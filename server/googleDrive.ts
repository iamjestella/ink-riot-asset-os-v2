import { ENV } from "./_core/env";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

/**
 * List all image files in a Google Drive folder (read-only).
 */
export async function listFolderFiles(
  accessToken: string,
  folderId: string,
  pageToken?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  // Accept all image types including PNG, JPEG, WEBP, GIF, TIFF, BMP, SVG
  // Also accept application/octet-stream in case Drive misidentifies file types
  const q = [
    `'${folderId}' in parents`,
    `trashed = false`,
    `(mimeType contains 'image/' or name contains '.png' or name contains '.jpg' or name contains '.jpeg' or name contains '.webp' or name contains '.tiff' or name contains '.tif')`,
  ].join(" and ");

  const params = new URLSearchParams({
    q,
    fields: "nextPageToken,files(id,name,mimeType,size,thumbnailLink,webViewLink,createdTime,modifiedTime)",
    pageSize: "100",
    orderBy: "modifiedTime desc",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Drive API error: ${error}`);
  }

  return response.json();
}

/**
 * Get a direct download URL for a file (for AI analysis).
 * Returns a temporary authenticated URL.
 */
export function getFileDownloadUrl(fileId: string): string {
  return `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`;
}

/**
 * Download file content as a buffer (for AI analysis).
 */
export async function downloadFileContent(accessToken: string, fileId: string): Promise<Buffer> {
  const response = await fetch(getFileDownloadUrl(fileId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file ${fileId}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get the Google OAuth authorization URL for Drive access.
 */
export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Get file thumbnail URL that can be used for display.
 * Google Drive thumbnails require authentication, so we use a proxy approach.
 */
export function getThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=s${size}`;
}

// ─── Router-facing wrappers ──────────────────────────────────────────────────

/**
 * Generate the Google OAuth URL for Drive authorization.
 * Used by the router's drive.getAuthUrl procedure.
 * The origin MUST come from the frontend (window.location.origin) to handle
 * both dev (localhost:3000) and production (*.manus.space) correctly.
 */
export function getGoogleDriveAuthUrl(userId: number, origin: string): string {
  const redirectUri = `${origin}/auth/google/callback`;
  return getGoogleAuthUrl(redirectUri, String(userId));
}

/**
 * Exchange an authorization code for tokens.
 * The origin MUST match the one used when generating the auth URL.
 */
export async function exchangeGoogleDriveCode(code: string, origin: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  email?: string;
}> {
  const redirectUri = `${origin}/auth/google/callback`;
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  // Optionally fetch the user's email from the userinfo endpoint
  let email: string | undefined;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (res.ok) {
      const info = await res.json();
      email = info.email;
    }
  } catch { /* non-critical */ }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
    email,
  };
}

/**
 * Scan a Google Drive folder and return all image files.
 * Handles pagination automatically.
 */
export async function scanGoogleDriveFolder(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const result = await listFolderFiles(accessToken, folderId, pageToken);
    allFiles.push(...result.files);
    pageToken = result.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Check if a Google Drive folder is accessible with the given token.
 * Returns folder name on success, throws on failure.
 */
export async function checkFolderAccess(accessToken: string, folderId: string): Promise<{ name: string; fileCount: number }> {
  // Get folder metadata
  const metaRes = await fetch(`${GOOGLE_DRIVE_API}/files/${folderId}?fields=name,mimeType`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const error = await metaRes.text();
    throw new Error(`Cannot access folder: ${error}`);
  }

  const meta = await metaRes.json();
  if (meta.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error(`The ID "${folderId}" is not a folder.`);
  }

  // Count image files in folder
  const countRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${folderId}' in parents and trashed = false and (mimeType contains 'image/')&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let fileCount = 0;
  if (countRes.ok) {
    const countData = await countRes.json();
    fileCount = countData.files?.length ?? 0;
  }

  return { name: meta.name, fileCount };
}
