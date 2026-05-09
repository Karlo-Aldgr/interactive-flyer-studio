import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export interface MassEmailRecipient {
  email: string;
  name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipients: MassEmailRecipient[];
  flyerTitle: string;
  flyerUrl: string;
}

const CHUNK = 90; // safe BCC chunk for most mail clients

export function MassEmailDialog({ open, onOpenChange, recipients, flyerTitle, flyerUrl }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeLink, setIncludeLink] = useState(true);

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
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (finalBody) params.set("body", finalBody);
    params.set("bcc", bcc.join(","));
    return `mailto:?${params.toString()}`;
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

  function copyAllEmails() {
    const text = recipients.map((r) => r.email).join(", ");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${recipients.length} email${recipients.length === 1 ? "" : "s"}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Mass email — {recipients.length} subscriber{recipients.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Composes an email in your default mail app with everyone in BCC. For high-volume sends, use the CSV
            export with Mailchimp, Resend, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              maxLength={250}
              placeholder={`News about ${flyerTitle}`}
              onChange={(e) => setSubject(e.target.value)}
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
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includeLink}
              onChange={(e) => setIncludeLink(e.target.checked)}
            />
            Include the flyer link at the bottom
          </label>

          {chunks.length > 1 && (
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              {recipients.length} recipients exceeds the safe-per-message limit. They've been split into{" "}
              <strong>{chunks.length}</strong> batches — open each one to send.
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyAllEmails}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy all emails
          </Button>
          {chunks.map((bcc, i) => (
            <div key={i} className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={buildGmail(bcc)} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Gmail {chunks.length > 1 ? `${i + 1}/${chunks.length}` : ""}
                </a>
              </Button>
              <Button asChild size="sm">
                <a href={buildMailto(bcc)}>
                  <Mail className="mr-1 h-3.5 w-3.5" /> Mail app {chunks.length > 1 ? `${i + 1}/${chunks.length}` : ""}
                </a>
              </Button>
            </div>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
