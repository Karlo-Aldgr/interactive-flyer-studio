import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { SocialAccount } from "@/lib/social/types";

export type TikTokCreatorInfo = {
  creator_username: string | null;
  creator_nickname: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number | null;
};

type CreatorResponse = {
  audited?: boolean;
  environment?: string;
  creator?: TikTokCreatorInfo;
  privacy_level?: string | null;
  privacy_error?: string | null;
  error?: string;
};

const AUDIENCE_LABEL: Record<string, string> = {
  SELF_ONLY: "Private / Only me",
  MUTUAL_FOLLOW_FRIENDS: "Friends (mutual follows)",
  FOLLOWER_OF_CREATOR: "Followers",
  PUBLIC_TO_EVERYONE: "Public — everyone",
};

/**
 * Shows the live TikTok creator information (account, audience options and
 * interaction settings) and requires an explicit upload confirmation, as the
 * Content Posting API requires.
 */
export function TikTokPublishSettings({
  account,
  confirmed,
  onConfirmedChange,
}: {
  account: SocialAccount;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
}) {
  const [state, setState] = useState<CreatorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.functions
      .invoke("social-accounts", {
        body: { action: "tiktok_creator_info", account_id: account.id },
      })
      .then(({ data, error }) => {
        if (!active) return;
        setState(
          error
            ? { error: error.message }
            : (data as CreatorResponse),
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [account.id]);

  const creator = state?.creator;
  const audience = state?.privacy_level ?? null;
  const problem = state?.error || state?.privacy_error || null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          TikTok publishing settings
          {state?.audited === false && (
            <Badge variant="outline" className="text-[10px]">Sandbox / unaudited app</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your TikTok account settings…
          </p>
        ) : problem ? (
          <p className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{problem}</span>
          </p>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                TikTok account
              </p>
              <p className="font-medium">
                {creator?.creator_nickname || account.account_name || "TikTok"}
                {creator?.creator_username ? ` (@${creator.creator_username})` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                TikTok audience
              </p>
              <p className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" />
                {audience ? AUDIENCE_LABEL[audience] ?? audience : "Not available"}
                {state?.audited === false && " (Sandbox testing)"}
              </p>
              {state?.audited === false && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Until TikTok approves this app, posts can only be created privately. After
                  approval the audience comes from your TikTok account settings automatically.
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Comments {creator?.comment_disabled ? "off" : "on"} · Duet{" "}
              {creator?.duet_disabled ? "off" : "on"} · Stitch{" "}
              {creator?.stitch_disabled ? "off" : "on"}
              {creator?.max_video_post_duration_sec
                ? ` · Max ${creator.max_video_post_duration_sec}s video`
                : ""}
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => onConfirmedChange(checked === true)}
              />
              <span className="text-sm">
                I confirm this video/photo is mine to post and agree to TikTok's{" "}
                <a
                  className="underline"
                  href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                  target="_blank"
                  rel="noreferrer"
                >
                  Music Usage Confirmation
                </a>{" "}
                — upload it to my TikTok account.
              </span>
            </label>
          </>
        )}
      </CardContent>
    </Card>
  );
}
