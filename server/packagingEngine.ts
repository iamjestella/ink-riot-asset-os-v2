/**
 * Commercial Bundle Packaging Engine
 * Generates the deliverable package for a $27 bundle:
 *   - Multi-size art export metadata (8 standard sizes)
 *   - Branded PDF with POD resource directory + affiliate links
 *   - Stores generated files in S3
 */

import PDFDocument from "pdfkit";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  getBundleById,
  getBundleAssets,
  getAssetById,
  getAffiliateLinks,
  getMockupPairings,
  updateBundle,
} from "./db";

// Standard print sizes for wall art
const STANDARD_SIZES = [
  { label: "5×7 in", width: 5, height: 7 },
  { label: "8×10 in", width: 8, height: 10 },
  { label: "11×14 in", width: 11, height: 14 },
  { label: "12×16 in", width: 12, height: 16 },
  { label: "16×20 in", width: 16, height: 20 },
  { label: "18×24 in", width: 18, height: 24 },
  { label: "24×36 in", width: 24, height: 36 },
  { label: "30×40 in", width: 30, height: 40 },
];

interface PackagingResult {
  pdfUrl: string;
  artworkCount: number;
  sizes: string[];
  affiliateLinkCount: number;
}

/**
 * Generate a branded PDF guide for a commercial bundle.
 * The PDF includes:
 *   - Bundle overview (name, description, genre, audience)
 *   - Artwork listing with suggested sizes
 *   - Mockup pairing info
 *   - POD resource directory with affiliate links
 *   - Commercial licensing note
 */
export async function packageBundle(userId: number, bundleId: number): Promise<PackagingResult> {
  const bundle = await getBundleById(bundleId);
  if (!bundle) throw new Error("Bundle not found");

  const bundleAssetRows = await getBundleAssets(bundleId);
  const pairings = await getMockupPairings(bundleId);
  const affiliates = await getAffiliateLinks(userId);

  // Gather artwork details
  const artworks: Array<{ name: string; genre: string; style: string; mockupName: string | null }> = [];
  for (const ba of bundleAssetRows) {
    const asset = await getAssetById(ba.assetId);
    if (!asset) continue;
    const pairing = pairings.find((p) => p.artworkAssetId === ba.assetId);
    let mockupName: string | null = null;
    if (pairing) {
      const mockupAsset = await getAssetById(pairing.mockupAssetId);
      mockupName = mockupAsset?.fileName || null;
    }
    artworks.push({
      name: asset.fileName,
      genre: asset.genre || "Unknown",
      style: asset.style || "Unknown",
      mockupName,
    });
  }

  // Generate PDF content via LLM
  const pdfContent = await generatePdfContent({
    bundleName: bundle.name,
    description: bundle.description || "",
    genre: bundle.genre || "Art",
    targetAudience: bundle.targetAudience || "Art lovers",
    artworks,
    sizes: STANDARD_SIZES.map((s) => s.label),
    affiliateLinks: affiliates.map((a) => ({
      name: a.serviceName,
      url: a.url,
      description: a.description || "",
      category: a.category || "other",
    })),
  });

  // Generate actual PDF using pdfkit
  const pdfBuffer = await buildPdf(pdfContent, bundle.name, artworks);

  // Store the PDF in S3
  const { url: pdfUrl } = await storagePut(
    `bundles/${bundleId}/guide.pdf`,
    pdfBuffer,
    "application/pdf"
  );

  // Update bundle with PDF URL
  await updateBundle(bundleId, { pdfUrl, packagedAt: new Date() });

  return {
    pdfUrl,
    artworkCount: artworks.length,
    sizes: STANDARD_SIZES.map((s) => s.label),
    affiliateLinkCount: affiliates.length,
  };
}

