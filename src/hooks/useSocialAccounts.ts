import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  accountAction,
  fetchAccounts,
  fetchIntegrationStatus,
  startConnect,
} from "@/lib/social/api";
import { friendlyErrorMessage } from "@/lib/social/friendly";
import type { SocialPlatform } from "@/lib/social/types";


/**
 * Single source of truth for social connections. Used by both the Social Media
 * Manager and the onboarding step so the two never drift apart.
 */
export function useSocialAccounts(redirectPath = "/dashboard/social") {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);

  const accounts = useQuery({
    queryKey: ["social-accounts"],
    queryFn: fetchAccounts,
    staleTime: 15_000,
  });

  const status = useQuery({
    queryKey: ["social-integration-status"],
    queryFn: fetchIntegrationStatus,
    staleTime: 60_000,
  });

  // Surface the OAuth callback outcome once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const error = params.get("social_error");
    if (!connected && !error) return;
    if (connected) {
      const count = params.get("social_accounts");
      toast.success(
        `${connected} connected${count && Number(count) > 1 ? ` (${count} accounts)` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    }
    if (error) {
      const platform = params.get("social_platform");
      const label = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "That";
      const cancelled = /cancel|access_denied|denied/i.test(error);
      toast.error(
        cancelled
          ? `${label} connection cancelled.`
          : `We couldn't finish connecting ${platform ? label : "that account"}. Please try again.`,
      );
    }


    params.delete("social_connected");
    params.delete("social_error");
    params.delete("social_accounts");
    params.delete("social_platform");
    const next = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", next);
  }, [queryClient]);

  const connect = useCallback(
    async (platform: SocialPlatform) => {
      setConnecting(platform);
      try {
        const url = await startConnect(platform, redirectPath);
        window.location.href = url;
      } catch (err) {
        toast.error(friendlyErrorMessage(err, platform));
        setConnecting(null);
      }
    },
    [redirectPath],
  );

  const run = useCallback(
    async (action: "sync" | "refresh" | "disconnect", accountId: string) => {
      try {
        await accountAction(action, accountId);
        toast.success(
          action === "disconnect"
            ? "Account disconnected"
            : "Account updated",
        );
        queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      } catch (err) {
        toast.error(
          action === "disconnect"
            ? "We couldn't disconnect that account. Please try again."
            : friendlyErrorMessage(err),
        );
      }
    },
    [queryClient],
  );


  const byPlatform = useCallback(
    (platform: SocialPlatform) => (accounts.data ?? []).filter((a) => a.platform === platform),
    [accounts.data],
  );

  return {
    accounts: accounts.data ?? [],
    accountsLoading: accounts.isLoading,
    accountsError: accounts.error as Error | null,
    status: status.data,
    statusLoading: status.isLoading,
    statusError: status.error as Error | null,
    connecting,
    connect,
    sync: (id: string) => run("sync", id),
    refresh: (id: string) => run("refresh", id),
    disconnect: (id: string) => run("disconnect", id),
    byPlatform,
    reload: () => {
      accounts.refetch();
      status.refetch();
    },
  };
}
