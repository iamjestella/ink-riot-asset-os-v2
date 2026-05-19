import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function AssetDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const assetId = Number(params.id);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: "", genre: "", style: "", audience: "", roomType: "",
    emotionalVibe: "", lineWeight: "", lighting: "",
  });

  const { data: asset, isLoading, refetch } = trpc.assets.getById.useQuery(
    { id: assetId },
    { enabled: !isNaN(assetId) }
  );

  const analyzeMutation = trpc.assets.analyze.useMutation({
    onSuccess: () => { toast.success("Analysis complete!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const updateTagsMutation = trpc.assets.updateTags.useMutation({
    onSuccess: () => { toast.success("Tags updated!"); refetch(); setEditing(false); },
    onError: (err) => toast.error(err.message),
  });

  const startEditing = () => {
    if (!asset) return;
    setEditForm({
      subject: asset.subject || "",
      genre: asset.genre || "",
      style: asset.style || "",
      audience: asset.audience || "",
      roomType: asset.roomType || "",
      emotionalVibe: asset.emotionalVibe || "",
      lineWeight: asset.lineWeight || "",
      lighting: asset.lighting || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateTagsMutation.mutate({ id: assetId, ...editForm });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/catalog")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Catalog
        </Button>
        <p className="text-muted-foreground">Asset not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/catalog")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{asset.fileName}</h1>
          <p className="text-muted-foreground text-sm">
            {asset.assetType} &middot; {asset.mimeType || "Unknown type"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Preview */}
        <Card>
          <CardContent className="p-4">
            <div className="aspect-square bg-secondary rounded flex items-center justify-center overflow-hidden">
              {asset.driveFileId ? (
                <img
                  src={`/api/drive-thumbnail/${asset.driveFileId}`}
                  alt={asset.fileName}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <p className="text-muted-foreground text-sm">No preview available</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {asset.webViewLink && (
                <Button size="sm" variant="secondary" asChild>
                  <a href={asset.webViewLink} target="_blank" rel="noopener noreferrer">View in Drive</a>
                </Button>
              )}
              {asset.analysisStatus !== "completed" && (
                <Button size="sm" onClick={() => analyzeMutation.mutate({ assetId: asset.id })} disabled={analyzeMutation.isPending}>
                  {analyzeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                  Analyze
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  AI Analysis
                  <Badge variant={asset.analysisStatus === "completed" ? "default" : asset.analysisStatus === "pending" ? "secondary" : "destructive"}>
                    {asset.analysisStatus}
                  </Badge>
                </span>
                {asset.analysisStatus === "completed" && !editing && (
                  <Button size="sm" variant="ghost" onClick={startEditing}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
                {editing && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleSave} disabled={updateTagsMutation.isPending}>
                      {updateTagsMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.analysisStatus === "completed" ? (
                editing ? (
                  <div className="space-y-3">
                    <EditField label="Subject" value={editForm.subject} onChange={(v) => setEditForm({ ...editForm, subject: v })} />
                    <EditField label="Genre" value={editForm.genre} onChange={(v) => setEditForm({ ...editForm, genre: v })} />
                    <EditField label="Style" value={editForm.style} onChange={(v) => setEditForm({ ...editForm, style: v })} />
                    <EditField label="Audience" value={editForm.audience} onChange={(v) => setEditForm({ ...editForm, audience: v })} />
                    <EditField label="Room Type" value={editForm.roomType} onChange={(v) => setEditForm({ ...editForm, roomType: v })} />
                    <EditField label="Emotional Vibe" value={editForm.emotionalVibe} onChange={(v) => setEditForm({ ...editForm, emotionalVibe: v })} />
                    <EditField label="Line Weight" value={editForm.lineWeight} onChange={(v) => setEditForm({ ...editForm, lineWeight: v })} />
                    <EditField label="Lighting" value={editForm.lighting} onChange={(v) => setEditForm({ ...editForm, lighting: v })} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <InfoRow label="Subject" value={asset.subject} />
                    <InfoRow label="Genre" value={asset.genre} />
                    <InfoRow label="Style" value={asset.style} />
                    <InfoRow label="Audience" value={asset.audience} />
                    <InfoRow label="Room Type" value={asset.roomType} />
                    <InfoRow label="Emotional Vibe" value={asset.emotionalVibe} />
                    <InfoRow label="Line Weight" value={asset.lineWeight} />
                    <InfoRow label="Lighting" value={asset.lighting} />

                    {Boolean(asset.colorPalette) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Color Palette</p>
                        <div className="flex gap-1 flex-wrap">
                          {(Array.isArray(asset.colorPalette) ? (asset.colorPalette as string[]) : []).map((color: string, i: number) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50">
                              <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: color }} />
                              <span className="text-xs">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Boolean(asset.tags) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Tags</p>
                        <div className="flex gap-1 flex-wrap">
                          {(Array.isArray(asset.tags) ? (asset.tags as string[]) : []).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {asset.analysisStatus === "pending"
                    ? "This asset has not been analyzed yet. Click 'Analyze' to run AI analysis."
                    : asset.analysisStatus === "analyzing"
                    ? "Analysis is in progress..."
                    : "Analysis failed. Try again."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <InfoRow label="File Name" value={asset.fileName} />
                <InfoRow label="Type" value={asset.assetType} />
                <InfoRow label="MIME" value={asset.mimeType} />
                <InfoRow label="Size" value={asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB` : "Unknown"} />
                <InfoRow label="Drive File ID" value={asset.driveFileId} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-8 text-sm" />
    </div>
  );
}
