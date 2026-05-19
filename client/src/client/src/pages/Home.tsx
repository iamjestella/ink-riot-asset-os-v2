import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Image, Package, Share2, Mail, FolderSync, Loader2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: recentScans } = trpc.dashboard.recentScans.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Ink Riot Asset OS — Your artwork intelligence hub
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
                <Image className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalAssets ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.analyzedAssets ?? 0} analyzed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bundles</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalBundles ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.finalizedBundles ?? 0} finalized</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Social Posts</CardTitle>
                <Share2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalPosts ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{stats?.scheduledPosts ?? 0} scheduled</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Analysis</CardTitle>
                <Mail className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.pendingAssets ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">awaiting AI analysis</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderSync className="h-5 w-5 text-primary" />
                  Recent Scan Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentScans && recentScans.length > 0 ? (
                  <div className="space-y-3">
                    {recentScans.map((scan: any) => (
                      <div key={scan.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{scan.folderType} scan</p>
                          <p className="text-xs text-muted-foreground">{scan.processedFiles}/{scan.totalFiles} files</p>
                        </div>
                        <Badge variant={scan.status === "completed" ? "default" : scan.status === "running" ? "secondary" : "destructive"}>
                          {scan.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No scan jobs yet. Connect Google Drive in Settings to get started.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="secondary" asChild>
                  <a href="/catalog"><Image className="h-4 w-4 mr-2" />Browse Asset Catalog</a>
                </Button>
                <Button className="w-full justify-start" variant="secondary" asChild>
                  <a href="/bundles"><Package className="h-4 w-4 mr-2" />Create New Bundle</a>
                </Button>
                <Button className="w-full justify-start" variant="secondary" asChild>
                  <a href="/settings"><FolderSync className="h-4 w-4 mr-2" />Connect Google Drive</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
