import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loadLatestMarketingDraft } from "@/lib/marketingAutomation";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export interface MassSmsRecipient {
  phone: string;
  name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipients: MassSmsRecipient[];
  flyerId: string;
  flyerTitle: string;
  flyerUrl: string;
}

const SERVER_MAX = 50;

export function MassSmsDialog({
  open,
  onOpenChange,
  recipients,
  flyerId,
  flyerTitle,
  flyerUrl,
}: Props) {
  const [body, setBody] = useState("");
  const [includeLink, setIncludeLink] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [prefilledFromAi, setPrefilledFromAi] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoadingDraft(true);
      setPrefilledFromAi(false);
      try {
        const draft = await loadLatestMarketingDraft(flyerId);
        if (cancelled) return;
        const ai = draft?.sms_body?.trim() || "";
        if (ai) {
          setBody(ai);
          const alreadyHasLink =
            !!flyerUrl && (ai.includes(flyerUrl) || /https?:\/\//i.test(ai));
          setIncludeLink(!alreadyHasLink);
          setPrefilledFromAi(true);
        } else {
          setBody(`Hi — quick update about ${flyerTitle}`);
          setIncludeLink(true);
        }
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, flyerId, flyerTitle, flyerUrl]);

  const finalBody = useMemo(() => {
    let b = body.trim();
    if (includeLink && flyerUrl && !b.includes(flyerUrl)) {
      b = `${b} ${flyerUrl}`.trim();
    }
    return b.slice(0, 320);
  }, [body, includeLink, flyerUrl]);

  async function sendViaServer() {
    if (!finalBody.trim()) {
      toast.error("Add a message first");
      return;
    }
    if (recipients.length === 0) {
      toast.error("No recipients with phone numbers");
      return;
    }
    if (recipients.length > SERVER_MAX) {
      toast.error(`Max ${SERVER_MAX} SMS recipients per send`);
      return;
    }

    setSending(true);
    try {
      const result = await invokeEdgeFunction<{
        sent: number;
        failed: number;
        total: number;
        errors?: string[];
      }>("send-subscriber-sms", {
        flyer_id: flyerId,
        message: finalBody,
        recipient_phones: recipients.map((r) => r.phone),
      });

      if (result.failed > 0) {
        toast.message(`Sent ${result.sent}/${result.total}`, {
          description: result.errors?.slice(0, 2).join(" · ") || `${result.failed} failed`,
        });
      } else {
        toast.success(`Sent SMS to ${result.sent} subscriber${result.sent === 1 ? "" : "s"}`);
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SMS send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Mass SMS — {recipients.length} with phone
          </DialogTitle>
          <DialogDescription>
            Prefills from AI SMS draft when available. Requires Twilio secrets. Phones should include country code (e.g. +63…).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loadingDraft ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading AI SMS draft…
            </div>
          ) : prefilledFromAi ? (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Prefilled from AI Social Copy — edit before sending.
            </div>
          ) : null}

          <div>
            <Label className="text-xs">Message ({finalBody.length}/320)</Label>
            <Textarea
              rows={5}
              value={body}
              maxLength={320}
              placeholder="Short SMS…"
              onChange={(e) => setBody(e.target.value)}
              disabled={loadingDraft || sending}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includeLink}
              onChange={(e) => setIncludeLink(e.target.checked)}
              disabled={loadingDraft || sending}
            />
            Include the flyer link
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void sendViaServer()}
            disabled={loadingDraft || sending || recipients.length === 0}
          >
            {sending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            Send SMS now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
