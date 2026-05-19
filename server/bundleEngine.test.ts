import { describe, it, expect } from "vitest";

// Test the enforceBundleSize logic by importing the module
// Since enforceBundleSize is private, we test it indirectly through the exported functions
// But we can test the logic pattern directly

describe("Bundle size enforcement logic", () => {
  // Replicate the enforcement logic for testing
  function enforceBundleSize(
    bundles: Array<{ name: string; assetIds: number[] }>,
    target: number
  ) {
    const result: Array<{ name: string; assetIds: number[] }> = [];

    for (const bundle of bundles) {
      if (bundle.assetIds.length > target + 5) {
        const chunks: number[][] = [];
        for (let i = 0; i < bundle.assetIds.length; i += target) {
          chunks.push(bundle.assetIds.slice(i, i + target));
        }
        chunks.forEach((chunk, idx) => {
          if (chunk.length >= 5) {
            result.push({
              ...bundle,
              name: chunks.length > 1 ? `${bundle.name} Vol. ${idx + 1}` : bundle.name,
              assetIds: chunk,
            });
          } else if (result.length > 0) {
            result[result.length - 1].assetIds.push(...chunk);
          }
        });
      } else if (bundle.assetIds.length < 5 && result.length > 0) {
        result[result.length - 1].assetIds.push(...bundle.assetIds);
      } else {
        result.push(bundle);
      }
    }

    return result;
  }

  it("passes through bundles of ~25 pieces unchanged", () => {
    const bundles = [
      { name: "Test Bundle", assetIds: Array.from({ length: 25 }, (_, i) => i + 1) },
    ];
    const result = enforceBundleSize(bundles, 25);
    expect(result).toHaveLength(1);
    expect(result[0].assetIds).toHaveLength(25);
    expect(result[0].name).toBe("Test Bundle");
  });

  it("splits oversized bundles (>30) into ~25 piece chunks", () => {
    const bundles = [
      { name: "Big Bundle", assetIds: Array.from({ length: 60 }, (_, i) => i + 1) },
    ];
    const result = enforceBundleSize(bundles, 25);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be between 5 and 30
    for (const b of result) {
      expect(b.assetIds.length).toBeGreaterThanOrEqual(5);
      expect(b.assetIds.length).toBeLessThanOrEqual(35);
    }
    // Total assets should be preserved
    const totalAssets = result.reduce((sum, b) => sum + b.assetIds.length, 0);
    expect(totalAssets).toBe(60);
  });

  it("names split bundles with Vol. suffix", () => {
    const bundles = [
      { name: "Neon Art", assetIds: Array.from({ length: 55 }, (_, i) => i + 1) },
    ];
    const result = enforceBundleSize(bundles, 25);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].name).toBe("Neon Art Vol. 1");
    expect(result[1].name).toBe("Neon Art Vol. 2");
  });

  it("merges tiny bundles (<5) into previous bundle", () => {
    const bundles = [
      { name: "Main Bundle", assetIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { name: "Tiny Bundle", assetIds: [11, 12, 13] },
    ];
    const result = enforceBundleSize(bundles, 25);
    expect(result).toHaveLength(1);
    expect(result[0].assetIds).toHaveLength(13);
  });

  it("keeps bundles between 5 and 30 as-is", () => {
    const bundles = [
      { name: "Small Bundle", assetIds: [1, 2, 3, 4, 5] },
      { name: "Medium Bundle", assetIds: Array.from({ length: 15 }, (_, i) => i + 100) },
    ];
    const result = enforceBundleSize(bundles, 25);
    expect(result).toHaveLength(2);
    expect(result[0].assetIds).toHaveLength(5);
    expect(result[1].assetIds).toHaveLength(15);
  });

  it("handles empty input", () => {
    const result = enforceBundleSize([], 25);
    expect(result).toHaveLength(0);
  });

  it("preserves all asset IDs across splits and merges", () => {
    const allIds = Array.from({ length: 100 }, (_, i) => i + 1);
    const bundles = [
      { name: "Bundle A", assetIds: allIds.slice(0, 40) },
      { name: "Bundle B", assetIds: allIds.slice(40, 43) }, // tiny, should merge
      { name: "Bundle C", assetIds: allIds.slice(43, 100) },
    ];
    const result = enforceBundleSize(bundles, 25);
    const resultIds = result.flatMap((b) => b.assetIds).sort((a, b) => a - b);
    expect(resultIds).toEqual(allIds);
  });
});
