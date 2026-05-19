import { describe, expect, it } from "vitest";

describe("Google Drive secrets", () => {
  it("GOOGLE_CLIENT_ID is set and has correct format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId!.length).toBeGreaterThan(10);
    expect(clientId).toContain(".apps.googleusercontent.com");
  });

  it("GOOGLE_CLIENT_SECRET is set", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeDefined();
    expect(clientSecret!.length).toBeGreaterThan(5);
  });

  it("GOOGLE_ARTWORK_FOLDER_ID is set", () => {
    const folderId = process.env.GOOGLE_ARTWORK_FOLDER_ID;
    expect(folderId).toBeDefined();
    expect(folderId!.length).toBeGreaterThan(10);
  });

  it("GOOGLE_MOCKUP_FOLDER_ID is set", () => {
    const folderId = process.env.GOOGLE_MOCKUP_FOLDER_ID;
    expect(folderId).toBeDefined();
    expect(folderId!.length).toBeGreaterThan(10);
  });
});
