import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FolderSync, Link, CheckCircle, Loader2, Trash2, Plus, Palette, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function Settings() {
  const { data: driveStatus, refetch: refetchDrive } = trpc.drive.status.useQuery();
  const [origin] = useState(() => window.location.origin);
  const { data: driveAuthUrl } = trpc.drive.getAuthUrl.useQuery({ origin });

  // Affiliate links
  const { data: affiliateLinks, refetch: refetchLinks } = trpc.settings.affiliateLinks.list.useQuery();
  const [newLink, setNewLink] = useState({ serviceName: "", url: "", description: "", category: "pod" });
  const createLinkMutation = trpc.settings.affiliateLinks.create.useMutation({
    onSuccess: () => { toast.success("Affiliate link added!"); refetchLinks(); setNewLink({ serviceName: "", url: "", description: "", category: "pod" }); },
    onError: (err) => toast.error(err.message),
  });
  const deleteLinkMutation = trpc.settings.affiliateLinks.delete.useMutation({
    onSuccess: () => { toast.success("Link removed"); refetchLinks(); },
    onError: (err) => toast.error(err.message),
  });

  // Mockup rules
  const { data: mockupRules, refetch: refetchRules } = trpc.settings.mockupRules.list.useQuery();
  const [newRule, setNewRule] = useState({ genre: "", mockupStyle: "", description: "" });
  const createRuleMutation = trpc.settings.mockupRules.create.useMutation({
    onSuccess: () => { toast.success("Mockup rule added!"); refetchRules(); setNewRule({ genre: "", mockupStyle: "", description: "" }); },
    onError: (err) => toast.error(err.message),
  });
  const deleteRuleMutation = trpc.settings.mockupRules.delete.useMutation({
    onSuccess: () => { toast.success("Rule removed"); refetchRules(); },
    onError: (err) => toast.error(err.message),
  });

  // Folder ID editing
  const [artworkFolderIdInput, setArtworkFolderIdInput] = useState("");
  const [mockupFolderIdInput, setMockupFolderIdInput] = useState("");

  // Sync folder IDs from server into local state once loaded (useEffect to avoid render-phase setState)
  useEffect(() => {
    if (driveStatus) {
      setArtworkFolderIdInput(driveStatus.artworkFolderId || "");
      setMockupFolderIdInput(driveStatus.mockupFolderId || "");
    }
  }, [driveStatus?.artworkFolderId, driveStatus?.mockupFolderId]);

  const updateFolderIdsMutation = trpc.drive.updateFolderIds.useMutation({
    onSuccess: () => {
      toast.success("Folder IDs saved! You can now scan your Drive folders.");
      refetchDrive();
    },
    onError: (err) => {
      console.error("[Settings] Failed to save folder IDs:", err);
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Drive disconnect
  const disconnectMutation = trpc.drive.disconnect.useMutation({
    onSuccess: () => { toast.success("Google Drive disconnected"); refetchDrive(); },
    onError: (err) => toast.error(err.message),
  });

  // Folder health check
  const checkFolderMutation = trpc.drive.checkFolder.useMutation({
    onSuccess: (result) => {
      if (result.accessible) {
        toast.success(`Folder "${result.name}" is accessible (${result.fileCount}+ images found)`);
      } else {
        toast.error(`Folder not accessible: ${result.error}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConnectDrive = () => {
    if (driveAuthUrl?.url) {
      window.location.href = driveAuthUrl.url;
    } else {
      toast.error("Unable to generate Google OAuth URL. Check your Google Cloud credentials.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure Google Drive, affiliate links, and mockup pairing rules
        </p>
      </div>

      {/* Google Drive Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSync className="h-5 w-5 text-primary" />
            Google Drive Connection
          </CardTitle>
          <CardDescription>
            Connect your Google Drive to scan artwork and mockup folders (read-only access)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={driveStatus?.connected ? "default" : "secondary"}>
              {driveStatus?.connected ? "Connected" : "Not Connected"}
            </Badge>
            {driveStatus?.email && (
              <span className="text-sm text-muted-foreground">{driveStatus.email}</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label>Artwork Folder ID</Label>
              <Input
                placeholder="Paste your Google Drive artwork folder ID here"
                value={artworkFolderIdInput}
                onChange={(e) => setArtworkFolderIdInput(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in the URL when you open the folder: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
              </p>
            </div>
            <div>
              <Label>Mockup Folder ID</Label>
              <Input
                placeholder="Paste your Google Drive mockup folder ID here"
                value={mockupFolderIdInput}
                onChange={(e) => setMockupFolderIdInput(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in the URL when you open the folder: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
              </p>
            </div>
            <Button
              onClick={() => updateFolderIdsMutation.mutate({ artworkFolderId: artworkFolderIdInput, mockupFolderId: mockupFolderIdInput })}
              disabled={updateFolderIdsMutation.isPending}
              variant="secondary"
            >
              {updateFolderIdsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Folder IDs
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!driveStatus?.connected ? (
              <Button onClick={handleConnectDrive}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Connect Google Drive
              </Button>
            ) : (
              <>
                <Button variant="destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                  {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Disconnect
                </Button>
                {driveStatus.artworkFolderId && (
                  <Button
                    variant="secondary"
                    onClick={() => checkFolderMutation.mutate({ folderId: driveStatus.artworkFolderId, folderType: "artwork" })}
                    disabled={checkFolderMutation.isPending}
                  >
                    {checkFolderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Check Artwork Folder
                  </Button>
                )}
                {driveStatus.mockupFolderId && (
                  <Button
                    variant="secondary"
                    onClick={() => checkFolderMutation.mutate({ folderId: driveStatus.mockupFolderId, folderType: "mockup" })}
                    disabled={checkFolderMutation.isPending}
                  >
                    {checkFolderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Check Mockup Folder
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Affiliate Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Affiliate Links
          </CardTitle>
          <CardDescription>
            These links are auto-injected into every commercial bundle PDF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {affiliateLinks && affiliateLinks.length > 0 && (
            <div className="space-y-2">
              {affiliateLinks.map((link: any) => (
                <div key={link.id} className="flex items-center justify-between p-3 rounded bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{link.serviceName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px]">{link.url}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteLinkMutation.mutate({ id: link.id })}
                    disabled={deleteLinkMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Add New Link</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Service Name</Label>
                <Input
                  placeholder="e.g. Printify, Printful"
                  value={newLink.serviceName}
                  onChange={(e) => setNewLink({ ...newLink, serviceName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newLink.category} onValueChange={(v) => setNewLink({ ...newLink, category: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pod">Print on Demand</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="tool">Tool / Software</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Affiliate URL</Label>
              <Input
                placeholder="https://..."
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="Brief description of this service"
                value={newLink.description}
                onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => {
                if (!newLink.serviceName || !newLink.url) { toast.error("Service name and URL are required"); return; }
                createLinkMutation.mutate(newLink);
              }}
              disabled={createLinkMutation.isPending}
            >
              {createLinkMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Affiliate Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mockup Pairing Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Mockup Pairing Rules
          </CardTitle>
          <CardDescription>
            Define which mockup styles pair best with each art genre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockupRules && mockupRules.length > 0 && (
            <div className="space-y-2">
              {mockupRules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{rule.genre} → {rule.mockupStyle}</p>
                    {rule.description && <p className="text-xs text-muted-foreground">{rule.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                    disabled={deleteRuleMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Add New Rule</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Art Genre</Label>
                <Select value={newRule.genre} onValueChange={(v) => setNewRule({ ...newRule, genre: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prismatic">Prismatic</SelectItem>
                    <SelectItem value="Blacklight">Blacklight</SelectItem>
                    <SelectItem value="Fantasy">Fantasy</SelectItem>
                    <SelectItem value="Comic Gothic">Comic Gothic</SelectItem>
                    <SelectItem value="Anime Pop Art">Anime Pop Art</SelectItem>
                    <SelectItem value="Teen Girl">Teen Girl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mockup Style</Label>
                <Input
                  placeholder="e.g. Dark room, Gallery wall"
                  value={newRule.mockupStyle}
                  onChange={(e) => setNewRule({ ...newRule, mockupStyle: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="Why this pairing works"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => {
                if (!newRule.genre || !newRule.mockupStyle) { toast.error("Genre and mockup style are required"); return; }
                createRuleMutation.mutate(newRule);
              }}
              disabled={createRuleMutation.isPending}
            >
              {createRuleMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Mockup Rule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
