import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Instagram, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  extendInstagramToken,
  loadLatestMarketingDraft,
  loadMetaConnection,
  postInstagramNow,
  saveInstagramManualLink,
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
  flyerTitle: string;
  onOpenMarketing: () => void;
  onOpenFacebookPost: () => void;
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
    case "posted": return "Sent to Instagram";
    case "posting": return "Sending…";
    case "failed": return "Send failed";
    case "ready": return "Ready";
    case "connected": return "Connected";
    case "not_connected": return "Not sent yet";
    default: return status || "Unknown";
  }
}

export function InstagramPostDialog({
  open,
  onOpenChange,
  flyerId,
  flyerTitle,
  onOpenMarketing,
  onOpenFacebookPost,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [startingOAuth, setStartingOAuth] = useState(false);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState<MarketingDraft | null>(null);
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [caption, setCaption] = useState("");
  const [manualIgId, setManualIgId] = useState("");
  const [manualIgUsername, setManualIgUsername] = useState("carlojay.algordo");
  const [savingManualIg, setSavingManualIg] = useState(false);
  const [extendingToken, setExtendingToken] = useState(false);

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
      setCaption((current) => current || latestDraft?.instagram_caption || "");
    } finally {
      setLoading(false);
    }
  }, [flyerId, user?.id]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    setCaption(draft?.instagram_caption ?? "");
  }, [draft?.id, draft?.instagram_caption, open]);

  async function handleRefreshConnection() {
    if (!connection?.facebook_page_id || !connection.facebook_page_name) return;
    setSavingConnection(true);
    try {
      const saved = await saveMetaConnection({
        pageId: connection.facebook_page_id,
        pageName: connection.facebook_page_name,
      });
      if (saved) {
        setConnection(saved);
        if (saved.instagram_user_id) {
          toast.success(`Instagram linked: @${saved.instagram_username || saved.instagram_user_id}`);
        } else {
          toast.error(saved.last_error || "Instagram still not detected — use Connect with Facebook");
        }
      }
    } finally {
      setSavingConnection(false);
    }
  }

  async function handleConnectFacebook() {
    setStartingOAuth(true);
    try {
      const url = await startMetaOAuth(typeof window !== "undefined" ? window.location.href : undefined);
      if (url) window.location.assign(url);
    } finally {
      setStartingOAuth(false);
    }
  }

  async function handleExtendInstagramToken() {
    setExtendingToken(true);
    try {
      await extendInstagramToken();
    } finally {
      setExtendingToken(false);
    }
  }

  async function handleSaveManualInstagram() {
    if (!user?.id) return;
    setSavingManualIg(true);
    try {
      const saved = await saveInstagramManualLink({
        userId: user.id,
        instagramUserId: manualIgId,
        instagramUsername: manualIgUsername,
      });
      if (saved) setConnection(saved);
    } finally {
      setSavingManualIg(false);
    }
  }

  async function handlePostNow() {
    if (!draft || !user?.id) return;
    setPosting(true);
    try {
      const updated = await postInstagramNow(draft.id, caption);
      if (updated) setDraft(updated);
      const latestConnection = await loadMetaConnection(user.id);
      setConnection(latestConnection);
    } finally {
      setPosting(false);
    }
  }

  const connectionStatus = connection?.status ?? "missing";
  const hasDraft = !!draft;
  const hasAiCaption = !!draft?.instagram_caption?.trim();
  const hasPage = !!connection?.facebook_page_id;
  const hasInstagram = !!connection?.instagram_user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-primary" />
            Instagram Post Now
          </DialogTitle>
          <DialogDescription>
            Test-mode Instagram posting for {flyerTitle}. Uses Instagram Login token (Extend for ~60 days).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
            Instagram needs a linked Business/Creator account on your Facebook Page, plus a public flyer thumbnail image URL.
          </div>

          <section className="space-y-3 rounded-md border border-border/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Meta / Instagram connection</h3>
                <p className="text-xs text-muted-foreground">Uses the Facebook Page already saved for test posting.</p>
              </div>
              <Badge variant={connectionBadgeVariant(connectionStatus)}>
                {connectionLabel(connectionStatus)}
              </Badge>
            </div>

            {!hasPage ? (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                Save a Facebook Page first in Facebook Post Now, then come back here.
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenFacebookPost();
                    }}
                  >
                    Open Facebook post
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Facebook Page: <span className="font-medium text-foreground">{connection?.facebook_page_name}</span>
                  {" "}({connection?.facebook_page_id})
                </p>
                {hasInstagram ? (
                  <p className="text-xs text-muted-foreground">
                    Instagram account: <span className="font-medium text-foreground">@{connection?.instagram_username || connection?.instagram_user_id}</span>
                  </p>
                ) : (
                  <p className="text-xs text-destructive">
                    No Instagram Business/Creator account detected on this Facebook Page yet.
                  </p>
                )}
                {connection?.last_error && (
                  <p className="text-xs text-destructive">{connection.last_error}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleRefreshConnection()}
                    disabled={loading || savingConnection || posting || startingOAuth || extendingToken}
                  >
                    {savingConnection ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Refresh Instagram link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleConnectFacebook()}
                    disabled={loading || savingConnection || posting || startingOAuth || extendingToken}
                  >
                    {startingOAuth ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Connect with Facebook
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleExtendInstagramToken()}
                    disabled={loading || savingConnection || posting || startingOAuth || extendingToken}
                  >
                    {extendingToken ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Extend Instagram token (60 days)
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Extend Instagram token turns your Meta Generate-token into a ~60-day token and stores it (auto-refreshes when near expiry).
                </p>
                {!hasInstagram && (
                  <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      Auto-detect failed. In Graph API Explorer, paste this exact path, Submit, then copy the Instagram <span className="font-medium text-foreground">id</span> number here.
                    </p>
                    <p className="break-all rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground">
                      {connection?.facebook_page_id
                        ? `${connection.facebook_page_id}?fields=instagram_business_account{id,username},connected_instagram_account{id,username}`
                        : ""}
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="manual-ig-id">Instagram User ID (numbers only)</Label>
                      <Input
                        id="manual-ig-id"
                        value={manualIgId}
                        onChange={(e) => setManualIgId(e.target.value)}
                        placeholder="1784140xxxxxxxxxx"
                        disabled={loading || savingManualIg || posting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manual-ig-username">Instagram username</Label>
                      <Input
                        id="manual-ig-username"
                        value={manualIgUsername}
                        onChange={(e) => setManualIgUsername(e.target.value)}
                        placeholder="carlojay.algordo"
                        disabled={loading || savingManualIg || posting}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSaveManualInstagram()}
                      disabled={loading || savingManualIg || posting || !manualIgId.trim()}
                    >
                      {savingManualIg ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Save Instagram ID
                    </Button>
                  </div>
                )}
                {!hasInstagram && (
                  <p className="text-xs text-muted-foreground">
                    If refresh fails, click <span className="font-medium text-foreground">Connect with Facebook</span> again so Meta re-reads the Instagram link with Instagram permissions.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="space-y-3 rounded-md border border-border/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Instagram caption</h3>
                <p className="text-xs text-muted-foreground">Reuse AI caption, or type one manually for this test post.</p>
              </div>
              {draft?.instagram_provider_status ? (
                <Badge variant={draft.instagram_provider_status === "failed" ? "destructive" : "outline"}>
                  {providerStatusLabel(draft.instagram_provider_status)}
                </Badge>
              ) : null}
            </div>

            {!hasDraft && (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                No marketing draft yet. Generate AI Social Copy first (or publish to create drafts), then come back here.
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

            {hasDraft && !hasAiCaption && (
              <p className="text-xs text-muted-foreground">
                No AI Instagram caption yet — type a test caption below (OpenAI regenerate can wait).
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="instagram-caption-copy">Caption to post</Label>
              <Textarea
                id="instagram-caption-copy"
                rows={8}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={loading || posting || !hasDraft}
                placeholder={hasDraft ? "Type an Instagram caption for this test post…" : undefined}
              />
            </div>

            {draft?.thumbnail_url && (
              <p className="text-xs text-muted-foreground break-all">
                Image source: <span className="font-medium text-foreground">{draft.thumbnail_url}</span>
              </p>
            )}
            {draft?.instagram_provider_post_id && (
              <p className="text-xs text-muted-foreground">
                Last provider post ID: <span className="font-medium text-foreground">{draft.instagram_provider_post_id}</span>
              </p>
            )}
            {draft?.instagram_last_error && (
              <p className="text-xs text-destructive">{draft.instagram_last_error}</p>
            )}
            {draft?.instagram_posted_at && (
              <p className="text-xs text-muted-foreground">
                Last successful test post: <span className="font-medium text-foreground">{new Date(draft.instagram_posted_at).toLocaleString()}</span>
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
              disabled={loading || savingConnection || posting || !draft || !caption.trim() || !hasPage || !hasInstagram}
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
