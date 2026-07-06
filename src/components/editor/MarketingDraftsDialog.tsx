import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { safeCopyToClipboard } from "@/lib/safeBrowser";
import { toast } from "sonner";
import {
  loadLatestMarketingDraft,
  regenerateMarketingDraft,
  type MarketingDraft,
} from "@/lib/marketingAutomation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  ownerId: string;
  flyerTitle: string;
}

function statusLabel(status: MarketingDraft["status"]): string {
  switch (status) {
    case "pending": return "Queued";
    case "processing": return "Generating…";
    case "ready": return "Ready";
    case "failed": return "Failed";
  }
}

export function MarketingDraftsDialog({ open, onOpenChange, flyerId, ownerId, flyerTitle }: Props) {
  const [draft, setDraft] = useState<MarketingDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const row = await loadLatestMarketingDraft(flyerId);
      setDraft(row);
    } finally {
      setLoading(false);
    }
  }, [flyerId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !draft) return;
    if (draft.status !== "pending" && draft.status !== "processing") return;
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [open, draft?.status, draft?.id, refresh]);

  async function copyText(label: string, text: string) {
    const ok = await safeCopyToClipboard(text);
    if (ok) toast.success(`${label} copied`);
    else toast.error("Copy failed");
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateMarketingDraft(flyerId, ownerId);
      await refresh();
    } finally {
      setRegenerating(false);
    }
  }

  const busy = loading && !draft;
  const working = draft?.status === "pending" || draft?.status === "processing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI marketing posts
          </DialogTitle>
          <DialogDescription>
            Draft Facebook and Instagram copy for <span className="font-medium">{flyerTitle}</span>.
            Review and paste into each platform — nothing is posted automatically in Phase 1.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !draft ? (
          <div className="space-y-3 py-4 text-sm text-muted-foreground">
            <p>No drafts yet. Publish the flyer or tap Regenerate to create Facebook and Instagram copy.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Status: <span className="font-medium text-foreground">{statusLabel(draft.status)}</span></span>
              {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>

            {draft.status === "failed" && draft.error_message && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {draft.error_message}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="fb-post">Facebook post</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!draft.facebook_post}
                  onClick={() => void copyText("Facebook post", draft.facebook_post || "")}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="fb-post"
                readOnly
                rows={6}
                value={draft.facebook_post || (working ? "Generating…" : "")}
                placeholder={working ? "Generating…" : "No Facebook draft yet"}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ig-caption">Instagram caption</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!draft.instagram_caption}
                  onClick={() => void copyText("Instagram caption", draft.instagram_caption || "")}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="ig-caption"
                readOnly
                rows={5}
                value={draft.instagram_caption || (working ? "Generating…" : "")}
                placeholder={working ? "Generating…" : "No Instagram draft yet"}
              />
            </div>

            {draft.flyer_url && (
              <p className="text-xs text-muted-foreground">
                Link included in drafts:{" "}
                <a href={draft.flyer_url} target="_blank" rel="noreferrer" className="underline">
                  {draft.flyer_url}
                </a>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleRegenerate()} disabled={regenerating || working}>
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
