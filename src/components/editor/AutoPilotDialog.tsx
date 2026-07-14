import { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  loadLatestMarketingDraft,
  regenerateMarketingDraft,
  type MarketingChannelStatus,
  type MarketingDraft,
} from "@/lib/marketingAutomation";

type AutoPilotOptionId =
  | "facebook"
  | "instagram"
  | "email"
  | "analytics"
  | "tiktok"
  | "google_ads"
  | "sms"
  | "chatbot"
  | "qr"
  | "autopilot_all";

type AutoPilotOption = {
  id: AutoPilotOptionId;
  label: string;
  enabled: boolean;
  hint?: string;
};

const OPTIONS: AutoPilotOption[] = [
  { id: "facebook", label: "Create Facebook Campaign", enabled: true, hint: "AI post + schedule / Post Now" },
  { id: "instagram", label: "Create Instagram Campaign", enabled: true, hint: "AI caption + schedule / Post Now" },
  { id: "email", label: "Create Email Campaign", enabled: true, hint: "Subject + body (copy/paste only)" },
  { id: "tiktok", label: "Create TikTok Video", enabled: true, hint: "Caption draft (copy/paste only)" },
  { id: "sms", label: "Create SMS Campaign", enabled: true, hint: "SMS draft (copy/paste only)" },
  { id: "google_ads", label: "Create Google Ads", enabled: true, hint: "Headline + description (copy/paste only)" },
  { id: "analytics", label: "AI Analytics", enabled: true, hint: "Uses portal Suggestions (Phase 3)" },
  { id: "chatbot", label: "AI Chatbot", enabled: false },
  { id: "qr", label: "AI QR Code", enabled: false },
  { id: "autopilot_all", label: "AutoPilot Marketing (everything)", enabled: false },
];

function channelLabel(status: MarketingChannelStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "posted":
      return "Posted";
    case "failed":
      return "Failed";
    default:
      return "Draft";
  }
}

function emailReady(draft: MarketingDraft | null): boolean {
  return !!(draft?.email_subject?.trim() || draft?.email_body?.trim());
}

function tiktokReady(draft: MarketingDraft | null): boolean {
  return !!draft?.tiktok_caption?.trim();
}

function smsReady(draft: MarketingDraft | null): boolean {
  return !!draft?.sms_body?.trim();
}

function googleAdsReady(draft: MarketingDraft | null): boolean {
  return !!(draft?.google_ads_headline?.trim() || draft?.google_ads_description?.trim());
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  ownerId: string;
  flyerTitle: string;
  onOpenMarketing: () => void;
  portalPath?: string;
}

export function AutoPilotDialog({
  open,
  onOpenChange,
  flyerId,
  ownerId,
  flyerTitle,
  onOpenMarketing,
  portalPath,
}: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    facebook: true,
    instagram: true,
    email: true,
    tiktok: true,
    sms: true,
    google_ads: true,
    analytics: true,
  });
  const [draft, setDraft] = useState<MarketingDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

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

  function toggle(id: string, enabled: boolean) {
    if (!enabled) return;
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleStart() {
    const wantsCopy =
      !!selected.facebook ||
      !!selected.instagram ||
      !!selected.email ||
      !!selected.tiktok ||
      !!selected.sms ||
      !!selected.google_ads;
    const wantsAnalytics = !!selected.analytics;

    if (!wantsCopy && !wantsAnalytics) {
      toast.error("Select at least one available option");
      return;
    }

    setStarting(true);
    try {
      if (wantsCopy) {
        await regenerateMarketingDraft(flyerId, ownerId);
        // Give the edge function a moment, then reload
        await new Promise((r) => window.setTimeout(r, 1500));
        const row = await loadLatestMarketingDraft(flyerId);
        setDraft(row);

        const parts: string[] = [];
        if (selected.facebook) {
          parts.push(
            row?.facebook_post?.trim()
              ? `Facebook: ${channelLabel(row.facebook_status)}`
              : "Facebook: generating…",
          );
        }
        if (selected.instagram) {
          parts.push(
            row?.instagram_caption?.trim()
              ? `Instagram: ${channelLabel(row.instagram_status)}`
              : "Instagram: generating…",
          );
        }
        if (selected.email) {
          parts.push(emailReady(row) ? "Email: copy ready" : "Email: generating…");
        }
        if (selected.tiktok) {
          parts.push(tiktokReady(row) ? "TikTok: copy ready" : "TikTok: generating…");
        }
        if (selected.sms) {
          parts.push(smsReady(row) ? "SMS: copy ready" : "SMS: generating…");
        }
        if (selected.google_ads) {
          parts.push(googleAdsReady(row) ? "Google Ads: copy ready" : "Google Ads: generating…");
        }
        toast.success(parts.join(" · ") || "AutoPilot started");
      }

      if (wantsAnalytics) {
        const path = portalPath || `/flyer/${flyerId}/portal`;
        toast.message("Analytics", {
          description: `Open Suggestions on the flyer portal for improvement tips.`,
          action: {
            label: "Open portal",
            onClick: () => {
              window.open(path, "_blank", "noopener,noreferrer");
            },
          },
        });
      }

      if (wantsCopy) {
        onOpenChange(false);
        onOpenMarketing();
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Tap That Flyer AI — AutoPilot
          </DialogTitle>
          <DialogDescription>
            Check what you want for <span className="font-medium text-foreground">{flyerTitle}</span>, then hit{" "}
            <span className="font-medium text-foreground">START</span>. Live channels use your existing AI copy and Meta tools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {draft && (
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">Current status</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">FB {channelLabel(draft.facebook_status)}</Badge>
                <Badge variant="outline">IG {channelLabel(draft.instagram_status)}</Badge>
                <Badge variant="outline">{emailReady(draft) ? "Email ready" : "Email empty"}</Badge>
                <Badge variant="outline">{tiktokReady(draft) ? "TikTok ready" : "TikTok empty"}</Badge>
                <Badge variant="outline">{smsReady(draft) ? "SMS ready" : "SMS empty"}</Badge>
                <Badge variant="outline">{googleAdsReady(draft) ? "Ads ready" : "Ads empty"}</Badge>
                {draft.status === "processing" || draft.status === "pending" ? (
                  <Badge variant="secondary">AI {draft.status}</Badge>
                ) : null}
              </div>
            </div>
          )}

          {loading && !draft ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
            </div>
          ) : null}

          <div className="space-y-3">
            {OPTIONS.map((opt) => {
              const checked = !!selected[opt.id];
              return (
                <div
                  key={opt.id}
                  className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  <Checkbox
                    id={`autopilot-${opt.id}`}
                    checked={opt.enabled ? checked : false}
                    disabled={!opt.enabled || starting}
                    onCheckedChange={() => toggle(opt.id, opt.enabled)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label
                        htmlFor={`autopilot-${opt.id}`}
                        className={!opt.enabled ? "text-muted-foreground" : "cursor-pointer"}
                      >
                        {opt.label}
                      </Label>
                      {!opt.enabled ? (
                        <Badge variant="outline" className="text-[10px]">
                          Coming soon
                        </Badge>
                      ) : null}
                    </div>
                    {opt.hint ? (
                      <p className="text-xs text-muted-foreground">{opt.hint}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={starting}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleStart()} disabled={starting}>
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            START
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
