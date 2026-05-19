import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GoogleDriveCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const callbackMutation = trpc.drive.callback.useMutation({
    onSuccess: () => {
      setStatus("success");
      setTimeout(() => setLocation("/settings"), 2000);
    },
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // Log for debugging
    console.log("[GoogleDriveCallback] URL:", window.location.href);
    console.log("[GoogleDriveCallback] code:", code ? "present" : "missing");
    console.log("[GoogleDriveCallback] error:", error);

    if (error) {
      setStatus("error");
      setErrorMsg(`Google OAuth error: ${error}${errorDescription ? ` — ${errorDescription}` : ""}`);
      return;
    }

    if (code) {
      callbackMutation.mutate({ code, origin: window.location.origin });
    } else {
      // Show the full URL in dev to help diagnose
      const allParams = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).join(", ");
      setStatus("error");
      setErrorMsg(
        allParams
          ? `Unexpected callback parameters: ${allParams}`
          : "No authorization code received from Google. Make sure the redirect URI is correctly configured in Google Cloud Console."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="py-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Connecting Google Drive...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-medium">Google Drive connected successfully!</p>
              <p className="text-sm text-muted-foreground">Redirecting to Settings...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="font-medium">Connection Failed</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="secondary" onClick={() => setLocation("/settings")}>
                Back to Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
