import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Trash2, CheckCircle, Plus, Palette, Package, Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function BundleDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const bundleId = Number(params.id);
  const [addAssetId, setAddAssetId] = useState("");
  const [overrideArtworkId, setOverrideArtworkId] = useState<number | null>(null);
  const [overrideMockupId, setOverrideMockupId] = useState("");

  const { data: bundle, isLoading, refetch } = trpc.bundles.getById.useQuery(
    { id: bundleId },
    { enabled: !isNaN(bundleId) }
  );

  const { data: pairings, refetch: refetchPairings } = trpc.bundles.getMockupPairings.useQuery(
    { bundleId },
    { enabled: !isNaN(bundleId) }
  );

  const finalizeMutation = trpc.bundles.finalize.useMutation({
    onSuccess: () => { toast.success("Bundle finalized!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const removeAssetMutation = trpc.bundles.removeAsset.useMutation({
    onSuccess: () => { toast.success("Asset removed from bundle"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const addAssetMutation = trpc.bundles.addAsset.useMutation({
    onSuccess: () => { toast.success("Asset added to bundle"); refetch(); setAddAssetId(""); },
    onError: (err) => toast.error(err.message),
  });

  const assignMockupsMutation = trpc.bundles.assignMockups.useMutation({
    onSuccess: (result) => {
      const paired = result.pairings.filter((p) => p.mockupId !== null).length;
      toast.success(`Mockups assigned: ${paired}/${result.pairings.length} artworks paired`);
      refetchPairings();
    },
    onError: (err) => toast.error(err.message),
  });

  const overrideMockupMutation = trpc.bundles.overrideMockup.useMutation({
    onSuccess: () => {
      toast.success("Mockup override applied!");
      refetchPairings();
      setOverrideArtworkId(null);
      setOverrideMockupId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const packageMutation = trpc.bundles.package.useMutation({
    onSuccess: (result) => {
      toast.success(`Bundle packaged! ${result.artworkCount} artworks across ${result.sizes.length} sizes. PDF guide generated.`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/bundles")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Bundles
        </Button>
        <p className="text-muted-foreground">Bundle not found.</p>
      </div>
    );
  }

  const isEditable = bundle.status !== "finalized" && bundle.status !== "published";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/bundles")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{bundle.name}</h1>
            <p className="text-muted-foreground text-sm">{bundle.description}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant={bundle.status === "finalized" || bundle.status === "published" ? "default" : "secondary"}>
            {bundle.status}
          </Badge>
          {bundle.status === "proposed" && (
            <Button size="sm" onClick={() => finalizeMutation.mutate({ id: bundleId })} disabled={finalizeMutation.isPending}>
              <CheckCircle className="h-3 w-3 mr-1" /> Finalize
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bundle Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bundle Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Genre</p>
                <p className="text-sm font-medium">{bundle.genre || "Mixed"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <Badge variant="secondary">{bundle.bundleType === "commercial" ? "$27 Commercial" : "End User"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Target Audience</p>
                <p className="text-sm">{bundle.targetAudience || "General"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Artwork Count</p>
                <p className="text-sm font-medium">{bundle.assets?.length ?? 0} / {bundle.bundleType === "commercial" ? 25 : 10} pieces</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => assignMockupsMutation.mutate({ bundleId })}
                disabled={assignMockupsMutation.isPending || !bundle.assets?.length}
              >
                {assignMockupsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Palette className="h-4 w-4 mr-2" />}
                Auto-Assign Mockups
              </Button>
              <Button
                className="w-full"
                onClick={() => packageMutation.mutate({ bundleId })}
                disabled={packageMutation.isPending || !bundle.assets?.length}
              >
                {packageMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                Generate Bundle Package
              </Button>
              {bundle.pdfUrl && (
                <Button className="w-full" variant="secondary" asChild>
                  <a href={bundle.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" /> Download PDF Guide
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Mockup Pairings */}
          {pairings && pairings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Mockup Pairings ({pairings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pairings.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-xs">
                    <div className="flex items-center gap-2">
                      <span>Art #{p.artworkAssetId}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>Mockup #{p.mockupAssetId}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setOverrideArtworkId(p.artworkAssetId);
                        setOverrideMockupId(String(p.mockupAssetId));
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

                {/* Manual Override Form */}
                {overrideArtworkId !== null && (
                  <div className="flex gap-2 items-center mt-2 p-2 rounded bg-primary/10">
                    <span className="text-xs whitespace-nowrap">Art #{overrideArtworkId} →</span>
                    <Input
                      type="number"
                      placeholder="New Mockup ID"
                      value={overrideMockupId}
                      onChange={(e) => setOverrideMockupId(e.target.value)}
                      className="h-7 text-xs w-24"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const newId = Number(overrideMockupId);
                        if (!newId) { toast.error("Enter a valid mockup ID"); return; }
                        overrideMockupMutation.mutate({
                          bundleId,
                          artworkAssetId: overrideArtworkId,
                          newMockupAssetId: newId,
                        });
                      }}
                      disabled={overrideMockupMutation.isPending}
                    >
                      {overrideMockupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => { setOverrideArtworkId(null); setOverrideMockupId(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bundle Assets */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Bundle Contents ({bundle.assets?.length ?? 0} artworks)</span>
                {bundle.pdfUrl && (
                  <Badge variant="default" className="gap-1">
                    <FileText className="h-3 w-3" /> Packaged
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add asset form */}
              {isEditable && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Asset ID to add"
                    value={addAssetId}
                    onChange={(e) => setAddAssetId(e.target.value)}
                    className="w-32"
                    type="number"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = Number(addAssetId);
                      if (!id) { toast.error("Enter a valid asset ID"); return; }
                      const nextPos = (bundle.assets?.length ?? 0) + 1;
                      addAssetMutation.mutate({ bundleId, assetId: id, position: nextPos });
                    }}
                    disabled={addAssetMutation.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              )}

              {bundle.assets && bundle.assets.length > 0 ? (
                <div className="space-y-2">
                  {bundle.assets.map((ba: any) => {
                    const pairing = pairings?.find((p: any) => p.artworkAssetId === ba.assetId);
                    return (
                      <div key={ba.assetId} className="flex items-center justify-between p-3 rounded bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-6">#{ba.position}</span>
                          <div>
                            <span className="text-sm font-medium">Asset #{ba.assetId}</span>
                            {pairing && (
                              <span className="text-xs text-muted-foreground ml-2">
                                (Mockup: #{pairing.mockupAssetId})
                              </span>
                            )}
                          </div>
                        </div>
                        {isEditable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAssetMutation.mutate({ bundleId, assetId: ba.assetId })}
                            disabled={removeAssetMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No artworks in this bundle yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
