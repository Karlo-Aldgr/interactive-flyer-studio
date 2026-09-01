import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  adminDisconnectAccount,
  adminSyncClientAccounts,
  fetchAdminPublishingHistory,
  fetchAdminZernioOverview,
  zernioPlatformLabel,
} from "@/lib/zernio";

/**
 * Admin view: which client maps to which publishing profile, what they have
 * connected, and every post that went out through the provider.
 */
export default function AdminSocialAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: ["admin-zernio-overview"],
    queryFn: fetchAdminZernioOverview,
    staleTime: 30_000,
  });

  const history = useQuery({
    queryKey: ["admin-zernio-history"],
    queryFn: () => fetchAdminPublishingHistory(),
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-zernio-overview"] });
    queryClient.invalidateQueries({ queryKey: ["admin-zernio-history"] });
  };

  const sync = useMutation({
    mutationFn: adminSyncClientAccounts,
    onSuccess: (res) => {
      toast({ title: "Accounts refreshed", description: `${res.synced} account(s) synced.` });
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: adminDisconnectAccount,
    onSuccess: () => {
      toast({ title: "Account disconnected" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Could not disconnect", description: e.message, variant: "destructive" }),
  });

  const nameFor = (userId: string) => {
    const row = (overview.data ?? []).find((r) => r.user_id === userId);
    return row?.full_name || row?.email || userId.slice(0, 8);
  };

  return (
    <AdminLayout active="social-accounts">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Social Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Each client maps to one publishing profile. Clients connect their own accounts; you can
            refresh or remove a connection from here.
          </p>
        </div>

        {overview.isLoading && <Skeleton className="h-40 w-full" />}
        {overview.error && (
          <p className="text-sm text-destructive">We couldn't load the social overview right now.</p>
        )}

        {overview.data?.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No client has a publishing profile yet. One is created automatically the first time a
              client connects a social account.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {(overview.data ?? []).map((row) => (
            <Card key={row.user_id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {row.full_name || row.email || row.user_id.slice(0, 8)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Profile: {row.profile_name || "—"}{" "}
                    <Badge variant="secondary" className="ml-1">{row.profile_status}</Badge>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sync.mutate(row.user_id)}
                  disabled={sync.isPending}
                >
                  {sync.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sync
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {row.accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No connected platforms.</p>
                )}
                {row.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span className="font-medium">{zernioPlatformLabel(account.platform)}</span>
                    <span className="truncate text-muted-foreground">
                      {account.account_name || account.username || "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={account.status === "connected" ? "secondary" : "outline"}>
                        {account.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {account.last_synced_at
                          ? new Date(account.last_synced_at).toLocaleString()
                          : "never synced"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => disconnect.mutate(account.id)}
                        disabled={disconnect.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent publishing activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.isLoading && <Skeleton className="h-24 w-full" />}
            {history.data?.posts.length === 0 && (
              <p className="text-sm text-muted-foreground">No posts have been sent yet.</p>
            )}
            {(history.data?.posts ?? []).map((post) => (
              <div key={post.id} className="space-y-1 rounded-md border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameFor(post.user_id)}</span>
                  <Badge variant={post.status === "failed" ? "destructive" : "secondary"}>
                    {post.status}
                  </Badge>
                  {(post.platforms ?? []).map((p) => (
                    <Badge key={p} variant="outline">{zernioPlatformLabel(p)}</Badge>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{post.content || "(no caption)"}</p>
                {post.last_error && <p className="text-destructive">{post.last_error}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
