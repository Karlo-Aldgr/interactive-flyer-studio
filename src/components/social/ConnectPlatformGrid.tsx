import { Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "./PlatformIcon";
import { SOCIAL_PLATFORMS, PLATFORM_LABEL } from "@/lib/social/types";
import type { SocialAccount, SocialPlatform } from "@/lib/social/types";
import {
  friendlyState,
  friendlyStatusDetail,
  friendlyStatusLabel,
  PLATFORM_BLURB,
} from "@/lib/social/friendly";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";

type Props = {
  social: ReturnType<typeof useSocialAccounts>;
  /** Compact mode is used inside onboarding. */
  compact?: boolean;
};

const DOT: Record<string, string> = {
  connected: "bg-emerald-500",
  attention: "bg-amber-500",
  failed: "bg-destructive",
  idle: "bg-muted-foreground/40",
};

function StatusPill({ state, label }: { state: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span className={`h-2.5 w-2.5 rounded-full ${DOT[state]}`} aria-hidden />
      {label}
    </span>
  );
}

function AccountRow({
  account,
  social,
}: {
  account: SocialAccount;
  social: ReturnType<typeof useSocialAccounts>;
}) {
  const state = friendlyState(account.connection_status);
  const detail = friendlyStatusDetail(account.connection_status, account.platform);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
      {account.profile_image_url
        ? (
          <img
            src={account.profile_image_url}
            alt=""
            loading="lazy"
            className="h-9 w-9 rounded-full object-cover"
          />
        )
        : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <PlatformIcon platform={account.platform} />
          </div>
        )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {account.account_name || (account.username ? `@${account.username}` : "Your account")}
        </p>
        <StatusPill state={state} label={friendlyStatusLabel(account.connection_status)} />
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {state === "connected"
          ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => social.sync(account.id)}
                title="Refresh account details"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => social.disconnect(account.id)}>
                <Unplug className="mr-2 h-3.5 w-3.5" />
                Disconnect
              </Button>
            </>
          )
          : (
            <>
              <Button size="sm" onClick={() => social.connect(account.platform)}>
                {state === "failed" ? "Try again" : "Reconnect"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => social.disconnect(account.id)}>
                Remove
              </Button>
            </>
          )}
      </div>
    </div>
  );
}

/**
 * The customer-facing connection surface used by the Social Accounts page and
 * onboarding. Connect → Login → Approve → Connected. No technical detail here:
 * setup problems are an admin concern and are surfaced as a simple
 * "temporarily unavailable" note.
 */
export function ConnectPlatformGrid({ social, compact = false }: Props) {
  const status = social.status;

  if (social.statusLoading && !status) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => <Skeleton key={p} className="h-28 w-full" />)}
      </div>
    );
  }

  const platformInfo = (platform: SocialPlatform) =>
    status?.platforms.find((p) => p.platform === platform);

  return (
    <div className="space-y-4">
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Connect your social accounts to let TapThatFlyer publish your flyers automatically.
          You'll sign in on the platform's own page — we never see your password.
        </p>
      )}

      <div className={compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
        {SOCIAL_PLATFORMS.map((platform) => {
          const info = platformInfo(platform);
          const accounts = social.byPlatform(platform);
          const available = Boolean(
            !social.statusError &&
              info?.configured &&
              status?.encryption_configured &&
              info?.globally_enabled,
          );
          const busy = social.connecting === platform;

          return (
            <Card key={platform} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform} className="h-5 w-5" />
                  <h3 className="flex-1 font-semibold">{PLATFORM_LABEL[platform]}</h3>
                  {accounts.length === 0 && (
                    <StatusPill state="idle" label="Not connected" />
                  )}
                </div>

                {accounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">{PLATFORM_BLURB[platform]}</p>
                )}

                {accounts.length > 0 && (
                  <div className="space-y-2">
                    {accounts.map((a) => <AccountRow key={a.id} account={a} social={social} />)}
                  </div>
                )}

                {!available
                  ? (
                    <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      {PLATFORM_LABEL[platform]} connections are temporarily unavailable. Our team
                      is on it — please check back soon.
                    </p>
                  )
                  : (
                    <Button
                      className="w-full"
                      variant={accounts.length ? "outline" : "default"}
                      disabled={busy}
                      onClick={() => social.connect(platform)}
                    >
                      {busy
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Link2 className="mr-2 h-4 w-4" />}
                      {accounts.length
                        ? `Add another ${PLATFORM_LABEL[platform]} account`
                        : `Connect ${PLATFORM_LABEL[platform]}`}
                    </Button>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
