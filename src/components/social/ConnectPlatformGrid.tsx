import { AlertTriangle, CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "./PlatformIcon";
import { SOCIAL_PLATFORMS, PLATFORM_LABEL, STATUS_LABEL } from "@/lib/social/types";
import type { SocialAccount, SocialPlatform } from "@/lib/social/types";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";

type Props = {
  social: ReturnType<typeof useSocialAccounts>;
  /** Compact mode is used inside onboarding. */
  compact?: boolean;
};

function statusTone(account: SocialAccount) {
  if (account.connection_status === "connected") return "default" as const;
  if (account.connection_status === "error") return "destructive" as const;
  return "secondary" as const;
}

function AccountRow({
  account,
  social,
}: {
  account: SocialAccount;
  social: ReturnType<typeof useSocialAccounts>;
}) {
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
        <p className="truncate text-sm font-medium">{account.account_name || "Account"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {account.username ? `@${account.username} · ` : ""}
          connected {new Date(account.connected_at).toLocaleDateString()}
          {account.last_synced_at
            ? ` · synced ${new Date(account.last_synced_at).toLocaleString()}`
            : " · never synced"}
        </p>
        {account.status_detail && (
          <p className="mt-1 text-xs text-destructive">{account.status_detail}</p>
        )}
      </div>
      <Badge variant={statusTone(account)} className="shrink-0">
        {STATUS_LABEL[account.connection_status]}
      </Badge>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={() => social.sync(account.id)} title="Sync details">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => social.connect(account.platform)}
          title="Reconnect"
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => social.disconnect(account.id)}
          title="Disconnect"
        >
          <Unplug className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The one connection surface used by both the Accounts tab and onboarding.
 * States are truthful: a platform without credentials says so instead of
 * pretending the button will work.
 */
export function ConnectPlatformGrid({ social, compact = false }: Props) {
  const status = social.status;

  if (social.statusLoading && !status) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => <Skeleton key={p} className="h-32 w-full" />)}
      </div>
    );
  }

  if (social.statusError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Could not load integration status: {social.statusError.message}
        </CardContent>
      </Card>
    );
  }

  const platformInfo = (platform: SocialPlatform) =>
    status?.platforms.find((p) => p.platform === platform);

  return (
    <div className="space-y-3">
      {!status?.encryption_configured && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>
            Connections are disabled until <code>SOCIAL_TOKEN_ENCRYPTION_KEY</code>{" "}
            is added in Project Settings → Secrets. Tokens are only ever stored encrypted.
          </p>
        </div>
      )}

      <div className={compact ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
        {SOCIAL_PLATFORMS.map((platform) => {
          const info = platformInfo(platform);
          const accounts = social.byPlatform(platform);
          const ready = Boolean(info?.configured && status?.encryption_configured && info?.globally_enabled);
          const busy = social.connecting === platform;

          return (
            <Card key={platform} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform} className="h-5 w-5" />
                  <h3 className="flex-1 font-semibold">{PLATFORM_LABEL[platform]}</h3>
                  {accounts.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {accounts.length}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{info?.capabilities.notes}</p>

                {accounts.length > 0 && (
                  <div className="space-y-2">
                    {accounts.map((a) => <AccountRow key={a.id} account={a} social={social} />)}
                  </div>
                )}

                {!ready && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    {!info?.globally_enabled
                      ? "This platform is turned off for the workspace by an administrator."
                      : !status?.encryption_configured
                      ? "Waiting on the token encryption secret."
                      : (
                        <>
                          Setup required — add these secrets in Project Settings → Secrets:{" "}
                          <span className="font-mono">{info?.missing_secrets.join(", ")}</span>. App
                          review may also be needed: {info?.approval_notes}
                        </>
                      )}
                  </div>
                )}

                <Button
                  className="w-full"
                  variant={accounts.length ? "outline" : "default"}
                  disabled={!ready || busy}
                  onClick={() => social.connect(platform)}
                >
                  {busy
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Link2 className="mr-2 h-4 w-4" />}
                  {accounts.length ? `Add another ${PLATFORM_LABEL[platform]} account` : `Connect ${PLATFORM_LABEL[platform]}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
