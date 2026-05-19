import { eq, and, desc, sql, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  assets,
  bundles,
  bundleAssets,
  scanJobs,
  socialPosts,
  emailDrafts,
  affiliateLinks,
  mockupRules,
  mockupPairings,
  driveConnections,
  analysisJobs,
  userSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Queries ───────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Drive Connection Queries ───────────────────────────────────────────────

export async function saveDriveConnection(userId: number, accessToken: string, refreshToken: string | null, tokenExpiry: Date | null, email: string | null) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(driveConnections).where(eq(driveConnections.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(driveConnections).set({ accessToken, refreshToken, tokenExpiry, email, connected: true }).where(eq(driveConnections.userId, userId));
  } else {
    await db.insert(driveConnections).values({ userId, accessToken, refreshToken, tokenExpiry, email, connected: true });
  }
}

export async function getDriveConnection(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(driveConnections).where(and(eq(driveConnections.userId, userId), eq(driveConnections.connected, true))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateDriveToken(userId: number, accessToken: string, tokenExpiry: Date | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(driveConnections).set({ accessToken, tokenExpiry }).where(eq(driveConnections.userId, userId));
}

export async function disconnectDrive(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(driveConnections).set({ connected: false }).where(eq(driveConnections.userId, userId));
}

// ─── Scan Job Queries ───────────────────────────────────────────────────────

export async function createScanJob(userId: number, folderType: "artwork" | "mockup", folderId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(scanJobs).values({ userId, folderType, folderId, status: "pending" });
  return result[0].insertId;
}

export async function updateScanJob(id: number, data: Partial<{ status: "pending" | "running" | "completed" | "failed"; totalFiles: number; processedFiles: number; errorMessage: string; startedAt: Date; completedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanJobs).set(data).where(eq(scanJobs.id, id));
}

export async function getRecentScanJobs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanJobs).where(eq(scanJobs.userId, userId)).orderBy(desc(scanJobs.createdAt)).limit(limit);
}

// ─── Asset Queries ──────────────────────────────────────────────────────────

export async function upsertAsset(data: { userId: number; driveFileId: string; fileName: string; mimeType: string | null; fileSize: number | null; thumbnailUrl: string | null; webViewLink: string | null; assetType: "artwork" | "mockup" }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(assets).values(data).onDuplicateKeyUpdate({
    set: { fileName: data.fileName, mimeType: data.mimeType, fileSize: data.fileSize, thumbnailUrl: data.thumbnailUrl, webViewLink: data.webViewLink },
  });
}

export async function getAssets(userId: number, filters?: { assetType?: "artwork" | "mockup"; genre?: string; style?: string; audience?: string; roomType?: string; analysisStatus?: string; search?: string }, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(assets.userId, userId)];
  if (filters?.assetType) conditions.push(eq(assets.assetType, filters.assetType));
  if (filters?.genre) conditions.push(eq(assets.genre, filters.genre));
  if (filters?.style) conditions.push(eq(assets.style, filters.style));
  if (filters?.audience) conditions.push(eq(assets.audience, filters.audience));
  if (filters?.roomType) conditions.push(eq(assets.roomType, filters.roomType));
  if (filters?.analysisStatus) conditions.push(eq(assets.analysisStatus, filters.analysisStatus as any));
  if (filters?.search) conditions.push(or(like(assets.fileName, `%${filters.search}%`), like(assets.subject, `%${filters.search}%`))!);

  const where = and(...conditions);
  const items = await db.select().from(assets).where(where).orderBy(desc(assets.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(assets).where(where);
  const total = countResult[0]?.count ?? 0;

  return { items, total };
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateAssetAnalysis(id: number, analysis: { subject: string; genre: string; style: string; audience: string; roomType: string; colorPalette: string[]; emotionalVibe: string; lineWeight: string; lighting: string; tags: string[]; aiAnalysisRaw: any }) {
  const db = await getDb();
  if (!db) return;
  await db.update(assets).set({ ...analysis, analysisStatus: "completed", analyzedAt: new Date() }).where(eq(assets.id, id));
}

export async function setAssetAnalysisStatus(id: number, status: "pending" | "analyzing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) return;
  await db.update(assets).set({ analysisStatus: status }).where(eq(assets.id, id));
}

export async function updateAssetTags(id: number, data: Partial<{ subject: string; genre: string; style: string; audience: string; roomType: string; emotionalVibe: string; lineWeight: string; lighting: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(assets).set(data).where(eq(assets.id, id));
}

export async function getPendingAnalysisAssets(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(and(eq(assets.userId, userId), eq(assets.analysisStatus, "pending"), eq(assets.assetType, "artwork"))).limit(limit);
}

export async function getAssetsByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  return db.select().from(assets).where(inArray(assets.id, ids));
}

export async function getAnalyzedArtworks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(and(eq(assets.userId, userId), eq(assets.analysisStatus, "completed"), eq(assets.assetType, "artwork")));
}

export async function getMockups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(and(eq(assets.userId, userId), eq(assets.assetType, "mockup")));
}

// ─── Bundle Queries ─────────────────────────────────────────────────────────

export async function createBundle(data: { userId: number; name: string; description?: string; bundleType: "end_user" | "commercial"; genre?: string; targetAudience?: string; artworkCount: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(bundles).values({ ...data, status: "proposed" });
  return result[0].insertId;
}

export async function getBundles(userId: number, filters?: { status?: string; bundleType?: string; genre?: string }, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(bundles.userId, userId)];
  if (filters?.status) conditions.push(eq(bundles.status, filters.status as any));
  if (filters?.bundleType) conditions.push(eq(bundles.bundleType, filters.bundleType as any));
  if (filters?.genre) conditions.push(eq(bundles.genre, filters.genre));

  const where = and(...conditions);
  const items = await db.select().from(bundles).where(where).orderBy(desc(bundles.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(bundles).where(where);
  const total = countResult[0]?.count ?? 0;

  return { items, total };
}

export async function getBundleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateBundle(id: number, data: Partial<{ name: string; description: string; status: "proposed" | "draft" | "finalized" | "published"; pdfUrl: string; zipUrl: string; packagedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundles).set(data).where(eq(bundles.id, id));
}

export async function addAssetToBundle(bundleId: number, assetId: number, position: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(bundleAssets).values({ bundleId, assetId, position });
}

export async function getBundleAssets(bundleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleAssets).where(eq(bundleAssets.bundleId, bundleId)).orderBy(bundleAssets.position);
}

export async function removeAssetFromBundle(bundleId: number, assetId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(bundleAssets).where(and(eq(bundleAssets.bundleId, bundleId), eq(bundleAssets.assetId, assetId)));
}

// ─── Social Post Queries ────────────────────────────────────────────────────

export async function createSocialPosts(posts: Array<{ userId: number; bundleId: number | null; platform: "instagram" | "pinterest"; postType: "static" | "carousel" | "reel"; caption: string; hashtags: string; hookLine: string; reelScript?: string; calendarDay?: number }>) {
  const db = await getDb();
  if (!db) return;
  if (posts.length === 0) return;
  await db.insert(socialPosts).values(posts.map(p => ({ ...p, status: "draft" as const })));
}

export async function getSocialPosts(userId: number, filters?: { bundleId?: number; platform?: string; status?: string }, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(socialPosts.userId, userId)];
  if (filters?.bundleId) conditions.push(eq(socialPosts.bundleId, filters.bundleId));
  if (filters?.platform) conditions.push(eq(socialPosts.platform, filters.platform as any));
  if (filters?.status) conditions.push(eq(socialPosts.status, filters.status as any));

  const where = and(...conditions);
  const items = await db.select().from(socialPosts).where(where).orderBy(desc(socialPosts.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(socialPosts).where(where);
  const total = countResult[0]?.count ?? 0;

  return { items, total };
}

export async function updateSocialPost(id: number, data: Partial<{ caption: string; hashtags: string; hookLine: string; status: "draft" | "scheduled" | "posted"; scheduledFor: Date; calendarDay: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(socialPosts).set(data).where(eq(socialPosts.id, id));
}

// ─── Email Draft Queries ────────────────────────────────────────────────────

export async function createEmailDrafts(drafts: Array<{ userId: number; bundleId: number | null; emailType: "post_purchase" | "promotional" | "newsletter"; subject: string; body: string; sequenceOrder: number }>) {
  const db = await getDb();
  if (!db) return;
  if (drafts.length === 0) return;
  await db.insert(emailDrafts).values(drafts.map(d => ({ ...d, status: "draft" as const })));
}

export async function getEmailDrafts(userId: number, filters?: { bundleId?: number; emailType?: string; status?: string }, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(emailDrafts.userId, userId)];
  if (filters?.bundleId) conditions.push(eq(emailDrafts.bundleId, filters.bundleId));
  if (filters?.emailType) conditions.push(eq(emailDrafts.emailType, filters.emailType as any));
  if (filters?.status) conditions.push(eq(emailDrafts.status, filters.status as any));

  return db.select().from(emailDrafts).where(and(...conditions)).orderBy(emailDrafts.sequenceOrder).limit(limit);
}

export async function updateEmailDraft(id: number, data: Partial<{ subject: string; body: string; status: "draft" | "approved" | "sent" }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(emailDrafts).set(data).where(eq(emailDrafts.id, id));
}

// ─── Affiliate Link Queries ─────────────────────────────────────────────────

export async function getAffiliateLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliateLinks).where(eq(affiliateLinks.userId, userId)).orderBy(affiliateLinks.serviceName);
}

export async function createAffiliateLink(data: { userId: number; serviceName: string; url: string; description?: string; category?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(affiliateLinks).values(data);
}

export async function deleteAffiliateLink(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(affiliateLinks).where(eq(affiliateLinks.id, id));
}

// ─── Mockup Rules Queries ───────────────────────────────────────────────────

export async function getMockupRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mockupRules).where(eq(mockupRules.userId, userId));
}

