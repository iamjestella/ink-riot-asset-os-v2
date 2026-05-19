import type { Express } from "express";
import { sdk } from "./_core/sdk";
import { getDriveConnection, getDb } from "./db";
import { refreshAccessToken } from "./googleDrive";
import { driveConnections } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Proxy Google Drive thumbnails through the server using the user's stored OAuth token.
 * This is necessary because Drive thumbnailLink URLs require authentication.
 *
 * Usage: <img src="/api/drive-thumbnail/FILE_ID" />
 */
export function registerDriveProxy(app: Express) {
  app.get("/api/drive-thumbnail/:fileId", async (req, res) => {
    const { fileId } = req.params;
    console.log(`[DriveProxy] Request for fileId=${fileId}, cookie=${req.headers.cookie ? 'present' : 'MISSING'}`);

    if (!fileId) {
      res.status(400).send("Missing fileId");
      return;
    }

    try {
      // Authenticate the request (throws ForbiddenError if not authenticated)
      let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
      try {
        user = await sdk.authenticateRequest(req);
        console.log(`[DriveProxy] Authenticated as userId=${user.id}`);
      } catch (authErr) {
        console.warn(`[DriveProxy] Auth failed:`, authErr);
        res.status(401).send("Unauthorized");
        return;
      }

      // Get the user's Drive connection
      const connection = await getDriveConnection(user.id);
      console.log(`[DriveProxy] Drive connection: ${connection ? (connection.connected ? 'connected' : 'not connected') : 'NOT FOUND'}`);
      if (!connection || !connection.connected) {
        res.status(403).send("No Drive connection");
        return;
      }

      let accessToken = connection.accessToken;

      // Refresh token if expired
      if (connection.tokenExpiry && new Date(connection.tokenExpiry) < new Date()) {
        if (connection.refreshToken) {
          try {
            const refreshed = await refreshAccessToken(connection.refreshToken);
            accessToken = refreshed.access_token;
            // Update stored token
            const db = await getDb();
            if (db) await db.update(driveConnections)
              .set({
                accessToken: refreshed.access_token,
                tokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
              })
              .where(eq(driveConnections.userId, user.id));
          } catch {
            // Use existing token and hope for the best
          }
        }
      }

      // Fetch the thumbnail from Google Drive using the authenticated token
      // Use the thumbnail endpoint with size parameter
      const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=s400`;
      const driveResp = await fetch(thumbnailUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "follow",
      });
      console.log(`[DriveProxy] Drive fetch status=${driveResp.status} for ${fileId}`);

      if (!driveResp.ok) {
        // Fallback: try fetching a smaller thumbnail via Drive API metadata
        // then proxy that image through the server (not redirect, to avoid auth issues)
        const apiThumbUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink&supportsAllDrives=true`;
        const metaResp = await fetch(apiThumbUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (metaResp.ok) {
          const meta = await metaResp.json() as { thumbnailLink?: string };
          if (meta.thumbnailLink) {
            // Fetch the thumbnail with auth and proxy it
            const thumbResp = await fetch(meta.thumbnailLink, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (thumbResp.ok) {
              const ct = thumbResp.headers.get("content-type") || "image/jpeg";
              res.set("Content-Type", ct);
              res.set("Cache-Control", "private, max-age=3600");
              const buf = await thumbResp.arrayBuffer();
              res.send(Buffer.from(buf));
              return;
            }
          }
        }
        res.status(404).send("Thumbnail not found");
        return;
      }

      // Stream the image back to the client
      const contentType = driveResp.headers.get("content-type") || "image/jpeg";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "private, max-age=3600"); // Cache for 1 hour

      const buffer = await driveResp.arrayBuffer();
      res.send(Buffer.from(buffer));
      return;
    } catch (err) {
      console.error("[DriveProxy] failed:", err);
      res.status(502).send("Drive proxy error");
    }
  });
}
