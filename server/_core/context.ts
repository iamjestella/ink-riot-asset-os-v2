import { COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { jwtVerify } from "jose";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";").map(cookie => cookie.trim());
  const target = `${name}=`;
  const match = cookies.find(cookie => cookie.startsWith(target));

  if (!match) return undefined;
  return decodeURIComponent(match.slice(target.length));
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error("JWT_SECRET is missing");
  }
  return new TextEncoder().encode(secret.trim());
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const token = getCookieValue(opts.req.headers.cookie, COOKIE_NAME);

    if (token) {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const openId = typeof payload.openId === "string" ? payload.openId : null;

      if (openId) {
        user = (await db.getUserByOpenId(openId)) ?? null;
      }
    }
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
