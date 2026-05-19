import { invokeLLM } from "./_core/llm";

interface AnalyzedAsset {
  id: number;
  fileName: string;
  genre: string | null;
  style: string | null;
  audience: string | null;
  roomType: string | null;
  colorPalette: any;
  emotionalVibe: string | null;
  lineWeight: string | null;
  lighting: string | null;
  tags: any;
  subject: string | null;
}

export interface ProposedBundle {
  name: string;
  description: string;
  genre: string;
  targetAudience: string;
  assetIds: number[];
}

/**
 * Group analyzed artworks into cohesive 25-piece bundles using AI.
 * The AI considers visual DNA (color palette, line weight, lighting, genre)
 * to ensure each bundle has a "seamless fit."
 */
export async function generateBundleProposals(artworks: AnalyzedAsset[]): Promise<ProposedBundle[]> {
  if (artworks.length < 5) {
    return [];
  }

  // Prepare a summary of each artwork for the LLM
  const artworkSummaries = artworks.map(a => ({
    id: a.id,
    fileName: a.fileName,
    genre: a.genre || "unknown",
    style: a.style || "unknown",
    audience: a.audience || "general",
    roomType: a.roomType || "any",
    colorPalette: a.colorPalette || [],
    emotionalVibe: a.emotionalVibe || "neutral",
    lineWeight: a.lineWeight || "medium",
    lighting: a.lighting || "standard",
    subject: a.subject || a.fileName,
  }));

  const targetBundleSize = 25;
  const maxBundles = Math.floor(artworks.length / targetBundleSize) || 1;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert art curator for a print-on-demand business. Your job is to group artworks into cohesive bundles of approximately ${targetBundleSize} pieces each.

CRITICAL RULES for "Seamless Fit":
1. Every artwork in a bundle must share a consistent VISUAL LANGUAGE — similar color palette, line weight, and lighting style
2. The genre must be consistent within a bundle (never mix Blacklight with Watercolor)
3. The emotional vibe should be complementary (all edgy, or all serene — never mixed)
4. The target audience should be the same for all pieces in a bundle
5. If there aren't enough pieces to make a full bundle of ${targetBundleSize}, make smaller bundles (minimum 5 pieces)

For each bundle, provide:
- A marketable name (e.g., "Blacklight Bundle Vol. 1", "Anime Pop Art Collection", "Teen Girl Art Bundle")
- A compelling description for the product listing
- The primary genre
- The target audience
- The list of artwork IDs that belong in this bundle

Return a JSON object with a "bundles" array.`,
      },
      {
        role: "user",
        content: `Here are ${artworks.length} analyzed artworks. Group them into cohesive bundles of ~${targetBundleSize} pieces (max ${maxBundles} bundles). Each bundle must have a seamless visual fit.\n\nArtworks:\n${JSON.stringify(artworkSummaries, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bundle_proposals",
        strict: true,
        schema: {
          type: "object",
          properties: {
            bundles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Marketable bundle name" },
                  description: { type: "string", description: "Product listing description" },
                  genre: { type: "string", description: "Primary genre of the bundle" },
                  targetAudience: { type: "string", description: "Target buyer demographic" },
                  assetIds: { type: "array", items: { type: "number" }, description: "IDs of artworks in this bundle" },
                },
                required: ["name", "description", "genre", "targetAudience", "assetIds"],
                additionalProperties: false,
              },
            },
          },
          required: ["bundles"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM for bundle proposals");
  }

  const parsed = JSON.parse(content as string);
  const rawBundles = parsed.bundles as ProposedBundle[];

  // Enforce 25-piece target: split oversized bundles, merge undersized ones
  return enforceBundleSize(rawBundles, targetBundleSize);
}

/**
 * Enforce the 25-piece target per bundle.
 * - Bundles > 30 pieces get split
 * - Bundles < 5 pieces get merged into the nearest compatible bundle
 */
function enforceBundleSize(bundles: ProposedBundle[], target: number): ProposedBundle[] {
  const result: ProposedBundle[] = [];

  for (const bundle of bundles) {
    if (bundle.assetIds.length > target + 5) {
      // Split into chunks of ~target
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
          // Merge small remainder into previous bundle
          result[result.length - 1].assetIds.push(...chunk);
        }
      });
    } else if (bundle.assetIds.length < 5 && result.length > 0) {
      // Merge tiny bundles into the last result
      result[result.length - 1].assetIds.push(...bundle.assetIds);
    } else {
      result.push(bundle);
    }
  }

  return result;
}

/**
 * Generate end-user bundle proposals.
 * End-user bundles are smaller (5-10 pieces), themed for personal use,
 * and priced lower than commercial bundles.
 */
export async function generateEndUserBundleProposals(artworks: AnalyzedAsset[]): Promise<ProposedBundle[]> {
  if (artworks.length < 3) {
    return [];
  }

  const artworkSummaries = artworks.map(a => ({
    id: a.id,
    fileName: a.fileName,
    genre: a.genre || "unknown",
    style: a.style || "unknown",
    audience: a.audience || "general",
    roomType: a.roomType || "any",
    colorPalette: a.colorPalette || [],
    emotionalVibe: a.emotionalVibe || "neutral",
    subject: a.subject || a.fileName,
  }));

  const targetSize = 8;
  const maxBundles = Math.floor(artworks.length / 5) || 1;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert art curator. Group artworks into small themed bundles of 5-10 pieces for END USERS (personal use, home decor).

RULES:
1. Each bundle should have a clear room/space theme (e.g., "Game Room Vibes", "Dorm Room Essentials", "Kids Room Collection")
2. Color palettes within a bundle should be complementary
3. Target size is ${targetSize} pieces per bundle
4. Bundles are for personal printing — focus on aesthetic cohesion over commercial viability
5. Name bundles with room/lifestyle themes, not genre labels

Return a JSON object with a "bundles" array.`,
      },
      {
        role: "user",
        content: `Group these ${artworks.length} artworks into end-user bundles of ~${targetSize} pieces (max ${maxBundles} bundles):\n\n${JSON.stringify(artworkSummaries, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "end_user_bundles",
        strict: true,
        schema: {
          type: "object",
          properties: {
            bundles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  genre: { type: "string" },
                  targetAudience: { type: "string" },
                  assetIds: { type: "array", items: { type: "number" } },
                },
                required: ["name", "description", "genre", "targetAudience", "assetIds"],
                additionalProperties: false,
              },
            },
          },
          required: ["bundles"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from LLM for end-user bundle proposals");

  const parsed = JSON.parse(content as string);
  return parsed.bundles as ProposedBundle[];
}
