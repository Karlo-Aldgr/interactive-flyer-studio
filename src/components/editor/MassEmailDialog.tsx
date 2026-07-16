import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, ExternalLink, Loader2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { loadLatestMarketingDraft } from "@/lib/marketingAutomation";
import { safeCopyToClipboard } from "@/lib/safeBrowser";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export interface MassEmailRecipient {
  email: string;
  name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipients: MassEmailRecipient[];
  flyerId: string;
  flyerTitle: string;
  flyerUrl: string;
}

const CHUNK = 90; // safe BCC chunk for most mail clients
const SERVER_MAX = 100;

export function MassEmailDialog({
  open,
  onOpenChange,
  recipients,
  flyerId,
  flyerTitle,
  flyerUrl,
}: Props) {
  const [subject, setSubject] = useState("");
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
        const aiSubject = draft?.email_subject?.trim() || "";
        const aiBody = draft?.email_body?.trim() || "";
        if (aiSubject || aiBody) {
          setSubject(aiSubject || `News about ${flyerTitle}`);
          setBody(aiBody);
          // AI body usually already includes the flyer URL — avoid duplicating it.
          const alreadyHasLink =
            !!flyerUrl && (aiBody.includes(flyerUrl) || /https?:\/\//i.test(aiBody));
          setIncludeLink(!alreadyHasLink);
          setPrefilledFromAi(true);
        } else {
          setSubject(`News about ${flyerTitle}`);
          setBody("");
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

  const chunks = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < recipients.length; i += CHUNK) {
      out.push(recipients.slice(i, i + CHUNK).map((r) => r.email));
    }
    return out;
  }, [recipients]);

  const finalBody = useMemo(() => {
    let b = body.trim();
    if (includeLink && flyerUrl) {
      b = `${b}\n\n${flyerUrl}`;
    }
    return b;
  }, [body, includeLink, flyerUrl]);

  function buildMailto(bcc: string[]) {
    // Prefer encodeURIComponent (%20) over URLSearchParams (+) — Outlook/Mail app
    // often shows literal "+" for spaces when using form-urlencoded style.
    const parts: string[] = [];
    if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
    if (finalBody) parts.push(`body=${encodeURIComponent(finalBody)}`);
    if (bcc.length) parts.push(`bcc=${encodeURIComponent(bcc.join(","))}`);
    return `mailto:?${parts.join("&")}`;
  }

  function buildGmail(bcc: string[]) {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      bcc: bcc.join(","),
      su: subject,
      body: finalBody,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  async function copyAllEmails() {
    const text = recipients.map((r) => r.email).join(", ");
    const ok = await safeCopyToClipboard(text);
    if (ok) toast.success(`Copied ${recipients.length} email${recipients.length === 1 ? "" : "s"}`);
    else toast.error("Copy failed");
  }

  async function sendViaServer() {
    if (!subject.trim() || !finalBody.trim()) {
      toast.error("Add a subject and message first");
      return;
    }
    if (recipients.length === 0) {
      toast.error("No recipients selected");
      return;
    }
    if (recipients.length > SERVER_MAX) {
      toast.error(`Server send supports up to ${SERVER_MAX} recipients. Select fewer, or use Gmail/Mail app batches.`);
      return;
    }

    setSending(true);
    try {
      const result = await invokeEdgeFunction<{
        sent: number;
        failed: number;
        total: number;
        errors?: string[];
      }>("send-subscriber-email", {
        flyer_id: flyerId,
        subject: subject.trim(),
        body: finalBody,
        recipient_emails: recipients.map((r) => r.email),
      });

      if (result.failed > 0) {
        toast.message(`Sent ${result.sent}/${result.total}`, {
          description: result.errors?.slice(0, 2).join(" · ") || `${result.failed} failed`,
        });
      } else {
        toast.success(`Sent to ${result.sent} subscriber${result.sent === 1 ? "" : "s"}`);
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Mass email — {recipients.length} subscriber
            {recipients.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Prefills from AI Social Copy when available. Use <strong>Send now</strong> for server delivery
            (Resend), or open Gmail / Mail app as a fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loadingDraft ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading AI email draft…
            </div>
          ) : prefilledFromAi ? (
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Prefilled from AI Social Copy — edit before sending.
            </div>
          ) : null}

          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              maxLength={250}
              placeholder={`News about ${flyerTitle}`}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loadingDraft || sending}
            />
          </div>
          <div>
            <Label className="text-xs">Message</Label>
            <Textarea
              rows={8}
              value={body}
              maxLength={5000}
              placeholder="Hi friends, just wanted to share..."
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
            Include the flyer link at the bottom
          </label>

          {chunks.length > 1 && (
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              {recipients.length} recipients exceeds the safe-per-message limit for mail apps. They&apos;ve been split into{" "}
              <strong>{chunks.length}</strong> batches — open each one to send, or select ≤{SERVER_MAX} for{" "}
              <strong>Send now</strong>.
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button
            type="button"
            size="sm"
            onClick={() => void sendViaServer()}
            disabled={loadingDraft || sending || recipients.length === 0}
          >
            {sending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            Send now
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyAllEmails()} disabled={sending}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy all emails
            </Button>
            {chunks.map((bcc, i) => (
              <div key={i} className="flex gap-2">
                <Button asChild size="sm" variant="outline" disabled={loadingDraft || sending}>
                  <a href={buildGmail(bcc)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Gmail{" "}
                    {chunks.length > 1 ? `${i + 1}/${chunks.length}` : ""}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" disabled={loadingDraft || sending}>
                  <a href={buildMailto(bcc)}>
                    <Mail className="mr-1 h-3.5 w-3.5" /> Mail app{" "}
                    {chunks.length > 1 ? `${i + 1}/${chunks.length}` : ""}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
