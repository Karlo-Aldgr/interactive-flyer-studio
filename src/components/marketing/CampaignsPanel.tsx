import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AudienceRules,
  CAMPAIGN_TYPES,
  EMPTY_RULES,
  MarketingAudience,
  MarketingCampaign,
  MarketingClient,
  PERSONALIZATION_VARS,
  evaluateSubscriberRules,
  fetchAudiences,
  fetchCampaigns,
  fetchSubscribers,
  renderTemplate,
  saveCampaign,
  setCampaignStatus,
} from "@/lib/marketing";

type Props = {
  clientId: string | null | undefined;
  isAdmin?: boolean;
  clients?: MarketingClient[];
  businessName?: string;
};

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  sent: "secondary",
  draft: "outline",
  scheduled: "outline",
  sending: "outline",
  failed: "destructive",
  cancelled: "outline",
  archived: "outline",
};

export function CampaignsPanel({ clientId, isAdmin, businessName }: Props) {
  const [rows, setRows] = useState<MarketingCampaign[]>([]);
  const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("newsletter");
  const [audienceId, setAudienceId] = useState("all");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([fetchCampaigns(clientId), fetchAudiences(clientId, "subscriber")]);
      setRows(c);
      setAudiences(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load campaigns");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedAudience = useMemo(
    () => audiences.find((a) => a.id === audienceId) ?? null,
    [audiences, audienceId],
  );

  const resolveRules = (): AudienceRules =>
    (selectedAudience?.rules as AudienceRules) ?? EMPTY_RULES;

  const countRecipients = useCallback(async () => {
    const subs = await fetchSubscribers({ clientId, status: "active" });
    return evaluateSubscriberRules(subs, resolveRules()).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, selectedAudience]);

  useEffect(() => {
    if (!open) return;
    countRecipients().then(setRecipients).catch(() => setRecipients(null));
  }, [open, countRecipients]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setType("newsletter");
    setAudienceId("all");
    setSubject("");
    setBodyText("");
    setCtaText("");
    setCtaUrl("");
    setScheduledAt("");
    setOpen(true);
  };

  const openEdit = (c: MarketingCampaign) => {
    setEditing(c);
    setName(c.name);
    setType(c.campaign_type);
    setAudienceId(c.audience_id ?? "all");
    setSubject(c.subject ?? "");
    setBodyText(c.body ?? "");
    setCtaText(c.cta_text ?? "");
    setCtaUrl(c.cta_url ?? "");
    setScheduledAt(c.scheduled_at ? c.scheduled_at.slice(0, 16) : "");
    setOpen(true);
  };

  const persist = async (status: "draft" | "scheduled") => {
    if (!name.trim()) throw new Error("Campaign needs a name");
    if (!subject.trim()) throw new Error("Campaign needs a subject");
    if (!bodyText.trim()) throw new Error("Campaign needs a message");
    const count = await countRecipients();
    return saveCampaign({
      id: editing?.id,
      client_id: clientId === undefined ? null : clientId,
      name,
      campaign_type: type,
      channel: "email",
      audience_id: selectedAudience?.id ?? null,
      audience_label: selectedAudience?.name ?? "All active subscribers",
      audience_rules: resolveRules(),
      recipient_count: count,
      subject,
      body: bodyText,
      cta_text: ctaText.trim() || null,
      cta_url: ctaUrl.trim() || null,
      status,
      scheduled_at: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
  };

  const saveDraft = async (status: "draft" | "scheduled" = "draft") => {
    setBusy(true);
    try {
      await persist(status);
      toast.success(status === "scheduled" ? "Campaign scheduled" : "Draft saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save campaign");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Enter a test email address");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-send", {
        body: {
          action: "test_campaign",
          to: testEmail.trim(),
          client_id: clientId === undefined ? null : clientId,
          subject,
          body: bodyText,
          cta_text: ctaText,
          cta_url: ctaUrl,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Test email sent to ${testEmail}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    setBusy(true);
    try {
      const id = await persist("draft");
      const { data, error } = await supabase.functions.invoke("marketing-send", {
        body: { action: "send_campaign", campaign_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Campaign sent to ${(data as any)?.sent ?? 0} subscriber(s)`);
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const previewBody = renderTemplate(bodyText, {
    first_name: "Alex",
    last_name: "Rivera",
    email: "alex@example.com",
    business_name: businessName || "TapThatFlyer",
    unsubscribe_link: "Unsubscribe",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Email campaigns sent to your own subscribers only.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New campaign
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-14 text-center text-sm text-muted-foreground">
          No campaigns yet.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {c.campaign_type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.audience_label || "All active subscribers"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.sent_count}/{c.recipient_count}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(c.sent_at ?? c.scheduled_at ?? c.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        {c.status === "sent" ? "View" : "Edit"}
                      </Button>
                      {c.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await setCampaignStatus(c.id, "cancelled");
                            load();
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select value={audienceId} onValueChange={setAudienceId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All active subscribers</SelectItem>
                      {audiences.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={10} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Variables: {PERSONALIZATION_VARS.join(" ")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Button text</Label>
                  <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                </div>
                <div>
                  <Label>Button link</Label>
                  <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recipients</p>
                <p className="text-2xl font-bold">{recipients ?? "…"}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAudience?.name ?? "All active subscribers"}
                </p>
              </Card>
              <Card className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                <p className="font-semibold">{subject || "Subject line"}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {previewBody || "Your message appears here."}
                </p>
                {ctaText && (
                  <span className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                    {ctaText}
                  </span>
                )}
              </Card>
              <Card className="space-y-2 p-4">
                <Label>Send test email</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button variant="outline" onClick={sendTest} disabled={busy}>
                    Test
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => saveDraft("draft")} disabled={busy}>
              Save draft
            </Button>
            {scheduledAt && (
              <Button variant="outline" onClick={() => saveDraft("scheduled")} disabled={busy}>
                Schedule
              </Button>
            )}
            <Button onClick={sendNow} disabled={busy}>
              <Send className="mr-1 h-4 w-4" />
              {busy ? "Working…" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
