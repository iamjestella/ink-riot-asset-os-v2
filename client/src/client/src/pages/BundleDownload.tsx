import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, Package, FileText, Palette } from "lucide-react";
import { useParams } from "wouter";

/**
 * Public-facing bundle download page for buyers.
 * Accessed via /download/:bundleId
 * Shows bundle info and provides download link for the PDF guide.
 */
export default function BundleDownload() {
  const params = useParams<{ id: string }>();
  const bundleId = Number(params.id);

  const { data: bundle, isLoading } = trpc.bundles.getPublicBundle.useQuery(
    { id: bundleId },
    { enabled: !isNaN(bundleId) }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Bundle Not Found</h2>
            <p className="text-muted-foreground">
              This bundle doesn't exist or hasn't been published yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Palette className="h-4 w-4" />
          The Ink Riot Press
        </div>
        <h1 className="text-3xl font-bold">{bundle.name}</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {bundle.description}
        </p>
      </div>

      {/* Bundle Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bundle Contents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Genre</p>
              <p className="font-medium">{bundle.genre || "Mixed"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Artworks</p>
              <p className="font-medium">{bundle.artworkCount} pieces</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Print Sizes</p>
              <p className="font-medium">8 standard sizes included</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">License</p>
              <Badge variant="default">Commercial Use</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Card */}
      <Card className="border-primary/30">
        <CardContent className="py-8 text-center space-y-4">
          <FileText className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h3 className="text-lg font-bold">Your Bundle Guide</h3>
            <p className="text-sm text-muted-foreground">
              Includes artwork descriptions, size guide, POD resources, and commercial license details.
            </p>
          </div>
          {bundle.pdfUrl ? (
            <Button size="lg" asChild>
              <a href={bundle.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-5 w-5 mr-2" />
                Download PDF Guide
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              The PDF guide is being generated. Please check back shortly.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} The Ink Riot Press. All rights reserved.
      </p>
    </div>
  );
}
