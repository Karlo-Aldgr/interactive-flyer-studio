import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "./PlatformIcon";
import { PLATFORM_LABEL } from "@/lib/social/types";
import type { useSocialAccounts } from "@/hooks/useSocialAccounts";

/** Truthful configuration status. Secret NAMES only — never values. */
export function IntegrationsPanel({ social }: { social: ReturnType<typeof useSocialAccounts> }) {
  const status = social.status;
  if (!status) return <p className="text-sm text-muted-foreground">Loading integration status…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Platform callback URL</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{status.callback_url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(status.callback_url);
                toast.success("Callback URL copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Register this exact URL as the OAuth redirect URI in every platform developer app.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Token encryption &amp; scheduler</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            {status.encryption_configured
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-destructive" />}
            <code>SOCIAL_TOKEN_ENCRYPTION_KEY</code>{" "}
            {status.encryption_configured ? "configured" : "missing — connections are blocked"}
          </p>
          <p className="flex items-center gap-2">
            {status.scheduler_configured
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            <code>SOCIAL_CRON_SECRET</code>{" "}
            {status.scheduler_configured
              ? "configured — scheduled posts run when the worker is called"
              : "missing — scheduled posts stay queued until this is set"}
          </p>
          <p className="text-xs text-muted-foreground">
            Scheduling becomes live once a cron/HTTP scheduler calls the{" "}
            <code>social-process-due-jobs</code> function every few minutes with the header{" "}
            <code>x-cron-secret</code>.
          </p>
        </CardContent>
      </Card>

      {status.platforms.map((p) => (
        <Card key={p.platform}>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <PlatformIcon platform={p.platform} />
            <CardTitle className="flex-1 text-base">{PLATFORM_LABEL[p.platform]}</CardTitle>
            <Badge variant={p.configured ? "default" : "secondary"}>
              {!p.globally_enabled
                ? "Disabled by admin"
                : p.configured
                ? "Configured"
                : "Missing credentials"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Required secrets: </span>
              <span className="font-mono text-xs">{p.required_secrets.join(", ")}</span>
            </p>
            {p.missing_secrets.length > 0 && (
              <p className="text-destructive">
                Missing: <span className="font-mono text-xs">{p.missing_secrets.join(", ")}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Scopes: </span>
              <span className="font-mono text-xs">{p.default_scopes.join(" ")}</span>
            </p>
            <p className="text-muted-foreground">{p.approval_notes}</p>
            <a
              className="text-xs underline"
              href={p.developer_console_url}
              target="_blank"
              rel="noreferrer"
            >
              Open developer console
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
