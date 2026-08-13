import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminListAffiliateApplications,
  adminListAffiliates,
  adminReviewAffiliateApplication,
  adminSetAffiliateStatus,
  formatCents,
  type AdminAffiliateRow,
  type AffiliateApplication,
} from "@/lib/affiliates";

export default function AdminAffiliates() {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [apps, setApps] = useState<AffiliateApplication[]>([]);
  const [affiliates, setAffiliates] = useState<AdminAffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([adminListAffiliateApplications(), adminListAffiliates()]);
      setApps(a);
      setAffiliates(b);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not load affiliates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Affiliates | Admin";
    if (!roleLoading && isAdmin) load();
    else if (!roleLoading) setLoading(false);
  }, [roleLoading, isAdmin]);

  const review = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      const res: any = await adminReviewAffiliateApplication(id, decision, notes[id]);
      toast.success(res?.message ?? (decision === "approved" ? "Affiliate approved" : "Application rejected"));
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update application");
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (row: AdminAffiliateRow) => {
    setBusyId(row.id);
    try {
      await adminSetAffiliateStatus(row.id, row.status === "active" ? "paused" : "active");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update affiliate");
    } finally {
      setBusyId(null);
    }
  };

  if (!roleLoading && !isAdmin) {
    return (
      <AdminLayout active="affiliates">
        <Card className="p-8 text-center text-muted-foreground">Admins only.</Card>
      </AdminLayout>
    );
  }

  const pendingApps = apps.filter((a) => a.status === "pending");
  const reviewedApps = apps.filter((a) => a.status !== "pending");

  return (
    <AdminLayout active="affiliates">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Affiliates</h1>
            <p className="text-sm text-muted-foreground">Review applications and manage affiliate accounts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Pending applications ({pendingApps.length})</h2>
              {pendingApps.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No pending applications.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {pendingApps.map((a) => (
                    <li key={a.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{a.full_name}</p>
                          <p className="text-sm text-muted-foreground">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                          {a.website && <p className="truncate text-sm text-muted-foreground">{a.website}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {a.audience && <p className="mt-2 text-sm"><strong>Audience:</strong> {a.audience}</p>}
                      {a.message && <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>}
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="Review note (optional)"
                          value={notes[a.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => review(a.id, "approved")} disabled={busyId === a.id}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => review(a.id, "rejected")}
                            disabled={busyId === a.id}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Active affiliates ({affiliates.length})</h2>
              {affiliates.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No affiliates yet.</p>
              ) : (
                <ul className="mt-4 divide-y">
                  {affiliates.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{row.full_name || row.email || "Affiliate"}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-mono">{row.code}</span> · {row.referral_count} referrals ·{" "}
                          {formatCents(Number(row.pending_cents))} pending · {formatCents(Number(row.paid_cents))} paid
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.status === "active" ? "secondary" : "outline"}>{row.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(row)} disabled={busyId === row.id}>
                          {row.status === "active" ? "Pause" : "Activate"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {reviewedApps.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold">Reviewed applications</h2>
                <ul className="mt-3 divide-y">
                  {reviewedApps.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{a.full_name} · {a.email}</span>
                      <Badge variant="outline">{a.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
