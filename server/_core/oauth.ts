import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";

type GoogleUserInfo = {
  sub: string;
  name?: string;
  email?: string;
};

function getEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`${name} is missing`);
  }

  return value.trim();
}

function getRedirectUri() {
  return getEnv("GOOGLE_REDIRECT_URI");
}

async function createSessionToken(user: { openId: string; name: string }) {
  const secret = new TextEncoder().encode(getEnv("JWT_SECRET"));

  return new SignJWT({
    openId: user.openId,
    appId: process.env.VITE_APP_ID || "ink-riot-asset-os",
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secret);
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/login/google", (_req: Request, res: Response) => {
    try {
      const params = new URLSearchParams({
        client_id: getEnv("GOOGLE_CLIENT_ID"),
        redirect_uri: getRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "consent",
      });

      res.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
      );
    } catch (error) {
      console.error("[OAuth] Login start failed:", error);
      res.status(500).json({ error: "Google login setup failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;

    if (!code) {
      res.status(400).json({ error: "Google OAuth code is missing" });
      return;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: getEnv("GOOGLE_CLIENT_ID"),
          client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
          redirect_uri: getRedirectUri(),
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const details = await tokenResponse.text();
        console.error("[OAuth] Google token exchange failed:", details);

        res.status(500).json({
          error: "Google token exchange failed",
          details,
        });
        return;
      }

      const tokens = await tokenResponse.json();

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (!userInfoResponse.ok) {
        const details = await userInfoResponse.text();
        console.error("[OAuth] Google user info failed:", details);

        res.status(500).json({
          error: "Google user info request failed",
          details,
        });
        return;
      }

      const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

      if (!userInfo.sub) {
        res.status(500).json({ error: "Google user ID missing" });
        return;
      }

      const openId = `google:${userInfo.sub}`;
      const name = userInfo.name || userInfo.email || "Google User";
      const email = userInfo.email || null;

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await createSessionToken({ openId, name });

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      res.redirect("/");
    } catch (error) {
      console.error("[OAuth] Callback failed:", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.post("/api/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(200).json({ ok: true });
  });
}