async function generatePdfContent(input: {
  bundleName: string;
  description: string;
  genre: string;
  targetAudience: string;
  artworks: Array<{ name: string; genre: string; style: string; mockupName: string | null }>;
  sizes: string[];
  affiliateLinks: Array<{ name: string; url: string; description: string; category: string }>;
}): Promise<{
  intro: string;
  artworkDescriptions: string[];
  sizeGuide: string;
  podDirectory: string;
  licensingNote: string;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a professional copywriter for The Ink Riot Press, a bold digital art brand. Generate content for a commercial bundle PDF guide. Write in an energetic, confident tone that appeals to ${input.targetAudience}. The guide should feel premium and valuable.`,
      },
      {
        role: "user",
        content: `Generate content for the "${input.bundleName}" bundle PDF guide.

Bundle: ${input.bundleName}
Description: ${input.description}
Genre: ${input.genre}
Target Audience: ${input.targetAudience}
Artwork Count: ${input.artworks.length}
Available Sizes: ${input.sizes.join(", ")}

Artworks:
${input.artworks.map((a, i) => `${i + 1}. ${a.name} (${a.genre}, ${a.style})${a.mockupName ? ` - Mockup: ${a.mockupName}` : ""}`).join("\n")}

Affiliate Links:
${input.affiliateLinks.map((l) => `- ${l.name}: ${l.url} (${l.category})`).join("\n") || "None configured"}

Generate:
1. intro: A compelling 2-3 paragraph introduction for the bundle
2. artworkDescriptions: One sentence per artwork describing its appeal
3. sizeGuide: A paragraph explaining the 8 sizes and which rooms they work best in
4. podDirectory: A section listing POD services with the affiliate links woven in naturally
5. licensingNote: A brief commercial licensing statement`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pdf_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intro: { type: "string" },
            artworkDescriptions: { type: "array", items: { type: "string" } },
            sizeGuide: { type: "string" },
            podDirectory: { type: "string" },
            licensingNote: { type: "string" },
          },
          required: ["intro", "artworkDescriptions", "sizeGuide", "podDirectory", "licensingNote"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0].message.content;
  const content = JSON.parse((typeof rawContent === "string" ? rawContent : "") || "{}");
  return content;
}

/**
 * Build an actual PDF using pdfkit.
 * Returns a Buffer containing the PDF bytes.
 */
async function buildPdf(
  content: { intro: string; artworkDescriptions: string[]; sizeGuide: string; podDirectory: string; licensingNote: string },
  bundleName: string,
  artworks: Array<{ name: string; genre: string; style: string; mockupName: string | null }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `${bundleName} - Bundle Guide`,
        Author: "The Ink Riot Press",
        Subject: "Commercial Art Bundle Guide",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100; // margins
    const accentColor = "#c026d3"; // magenta/fuchsia
    const darkBg = "#1a1a2e";
    const textColor = "#333333";
    const lightGray = "#666666";

    // ─── Cover Page ───
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(darkBg);
    doc.fillColor("#ffffff").fontSize(36).font("Helvetica-Bold");
    doc.text(bundleName, 50, 200, { width: pageWidth, align: "center" });
    doc.moveDown(0.5);
    doc.fillColor(accentColor).fontSize(16).font("Helvetica");
    doc.text("by The Ink Riot Press", { width: pageWidth, align: "center" });
    doc.moveDown(2);
    doc.fillColor("#cccccc").fontSize(12);
    doc.text("Commercial Art Bundle Guide", { width: pageWidth, align: "center" });
    doc.moveDown(0.5);
    doc.text(`${artworks.length} Premium Artworks • 8 Print Sizes`, { width: pageWidth, align: "center" });
    doc.moveDown(4);
    doc.fillColor("#888888").fontSize(10);
    doc.text(`© ${new Date().getFullYear()} The Ink Riot Press. All rights reserved.`, { width: pageWidth, align: "center" });

    // ─── Introduction Page ───
    doc.addPage();
    drawSectionHeader(doc, "Welcome to Your Bundle", pageWidth, accentColor);
    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    const introParagraphs = content.intro.split("\n").filter((p) => p.trim());
    for (const para of introParagraphs) {
      doc.text(para.trim(), { width: pageWidth, align: "left", lineGap: 4 });
      doc.moveDown(0.8);
    }

    // ─── Artwork Listing Page ───
    doc.addPage();
    drawSectionHeader(doc, "Your Artworks", pageWidth, accentColor);
    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    artworks.forEach((artwork, i) => {
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.fillColor(accentColor).font("Helvetica-Bold").text(`${i + 1}. ${artwork.name}`, { continued: false });
      doc.fillColor(lightGray).font("Helvetica").fontSize(10);
      doc.text(`   Genre: ${artwork.genre} • Style: ${artwork.style}${artwork.mockupName ? ` • Mockup: ${artwork.mockupName}` : ""}`, { lineGap: 2 });
      if (content.artworkDescriptions[i]) {
        doc.fillColor(textColor).fontSize(11);
        doc.text(`   ${content.artworkDescriptions[i]}`, { lineGap: 3 });
      }
      doc.moveDown(0.5);
    });

    // ─── Size Guide Page ───
    doc.addPage();
    drawSectionHeader(doc, "Size Guide", pageWidth, accentColor);
    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    doc.text(content.sizeGuide, { width: pageWidth, lineGap: 4 });
    doc.moveDown(1.5);

    // Size table
    doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(12);
    doc.text("Available Sizes:", { underline: true });
    doc.moveDown(0.5);
    doc.fillColor(textColor).font("Helvetica").fontSize(11);
    const sizeRows = [
      ["5×7 in", "Perfect for desks, shelves, and small accent walls"],
      ["8×10 in", "Great for gallery walls and bathroom decor"],
      ["11×14 in", "Ideal for bedrooms and reading nooks"],
      ["12×16 in", "Standard frame size, great for offices"],
      ["16×20 in", "Statement piece for living rooms"],
      ["18×24 in", "Eye-catching for entryways and hallways"],
      ["24×36 in", "Large format for feature walls"],
      ["30×40 in", "Maximum impact for large spaces"],
    ];
    for (const [size, desc] of sizeRows) {
      doc.font("Helvetica-Bold").text(`  ${size}`, { continued: true });
      doc.font("Helvetica").text(` — ${desc}`, { lineGap: 3 });
    }

    // ─── POD Resources Page ───
    doc.addPage();
    drawSectionHeader(doc, "Print-on-Demand Resources", pageWidth, accentColor);
    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    doc.text(content.podDirectory, { width: pageWidth, lineGap: 4 });

    // ─── License Page ───
    doc.addPage();
    drawSectionHeader(doc, "Commercial License", pageWidth, accentColor);
    doc.roundedRect(50, doc.y, pageWidth, 120, 8).fillAndStroke("#f5f0ff", accentColor);
    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    doc.text(content.licensingNote, 60, doc.y - 110, { width: pageWidth - 20, lineGap: 4 });

    doc.moveDown(4);
    doc.fillColor(lightGray).fontSize(9).font("Helvetica");
    doc.text(`© ${new Date().getFullYear()} The Ink Riot Press. All rights reserved.`, { width: pageWidth, align: "center" });
    doc.text("This bundle includes a commercial license for all included artworks.", { width: pageWidth, align: "center" });

    doc.end();
  });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, pageWidth: number, accentColor: string) {
  doc.fillColor(accentColor).fontSize(22).font("Helvetica-Bold");
  doc.text(title, { width: pageWidth });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor(accentColor).lineWidth(2).stroke();
  doc.moveDown(0.8);
}