export async function createMockupRule(data: { userId: number; genre: string; mockupStyle: string; description?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mockupRules).values(data);
}

export async function deleteMockupRule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mockupRules).where(eq(mockupRules.id, id));
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalAssets: 0, analyzedAssets: 0, pendingAssets: 0, totalBundles: 0, proposedBundles: 0, finalizedBundles: 0, totalPosts: 0, scheduledPosts: 0 };

  const [assetStats] = await db.select({
    total: sql<number>`count(*)`,
    analyzed: sql<number>`sum(case when analysisStatus = 'completed' then 1 else 0 end)`,
    pending: sql<number>`sum(case when analysisStatus = 'pending' then 1 else 0 end)`,
  }).from(assets).where(eq(assets.userId, userId));

  const [bundleStats] = await db.select({
    total: sql<number>`count(*)`,
    proposed: sql<number>`sum(case when status = 'proposed' then 1 else 0 end)`,
    finalized: sql<number>`sum(case when status = 'finalized' then 1 else 0 end)`,
  }).from(bundles).where(eq(bundles.userId, userId));

  const [postStats] = await db.select({
    total: sql<number>`count(*)`,
    scheduled: sql<number>`sum(case when status = 'scheduled' then 1 else 0 end)`,
  }).from(socialPosts).where(eq(socialPosts.userId, userId));

  return {
    totalAssets: assetStats?.total ?? 0,
    analyzedAssets: assetStats?.analyzed ?? 0,
    pendingAssets: assetStats?.pending ?? 0,
    totalBundles: bundleStats?.total ?? 0,
    proposedBundles: bundleStats?.proposed ?? 0,
    finalizedBundles: bundleStats?.finalized ?? 0,
    totalPosts: postStats?.total ?? 0,
    scheduledPosts: postStats?.scheduled ?? 0,
  };
}

