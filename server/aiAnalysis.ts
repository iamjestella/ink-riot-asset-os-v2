import { invokeLLM } from "./_core/llm";

export interface ArtworkAnalysis {
  subject: string;
  genre: string;
  style: string;
  audience: string;
  roomType: string;
  colorPalette: string[];
  emotionalVibe: string;
  lineWeight: string;
  lighting: string;
  tags: string[];
  suggestedBundleName: string;
}

/**
 * Analyze an artwork image using multimodal LLM.
 * Sends the image URL and receives structured analysis tags.
 */
export async function analyzeArtwork(imageUrl: string, fileName: string): Promise<ArtworkAnalysis> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert art curator and print-on-demand product strategist. You analyze artwork images and provide structured metadata for catalog organization and bundle creation.

Your job is to analyze the artwork and return a JSON object with these exact fields:
- subject: What is depicted (e.g., "skull with roses", "anime girl with headphones", "abstract geometric pattern")
- genre: One of: Prismatic, Blacklight, Fantasy, Comic Gothic, Anime Pop Art, Teen Girl, Abstract, Botanical, Minimalist, Retro, Neon, Watercolor, or a new genre if none fit
- style: The artistic style (e.g., "halftone", "digital illustration", "vector art", "mixed media")
- audience: Target buyer demographic (e.g., "teen girls 13-19", "young adults 20-35", "home decor enthusiasts")
- roomType: Best room for display (e.g., "bedroom", "living room", "office", "dorm room", "game room")
- colorPalette: Array of 3-5 dominant hex colors
- emotionalVibe: The mood/feeling (e.g., "edgy and rebellious", "calm and serene", "playful and energetic")
- lineWeight: Description of line quality (e.g., "bold thick lines", "fine detailed lines", "no visible lines")
- lighting: Lighting style (e.g., "neon glow", "soft ambient", "high contrast", "flat")
- tags: Array of 5-10 searchable keywords
- suggestedBundleName: A marketable bundle name this could belong to (e.g., "Blacklight Bundle Vol. 1", "Anime Pop Art Collection")

Be specific and consistent. Use the same genre/style vocabulary across analyses for grouping purposes.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this artwork file named "${fileName}" and return the structured JSON analysis.`,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "artwork_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "What is depicted in the artwork" },
            genre: { type: "string", description: "Art genre category" },
            style: { type: "string", description: "Artistic style" },
            audience: { type: "string", description: "Target buyer demographic" },
            roomType: { type: "string", description: "Best room for display" },
            colorPalette: { type: "array", items: { type: "string" }, description: "3-5 dominant hex colors" },
            emotionalVibe: { type: "string", description: "Mood/feeling of the artwork" },
            lineWeight: { type: "string", description: "Line quality description" },
            lighting: { type: "string", description: "Lighting style" },
            tags: { type: "array", items: { type: "string" }, description: "5-10 searchable keywords" },
            suggestedBundleName: { type: "string", description: "Marketable bundle name suggestion" },
          },
          required: ["subject", "genre", "style", "audience", "roomType", "colorPalette", "emotionalVibe", "lineWeight", "lighting", "tags", "suggestedBundleName"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  return JSON.parse(content as string) as ArtworkAnalysis;
}

/**
 * Generate social media content for a bundle.
 */
export async function generateSocialContent(bundleName: string, genre: string, artworkDescriptions: string[]): Promise<{
  posts: Array<{
    platform: "instagram" | "pinterest";
    postType: "static" | "carousel" | "reel";
    caption: string;
    hashtags: string;
    hookLine: string;
    reelScript?: string;
  }>;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a viral social media content strategist for a print-on-demand art business called "The Ink Riot Press." You create scroll-stopping content that drives sales.

Generate a mix of content types for Instagram and Pinterest that will promote an art bundle. Each post should have a strong hook, engaging caption, and relevant hashtags.

Return a JSON object with a "posts" array containing 6 posts:
- 2 Instagram static posts
- 1 Instagram carousel concept
- 1 Instagram Reel script
- 2 Pinterest pins

Each post object should have: platform, postType, caption, hashtags (comma-separated), hookLine, and reelScript (only for reels).`,
      },
      {
        role: "user",
        content: `Create viral social media content for the bundle "${bundleName}" in the ${genre} genre. The bundle contains these artworks: ${artworkDescriptions.slice(0, 5).join(", ")}. The bundle sells for $27 and includes commercial licensing, mockups, and a POD resource guide.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string", description: "instagram or pinterest" },
                  postType: { type: "string", description: "static, carousel, or reel" },
                  caption: { type: "string", description: "Full post caption" },
                  hashtags: { type: "string", description: "Comma-separated hashtags" },
                  hookLine: { type: "string", description: "Scroll-stopping first line" },
                  reelScript: { type: "string", description: "Reel script if applicable" },
                },
                required: ["platform", "postType", "caption", "hashtags", "hookLine", "reelScript"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  return JSON.parse(content as string);
}

/**
 * Generate email content for a bundle.
 */
export async function generateEmailContent(bundleName: string, genre: string, bundleDescription: string): Promise<{
  emails: Array<{
    emailType: "post_purchase" | "promotional" | "newsletter";
    subject: string;
    body: string;
    sequenceOrder: number;
  }>;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an email marketing expert for "The Ink Riot Press," a print-on-demand art business. Write compelling email sequences that drive sales and build community.

Generate 4 emails:
1. A promotional email announcing the new bundle (sequenceOrder: 1)
2. A post-purchase thank you + onboarding email (sequenceOrder: 2)
3. A post-purchase "here's how to use your bundle" email (sequenceOrder: 3)
4. A newsletter snippet announcing the bundle to subscribers (sequenceOrder: 4)

Each email should be warm, energetic, and action-oriented. Include clear CTAs.`,
      },
      {
        role: "user",
        content: `Create email content for the bundle "${bundleName}" (${genre} genre). Description: ${bundleDescription}. Price: $27. Includes commercial license, mockups, and POD resource guide with affiliate links.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "email_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  emailType: { type: "string", description: "post_purchase, promotional, or newsletter" },
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Full email body in HTML" },
                  sequenceOrder: { type: "number", description: "Order in sequence" },
                },
                required: ["emailType", "subject", "body", "sequenceOrder"],
                additionalProperties: false,
              },
            },
          },
          required: ["emails"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  return JSON.parse(content as string);
}
