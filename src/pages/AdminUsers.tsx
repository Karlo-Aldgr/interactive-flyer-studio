import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link, Navigate } from "react-router-dom";
import { Briefcase, FileText, Loader2, Users, Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadAdminUsers, primaryRoleLabel, roleBadgeClass, type AdminUserRow } from "@/lib/adminUsers";
import { checkIsAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { RealtorInvitesPanel } from "@/components/realtor/RealtorInvitesPanel";
import { RealtorAccessApplicationsPanel } from "@/components/realtor/RealtorAccessApplicationsPanel";

type UserFilter = "all" | "customers" | "editors" | "admins" | "realtors";

function matchesFilter(user: AdminUserRow, filter: UserFilter) {
  const roles = user.roles ?? [];
  if (filter === "all") return true;
  if (filter === "admins") return roles.includes("admin");
  if (filter === "editors") return roles.includes("editor");
  if (filter === "realtors") return roles.includes("realtor");
  return !roles.includes("admin") && !roles.includes("editor") && !roles.includes("realtor");
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserFilter>("all");

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    const { users: rows, error } = await loadAdminUsers();
    if (error) toast.error(error.message || "Could not load users");
    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const filtered = useMemo(() => users.filter((u) => matchesFilter(u, filter)), [users, filter]);

  const counts = useMemo(
    () => ({
      all: users.length,
      customers: users.filter((u) => matchesFilter(u, "customers")).length,
      editors: users.filter((u) => matchesFilter(u, "editors")).length,
      admins: users.filter((u) => matchesFilter(u, "admins")).length,
    }),
    [users]
  );

  const filters: { value: UserFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "customers", label: "Customers", count: counts.customers },
    { value: "editors", label: "Editors", count: counts.editors },
    { value: "realtors", label: "Realtors", count: users.filter((u) => matchesFilter(u, "realtors")).length },
    { value: "admins", label: "Admins", count: counts.admins },
  ];

  const [pendingId, setPendingId] = useState<string | null>(null);
  const toggleRealtor = async (row: AdminUserRow) => {
    const isRealtor = row.roles.includes("realtor");
    setPendingId(row.user_id);
    const rpc = isRealtor ? "revoke_realtor_by_email" : "grant_realtor_by_email";
    const { data, error } = await supabase.rpc(rpc, { _email: row.email });
    setPendingId(null);
    if (error || (data as any)?.ok === false) {
      toast.error((error?.message) || (data as any)?.error || "Failed");
      return;
    }
    toast.success(isRealtor ? "Realtor role revoked" : "Realtor role granted");
    refresh();
  };


  if (authLoading || isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminLayout active="users">
      <div className="space-y-8">
        <section>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who signs up appears here automatically. Grant editor access from the Editors page.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{counts.customers}</div>
              <div className="text-xs text-muted-foreground">Customers</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <FileText className="h-8 w-8 text-indigo-500" />
            <div>
              <div className="text-2xl font-bold">{counts.editors}</div>
              <div className="text-xs text-muted-foreground">Editors</div>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Briefcase className="h-8 w-8 text-rose-500" />
            <div>
              <div className="text-2xl font-bold">{users.reduce((n, u) => n + u.job_count, 0)}</div>
              <div className="text-xs text-muted-foreground">Total job submissions</div>
            </div>
          </Card>
        </div>

        <RealtorInvitesPanel />
        <RealtorAccessApplicationsPanel />

        <div className="flex flex-wrap gap-2">
          {filters.map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                filter === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No users in this filter.</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => (
              <Card key={row.user_id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{row.email}</span>
                      {(row.roles ?? ["user"]).map((role) => (
                        <Badge key={role} className={roleBadgeClass(role)}>
                          {role === "user" ? "Customer" : role.charAt(0).toUpperCase() + role.slice(1)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Signed up {format(new Date(row.signed_up_at), "PPP")} · {primaryRoleLabel(row.roles)}
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
                    {row.job_count > 0 && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/jobs">View jobs</Link>
                      </Button>
                    )}
                    {!row.roles.includes("editor") && !row.roles.includes("admin") && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/editors">Grant editor</Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={row.roles.includes("realtor") ? "secondary" : "outline"}
                      disabled={pendingId === row.user_id}
                      onClick={() => toggleRealtor(row)}
                    >
                      <Home className="mr-1 h-3.5 w-3.5" />
                      {row.roles.includes("realtor") ? "Revoke realtor" : "Grant realtor"}
                    </Button>

                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
