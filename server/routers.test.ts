import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("admin.stats", () => {
  it("returns dashboard stats with correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.stats();

    // Should return an object with the expected numeric fields
    expect(result).toHaveProperty("totalAssets");
    expect(result).toHaveProperty("analyzedAssets");
    expect(result).toHaveProperty("pendingAssets");
    expect(result).toHaveProperty("totalBundles");
    expect(result).toHaveProperty("proposedBundles");
    expect(result).toHaveProperty("finalizedBundles");
    expect(result).toHaveProperty("totalPosts");
    expect(result).toHaveProperty("scheduledPosts");
    expect(typeof result.totalAssets).toBe("number");
    expect(typeof result.totalPosts).toBe("number");
  });
});

describe("dashboard.recentScans", () => {
  it("returns an array of recent scans", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.recentScans();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("drive.status", () => {
  it("returns drive connection status with folder IDs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.drive.status();

    expect(result).toHaveProperty("connected");
    expect(result).toHaveProperty("email");
    expect(result).toHaveProperty("artworkFolderId");
    expect(result).toHaveProperty("mockupFolderId");
    expect(typeof result.connected).toBe("boolean");
  });
});

describe("assets.list", () => {
  it("returns items array and total count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.assets.list({ limit: 10, offset: 0 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });
});

describe("bundles.list", () => {
  it("returns items array and total count", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.bundles.list({ limit: 10, offset: 0 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

describe("email.list", () => {
  it("returns a plain array of email drafts", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.email.list({});

    // email.list returns a plain array, NOT { items: [] }
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("drive.updateFolderIds", () => {
  it("saves folder IDs and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.drive.updateFolderIds({
      artworkFolderId: "test-artwork-folder-id",
      mockupFolderId: "test-mockup-folder-id",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("drive.status returns saved folder IDs after update", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const testArtworkId = `test-artwork-${Date.now()}`;
    await caller.drive.updateFolderIds({ artworkFolderId: testArtworkId });

    const status = await caller.drive.status();
    expect(status.artworkFolderId).toBe(testArtworkId);
  });
});