// ─── Mockup Pairing Queries ────────────────────────────────────────────────

export async function createMockupPairing(data: { bundleId: number; artworkAssetId: number; mockupAssetId: number; compositeUrl?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mockupPairings).values(data);
}

export async function getMockupPairings(bundleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mockupPairings).where(eq(mockupPairings.bundleId, bundleId));
}

export async function deleteMockupPairings(bundleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mockupPairings).where(eq(mockupPairings.bundleId, bundleId));
}

export async function getMockupPairingsByArtwork(bundleId: number, artworkAssetId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(mockupPairings).where(and(eq(mockupPairings.bundleId, bundleId), eq(mockupPairings.artworkAssetId, artworkAssetId))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateMockupPairing(bundleId: number, artworkAssetId: number, newMockupAssetId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(mockupPairings)
    .set({ mockupAssetId: newMockupAssetId })
    .where(and(eq(mockupPairings.bundleId, bundleId), eq(mockupPairings.artworkAssetId, artworkAssetId)));
}

// ─── Analysis Jobs ────────────────────────────────────────────────────────────

export async function createAnalysisJob(userId: number, totalAssets: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analysisJobs).values({
    userId,
    totalAssets,
    status: "queued",
  });
  return { id: Number(result[0].insertId) };
}

export async function getAnalysisJob(jobId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).limit(1);
  return rows[0] || null;
}

