import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link, Navigate } from "react-router-dom";
import { Home, Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { checkIsAdmin } from "@/lib/roles";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RealtorInvitesPanel } from "@/components/realtor/RealtorInvitesPanel";
import { RealtorAccessApplicationsPanel } from "@/components/realtor/RealtorAccessApplicationsPanel";
import { loadAdminUsers, roleBadgeClass, type AdminUserRow } from "@/lib/adminUsers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function AdminRealtorApplications() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    const [{ users: rows, error }, appsRes] = await Promise.all([
      loadAdminUsers(),
      supabase.rpc("admin_list_realtor_applications" as any),
    ]);
    if (error) toast.error(error.message || "Could not load users");
    setUsers(rows);
    if (appsRes.error) toast.error(appsRes.error.message);
    const apps = (appsRes.data as { status: string }[]) ?? [];
    setPendingRequests(apps.filter((a) => a.status === "pending").length);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const realtors = useMemo(
    () => users.filter((u) => u.roles.includes("realtor")),
    [users],
  );

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminLayout active="realtor-applications">
      <div className="space-y-8">
        <section>
          <h1 className="font-display text-3xl font-bold">Realtor listings overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage realtor access, review applications, and see everyone with portal access.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{realtors.length}</div>
              <div className="text-xs text-muted-foreground">Total realtors</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Home className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{pendingRequests}</div>
              <div className="text-xs text-muted-foreground">Pending requests</div>
            </div>
          </Card>
        </div>

        <RealtorInvitesPanel defaultOpen />
        <RealtorAccessApplicationsPanel defaultOpen onReviewed={refresh} />

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Realtors</h2>
            <p className="text-sm text-muted-foreground">
              View-only list. Grant or revoke access from the{" "}
              <Link to="/admin/users" className="text-primary underline">
                Users
              </Link>{" "}
              page.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : realtors.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No realtors yet.</Card>
          ) : (
            <div className="space-y-2">
              {realtors.map((row) => (
                <Card key={row.user_id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{row.email}</span>
                        {(row.roles ?? []).map((role) => (
                          <Badge key={role} className={roleBadgeClass(role)}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Signed up {format(new Date(row.signed_up_at), "PPP")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{row.job_count}</div>
                        <div className="text-xs text-muted-foreground">Jobs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{row.flyer_count}</div>
                        <div className="text-xs text-muted-foreground">Flyers</div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/realtor">Open portal</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
