import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Package, Sparkles, Loader2, CheckCircle, Users } from "lucide-react";
import { toast } from "sonner";

export default function Bundles() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch } = trpc.bundles.list.useQuery({
    bundleType: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const generateMutation = trpc.bundles.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.created} commercial bundle proposals generated!`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateEndUserMutation = trpc.bundles.generateEndUser.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.created} end-user bundle proposals generated!`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const finalizeMutation = trpc.bundles.finalize.useMutation({
    onSuccess: () => {
      toast.success("Bundle finalized!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bundles</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated 25-piece art bundles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Commercial
          </Button>
          <Button
            variant="secondary"
            onClick={() => generateEndUserMutation.mutate()}
            disabled={generateEndUserMutation.isPending}
          >
            {generateEndUserMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Generate End-User
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Bundle Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="commercial">Commercial ($27)</SelectItem>
            <SelectItem value="end_user">End User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="finalized">Finalized</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !data?.items || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No bundles yet. Analyze your artwork first, then click "Generate Bundles" to create AI-powered groupings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((bundle: any) => (
            <Card key={bundle.id} className="cursor-pointer" onClick={() => window.location.href = `/bundles/${bundle.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{bundle.name}</CardTitle>
                  <Badge
                    variant={
                      bundle.status === "finalized" || bundle.status === "published"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {bundle.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {bundle.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {bundle.genre && (
                    <Badge variant="secondary" className="text-xs">
                      {bundle.genre}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {bundle.bundleType === "commercial" ? "$27 Commercial" : "End User"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {bundle.artworkCount ?? 25} pieces
                  </Badge>
                </div>
                {bundle.targetAudience && (
                  <p className="text-xs text-muted-foreground">
                    Target: {bundle.targetAudience}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  {bundle.status === "proposed" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => finalizeMutation.mutate({ id: bundle.id })}
                      disabled={finalizeMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Finalize
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