export async function getLatestAnalysisJob(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(analysisJobs)
    .where(eq(analysisJobs.userId, userId))
    .orderBy(desc(analysisJobs.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function getActiveAnalysisJob(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(analysisJobs)
    .where(and(
      eq(analysisJobs.userId, userId),
      inArray(analysisJobs.status, ["queued", "running"])
    ))
    .orderBy(desc(analysisJobs.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function updateAnalysisJob(jobId: number, data: Partial<{
  status: "queued" | "running" | "completed" | "failed";
  processedAssets: number;
  failedAssets: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(analysisJobs).set(data).where(eq(analysisJobs.id, jobId));
}

export async function getAnalysisJobHistory(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analysisJobs)
    .where(eq(analysisJobs.userId, userId))
    .orderBy(desc(analysisJobs.createdAt))
    .limit(limit);
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0] || null;
}

export async function upsertUserSettings(userId: number, data: {
  artworkFolderId?: string;
  mockupFolderId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserSettings(userId);
  if (existing) {
    await db.update(userSettings).set(data).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({ userId, ...data });
  }
}

/**
 * Get the effective folder IDs for a user.
 * DB settings take priority over environment variables.
 */
export async function getEffectiveFolderIds(userId: number) {
  const settings = await getUserSettings(userId);
  return {
    artworkFolderId: settings?.artworkFolderId || process.env.GOOGLE_ARTWORK_FOLDER_ID || "",
    mockupFolderId: settings?.mockupFolderId || process.env.GOOGLE_MOCKUP_FOLDER_ID || "",
  };
}

/**
 * Reset all assets back to pending status, clearing all AI analysis data.
 * Also clears all analysis jobs for the user.
 */
export async function resetAllAssets(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  await db.update(assets)
    .set({
      analysisStatus: "pending",
      genre: null,
      style: null,
      audience: null,
      roomType: null,
      colorPalette: null,
      tags: null,
      subject: null,
      emotionalVibe: null,
      lineWeight: null,
      lighting: null,
      aiAnalysisRaw: null,
      analyzedAt: null,
    })
    .where(eq(assets.userId, userId));
  await db.delete(analysisJobs).where(eq(analysisJobs.userId, userId));
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.userId, userId));
  return countResult[0]?.count ?? 0;
}
