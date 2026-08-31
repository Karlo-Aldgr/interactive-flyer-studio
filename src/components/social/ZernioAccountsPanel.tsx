import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Plus } from "lucide-react";
import {
  disconnectZernioAccount,
  fetchZernioStatus,
  startZernioConnect,
  syncZernioAccounts,
  zernioPlatformLabel,
} from "@/lib/zernio";

/**
 * New Zernio-managed social connections. Runs alongside the existing direct
 * OAuth integration while the migration is in progress.
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
    if (!params.get("zernio_connected")) return;
    params.delete("zernio_connected");
    const next = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", next);
    syncZernioAccounts()
      .then(() => {
        toast.success("Social account connected");
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

  const connected = useMemo(
    () => (status.data?.accounts ?? []).filter((a) => a.status !== "disconnected"),
    [status.data],
  );

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

  if (status.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

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
          Social publishing through Zernio isn't switched on yet. An administrator needs to finish
          the setup — your existing connections keep working in the meantime.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Connected accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              You authorize each account on the platform's own page. TapThatFlyer never sees your
              social passwords.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No accounts connected yet. Pick a platform below to get started.
            </p>
          )}
          {connected.map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{zernioPlatformLabel(account.platform)}</span>
                  <Badge variant={account.status === "connected" ? "secondary" : "destructive"}>
                    {account.status}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {account.account_name || account.username || account.zernio_account_id}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate(account.id)}
                disabled={remove.isPending}
              >
                Disconnect
              </Button>
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
              disabled={connecting !== null}
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
