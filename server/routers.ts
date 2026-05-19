import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getDashboardStats,
  getAssets,
  getAssetById,
  getPendingAnalysisAssets,
  setAssetAnalysisStatus,
  updateAssetAnalysis,
  upsertAsset,
  getBundles,
  getBundleById,
  createBundle,
  updateBundle,
  addAssetToBundle,
  getBundleAssets,
  removeAssetFromBundle,
  getSocialPosts,
  updateSocialPost,
  createSocialPosts,
  getEmailDrafts,
  updateEmailDraft,
  createEmailDrafts,
  updateAssetTags,
  getMockupPairings,
  updateMockupPairing,
  getAffiliateLinks,
  createAffiliateLink,
  deleteAffiliateLink,
  getMockupRules,
  createMockupRule,
  deleteMockupRule,
  getRecentScanJobs,
  createScanJob,
  updateScanJob,
  getAnalyzedArtworks,
  getMockups,
  saveDriveConnection,
  getDriveConnection,
  disconnectDrive,
  createAnalysisJob,
  getActiveAnalysisJob,
  getLatestAnalysisJob,
  updateAnalysisJob,
  getAnalysisJobHistory,
  getUserSettings,
  upsertUserSettings,
  getEffectiveFolderIds,
  resetAllAssets,
} from "./db";
import { scanGoogleDriveFolder, getGoogleDriveAuthUrl, exchangeGoogleDriveCode, checkFolderAccess, downloadFileContent } from "./googleDrive";
import { autoAssignMockups } from "./mockupEngine";
import { packageBundle } from "./packagingEngine";
import { analyzeArtwork } from "./aiAnalysis";
import { generateBundleProposals, generateEndUserBundleProposals } from "./bundleEngine";
import { generateSocialContent, generateEmailSequence } from "./socialAgent";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

/**
 * Background batch processor for AI analysis with persistent job tracking.
 * Creates a DB-backed job record and updates progress in real-time.
 */
