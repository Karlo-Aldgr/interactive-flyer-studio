import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Download,
  Loader2,
  MousePointerClick,
  RefreshCw,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminAffiliateOverview,
  adminDeleteCoupon,
  adminListAffiliateApplications,
  adminListAffiliates,
  adminListCommissions,
  adminListPayouts,
  adminListReferrals,
  adminRecordConversion,
  adminReviewAffiliateApplication,
  adminSetAffiliateRate,
  adminSetAffiliateStatus,
  adminUpdatePayout,
  adminUpsertCoupon,
  deleteAffiliateAsset,
  exportCsv,
  formatCents,
  loadAffiliateAssets,
  loadCoupons,
  loadProgramSettings,
  saveAffiliateAsset,
  saveProgramSettings,
  type AdminAffiliateRow,
  type AdminCommissionRow,
  type AdminPayoutRow,
  type AdminReferralRow,
  type AffiliateApplication,
  type AffiliateAsset,
  type AffiliateCoupon,
  type AffiliateOverview,
} from "@/lib/affiliates";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 72% 51%)",
];

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export default function AdminAffiliates() {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [overview, setOverview] = useState<AffiliateOverview | null>(null);
  const [apps, setApps] = useState<AffiliateApplication[]>([]);
  const [affiliates, setAffiliates] = useState<AdminAffiliateRow[]>([]);
  const [referrals, setReferrals] = useState<AdminReferralRow[]>([]);
  const [commissions, setCommissions] = useState<AdminCommissionRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [assets, setAssets] = useState<AffiliateAsset[]>([]);
  const [coupons, setCoupons] = useState<AffiliateCoupon[]>([]);
  const [settings, setSettings] = useState({ default_rate: 20, min_payout_cents: 5000, cookie_days: 14 });
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [sale, setSale] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState({ title: "", description: "", image_url: "", body_text: "", link_url: "" });
  const [couponForm, setCouponForm] = useState({ code: "", affiliate_id: "", discount: "10", description: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [ov, a, b, r, c, p, as, cp, st] = await Promise.all([
        adminAffiliateOverview(),
        adminListAffiliateApplications(),
        adminListAffiliates(),
        adminListReferrals(),
        adminListCommissions(),
        adminListPayouts(),
        loadAffiliateAssets(false),
        loadCoupons(),
        loadProgramSettings(),
      ]);
      setOverview(ov);
      setApps(a);
      setAffiliates(b);
      setReferrals(r);
      setCommissions(c);
      setPayouts(p);
      setAssets(as);
      setCoupons(cp);
      setSettings(st);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isAdmin]);

  // Keep the payout queue live without a manual refresh.
  useEffect(() => {
    if (roleLoading || !isAdmin) return;
    const syncPayouts = async () => {
      try {
        setPayouts(await adminListPayouts());
      } catch {
        /* ignore transient errors */
      }
    };
    const onFocus = () => syncPayouts();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(syncPayouts, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [roleLoading, isAdmin]);


  const run = async (id: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusyId(id);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const channelData = useMemo(
    () => (overview?.channels ?? []).map((c) => ({ name: c.name, value: Number(c.clicks) })),
    [overview],
  );

  if (!roleLoading && !isAdmin) {
    return (
      <AdminLayout active="affiliates">
        <Card className="p-8 text-center text-muted-foreground">Admins only.</Card>
      </AdminLayout>
    );
  }

  const pendingApps = apps.filter((a) => a.status === "pending");
  const reviewedApps = apps.filter((a) => a.status !== "pending");
  const ctr = (clicks: number, converts: number) => (clicks ? `${((converts / clicks) * 100).toFixed(1)}%` : "—");

  return (
    <AdminLayout active="affiliates">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Affiliate program</h1>
            <p className="text-sm text-muted-foreground">Analytics, applications, commissions, payouts and assets.</p>
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
          <Tabs defaultValue="overview">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="applications">Applications ({pendingApps.length})</TabsTrigger>
              <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="ledger">Commissions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="promo">Promo assets</TabsTrigger>
              <TabsTrigger value="coupons">Coupons</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* ---------------- OVERVIEW ---------------- */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi icon={Users} label="Participants" value={String(overview?.participants ?? 0)} hint="Active affiliates" />
                <Kpi icon={UserPlus} label="Applications" value={String(overview?.invites ?? 0)} hint={`${pendingApps.length} pending`} />
                <Kpi icon={MousePointerClick} label="Clicks" value={String(overview?.clicks ?? 0)} hint={`${overview?.signups ?? 0} signups`} />
                <Kpi
                  icon={Trophy}
                  label="Converts"
                  value={String(overview?.converts ?? 0)}
                  hint={ctr(Number(overview?.clicks ?? 0), Number(overview?.converts ?? 0)) + " conversion rate"}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi icon={BadgeDollarSign} label="Commissions earned" value={formatCents(Number(overview?.earned_cents ?? 0))} />
                <Kpi icon={BadgeDollarSign} label="Paid out" value={formatCents(Number(overview?.paid_cents ?? 0))} />
                <Kpi icon={ShieldAlert} label="Flagged referrals" value={String(overview?.flagged ?? 0)} hint="Self-referral / rapid repeats" />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Campaign overview</h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportCsv("affiliates.csv", (overview?.rows ?? []) as any)}
                    >
                      <Download className="mr-1 h-4 w-4" /> CSV
                    </Button>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2">Affiliate</th>
                          <th className="py-2">Code</th>
                          <th className="py-2 text-right">Clicks</th>
                          <th className="py-2 text-right">Signups</th>
                          <th className="py-2 text-right">Converts</th>
                          <th className="py-2 text-right">CTR</th>
                          <th className="py-2 text-right">Earned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(overview?.rows ?? []).map((r) => (
                          <tr key={r.id}>
                            <td className="py-2">{r.name}</td>
                            <td className="py-2 font-mono text-xs">{r.code}</td>
                            <td className="py-2 text-right">{r.clicks}</td>
                            <td className="py-2 text-right">{r.signups}</td>
                            <td className="py-2 text-right">{r.converts}</td>
                            <td className="py-2 text-right">{ctr(Number(r.clicks), Number(r.signups))}</td>
                            <td className="py-2 text-right font-medium">{formatCents(Number(r.earned_cents))}</td>
                          </tr>
                        ))}
                        {(overview?.rows ?? []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-muted-foreground">
                              No affiliates yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold">Share channels</h2>
                  {channelData.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No clicks recorded yet.</p>
                  ) : (
                    <>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={72}>
                              {channelData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <ReTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(overview?.channels ?? []).map((c) => (
                          <li key={c.name} className="flex justify-between">
                            <span>{c.name}</span>
                            <span className="text-muted-foreground">
                              {c.clicks} clicks · {c.signups} signups
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* ---------------- APPLICATIONS ---------------- */}
            <TabsContent value="applications" className="space-y-4">
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
                            <p className="text-sm text-muted-foreground">
                              {a.email}
                              {a.phone ? ` · ${a.phone}` : ""}
                            </p>
                            {a.website && <p className="truncate text-sm text-muted-foreground">{a.website}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {a.audience && (
                          <p className="mt-2 text-sm">
                            <strong>Audience:</strong> {a.audience}
                          </p>
                        )}
                        {a.message && <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>}
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Input
                            placeholder="Review note (optional)"
                            value={notes[a.id] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={busyId === a.id}
                              onClick={() =>
                                run(a.id, () => adminReviewAffiliateApplication(a.id, "approved", notes[a.id]), "Affiliate approved")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === a.id}
                              onClick={() =>
                                run(a.id, () => adminReviewAffiliateApplication(a.id, "rejected", notes[a.id]), "Application rejected")
                              }
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

              {reviewedApps.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold">Reviewed applications</h2>
                  <ul className="mt-3 divide-y">
                    {reviewedApps.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {a.full_name} · {a.email}
                        </span>
                        <Badge variant="outline">{a.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </TabsContent>

            {/* ---------------- AFFILIATES ---------------- */}
            <TabsContent value="affiliates">
              <Card className="p-6">
                <h2 className="text-lg font-semibold">Affiliates ({affiliates.length})</h2>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className="w-24"
                            type="number"
                            value={rates[row.id] ?? String(row.commission_rate)}
                            onChange={(e) => setRates((r) => ({ ...r, [row.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() =>
                              run(row.id, () => adminSetAffiliateRate(row.id, Number(rates[row.id] ?? row.commission_rate)), "Rate updated")
                            }
                          >
                            Save rate
                          </Button>
                          <Badge variant={row.status === "active" ? "secondary" : "outline"}>{row.status}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() =>
                              run(row.id, () => adminSetAffiliateStatus(row.id, row.status === "active" ? "paused" : "active"))
                            }
                          >
                            {row.status === "active" ? "Pause" : "Activate"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </TabsContent>

            {/* ---------------- REFERRALS ---------------- */}
            <TabsContent value="referrals">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Referred customers ({referrals.length})</h2>
                  <Button size="sm" variant="outline" onClick={() => exportCsv("referrals.csv", referrals as any)}>
                    <Download className="mr-1 h-4 w-4" /> CSV
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record a conversion to create the commission at the affiliate's rate. Enter the sale amount in dollars.
                </p>
                <ul className="mt-4 divide-y">
                  {referrals.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{r.referred_email || r.referred_name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.affiliate_name} · <span className="font-mono">{r.code}</span> · {r.channel} ·{" "}
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.fraud_flag && <Badge variant="destructive">{r.fraud_flag.replace("_", " ")}</Badge>}
                        <Badge variant={r.status === "converted" ? "secondary" : "outline"}>{r.status}</Badge>
                        {r.status !== "converted" && (
                          <>
                            <Input
                              className="w-24"
                              placeholder="$ sale"
                              value={sale[r.id] ?? ""}
                              onChange={(e) => setSale((s) => ({ ...s, [r.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              disabled={busyId === r.id || !Number(sale[r.id])}
                              onClick={() =>
                                run(r.id, () => adminRecordConversion(r.id, Math.round(Number(sale[r.id]) * 100)), "Conversion recorded")
                              }
                            >
                              Convert
                            </Button>
                          </>
                        )}
                        {r.commission_cents ? <strong>{formatCents(r.commission_cents)}</strong> : null}
                      </div>
                    </li>
                  ))}
                  {referrals.length === 0 && <p className="py-6 text-center text-muted-foreground">No referrals yet.</p>}
                </ul>
              </Card>
            </TabsContent>

            {/* ---------------- COMMISSIONS ---------------- */}
            <TabsContent value="ledger">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Commission ledger</h2>
                  <Button size="sm" variant="outline" onClick={() => exportCsv("commissions.csv", commissions as any)}>
                    <Download className="mr-1 h-4 w-4" /> CSV
                  </Button>
                </div>
                <ul className="mt-3 divide-y">
                  {commissions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {c.affiliate_name} · {c.description || "Commission"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={c.status === "paid" ? "secondary" : "outline"}>{c.status}</Badge>
                        <strong>{formatCents(c.amount_cents)}</strong>
                      </span>
                    </li>
                  ))}
                  {commissions.length === 0 && <p className="py-6 text-center text-muted-foreground">No commissions yet.</p>}
                </ul>
              </Card>
            </TabsContent>

            {/* ---------------- PAYOUTS ---------------- */}
            <TabsContent value="payouts">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Payout queue</h2>
                  <Button size="sm" variant="outline" onClick={() => exportCsv("payouts.csv", payouts as any)}>
                    <Download className="mr-1 h-4 w-4" /> CSV
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Payouts are sent manually (PayPal). Marking a payout paid also marks that affiliate's approved
                  commissions as paid.
                </p>
                <ul className="mt-4 divide-y">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.affiliate_name} · {formatCents(p.amount_cents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.payout_email || "no payout email"} · requested {new Date(p.requested_at).toLocaleDateString()}
                          {p.admin_note ? ` · ${p.admin_note}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge>
                        <Input
                          className="w-40"
                          placeholder="Note / txn ref"
                          value={notes[p.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                        />
                        {p.status !== "paid" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === p.id}
                              onClick={() => run(p.id, () => adminUpdatePayout(p.id, "approved", notes[p.id]), "Payout approved")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              disabled={busyId === p.id}
                              onClick={() => run(p.id, () => adminUpdatePayout(p.id, "paid", notes[p.id]), "Marked paid")}
                            >
                              Mark paid
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === p.id}
                              onClick={() => run(p.id, () => adminUpdatePayout(p.id, "rejected", notes[p.id]), "Payout rejected")}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                  {payouts.length === 0 && <p className="py-6 text-center text-muted-foreground">No payout requests.</p>}
                </ul>
              </Card>
            </TabsContent>

            {/* ---------------- PROMO ASSETS ---------------- */}
            <TabsContent value="promo" className="space-y-4">
              <Card className="space-y-3 p-6">
                <h2 className="text-lg font-semibold">Add promo asset</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={assetForm.title} onChange={(e) => setAssetForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Image URL</Label>
                    <Input
                      value={assetForm.image_url}
                      onChange={(e) => setAssetForm((f) => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input
                    value={assetForm.description}
                    onChange={(e) => setAssetForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ready-made copy</Label>
                  <Textarea
                    rows={3}
                    value={assetForm.body_text}
                    onChange={(e) => setAssetForm((f) => ({ ...f, body_text: e.target.value }))}
                  />
                </div>
                <Button
                  disabled={!assetForm.title.trim() || busyId === "new-asset"}
                  onClick={() =>
                    run(
                      "new-asset",
                      async () => {
                        await saveAffiliateAsset({
                          title: assetForm.title.trim(),
                          description: assetForm.description || null,
                          image_url: assetForm.image_url || null,
                          body_text: assetForm.body_text || null,
                          link_url: assetForm.link_url || null,
                          asset_type: assetForm.image_url ? "banner" : "copy",
                        });
                        setAssetForm({ title: "", description: "", image_url: "", body_text: "", link_url: "" });
                      },
                      "Asset saved",
                    )
                  }
                >
                  Add asset
                </Button>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold">Published assets ({assets.length})</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {assets.map((a) => (
                    <Card key={a.id} className="space-y-2 p-4">
                      {a.image_url && (
                        <img src={a.image_url} alt={a.title} loading="lazy" className="h-28 w-full rounded object-cover" />
                      )}
                      <p className="font-medium">{a.title}</p>
                      {a.body_text && <p className="line-clamp-3 text-xs text-muted-foreground">{a.body_text}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={a.active}
                            onCheckedChange={(v) => run(a.id, () => saveAffiliateAsset({ id: a.id, title: a.title, active: v }))}
                          />
                          {a.active ? "Visible" : "Hidden"}
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === a.id}
                          onClick={() => run(a.id, () => deleteAffiliateAsset(a.id), "Asset deleted")}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {assets.length === 0 && <p className="text-sm text-muted-foreground">No assets yet.</p>}
                </div>
              </Card>
            </TabsContent>

            {/* ---------------- COUPONS ---------------- */}
            <TabsContent value="coupons" className="space-y-4">
              <Card className="space-y-3 p-6">
                <h2 className="text-lg font-semibold">Create / update coupon</h2>
                <p className="text-xs text-muted-foreground">
                  Redemption is applied manually by staff at checkout (placeholder until billing integration).
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={couponForm.code}
                      onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SAVE10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      value={couponForm.discount}
                      onChange={(e) => setCouponForm((f) => ({ ...f, discount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Assign to affiliate</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={couponForm.affiliate_id}
                      onChange={(e) => setCouponForm((f) => ({ ...f, affiliate_id: e.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {affiliates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name || a.email || a.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button
                  disabled={!couponForm.code.trim() || busyId === "new-coupon"}
                  onClick={() =>
                    run(
                      "new-coupon",
                      async () => {
                        await adminUpsertCoupon({
                          code: couponForm.code.trim(),
                          affiliate_id: couponForm.affiliate_id || null,
                          description: couponForm.description || null,
                          discount: Number(couponForm.discount) || 10,
                        });
                        setCouponForm({ code: "", affiliate_id: "", discount: "10", description: "" });
                      },
                      "Coupon saved",
                    )
                  }
                >
                  Save coupon
                </Button>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold">Coupons ({coupons.length})</h2>
                <ul className="mt-3 divide-y">
                  {coupons.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <span className="font-mono font-semibold">{c.code}</span>{" "}
                        <span className="text-muted-foreground">
                          {c.discount_percent}% · {affiliates.find((a) => a.id === c.affiliate_id)?.code ?? "unassigned"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "active" : "inactive"}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === c.id}
                          onClick={() => run(c.id, () => adminDeleteCoupon(c.id), "Coupon deleted")}
                        >
                          Delete
                        </Button>
                      </span>
                    </li>
                  ))}
                  {coupons.length === 0 && <p className="py-4 text-center text-muted-foreground">No coupons yet.</p>}
                </ul>
              </Card>
            </TabsContent>

            {/* ---------------- SETTINGS ---------------- */}
            <TabsContent value="settings">
              <Card className="max-w-md space-y-4 p-6">
                <h2 className="text-lg font-semibold">Program settings</h2>
                <div className="space-y-1">
                  <Label>Default commission rate (%)</Label>
                  <Input
                    type="number"
                    value={settings.default_rate}
                    onChange={(e) => setSettings((s) => ({ ...s, default_rate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Minimum payout (USD)</Label>
                  <Input
                    type="number"
                    value={settings.min_payout_cents / 100}
                    onChange={(e) => setSettings((s) => ({ ...s, min_payout_cents: Math.round(Number(e.target.value) * 100) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Attribution window (days)</Label>
                  <Input
                    type="number"
                    value={settings.cookie_days}
                    onChange={(e) => setSettings((s) => ({ ...s, cookie_days: Number(e.target.value) }))}
                  />
                </div>
                <Button
                  disabled={busyId === "settings"}
                  onClick={() => run("settings", () => saveProgramSettings(settings), "Settings saved")}
                >
                  Save settings
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
