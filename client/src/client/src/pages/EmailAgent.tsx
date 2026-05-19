import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Mail, Sparkles, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";

export default function EmailAgent() {
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: bundlesData } = trpc.bundles.list.useQuery({ status: "finalized" });
  const [selectedBundle, setSelectedBundle] = useState<string>("all");

  const { data: emails, isLoading, refetch } = trpc.email.list.useQuery({
    bundleId: selectedBundle !== "all" ? Number(selectedBundle) : undefined,
    emailType: typeFilter !== "all" ? typeFilter : undefined,
  });

  const generateMutation = trpc.email.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.created} email drafts generated!`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportGHLMutation = trpc.email.exportToGHL.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.email.update.useMutation({
    onSuccess: () => { toast.success("Email approved!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Agent</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated email sequences for bundle launches
          </p>
        </div>
        <div className="flex gap-2">
          {selectedBundle !== "all" && (
            <>
              <Button
                onClick={() => generateMutation.mutate({ bundleId: Number(selectedBundle) })}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Emails
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportGHLMutation.mutate({ bundleId: Number(selectedBundle) })}
                disabled={exportGHLMutation.isPending}
              >
                {exportGHLMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Export to GHL
              </Button>
            </>
          )}
        </div>
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Email Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="welcome">Welcome</SelectItem>
            <SelectItem value="launch">Launch</SelectItem>
            <SelectItem value="follow_up">Follow Up</SelectItem>
            <SelectItem value="promotional">Promotional</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !emails || emails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No email drafts yet. Select a finalized bundle and click "Generate Emails" to create a launch sequence.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {emails.map((email: any) => (
            <Card key={email.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{email.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sequence #{email.sequenceOrder} &middot; {email.emailType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={
                        email.status === "sent"
                          ? "default"
                          : email.status === "approved"
                          ? "secondary"
                          : "secondary"
                      }
                    >
                      {email.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {email.body?.substring(0, 200)}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => toast.info(email.body || "No content")}>
                    <Send className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  {email.status === "draft" && (
                    <Button size="sm" variant="secondary" onClick={() => approveMutation.mutate({ id: email.id, status: "approved" })} disabled={approveMutation.isPending}>
                      Approve
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
