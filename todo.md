# Ink Riot Asset OS — TODO

## Core Infrastructure
- [x] Database schema design (assets, bundles, mockups, social posts, email drafts, scan jobs)
- [x] Dark theme dashboard layout with sidebar navigation
- [x] Google Drive OAuth credentials stored as secrets
- [x] App-wide theming and design tokens

## 1. Google Drive Integration
- [x] Google Drive OAuth flow backend (getAuthUrl, callback, disconnect procedures)
- [x] Folder scanner: list files in artwork folder
- [x] Folder scanner: list files in mockup folder
- [x] Manual rescan trigger from Asset Catalog page
- [x] Import image metadata into asset catalog (name, size, type, drive URL, thumbnail)
- [x] Full OAuth connect UI (redirect user to Google consent, handle callback in browser)
- [x] Drive folder health validation (verify folder IDs are accessible)

## 2. AI-Powered Image Analysis
- [x] Multimodal LLM analysis endpoint (send image URL, receive structured tags)
- [x] Tag extraction: subject, genre, style, audience, room type, color palette, emotional vibe
- [x] Bulk analysis: process pending assets (up to 50 per batch)
- [x] Analysis status tracking per asset
- [x] Background bulk analysis (fire-and-forget async batches, up to 1000 assets)
- [ ] Persistent job queue with DB-backed status tracking (future enhancement)

## 3. Asset Catalog
- [x] Searchable asset catalog page with grid view
- [x] Filter by genre and analysis status
- [x] Asset detail view with all AI-generated tags
- [x] Manual tag editing
- [x] List view toggle
- [x] Extended filters (style, audience, room type, color palette)

## 4. Seamless 25-Piece Bundle Engine
- [x] Bundle grouping algorithm (visual DNA: color palette, line weight, lighting, genre)
- [x] Auto-generate named bundles via LLM
- [x] Commercial bundle type creation
- [x] End-user bundle creation flow
- [x] 25-piece target enforcement (soft: splits >30, merges <5, targets ~25 per bundle)

## 5. Bundle Dashboard
- [x] View all proposed and finalized bundles
- [x] Search and filter bundles by genre, status, type
- [x] Finalize/publish bundle action
- [x] Backend procedures for add/remove artworks
- [x] Bundle detail/edit UI to view contents and add/remove artworks

## 6. Commercial Bundle Packaging
- [x] Define 8 standard print sizes in packaging engine
- [ ] Generate actual multi-size artwork export files and upload to S3 (future: requires image processing)
- [x] Pair mockups with art per genre rules
- [x] Generate branded HTML guide with POD resource directory (LLM-generated content)
- [x] Convert to actual PDF format (pdfkit)
- [x] Inject affiliate links into PDF
- [x] Bundle packaging pipeline (HTML guide + affiliate links + size metadata)
- [ ] Create downloadable ZIP commercial kit with all assets (future: requires image processing first)
- [x] Store generated files in cloud storage (S3)

## 7. Mockup Pairing Engine
- [x] Genre-to-mockup style mapping rules (DB table + backend CRUD)
- [x] Settings UI for mockup rules management
- [x] Auto-select best mockup from mockup folder per artwork genre
- [x] Manual mockup override per bundle

## 8. Social Media Content Agent
- [x] Generate viral content ideas from bundle metadata
- [x] Generate static post concepts with captions and hashtags
- [x] Generate carousel concepts
- [x] Generate Reel script ideas
- [x] Platform targeting: Pinterest and Instagram

## 9. Social Media Planning Calendar
- [x] 30-day content calendar UI
- [x] Schedule posts per platform (Pinterest, Instagram)
- [x] Track post status (draft, scheduled, posted)
- [x] Edit scheduled content UI (captions, status, schedule date)

## 10. Admin Dashboard
- [x] Scan job monitor (running, completed, failed)
- [x] Catalog stats (total assets, analyzed, unanalyzed)
- [x] Bundle progress overview
- [x] Google Drive folder accessibility health check

## 11. Email Automation
- [x] Draft post-purchase email sequences per bundle
- [x] Draft promotional broadcast emails
- [x] Draft newsletter content for new bundle releases
- [x] Integration placeholder for CC Machine / GoHighLevel

## 12. Cloud File Storage
- [x] Upload generated HTML guide to S3
- [ ] Upload multi-size art exports to S3 (future: requires image processing)
- [ ] Upload mockup composites to S3 (future: requires image processing)
- [x] Download link on bundle detail page (dashboard-only, not buyer-facing)
- [x] Buyer-facing download delivery page (/download/:bundleId)

## Bug Fixes
- [x] Fix Google OAuth redirect_uri_mismatch — now passes window.location.origin from frontend
- [x] Allow user to edit artwork and mockup folder IDs directly in Settings UI (store in DB, not env vars)
- [x] Fix Google OAuth callback — moved /auth/google/callback outside DashboardLayout so it's a public route (Google redirects before session is established)
- [x] Fix Drive folder scan — broadened MIME type filter to include name-based matching, added Shared Drive support, added server logging
- [x] Verify folder ID save persists to DB and drive.status returns saved IDs (covered by new test)
- [x] Add test coverage for drive.updateFolderIds procedure (20 tests passing)
- [x] Fix AI analysis — now downloads images from Drive via authenticated API and uploads to S3 before sending to AI (thumbnailLink URLs are not publicly accessible)
- [x] Fix asset thumbnail previews — now using /api/drive-thumbnail proxy
- [x] Auto-refresh asset catalog while analysis job is running (polls every 4s, stops when job completes/fails)
- [x] Fix Drive thumbnail proxy — /api/drive-thumbnail/:fileId proxies images through server using stored OAuth token
- [x] Add manual "Reset All Analysis" button to Asset Catalog (with confirmation dialog, clears all analysis data + jobs)
- [x] Update skill files with all current fixes and architecture (May 2026)
