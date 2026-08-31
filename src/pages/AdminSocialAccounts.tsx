import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdminZernioOverview, zernioPlatformLabel } from "@/lib/zernio";

/**
 * Read-only foundation view: which client maps to which Zernio profile and
 * what they have connected. Posting management arrives in a later phase.
 */
export default function AdminSocialAccounts() {
  const overview = useQuery({
    queryKey: ["admin-zernio-overview"],
    queryFn: fetchAdminZernioOverview,
    staleTime: 30_000,
  });

  return (
    <AdminLayout active="social-accounts">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Social Accounts</h1>
        <p className="text-sm text-muted-foreground">

          Each client maps to one Zernio profile. Connections are managed by the client from their
          own dashboard.
        </p>

        {overview.isLoading && <Skeleton className="h-40 w-full" />}

        {overview.error && (
          <p className="text-sm text-destructive">
            We couldn't load the social overview right now.
          </p>
        )}

        {overview.data?.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No client has a Zernio profile yet. A profile is created automatically the first time
              a client connects a social account.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {(overview.data ?? []).map((row) => (
            <Card key={row.user_id}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">
                  {row.full_name || row.email || row.user_id.slice(0, 8)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Zernio profile: {row.profile_name || "—"}{" "}
                  <Badge variant="secondary" className="ml-1">{row.profile_status}</Badge>
                </p>
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
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
