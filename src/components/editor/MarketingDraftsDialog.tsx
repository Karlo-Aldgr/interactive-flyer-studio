import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { safeCopyToClipboard } from "@/lib/safeBrowser";
import { toast } from "sonner";
import {
  formatScheduleLabel,
  fromLocalInputValue,
  loadLatestMarketingDraft,
  markMarketingChannelPosted,
  regenerateMarketingDraft,
  saveManualMarketingCopy,
  scheduleMarketingChannel,
  toLocalInputValue,
  unscheduleMarketingChannel,
  type MarketingChannel,
  type MarketingChannelStatus,
  type MarketingDraft,
} from "@/lib/marketingAutomation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  ownerId: string;
  flyerTitle: string;
}

function genStatusLabel(status: MarketingDraft["status"]): string {
  switch (status) {
    case "pending": return "Queued";
    case "processing": return "Generating…";
    case "ready": return "Ready";
    case "failed": return "Failed";
  }
}

function channelStatusLabel(status: MarketingChannelStatus): string {
  switch (status) {
    case "draft": return "Draft";
    case "scheduled": return "Scheduled";
    case "posted": return "Posted";
    case "failed": return "Failed";
  }
}

function isMetaDelivered(channel: MarketingChannel, draft: MarketingDraft): boolean {
  if (channel === "facebook") {
    return draft.facebook_provider_status === "posted" && !!draft.facebook_provider_post_id;
  }
  return draft.instagram_provider_status === "posted" && !!draft.instagram_provider_post_id;
}

function postedHowLabel(channel: MarketingChannel, draft: MarketingDraft): string {
  const postedAt = channel === "facebook" ? draft.facebook_posted_at : draft.instagram_posted_at;
  const when = postedAt ? formatScheduleLabel(postedAt) : "";
  if (isMetaDelivered(channel, draft)) {
    return channel === "facebook"
      ? `Posted to Facebook ${when}`
      : `Posted to Instagram ${when}`;
  }
  return `Marked posted manually ${when}`;
}

function channelBadgeVariant(
  status: MarketingChannelStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "scheduled": return "default";
    case "posted": return "secondary";
    case "failed": return "destructive";
    default: return "outline";
  }
}

function defaultScheduleInput(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return toLocalInputValue(d.toISOString());
}