async function processAnalysisJob(userId: number, jobId: number) {
  try {
    await updateAnalysisJob(jobId, { status: "running", startedAt: new Date() });
    let batchNum = 0;
    const maxBatches = 20;
    let totalProcessed = 0;
    let totalFailed = 0;

    while (batchNum < maxBatches) {
      const pending = await getPendingAnalysisAssets(userId, 50);
      if (pending.length === 0) break;

      for (const asset of pending) {
        try {
          await setAssetAnalysisStatus(asset.id, "analyzing");

          // Get the Drive connection to download the actual image
          const connection = await getDriveConnection(userId);
          let imageUrl = "";

          if (connection && asset.driveFileId) {
            try {
              // Download image from Drive and upload to S3 for authenticated AI access
              const imageBuffer = await downloadFileContent(connection.accessToken, asset.driveFileId);
              const mimeType = asset.mimeType || "image/jpeg";
              const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
              const s3Key = `artwork-analysis/${userId}/${asset.driveFileId}.${ext}`;
              const { url } = await storagePut(s3Key, imageBuffer, mimeType);
              imageUrl = url;
              console.log(`[Analysis] Uploaded ${asset.fileName} to S3: ${url}`);
            } catch (downloadErr) {
              // Fallback to thumbnail URL if download fails
              console.warn(`[Analysis] Failed to download ${asset.fileName} from Drive, using thumbnail fallback:`, downloadErr);
              imageUrl = asset.thumbnailUrl || asset.webViewLink || "";
            }
          } else {
            // No Drive connection — use thumbnail as fallback
            imageUrl = asset.thumbnailUrl || asset.webViewLink || "";
          }

          if (!imageUrl) {
            await setAssetAnalysisStatus(asset.id, "failed");
            totalFailed++;
          } else {
            const analysis = await analyzeArtwork(imageUrl, asset.fileName);
            await updateAssetAnalysis(asset.id, { ...analysis, aiAnalysisRaw: analysis });
            totalProcessed++;
          }
        } catch (err) {
          console.error(`[Analysis] Failed to analyze asset ${asset.id}:`, err);
          await setAssetAnalysisStatus(asset.id, "failed");
          totalFailed++;
        }
        // Update job progress after each asset
        await updateAnalysisJob(jobId, {
          processedAssets: totalProcessed,
          failedAssets: totalFailed,
        });
      }
      batchNum++;
    }

    await updateAnalysisJob(jobId, {
      status: "completed",
      processedAssets: totalProcessed,
      failedAssets: totalFailed,
      completedAt: new Date(),
    });
  } catch (err) {
    await updateAnalysisJob(jobId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      completedAt: new Date(),
    });
  }
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard / Admin ──────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
    recentScans: protectedProcedure.query(async ({ ctx }) => {
      return getRecentScanJobs(ctx.user.id);
    }),
  }),
  admin: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
  }),

  // ─── Google Drive ───────────────────────────────────────────────────────────
  drive: router({
    getAuthUrl: protectedProcedure
      .input(z.object({ origin: z.string() }))
      .query(async ({ ctx, input }) => {
        const url = getGoogleDriveAuthUrl(ctx.user.id, input.origin);
        return { url };
      }),
    callback: protectedProcedure
      .input(z.object({ code: z.string(), origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tokens = await exchangeGoogleDriveCode(input.code, input.origin);
        await saveDriveConnection(
          ctx.user.id,
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          tokens.email || null
        );
        return { success: true };
      }),
    status: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getDriveConnection(ctx.user.id);
      const folderIds = await getEffectiveFolderIds(ctx.user.id);
      return {
        connected: !!connection,
        email: connection?.email || null,
        artworkFolderId: folderIds.artworkFolderId,
        mockupFolderId: folderIds.mockupFolderId,
        lastScan: null,
      };
    }),
    connect: protectedProcedure.mutation(async ({ ctx }) => {
      const folderIds = await getEffectiveFolderIds(ctx.user.id);
      if (!folderIds.artworkFolderId && !folderIds.mockupFolderId) {
        throw new Error("No folder IDs configured. Please enter your Google Drive folder IDs in Settings.");
      }
      return { success: true, message: "Folder IDs configured" };
    }),
    updateFolderIds: protectedProcedure
      .input(z.object({
        artworkFolderId: z.string().optional(),
        mockupFolderId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertUserSettings(ctx.user.id, {
          artworkFolderId: input.artworkFolderId,
          mockupFolderId: input.mockupFolderId,
        });
        return { success: true };
      }),
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await disconnectDrive(ctx.user.id);
      return { success: true };
    }),
    checkFolder: protectedProcedure
      .input(z.object({ folderId: z.string().min(1), folderType: z.enum(["artwork", "mockup"]) }))
      .mutation(async ({ ctx, input }) => {
        const connection = await getDriveConnection(ctx.user.id);
        if (!connection) throw new Error("Google Drive not connected");
        try {
          const result = await checkFolderAccess(connection.accessToken, input.folderId);
          return { accessible: true, name: result.name, fileCount: result.fileCount };
        } catch (error: any) {
          return { accessible: false, name: null, fileCount: 0, error: error.message };
        }
      }),
    scan: protectedProcedure
      .input(z.object({ folderType: z.enum(["artwork", "mockup"]), folderId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const connection = await getDriveConnection(ctx.user.id);
        if (!connection) throw new Error("Google Drive not connected");

        const jobId = await createScanJob(ctx.user.id, input.folderType, input.folderId);
        if (!jobId) throw new Error("Failed to create scan job");

        // Run scan in background (non-blocking)
        (async () => {
          try {
            await updateScanJob(jobId, { status: "running", startedAt: new Date() });
            console.log(`[Drive Scan] Starting scan of folder ${input.folderId} (type: ${input.folderType})`);
            const files = await scanGoogleDriveFolder(connection.accessToken, input.folderId);
            console.log(`[Drive Scan] Found ${files.length} files in folder ${input.folderId}`);
            await updateScanJob(jobId, { totalFiles: files.length });

            let processed = 0;
            for (const file of files) {
              await upsertAsset({
                userId: ctx.user.id,
                driveFileId: file.id,
                fileName: file.name,
                mimeType: file.mimeType || null,
                fileSize: file.size ? parseInt(file.size) : null,
                thumbnailUrl: file.thumbnailLink || null,
                webViewLink: file.webViewLink || null,
                assetType: input.folderType,
              });
              processed++;
              if (processed % 10 === 0) {
                await updateScanJob(jobId, { processedFiles: processed });
              }
            }

            await updateScanJob(jobId, { status: "completed", processedFiles: processed, completedAt: new Date() });
          } catch (error: any) {
            await updateScanJob(jobId, { status: "failed", errorMessage: error.message, completedAt: new Date() });
          }
        })();

        return { jobId, message: "Scan started" };
      }),
  }),

  // ─── Assets / Catalog ───────────────────────────────────────────────────────
  assets: router({
    list: protectedProcedure
      .input(z.object({
        assetType: z.enum(["artwork", "mockup"]).optional(),
        genre: z.string().optional(),
        style: z.string().optional(),
        audience: z.string().optional(),
        roomType: z.string().optional(),
        colorPalette: z.string().optional(),
        analysisStatus: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getAssets(ctx.user.id, input, input?.limit, input?.offset);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getAssetById(input.id);
      }),
    analyze: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const asset = await getAssetById(input.assetId);
        if (!asset) throw new Error("Asset not found");

        await setAssetAnalysisStatus(input.assetId, "analyzing");

        try {
          let imageUrl = "";
          const connection = await getDriveConnection(ctx.user.id);

          if (connection && asset.driveFileId) {
            try {
              const imageBuffer = await downloadFileContent(connection.accessToken, asset.driveFileId);
              const mimeType = asset.mimeType || "image/jpeg";
              const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
              const s3Key = `artwork-analysis/${ctx.user.id}/${asset.driveFileId}.${ext}`;
              const { url } = await storagePut(s3Key, imageBuffer, mimeType);
              imageUrl = url;
            } catch {
              imageUrl = asset.thumbnailUrl || asset.webViewLink || "";
            }
          } else {
            imageUrl = asset.thumbnailUrl || asset.webViewLink || "";
          }

          if (!imageUrl) throw new Error("No image URL available for analysis");

          const analysis = await analyzeArtwork(imageUrl, asset.fileName);
          await updateAssetAnalysis(input.assetId, { ...analysis, aiAnalysisRaw: analysis });
          return { success: true, analysis };
        } catch (error: any) {
          await setAssetAnalysisStatus(input.assetId, "failed");
          throw new Error(`Analysis failed: ${error.message}`);
        }
      }),
    updateTags: protectedProcedure
      .input(z.object({
        id: z.number(),
        subject: z.string().optional(),
        genre: z.string().optional(),
        style: z.string().optional(),
        audience: z.string().optional(),
        roomType: z.string().optional(),
        emotionalVibe: z.string().optional(),
        lineWeight: z.string().optional(),
        lighting: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateAssetTags(id, data);
        return { success: true };
      }),
    analyzeAll: protectedProcedure.mutation(async ({ ctx }) => {
      // Check if there's already an active job
      const activeJob = await getActiveAnalysisJob(ctx.user.id);
      if (activeJob) {
        return { jobId: activeJob.id, message: "Analysis already in progress", alreadyRunning: true };
      }

      // Count pending assets
      const pending = await getPendingAnalysisAssets(ctx.user.id, 1000);
      if (pending.length === 0) {
        return { jobId: null, message: "No pending assets to analyze", alreadyRunning: false };
      }

      // Create persistent job record
      const { id: jobId } = await createAnalysisJob(ctx.user.id, pending.length);

      // Fire-and-forget: process in background with job tracking
      processAnalysisJob(ctx.user.id, jobId).catch(() => {});

      return { jobId, message: `Started analysis of ${pending.length} assets`, alreadyRunning: false };
    }),
    analysisJobStatus: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Return the specific job by ID (for polling progress)
        const jobs = await getAnalysisJobHistory(ctx.user.id);
        const job = jobs.find((j: any) => j.id === input.jobId);
        return job ?? null;
      }),
    analysisJobHistory: protectedProcedure.query(async ({ ctx }) => {
      return getAnalysisJobHistory(ctx.user.id);
    }),
    resetAll: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await resetAllAssets(ctx.user.id);
      return { success: true, message: `Reset ${count} assets to pending. All analysis jobs cleared.`, count };
    }),
  }),

  // ─── Bundles ────────────────────────────────────────────────────────────────
  bundles: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        bundleType: z.string().optional(),
        genre: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getBundles(ctx.user.id, input, input?.limit, input?.offset);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const bundle = await getBundleById(input.id);
        if (!bundle) throw new Error("Bundle not found");
        const bundleAssetsList = await getBundleAssets(input.id);
        return { ...bundle, assets: bundleAssetsList };
      }),
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      const artworks = await getAnalyzedArtworks(ctx.user.id);
      if (artworks.length < 5) {
        throw new Error("Need at least 5 analyzed artworks to generate bundle proposals.");
      }
      const proposals = await generateBundleProposals(artworks);
      const createdBundles: number[] = [];
      for (const proposal of proposals) {
        const bundleId = await createBundle({
          userId: ctx.user.id,
          name: proposal.name,
          description: proposal.description,
          bundleType: "commercial",
          genre: proposal.genre,
          targetAudience: proposal.targetAudience,
          artworkCount: proposal.assetIds.length,
        });
        if (bundleId) {
          createdBundles.push(bundleId);
          for (let i = 0; i < proposal.assetIds.length; i++) {
            await addAssetToBundle(bundleId, proposal.assetIds[i], i + 1);
          }
        }
      }
      return { created: createdBundles.length, bundleIds: createdBundles };
    }),
    finalize: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateBundle(input.id, { status: "finalized" });
        return { success: true };
      }),
    generateProposals: protectedProcedure.mutation(async ({ ctx }) => {
      const artworks = await getAnalyzedArtworks(ctx.user.id);
      if (artworks.length < 5) {
        throw new Error("Need at least 5 analyzed artworks to generate bundle proposals. Please scan and analyze your artwork first.");
      }

      const proposals = await generateBundleProposals(artworks);
      const createdBundles: number[] = [];

      for (const proposal of proposals) {
        const bundleId = await createBundle({
          userId: ctx.user.id,
          name: proposal.name,
          description: proposal.description,
          bundleType: "commercial",
          genre: proposal.genre,
          targetAudience: proposal.targetAudience,
          artworkCount: proposal.assetIds.length,
        });

        if (bundleId) {
          createdBundles.push(bundleId);
          for (let i = 0; i < proposal.assetIds.length; i++) {
            await addAssetToBundle(bundleId, proposal.assetIds[i], i + 1);
          }
        }
      }

      return { created: createdBundles.length, bundleIds: createdBundles };
    }),
    generateEndUser: protectedProcedure.mutation(async ({ ctx }) => {
      const artworks = await getAnalyzedArtworks(ctx.user.id);
      if (artworks.length < 3) {
        throw new Error("Need at least 3 analyzed artworks to generate end-user bundle proposals.");
      }

      const proposals = await generateEndUserBundleProposals(artworks);
      const createdBundles: number[] = [];

      for (const proposal of proposals) {
        const bundleId = await createBundle({
          userId: ctx.user.id,
          name: proposal.name,
          description: proposal.description,
          bundleType: "end_user",
          genre: proposal.genre,
          targetAudience: proposal.targetAudience,
          artworkCount: proposal.assetIds.length,
        });

        if (bundleId) {
          createdBundles.push(bundleId);
          for (let i = 0; i < proposal.assetIds.length; i++) {
            await addAssetToBundle(bundleId, proposal.assetIds[i], i + 1);
          }
        }
      }

      return { created: createdBundles.length, bundleIds: createdBundles };
    }),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["proposed", "draft", "finalized", "published"]) }))
      .mutation(async ({ input }) => {
        await updateBundle(input.id, { status: input.status });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBundle(id, data);
        return { success: true };
      }),
    addAsset: protectedProcedure
      .input(z.object({ bundleId: z.number(), assetId: z.number(), position: z.number() }))
      .mutation(async ({ input }) => {
        await addAssetToBundle(input.bundleId, input.assetId, input.position);
        return { success: true };
      }),
    removeAsset: protectedProcedure
      .input(z.object({ bundleId: z.number(), assetId: z.number() }))
      .mutation(async ({ input }) => {
        await removeAssetFromBundle(input.bundleId, input.assetId);
        return { success: true };
      }),
    assignMockups: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const results = await autoAssignMockups(ctx.user.id, input.bundleId);
        return { pairings: results };
      }),
    getPublicBundle: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const bundle = await getBundleById(input.id);
        if (!bundle || (bundle.status !== "published" && bundle.status !== "finalized")) return null;
        return {
          id: bundle.id,
          name: bundle.name,
          description: bundle.description,
          genre: bundle.genre,
          artworkCount: bundle.artworkCount,
          pdfUrl: bundle.pdfUrl,
          bundleType: bundle.bundleType,
        };
      }),
    getMockupPairings: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .query(async ({ input }) => {
        return getMockupPairings(input.bundleId);
      }),
    overrideMockup: protectedProcedure
      .input(z.object({ bundleId: z.number(), artworkAssetId: z.number(), newMockupAssetId: z.number() }))
      .mutation(async ({ input }) => {
        await updateMockupPairing(input.bundleId, input.artworkAssetId, input.newMockupAssetId);
        return { success: true };
      }),
    package: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await packageBundle(ctx.user.id, input.bundleId);
        return result;
      }),
  }),

  // ─── Social Media ───────────────────────────────────────────────────────────
  social: router({
    list: protectedProcedure
      .input(z.object({
        bundleId: z.number().optional(),
        platform: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getSocialPosts(ctx.user.id, input, input?.limit, input?.offset);
      }),
    generate: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await getBundleById(input.bundleId);
        if (!bundle) throw new Error("Bundle not found");

        const posts = await generateSocialContent({
          name: bundle.name,
          description: bundle.description || "",
          genre: bundle.genre || "Art",
          targetAudience: bundle.targetAudience || "Art lovers",
          artworkCount: bundle.artworkCount ?? 25,
        });

        await createSocialPosts(
          posts.map((p) => ({
            userId: ctx.user.id,
            bundleId: input.bundleId,
            platform: p.platform,
            postType: p.postType,
            caption: p.caption,
            hashtags: p.hashtags,
            hookLine: p.hookLine,
            reelScript: p.reelScript || undefined,
            calendarDay: p.calendarDay,
          }))
        );

        return { created: posts.length };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        caption: z.string().optional(),
        hashtags: z.string().optional(),
        hookLine: z.string().optional(),
        status: z.enum(["draft", "scheduled", "posted"]).optional(),
        scheduledFor: z.date().optional(),
        calendarDay: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSocialPost(id, data);
        return { success: true };
      }),
  }),

  // ─── Email ──────────────────────────────────────────────────────────────────
  email: router({
    list: protectedProcedure
      .input(z.object({
        bundleId: z.number().optional(),
        emailType: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getEmailDrafts(ctx.user.id, input);
      }),
    generate: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await getBundleById(input.bundleId);
        if (!bundle) throw new Error("Bundle not found");

        const emails = await generateEmailSequence({
          name: bundle.name,
          description: bundle.description || "",
          genre: bundle.genre || "Art",
          targetAudience: bundle.targetAudience || "Art lovers",
          artworkCount: bundle.artworkCount ?? 25,
        });

        await createEmailDrafts(
          emails.map((e) => ({
            userId: ctx.user.id,
            bundleId: input.bundleId,
            emailType: e.emailType,
            subject: e.subject,
            body: e.body,
            sequenceOrder: e.sequenceOrder,
          }))
        );

        return { created: emails.length };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        subject: z.string().optional(),
        body: z.string().optional(),
        status: z.enum(["draft", "approved", "sent"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateEmailDraft(id, data);
        return { success: true };
      }),
    exportToGHL: protectedProcedure
      .input(z.object({ bundleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Placeholder for GoHighLevel / CC Machine integration
        // In a future version, this will push approved email drafts to GHL workflows
        const emails = await getEmailDrafts(ctx.user.id, { bundleId: input.bundleId, status: "approved" });
        if (emails.length === 0) {
          throw new Error("No approved emails to export. Please approve email drafts first.");
        }
        return {
          success: true,
          message: `GHL export ready: ${emails.length} approved emails prepared for GoHighLevel integration. This feature will be fully connected in a future update.`,
          emailCount: emails.length,
          placeholder: true,
        };
      }),
  }),

  // ─── Settings ───────────────────────────────────────────────────────────────
  settings: router({
    affiliateLinks: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        return getAffiliateLinks(ctx.user.id);
      }),
      create: protectedProcedure
        .input(z.object({ serviceName: z.string(), url: z.string().url(), description: z.string().optional(), category: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
          await createAffiliateLink({ userId: ctx.user.id, ...input });
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteAffiliateLink(input.id);
          return { success: true };
        }),
    }),
    mockupRules: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        return getMockupRules(ctx.user.id);
      }),
      create: protectedProcedure
        .input(z.object({ genre: z.string(), mockupStyle: z.string(), description: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
          await createMockupRule({ userId: ctx.user.id, ...input });
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteMockupRule(input.id);
          return { success: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
