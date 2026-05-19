import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Google Drive connection state (OAuth tokens for Drive access).
 */
export const driveConnections = mysqlTable("driveConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiry: timestamp("tokenExpiry"),
  email: varchar("email", { length: 320 }),
  connected: boolean("connected").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Scan jobs track each folder scan operation.
 */
export const scanJobs = mysqlTable("scanJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  folderType: mysqlEnum("folderType", ["artwork", "mockup"]).notNull(),
  folderId: varchar("folderId", { length: 256 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  totalFiles: int("totalFiles").default(0),
  processedFiles: int("processedFiles").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Assets represent individual artwork or mockup files from Google Drive.
 */
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  driveFileId: varchar("driveFileId", { length: 256 }).notNull().unique(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  thumbnailUrl: text("thumbnailUrl"),
  webViewLink: text("webViewLink"),
  assetType: mysqlEnum("assetType", ["artwork", "mockup"]).notNull(),
  // AI analysis fields
  analysisStatus: mysqlEnum("analysisStatus", ["pending", "analyzing", "completed", "failed"]).default("pending").notNull(),
  subject: varchar("subject", { length: 256 }),
  genre: varchar("genre", { length: 128 }),
  style: varchar("style", { length: 128 }),
  audience: varchar("audience", { length: 128 }),
  roomType: varchar("roomType", { length: 128 }),
  colorPalette: json("colorPalette"),
  emotionalVibe: varchar("emotionalVibe", { length: 256 }),
  lineWeight: varchar("lineWeight", { length: 64 }),
  lighting: varchar("lighting", { length: 128 }),
  tags: json("tags"),
  aiAnalysisRaw: json("aiAnalysisRaw"),
  analyzedAt: timestamp("analyzedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Bundles represent curated groups of 25 artworks.
 */
export const bundles = mysqlTable("bundles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  bundleType: mysqlEnum("bundleType", ["end_user", "commercial"]).default("commercial").notNull(),
  status: mysqlEnum("status", ["proposed", "draft", "finalized", "published"]).default("proposed").notNull(),
  genre: varchar("genre", { length: 128 }),
  targetAudience: varchar("targetAudience", { length: 256 }),
  price: int("price").default(2700), // cents, $27.00
  artworkCount: int("artworkCount").default(0),
  // Packaging output references
  pdfUrl: text("pdfUrl"),
  zipUrl: text("zipUrl"),
  packagedAt: timestamp("packagedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Junction table: which assets belong to which bundle.
 */
export const bundleAssets = mysqlTable("bundleAssets", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundleId").notNull(),
  assetId: int("assetId").notNull(),
  position: int("position").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Mockup pairings: which mockup is paired with which artwork in a bundle.
 */
export const mockupPairings = mysqlTable("mockupPairings", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundleId").notNull(),
  artworkAssetId: int("artworkAssetId").notNull(),
  mockupAssetId: int("mockupAssetId").notNull(),
  compositeUrl: text("compositeUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Social media content generated by the AI agent.
 */
export const socialPosts = mysqlTable("socialPosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bundleId: int("bundleId"),
  platform: mysqlEnum("platform", ["instagram", "pinterest"]).notNull(),
  postType: mysqlEnum("postType", ["static", "carousel", "reel"]).notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  hookLine: varchar("hookLine", { length: 512 }),
  reelScript: text("reelScript"),
  imageUrls: json("imageUrls"),
  status: mysqlEnum("status", ["draft", "scheduled", "posted"]).default("draft").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  postedAt: timestamp("postedAt"),
  calendarDay: int("calendarDay"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Email drafts generated for bundle marketing.
 */
export const emailDrafts = mysqlTable("emailDrafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bundleId: int("bundleId"),
  emailType: mysqlEnum("emailType", ["post_purchase", "promotional", "newsletter"]).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "sent"]).default("draft").notNull(),
  sequenceOrder: int("sequenceOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Affiliate links for injection into PDFs and emails.
 */
export const affiliateLinks = mysqlTable("affiliateLinks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceName: varchar("serviceName", { length: 256 }).notNull(),
  url: text("url").notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Genre-to-mockup style mapping rules.
 */
export const mockupRules = mysqlTable("mockupRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  genre: varchar("genre", { length: 128 }).notNull(),
  mockupStyle: varchar("mockupStyle", { length: 256 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Persistent analysis job queue.
 * Tracks bulk analysis runs with progress, so the UI can show real-time status.
 */
export const analysisJobs = mysqlTable("analysisJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
  totalAssets: int("totalAssets").default(0).notNull(),
  processedAssets: int("processedAssets").default(0).notNull(),
  failedAssets: int("failedAssets").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * User-configurable settings stored in DB (overrides env vars).
 * Allows users to update folder IDs and other config from the UI.
 */
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  artworkFolderId: varchar("artworkFolderId", { length: 256 }),
  mockupFolderId: varchar("mockupFolderId", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