function ChannelSchedulePanel({
  channel,
  label,
  draft,
  busy,
  onUpdated,
}: {
  channel: MarketingChannel;
  label: string;
  draft: MarketingDraft;
  busy: boolean;
  onUpdated: (row: MarketingDraft) => void;
}) {
  const status = channel === "facebook" ? draft.facebook_status : draft.instagram_status;
  const scheduledFor = channel === "facebook" ? draft.facebook_scheduled_for : draft.instagram_scheduled_for;
  const postedAt = channel === "facebook" ? draft.facebook_posted_at : draft.instagram_posted_at;
  const errorMessage = channel === "facebook" ? draft.facebook_error_message : draft.instagram_error_message;
  const hasCopy = channel === "facebook" ? !!draft.facebook_post : !!draft.instagram_caption;
  const metaDelivered = isMetaDelivered(channel, draft);
  const statusBadge =
    status === "posted"
      ? metaDelivered
        ? "Posted"
        : "Marked"
      : channelStatusLabel(status);

  const [when, setWhen] = useState(() => toLocalInputValue(scheduledFor) || defaultScheduleInput());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWhen(toLocalInputValue(scheduledFor) || defaultScheduleInput());
  }, [scheduledFor, draft.id]);

  async function run(action: () => Promise<MarketingDraft | null>) {
    setSaving(true);
    try {
      const updated = await action();
      if (updated) onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={channelBadgeVariant(status)}>{statusBadge}</Badge>
      </div>

      {status === "scheduled" && scheduledFor && (
        <p className="text-xs text-muted-foreground">
          Scheduled for <span className="font-medium text-foreground">{formatScheduleLabel(scheduledFor)}</span>
          {channel === "facebook" ? " — will auto-post to Facebook" : ""}
        </p>
      )}
      {status === "posted" && postedAt && (
        <p className="text-xs text-muted-foreground">
          {postedHowLabel(channel, draft)}
          {metaDelivered && channel === "facebook" && draft.facebook_provider_post_id ? (
            <>
              {" "}
              <span className="text-muted-foreground/80">(id {draft.facebook_provider_post_id})</span>
            </>
          ) : null}
        </p>
      )}
      {status === "failed" && errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {(status === "draft" || status === "failed" || status === "scheduled" || status === "posted") && (
        <div className="space-y-2">
          <Label htmlFor={`${channel}-when`} className="text-xs">
            {status === "scheduled" ? "Change schedule" : status === "posted" ? "Schedule again" : "Schedule for"}
          </Label>
          <Input
            id={`${channel}-when`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={busy || saving || !hasCopy}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(status === "draft" || status === "failed" || status === "posted") && (
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={busy || saving || !hasCopy || !when}
            onClick={() => {
              const iso = fromLocalInputValue(when);
              if (!iso) {
                toast.error("Pick a valid date and time");
                return;
              }
              void run(() => scheduleMarketingChannel(draft.id, channel, iso));
            }}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {status === "posted" ? "Schedule again" : "Schedule"}
          </Button>
        )}

        {status === "scheduled" && (
          <>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={busy || saving || !hasCopy || !when}
              onClick={() => {
                const iso = fromLocalInputValue(when);
                if (!iso) {
                  toast.error("Pick a valid date and time");
                  return;
                }
                void run(() => scheduleMarketingChannel(draft.id, channel, iso));
              }}
            >
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Update schedule
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={busy || saving}
              onClick={() => void run(() => unscheduleMarketingChannel(draft.id, channel))}
            >
              Unschedule
            </Button>
          </>
        )}

        {status !== "posted" && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            disabled={busy || saving || !hasCopy}
            onClick={() => void run(() => markMarketingChannelPosted(draft.id, channel))}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Mark posted manually
          </Button>
        )}
      </div>

      {!hasCopy && (
        <p className="text-[11px] text-muted-foreground">Generate AI copy first, then schedule this channel.</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {channel === "facebook"
          ? "Schedule = auto-post to Facebook at that time. Mark posted manually = track only, no Meta send."
          : "Schedule = auto-post to Instagram at that time (needs Instagram User ID + META_INSTAGRAM_USER_ACCESS_TOKEN). Mark posted manually = track only."}
      </p>
    </div>
  );
}

export function MarketingDraftsDialog({ open, onOpenChange, flyerId, ownerId, flyerTitle }: Props) {
  const [draft, setDraft] = useState<MarketingDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [facebookPost, setFacebookPost] = useState("");
  const [instagramCaption, setInstagramCaption] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [tiktokCaption, setTiktokCaption] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [googleAdsHeadline, setGoogleAdsHeadline] = useState("");
  const [googleAdsDescription, setGoogleAdsDescription] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const row = await loadLatestMarketingDraft(flyerId);
      setDraft(row);
      if (row) {
        setFacebookPost(row.facebook_post || "");
        setInstagramCaption(row.instagram_caption || "");
        setEmailSubject(row.email_subject || "");
        setEmailBody(row.email_body || "");
        setTiktokCaption(row.tiktok_caption || "");
        setSmsBody(row.sms_body || "");
        setGoogleAdsHeadline(row.google_ads_headline || "");
        setGoogleAdsDescription(row.google_ads_description || "");
      }
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

  async function handleSaveManual() {
    if (!draft) return;
    setSavingManual(true);
    try {
      const saved = await saveManualMarketingCopy({
        draftId: draft.id,
        facebookPost,
        instagramCaption,
        emailSubject,
        emailBody,
        tiktokCaption,
        smsBody,
        googleAdsHeadline,
        googleAdsDescription,
      });
      if (saved) setDraft(saved);
    } finally {
      setSavingManual(false);
    }
  }

  const busy = loading && !draft;
  const working = draft?.status === "pending" || draft?.status === "processing";
  const ready = draft?.status === "ready";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI marketing posts
          </DialogTitle>
          <DialogDescription>
            Draft Facebook, Instagram, email, TikTok, SMS, and Google Ads copy for{" "}
            <span className="font-medium">{flyerTitle}</span>.
            Facebook and Instagram can schedule auto-post in Meta test mode. Email, TikTok, SMS, and Google Ads are copy/paste only (no auto-send yet).
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
              <span>
                AI status: <span className="font-medium text-foreground">{genStatusLabel(draft.status)}</span>
              </span>
              {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>

            {working && (
              <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                AI is stuck or slow. Type your posts below and click <span className="font-medium text-foreground">Save copy</span> to continue.
              </p>
            )}

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
                  disabled={!facebookPost.trim()}
                  onClick={() => void copyText("Facebook post", facebookPost)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="fb-post"
                rows={5}
                value={facebookPost}
                onChange={(e) => setFacebookPost(e.target.value)}
                placeholder="Type Facebook post here…"
                disabled={savingManual || regenerating}
              />
              {ready && (
                <ChannelSchedulePanel
                  channel="facebook"
                  label="Facebook publishing"
                  draft={draft}
                  busy={working || regenerating || savingManual}
                  onUpdated={setDraft}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ig-caption">Instagram caption</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!instagramCaption.trim()}
                  onClick={() => void copyText("Instagram caption", instagramCaption)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="ig-caption"
                rows={4}
                value={instagramCaption}
                onChange={(e) => setInstagramCaption(e.target.value)}
                placeholder="Type Instagram caption here…"
                disabled={savingManual || regenerating}
              />
              {ready && (
                <ChannelSchedulePanel
                  channel="instagram"
                  label="Instagram publishing"
                  draft={draft}
                  busy={working || regenerating || savingManual}
                  onUpdated={setDraft}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-subject">Email subject</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!emailSubject.trim()}
                  onClick={() => void copyText("Email subject", emailSubject)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line…"
                disabled={savingManual || regenerating}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-body">Email body</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!emailBody.trim()}
                  onClick={() => void copyText("Email body", emailBody)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="email-body"
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Plain-text email draft…"
                disabled={savingManual || regenerating}
              />
              <p className="text-xs text-muted-foreground">
                Copy/paste works here. To send to subscribers: Portal menu → Subscribers → Compose mass email → Send now
                (prefills this draft).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tiktok-caption">TikTok caption</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!tiktokCaption.trim()}
                  onClick={() => void copyText("TikTok caption", tiktokCaption)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="tiktok-caption"
                rows={3}
                value={tiktokCaption}
                onChange={(e) => setTiktokCaption(e.target.value)}
                placeholder="Short TikTok caption…"
                disabled={savingManual || regenerating}
              />
              <p className="text-xs text-muted-foreground">Copy/paste only — no TikTok post in this version.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-body">SMS text</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!smsBody.trim()}
                  onClick={() => void copyText("SMS text", smsBody)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="sms-body"
                rows={2}
                value={smsBody}
                maxLength={320}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder="Short SMS…"
                disabled={savingManual || regenerating}
              />
              <p className="text-xs text-muted-foreground">
                Copy/paste only — no SMS send ({smsBody.length}/320).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="gads-headline">Google Ads headline</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!googleAdsHeadline.trim()}
                  onClick={() => void copyText("Google Ads headline", googleAdsHeadline)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Input
                id="gads-headline"
                value={googleAdsHeadline}
                maxLength={30}
                onChange={(e) => setGoogleAdsHeadline(e.target.value)}
                placeholder="Headline (max 30)…"
                disabled={savingManual || regenerating}
              />
              <p className="text-xs text-muted-foreground">{googleAdsHeadline.length}/30</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="gads-description">Google Ads description</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={!googleAdsDescription.trim()}
                  onClick={() => void copyText("Google Ads description", googleAdsDescription)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <Textarea
                id="gads-description"
                rows={2}
                value={googleAdsDescription}
                maxLength={90}
                onChange={(e) => setGoogleAdsDescription(e.target.value)}
                placeholder="Description (max 90)…"
                disabled={savingManual || regenerating}
              />
              <p className="text-xs text-muted-foreground">
                Copy/paste only — no Google Ads publish ({googleAdsDescription.length}/90).
              </p>
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

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {draft && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSaveManual()}
              disabled={
                savingManual ||
                regenerating ||
                (!facebookPost.trim() &&
                  !instagramCaption.trim() &&
                  !emailSubject.trim() &&
                  !emailBody.trim() &&
                  !tiktokCaption.trim() &&
                  !smsBody.trim() &&
                  !googleAdsHeadline.trim() &&
                  !googleAdsDescription.trim())
              }
            >
              {savingManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save copy
            </Button>
          )}
          <Button type="button" onClick={() => void handleRegenerate()} disabled={regenerating || savingManual}>
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
