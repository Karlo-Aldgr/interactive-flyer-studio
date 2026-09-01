import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  disconnectZernioAccount,
  fetchZernioStatus,
  startZernioConnect,
  syncZernioAccounts,
  zernioPlatformLabel,
} from "@/lib/zernio";

/**
 * Zernio-managed social connections. Platforms come from the backend, so the
 * list grows without a frontend release. Plan limits are shown here and are
 * also enforced server-side.
 */
export function ZernioAccountsPanel({ redirectPath = "/dashboard/social" }: { redirectPath?: string }) {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["zernio-status"],
    queryFn: fetchZernioStatus,
    staleTime: 15_000,
  });

  // Surface the return trip from Zernio, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("zernio_return") && !params.get("zernio_connected")) return;
    params.delete("zernio_return");
    params.delete("zernio_connected");
    const next = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", next);
    syncZernioAccounts()
      .then(() => {
        toast.success("Social accounts updated");
        queryClient.invalidateQueries({ queryKey: ["zernio-status"] });
      })
      .catch((err: Error) => toast.error(err.message));
  }, [queryClient]);

  const sync = useMutation({
    mutationFn: syncZernioAccounts,
    onSuccess: () => {
      toast.success("Accounts refreshed");
      queryClient.invalidateQueries({ queryKey: ["zernio-status"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: disconnectZernioAccount,
    onSuccess: () => {
      toast.success("Account disconnected");
      queryClient.invalidateQueries({ queryKey: ["zernio-status"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const accounts = useMemo(
    () => (status.data?.accounts ?? []).filter((a) => a.status !== "disconnected"),
    [status.data],
  );

  const limits = status.data?.limits;
  const maxAccounts = limits?.plan?.max_social_accounts ?? 0;
  const usedAccounts = limits?.usage.connected_accounts ?? accounts.length;
  const atLimit = maxAccounts > 0 && usedAccounts >= maxAccounts;

  async function connect(platform: string) {
    setConnecting(platform);
    try {
      const { authorize_url } = await startZernioConnect(platform, redirectPath);
      window.location.href = authorize_url;
    } catch (err) {
      toast.error((err as Error).message);
      setConnecting(null);
    }
  }

  if (status.isLoading) return <Skeleton className="h-48 w-full" />;

  if (status.error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          We couldn't load your social connections right now. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (!status.data?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social connections</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Social publishing isn't switched on yet. An administrator needs to finish the setup —
          your existing connections keep working in the meantime.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {limits?.plan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {limits.plan.name} plan
              <Badge variant="secondary" className="ml-2">
                {usedAccounts}
                {maxAccounts > 0 ? ` / ${maxAccounts}` : ""} accounts
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {maxAccounts > 0 && (
              <Progress value={Math.min(100, (usedAccounts / maxAccounts) * 100)} />
            )}
            {atLimit && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                You've reached your account limit.{" "}
                <Link to="/dashboard/billing" className="underline">
                  See plans
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Connected accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              You authorize each account on the platform's own page. TapThatFlyer never sees your
              social passwords.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No accounts connected yet. Pick a platform below to get started.
            </p>
          )}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {account.avatar_url && (
                  <img
                    src={account.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{zernioPlatformLabel(account.platform)}</span>
                    <Badge variant={account.status === "connected" ? "secondary" : "destructive"}>
                      {account.status === "connected" ? "Connected" : "Reconnect needed"}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {account.account_name || account.username || account.zernio_account_id}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {account.status !== "connected" && (
                  <Button size="sm" variant="outline" onClick={() => connect(account.platform)}>
                    Reconnect
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(account.id)}
                  disabled={remove.isPending}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect a social account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(status.data?.platforms ?? []).map((platform) => (
            <Button
              key={platform}
              variant="outline"
              className="justify-start"
              onClick={() => connect(platform)}
              disabled={connecting !== null || atLimit}
            >
              {connecting === platform
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Plus className="mr-2 h-4 w-4" />}
              {zernioPlatformLabel(platform)}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
