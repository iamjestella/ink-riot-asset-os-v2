/**
 * Mockup Pairing Engine
 * Auto-selects the best mockup from the mockup folder for each artwork in a bundle,
 * based on genre-to-mockup-style rules.
 */

import { getMockupRules, getMockups, getBundleAssets, getAssetById, createMockupPairing, deleteMockupPairings } from "./db";

interface PairingResult {
  artworkId: number;
  artworkName: string;
  mockupId: number | null;
  mockupName: string | null;
  matchReason: string;
}

/**
 * Auto-pair mockups with artworks in a bundle based on genre rules.
 * For each artwork in the bundle:
 *   1. Look up the artwork's genre
 *   2. Find matching mockup rules for that genre
 *   3. Find mockups whose filename contains the rule's mockupStyle keyword
 *   4. If no rule match, assign a random mockup as fallback
 */
export async function autoAssignMockups(userId: number, bundleId: number): Promise<PairingResult[]> {
  // Clear existing pairings for this bundle
  await deleteMockupPairings(bundleId);

  const rules = await getMockupRules(userId);
  const allMockups = await getMockups(userId);
  const bundleAssetRows = await getBundleAssets(bundleId);

  if (allMockups.length === 0) {
    return bundleAssetRows.map((ba) => ({
      artworkId: ba.assetId,
      artworkName: `Asset #${ba.assetId}`,
      mockupId: null,
      mockupName: null,
      matchReason: "No mockups available in your library",
    }));
  }

  const results: PairingResult[] = [];
  let fallbackIndex = 0;

  for (const ba of bundleAssetRows) {
    const artwork = await getAssetById(ba.assetId);
    if (!artwork) continue;

    const artworkGenre = artwork.genre?.toLowerCase() || "";
    let bestMockup: typeof allMockups[0] | null = null;
    let reason = "";

    // Try to match via rules
    const matchingRules = rules.filter((r) => r.genre.toLowerCase() === artworkGenre);

    for (const rule of matchingRules) {
      const keyword = rule.mockupStyle.toLowerCase();
      const match = allMockups.find((m) =>
        m.fileName.toLowerCase().includes(keyword)
      );
      if (match) {
        bestMockup = match;
        reason = `Matched rule: ${rule.genre} → ${rule.mockupStyle}`;
        break;
      }
    }

    // Fallback: round-robin through available mockups
    if (!bestMockup) {
      bestMockup = allMockups[fallbackIndex % allMockups.length];
      fallbackIndex++;
      reason = artworkGenre
        ? `No rule match for genre "${artwork.genre}"; assigned fallback mockup`
        : "No genre detected; assigned fallback mockup";
    }

    await createMockupPairing({
      bundleId,
      artworkAssetId: ba.assetId,
      mockupAssetId: bestMockup.id,
    });

    results.push({
      artworkId: ba.assetId,
      artworkName: artwork.fileName,
      mockupId: bestMockup.id,
      mockupName: bestMockup.fileName,
      matchReason: reason,
    });
  }

  return results;
}
