import { invokeLLM } from "./_core/llm";

interface BundleInfo {
  name: string;
  description: string;
  genre: string;
  targetAudience: string;
  artworkCount: number;
}

export interface GeneratedPost {
  platform: "instagram" | "pinterest";
  postType: "static" | "carousel" | "reel";
  caption: string;
  hashtags: string;
  hookLine: string;
  reelScript?: string;
  calendarDay: number;
}

/**
 * Generate a 30-day social media content calendar for a bundle.
 * Creates a mix of static posts, carousels, and Reels for Instagram and Pinterest.
 */
export async function generateSocialContent(bundle: BundleInfo): Promise<GeneratedPost[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a viral social media content strategist for a print-on-demand art business called "The Ink Riot Press." You create scroll-stopping content that drives sales.

Your content style:
- Bold, edgy hooks that stop the scroll
- Emotional triggers tied to art aesthetics (nostalgia, rebellion, self-expression)
- Platform-native formats (Reels for IG, Idea Pins for Pinterest)
- Strategic hashtag clusters (mix of broad + niche)

Generate a 30-day content calendar with a mix of:
- 10 static posts (product showcases, lifestyle shots, flat lays)
- 8 carousel posts (bundle reveals, before/after, "5 ways to style")
- 6 Reels (unboxing, room transformations, "POV: you just bought...")
- 6 Pinterest pins (vertical, keyword-rich, lifestyle-focused)

Each post should have a specific calendar day (1-30), a viral hook line, full caption, hashtags, and for Reels include a brief script.`,
      },
      {
        role: "user",
        content: `Create a 30-day social media content calendar for this bundle:\n\nBundle Name: ${bundle.name}\nDescription: ${bundle.description}\nGenre: ${bundle.genre}\nTarget Audience: ${bundle.targetAudience}\nArtwork Count: ${bundle.artworkCount} pieces`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_calendar",
        strict: true,
        schema: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: { type: "string", enum: ["instagram", "pinterest"] },
                  postType: { type: "string", enum: ["static", "carousel", "reel"] },
                  caption: { type: "string", description: "Full post caption" },
                  hashtags: { type: "string", description: "Hashtag cluster" },
                  hookLine: { type: "string", description: "The scroll-stopping first line" },
                  reelScript: { type: "string", description: "Brief reel script if applicable, empty string otherwise" },
                  calendarDay: { type: "number", description: "Day number 1-30" },
                },
                required: ["platform", "postType", "caption", "hashtags", "hookLine", "reelScript", "calendarDay"],
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
    throw new Error("No response from LLM for social content");
  }

  const parsed = JSON.parse(content as string);
  return parsed.posts as GeneratedPost[];
}

/**
 * Generate email sequences for a bundle release.
 */
export async function generateEmailSequence(bundle: BundleInfo): Promise<Array<{ emailType: "post_purchase" | "promotional" | "newsletter"; subject: string; body: string; sequenceOrder: number }>> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an email marketing expert for The Ink Riot Press, a bold print-on-demand art brand. Write email sequences that convert.

Generate a 5-email sequence:
1. Post-purchase thank you + how to use the bundle (sequence 1)
2. Post-purchase follow-up with tips for commercial sellers (sequence 2)
3. Promotional launch email for new subscribers (sequence 3)
4. Promotional urgency/scarcity email (sequence 4)
5. Newsletter feature highlighting the bundle (sequence 5)

Style: Bold, direct, slightly rebellious. Short paragraphs. Clear CTAs.`,
      },
      {
        role: "user",
        content: `Write a 5-email sequence for this bundle:\n\nBundle Name: ${bundle.name}\nDescription: ${bundle.description}\nGenre: ${bundle.genre}\nTarget Audience: ${bundle.targetAudience}\nPrice: $27 (commercial license included)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "email_sequence",
        strict: true,
        schema: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  emailType: { type: "string", enum: ["post_purchase", "promotional", "newsletter"] },
                  subject: { type: "string" },
                  body: { type: "string", description: "Full email body in markdown" },
                  sequenceOrder: { type: "number" },
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
    throw new Error("No response from LLM for email sequence");
  }

  const parsed = JSON.parse(content as string);
  return parsed.emails;
}
