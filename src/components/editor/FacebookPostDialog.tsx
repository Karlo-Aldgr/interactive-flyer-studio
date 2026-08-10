import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadLatestMarketingDraft,
  loadMetaConnection,
  postFacebookNow,
  saveMetaConnection,
  startMetaOAuth,
  type MarketingDraft,
  type MetaConnection,
} from "@/lib/marketingAutomation";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  ownerId: string;
  flyerTitle: string;
  onOpenMarketing: () => void;
}

function connectionBadgeVariant(
  status: MetaConnection["status"] | "missing",
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready": return "secondary";
    case "connected": return "default";
    case "error": return "destructive";
    default: return "outline";
  }
}

function connectionLabel(status: MetaConnection["status"] | "missing") {
  switch (status) {
    case "ready": return "Ready to post";
    case "connected": return "Connected";
    case "error": return "Needs attention";
    default: return "Not connected";
  }
}

function providerStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "posted": return "Sent to Facebook";
    case "posting": return "Sending…";
    case "failed": return "Send failed";
    case "ready": return "Ready";
    case "connected": return "Connected";
    case "not_connected": return "Not sent yet";
    default: return status || "Unknown";
  }
}

export function FacebookPostDialog({
  open,
  onOpenChange,
  flyerId,
  ownerId: _ownerId,
  flyerTitle,
  onOpenMarketing,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState<MarketingDraft | null>(null);
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [latestDraft, metaConnection] = await Promise.all([
        loadLatestMarketingDraft(flyerId),
        loadMetaConnection(user.id),
      ]);
      setDraft(latestDraft);
      setConnection(metaConnection);
      setPageId(metaConnection?.facebook_page_id ?? "");
      setPageName(metaConnection?.facebook_page_name ?? "");
      setMessage((current) => current || latestDraft?.facebook_post || "");
    } finally {
      setLoading(false);
    }
  }, [flyerId, user?.id]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("meta_oauth");
    if (!oauth) return;
    if (oauth === "connected") {
      toast.success(`Facebook connected${params.get("page") ? `: ${params.get("page")}` : ""}`);
      void refresh();
    } else if (oauth === "error") {
      toast.error(params.get("reason") || "Facebook connect failed");
    }
    params.delete("meta_oauth");
    params.delete("page");
    params.delete("reason");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setMessage(draft?.facebook_post ?? "");
  }, [draft?.id, draft?.facebook_post, open]);

  async function handleConnectFacebook() {
    setStartingOAuth(true);
    try {
      const url = await startMetaOAuth(typeof window !== "undefined" ? window.location.href : undefined);
      if (url) window.location.assign(url);
    } finally {
      setStartingOAuth(false);
    }
  }

  async function handleSaveConnection() {
    setSavingConnection(true);
    try {
      const saved = await saveMetaConnection({
        pageId,
        pageName,
      });
      if (saved) setConnection(saved);
    } finally {
      setSavingConnection(false);
    }
  }

  async function handlePostNow() {
    if (!draft || !user?.id) return;
    setPosting(true);
    try {
      const updated = await postFacebookNow(draft.id, message);
      if (updated) setDraft(updated);
      const latestConnection = await loadMetaConnection(user.id);
      setConnection(latestConnection);
    } finally {
      setPosting(false);
    }
  }

  const connectionStatus = connection?.status ?? "missing";
  const hasDraftCopy = !!draft?.facebook_post?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Facebook Post Now
          </DialogTitle>
          <DialogDescription>
            Connect a Facebook Page for {flyerTitle}, then post the latest AI Facebook copy.
            OAuth stores your page token securely; staff can still use the manual test-page fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
            Meta app can stay unpublished for now. Add testers in the Meta app if Connect with Facebook fails for non-admin users.
          </div>

          <section className="space-y-3 rounded-md border border-border/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Meta connection</h3>
                <p className="text-xs text-muted-foreground">
                  Preferred: Connect with Facebook. Manual page ID fields remain for staff test mode.
                </p>
              </div>
              <Badge variant={connectionBadgeVariant(connectionStatus)}>
                {connectionLabel(connectionStatus)}
              </Badge>
            </div>

            <Button
              type="button"
              onClick={() => void handleConnectFacebook()}
              disabled={loading || savingConnection || posting || startingOAuth}
            >
              {startingOAuth ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Connect with Facebook
            </Button>

            {connection?.connection_mode === "oauth" && connection.facebook_page_name && (
              <p className="text-xs text-muted-foreground">
                Connected via OAuth:{" "}
                <span className="font-medium text-foreground">{connection.facebook_page_name}</span>
                {connection.page_access_token_last4
                  ? ` (token …${connection.page_access_token_last4})`
                  : ""}
              </p>
            )}
            {connection?.connection_mode === "manual_test" && (
              <p className="text-xs text-muted-foreground">Using manual test-page connection.</p>
            )}
            {connection?.meta_app_id && (
              <p className="text-xs text-muted-foreground">
                Meta app ID detected: <span className="font-medium text-foreground">{connection.meta_app_id}</span>
              </p>
            )}
            {connection?.page_access_token_last4 && connection.connection_mode !== "oauth" && (
              <p className="text-xs text-muted-foreground">
                Test page token detected in backend secrets: ending in{" "}
                <span className="font-medium text-foreground">{connection.page_access_token_last4}</span>
              </p>
            )}
            {connection?.last_error && (
              <p className="text-xs text-destructive">{connection.last_error}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="facebook-page-id">Facebook page ID (manual test)</Label>
                <Input
                  id="facebook-page-id"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="Your Facebook page ID"
                  disabled={loading || savingConnection || posting || startingOAuth}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook-page-name">Facebook page name (manual test)</Label>
                <Input
                  id="facebook-page-name"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="True Animal Chronicles"
                  disabled={loading || savingConnection || posting || startingOAuth}
                />
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleSaveConnection()}
              disabled={loading || savingConnection || posting || startingOAuth}
            >
              {savingConnection ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save Facebook page (manual test)
            </Button>
          </section>

          <section className="space-y-3 rounded-md border border-border/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Facebook copy</h3>
                <p className="text-xs text-muted-foreground">Reuse the latest AI-generated Facebook copy, then post it in Meta test mode.</p>
              </div>
              {draft?.facebook_provider_status ? (
                <Badge variant={draft.facebook_provider_status === "failed" ? "destructive" : "outline"}>
                  {providerStatusLabel(draft.facebook_provider_status)}
                </Badge>
              ) : null}
            </div>

            {!hasDraftCopy && (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                No Facebook copy is ready yet. Generate AI Social Copy first, then come back here.
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenMarketing();
                    }}
                  >
                    Open AI posts
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="facebook-post-copy">Message to post</Label>
              <Textarea
                id="facebook-post-copy"
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading || posting || !hasDraftCopy}
              />
            </div>

            {draft?.facebook_provider_post_id && (
              <p className="text-xs text-muted-foreground">
                Facebook post ID: <span className="font-medium text-foreground">{draft.facebook_provider_post_id}</span>
              </p>
            )}
            {draft?.facebook_last_error && (
              <p className="text-xs text-destructive">{draft.facebook_last_error}</p>
            )}
            {draft?.facebook_posted_at && (
              <p className="text-xs text-muted-foreground">
                {draft.facebook_provider_status === "posted" && draft.facebook_provider_post_id
                  ? "Last Meta send:"
                  : "Last channel update:"}{" "}
                <span className="font-medium text-foreground">{new Date(draft.facebook_posted_at).toLocaleString()}</span>
              </p>
            )}
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading || savingConnection || posting}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void handlePostNow()}
              disabled={loading || savingConnection || posting || !draft || !message.trim() || connectionStatus === "missing"}
            >
              {posting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1 h-4 w-4" />}
              Post now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
