import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Share2, Sparkles, Loader2, Instagram, Calendar, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function SocialCalendar() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedBundle, setSelectedBundle] = useState<string>("all");
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editForm, setEditForm] = useState({ caption: "", hashtags: "", hookLine: "", status: "draft" as "draft" | "scheduled" | "posted", calendarDay: 1 });

  const { data: bundlesData } = trpc.bundles.list.useQuery({ status: "finalized" });

  const { data: posts, isLoading, refetch } = trpc.social.list.useQuery({
    bundleId: selectedBundle !== "all" ? Number(selectedBundle) : undefined,
    platform: platformFilter !== "all" ? platformFilter : undefined,
  });

  const generateMutation = trpc.social.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.created} social posts generated!`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.social.update.useMutation({
    onSuccess: () => {
      toast.success("Post updated!");
      refetch();
      setEditingPost(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Group posts by calendar day
  const postsByDay: Record<number, any[]> = {};
  if (posts?.items) {
    for (const post of posts.items) {
      const day = post.calendarDay ?? 0;
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  }

  const openEditDialog = (post: any) => {
    setEditingPost(post);
    setEditForm({
      caption: post.caption || "",
      hashtags: post.hashtags || "",
      hookLine: post.hookLine || "",
      status: post.status || "draft",
      calendarDay: post.calendarDay || 1,
    });
  };

  const handleSaveEdit = () => {
    if (!editingPost) return;
    updateMutation.mutate({
      id: editingPost.id,
      caption: editForm.caption,
      hashtags: editForm.hashtags,
      hookLine: editForm.hookLine,
      status: editForm.status,
      calendarDay: editForm.calendarDay,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Social Media Calendar</h1>
          <p className="text-muted-foreground mt-1">
            30-day content planning for Instagram & Pinterest
          </p>
        </div>
        {selectedBundle !== "all" && (
          <Button
            onClick={() => generateMutation.mutate({ bundleId: Number(selectedBundle) })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Calendar
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={selectedBundle} onValueChange={setSelectedBundle}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select Bundle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bundles</SelectItem>
            {bundlesData?.items?.map((b: any) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="pinterest">Pinterest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !posts?.items || posts.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No social posts yet. Select a finalized bundle and click "Generate Calendar" to create a 30-day content plan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
            <Card key={day} className={postsByDay[day] ? "" : "opacity-50"}>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Day {day}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {postsByDay[day] ? (
                  postsByDay[day].map((post: any) => (
                    <div
                      key={post.id}
                      className="p-2 rounded bg-secondary/50 space-y-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => openEditDialog(post)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {post.platform === "instagram" ? (
                            <Instagram className="h-3 w-3 text-pink-400" />
                          ) : (
                            <Share2 className="h-3 w-3 text-red-400" />
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {post.postType}
                          </Badge>
                        </div>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium line-clamp-2">
                        {post.hookLine}
                      </p>
                      <Badge
                        variant={post.status === "posted" ? "default" : post.status === "scheduled" ? "secondary" : "secondary"}
                        className="text-[9px] px-1 py-0"
                      >
                        {post.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    No posts
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Post Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Social Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hook Line</Label>
              <Input
                value={editForm.hookLine}
                onChange={(e) => setEditForm({ ...editForm, hookLine: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Caption</Label>
              <Textarea
                value={editForm.caption}
                onChange={(e) => setEditForm({ ...editForm, caption: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>
            <div>
              <Label>Hashtags</Label>
              <Input
                value={editForm.hashtags}
                onChange={(e) => setEditForm({ ...editForm, hashtags: e.target.value })}
                className="mt-1"
                placeholder="#art #wallart #printable"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as any })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Calendar Day (1-30)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={editForm.calendarDay}
                  onChange={(e) => setEditForm({ ...editForm, calendarDay: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingPost(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
