import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, ScanLine, Loader2, Eye, LayoutGrid, List, Filter, X, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Helper: build a proxied thumbnail URL using the Drive file ID
function driveThumb(asset: any): string | null {
  if (!asset.driveFileId) return null;
  return `/api/drive-thumbnail/${asset.driveFileId}`;
}

export default function AssetCatalog() {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showExtendedFilters, setShowExtendedFilters] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const { data: driveStatus } = trpc.drive.status.useQuery();

  // Poll job status while analysis is running — auto-refresh catalog when progress changes
  const { data: jobStatus } = trpc.assets.analysisJobStatus.useQuery(
    { jobId: activeJobId! },
    {
      enabled: activeJobId !== null,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "running" || status === "queued" ? 4000 : false;
      },
    }
  );

  // Refresh catalog whenever job makes progress
  const utils = trpc.useUtils();
  useEffect(() => {
    if (jobStatus) {
      utils.assets.list.invalidate();
      if (jobStatus.status === "completed" || jobStatus.status === "failed") {
        setActiveJobId(null);
        if (jobStatus.status === "completed") {
          toast.success(`Analysis complete! ${jobStatus.processedAssets} assets analyzed.`);
        }
      }
    }
  }, [jobStatus?.processedAssets, jobStatus?.status]);

  const { data, isLoading, refetch } = trpc.assets.list.useQuery({
    genre: genreFilter !== "all" ? genreFilter : undefined,
    style: styleFilter !== "all" ? styleFilter : undefined,
    audience: audienceFilter !== "all" ? audienceFilter : undefined,
    roomType: roomTypeFilter !== "all" ? roomTypeFilter : undefined,
    colorPalette: colorFilter !== "all" ? colorFilter : undefined,
    analysisStatus: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
    limit: 50,
    offset: 0,
  });

  const scanMutation = trpc.drive.scan.useMutation({
    onSuccess: () => { toast.success("Scan started! Check the dashboard for progress."); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const resetMutation = trpc.assets.resetAll.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setActiveJobId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const analyzeMutation = trpc.assets.analyzeAll.useMutation({
    onSuccess: (result) => {
      if (result.alreadyRunning) {
        toast.info(result.message);
        if (result.jobId) setActiveJobId(result.jobId);
      } else if (result.jobId) {
        toast.success(result.message);
        setActiveJobId(result.jobId); // start polling
      } else {
        toast.info(result.message);
      }
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const assets = data?.items ?? [];
  const activeFilterCount = [genreFilter, statusFilter, styleFilter, audienceFilter, roomTypeFilter, colorFilter].filter(f => f !== "all").length;

  const clearAllFilters = () => {
    setGenreFilter("all");
    setStatusFilter("all");
    setStyleFilter("all");
    setAudienceFilter("all");
    setRoomTypeFilter("all");
    setColorFilter("all");
    setSearch("");
  };

  const handleScan = () => {
    const folderId = driveStatus?.artworkFolderId;
    if (!folderId) {
      toast.error("No artwork folder ID saved. Go to Settings → save your Artwork Folder ID first.");
      return;
    }
    if (!driveStatus?.connected) {
      toast.error("Google Drive is not connected. Go to Settings → Connect Google Drive.");
      return;
    }
    scanMutation.mutate({ folderType: "artwork", folderId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset Catalog</h1>
          <p className="text-muted-foreground mt-1">{data?.total ?? 0} artworks in your library</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleScan} disabled={scanMutation.isPending}>
            {scanMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
            Scan Drive
          </Button>
          <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>
            {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Analyze All
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Analysis?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all AI analysis data (genres, tags, color palettes) for every asset and reset them to pending. Any active analysis jobs will be cancelled. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Primary Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, genre, or subject..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            <SelectItem value="Prismatic">Prismatic</SelectItem>
            <SelectItem value="Blacklight">Blacklight</SelectItem>
            <SelectItem value="Fantasy">Fantasy</SelectItem>
            <SelectItem value="Comic Gothic">Comic Gothic</SelectItem>
            <SelectItem value="Anime Pop Art">Anime Pop Art</SelectItem>
            <SelectItem value="Teen Girl">Teen Girl</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Analyzed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showExtendedFilters ? "secondary" : "ghost"} onClick={() => setShowExtendedFilters(!showExtendedFilters)} className="relative">
          <Filter className="h-4 w-4 mr-1" /> More
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>
        <div className="flex border border-border rounded">
          <Button size="sm" variant={viewMode === "grid" ? "secondary" : "ghost"} onClick={() => setViewMode("grid")} className="rounded-r-none">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={viewMode === "list" ? "secondary" : "ghost"} onClick={() => setViewMode("list")} className="rounded-l-none">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Extended Filters */}
      {showExtendedFilters && (
        <div className="flex gap-3 flex-wrap items-center p-3 rounded bg-secondary/30">
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Style" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Styles</SelectItem>
              <SelectItem value="Abstract">Abstract</SelectItem>
              <SelectItem value="Illustrative">Illustrative</SelectItem>
              <SelectItem value="Photorealistic">Photorealistic</SelectItem>
              <SelectItem value="Minimalist">Minimalist</SelectItem>
              <SelectItem value="Maximalist">Maximalist</SelectItem>
              <SelectItem value="Retro">Retro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={audienceFilter} onValueChange={setAudienceFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Audiences</SelectItem>
              <SelectItem value="Kids">Kids</SelectItem>
              <SelectItem value="Teens">Teens</SelectItem>
              <SelectItem value="Young Adults">Young Adults</SelectItem>
              <SelectItem value="Adults">Adults</SelectItem>
              <SelectItem value="Gamers">Gamers</SelectItem>
              <SelectItem value="Art Collectors">Art Collectors</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Room Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              <SelectItem value="Man Cave">Man Cave</SelectItem>
              <SelectItem value="Dorm Room">Dorm Room</SelectItem>
              <SelectItem value="Game Room">Game Room</SelectItem>
              <SelectItem value="Kids Room">Kids Room</SelectItem>
              <SelectItem value="Living Room">Living Room</SelectItem>
              <SelectItem value="Office">Office</SelectItem>
            </SelectContent>
          </Select>
          <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Color" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colors</SelectItem>
              <SelectItem value="neon">Neon</SelectItem>
              <SelectItem value="pastel">Pastel</SelectItem>
              <SelectItem value="earth">Earth Tones</SelectItem>
              <SelectItem value="monochrome">Monochrome</SelectItem>
              <SelectItem value="warm">Warm</SelectItem>
              <SelectItem value="cool">Cool</SelectItem>
              <SelectItem value="vibrant">Vibrant</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAllFilters}>
              <X className="h-3 w-3 mr-1" /> Clear All
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No assets found. Scan your Google Drive to import artwork.</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset: any) => (
            <Card key={asset.id} className="overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all" onClick={() => window.location.href = `/catalog/${asset.id}`}>
              <div className="aspect-square bg-secondary flex items-center justify-center">
  {driveThumb(asset) ? (
                  <img
                    src={driveThumb(asset)!}
                    alt={asset.fileName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.thumb-fallback')) {
                        const fb = document.createElement('div');
                        fb.className = 'thumb-fallback text-muted-foreground text-xs text-center p-4 flex items-center justify-center w-full h-full';
                        fb.textContent = asset.fileName;
                        parent.appendChild(fb);
                      }
                    }}
                  />
                ) : (
                  <div className="text-muted-foreground text-xs text-center p-4">{asset.fileName}</div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">{asset.fileName}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {asset.genre && <Badge variant="default" className="text-xs">{asset.genre}</Badge>}
                  {asset.style && <Badge variant="secondary" className="text-xs">{asset.style}</Badge>}
                  {asset.audience && <Badge variant="secondary" className="text-xs">{asset.audience}</Badge>}
                  <Badge variant={asset.analysisStatus === "completed" ? "default" : asset.analysisStatus === "pending" ? "secondary" : "destructive"} className="text-xs">
                    {asset.analysisStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset: any) => (
            <div key={asset.id} className="flex items-center gap-4 p-3 rounded bg-secondary/30 hover:bg-secondary/60 cursor-pointer transition-colors" onClick={() => window.location.href = `/catalog/${asset.id}`}>
              <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
{driveThumb(asset) ? <img src={driveThumb(asset)!} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} /> : <div className="text-[8px] text-muted-foreground">IMG</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{asset.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.genre || "Unanalyzed"} {asset.style ? `· ${asset.style}` : ""} {asset.audience ? `· ${asset.audience}` : ""} {asset.roomType ? `· ${asset.roomType}` : ""}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {asset.genre && <Badge variant="default" className="text-xs">{asset.genre}</Badge>}
                <Badge variant={asset.analysisStatus === "completed" ? "default" : asset.analysisStatus === "pending" ? "secondary" : "destructive"} className="text-xs">
                  {asset.analysisStatus}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
