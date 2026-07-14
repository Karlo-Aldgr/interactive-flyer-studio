import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import {
  loadLatestMarketingDraft,
  type MarketingChannelStatus,
  type MarketingDraft,
} from "@/lib/marketingAutomation";

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

function emailReady(draft: MarketingDraft): boolean {
  return !!(draft.email_subject?.trim() || draft.email_body?.trim());
}

function tiktokReady(draft: MarketingDraft): boolean {
  return !!draft.tiktok_caption?.trim();
}

function smsReady(draft: MarketingDraft): boolean {
  return !!draft.sms_body?.trim();
}

function googleAdsReady(draft: MarketingDraft): boolean {
  return !!(draft.google_ads_headline?.trim() || draft.google_ads_description?.trim());
}

/** Compact AutoPilot status for the flyer portal (Phase 5). */
export function AutoPilotPortalStrip({
  flyerId,
  insightTip,
}: {
  flyerId: string;
  insightTip?: string | null;
}) {
  const [draft, setDraft] = useState<MarketingDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await loadLatestMarketingDraft(flyerId);
      if (!cancelled) setDraft(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [flyerId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Rocket className="h-4 w-4 text-primary" />
          AutoPilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <>
              <Badge variant="outline">FB {channelLabel(draft.facebook_status)}</Badge>
              <Badge variant="outline">IG {channelLabel(draft.instagram_status)}</Badge>
              <Badge variant="outline">{emailReady(draft) ? "Email ready" : "Email empty"}</Badge>
              <Badge variant="outline">{tiktokReady(draft) ? "TikTok ready" : "TikTok empty"}</Badge>
              <Badge variant="outline">{smsReady(draft) ? "SMS ready" : "SMS empty"}</Badge>
              <Badge variant="outline">{googleAdsReady(draft) ? "Ads ready" : "Ads empty"}</Badge>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No marketing draft yet — start AutoPilot from the editor.</span>
          )}
        </div>
        {insightTip ? (
          <p className="text-xs text-muted-foreground">
            Tip: {insightTip}
          </p>
        ) : null}
        <Button asChild type="button" size="sm" variant="secondary">
          <Link to={`/editor/${flyerId}`}>Open AutoPilot in editor</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
