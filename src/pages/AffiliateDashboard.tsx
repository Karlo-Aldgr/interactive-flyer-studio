import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeDollarSign,
  Copy,
  Download,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAffiliate } from "@/hooks/useAffiliate";
import {
  affiliateLink,
  formatCents,
  loadAffiliateAssets,
  loadAffiliateBalance,
  loadAffiliateClicks,
  loadAffiliateCommissions,
  loadAffiliatePayouts,
  loadAffiliateReferrals,
  loadCoupons,
  loadMyNotifications,
  loadProgramSettings,
  requestPayout,
  updatePayoutEmail,
  type AffiliateAsset,
  type AffiliateBalance,
  type AffiliateClick,
  type AffiliateCommission,
  type AffiliateCoupon,
  type AffiliateNotification,
  type AffiliatePayout,
  type AffiliateReferral,
} from "@/lib/affiliates";

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
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

export default function AffiliateDashboard() {
  const { affiliate, application, loading, reload } = useAffiliate();

  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [assets, setAssets] = useState<AffiliateAsset[]>([]);
  const [coupons, setCoupons] = useState<AffiliateCoupon[]>([]);
  const [notifications, setNotifications] = useState<AffiliateNotification[]>([]);
  const [balance, setBalance] = useState<AffiliateBalance | null>(null);
  const [minPayout, setMinPayout] = useState(5000);
  const [payout, setPayout] = useState("");
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (affiliateId: string) => {
    setRefreshing(true);
    const [r, c, cl, p, a, cp, n, b, s] = await Promise.all([
      loadAffiliateReferrals(affiliateId),
      loadAffiliateCommissions(affiliateId),
      loadAffiliateClicks(affiliateId),
      loadAffiliatePayouts(affiliateId),
      loadAffiliateAssets(true),
      loadCoupons(affiliateId),
      loadMyNotifications(),
      loadAffiliateBalance(affiliateId),
      loadProgramSettings(),
    ]);
    setReferrals(r);
    setCommissions(c);
    setClicks(cl);
    setPayouts(p);
    setAssets(a);
    setCoupons(cp);
    setNotifications(n);
    setBalance(b);
    setMinPayout(s.min_payout_cents);
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "Affiliate dashboard | TapThatFlyer";
    if (!affiliate) return;
    setPayout(affiliate.payout_email ?? "");
    refresh(affiliate.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliate]);

  // Keep settings (minimum payout), rate and balances current when returning to the tab.
  useEffect(() => {
    if (!affiliate) return;
    const onFocus = () => {
      reload();
      refresh(affiliate.id);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliate?.id]);


  const available = useMemo(() => {
    if (!balance) return 0;
    return Math.max(
      0,
      Number(balance.approved_cents) - Number(balance.paid_out_cents) - Number(balance.requested_cents),
    );
  }, [balance]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md space-y-4 p-8 text-center">
          <h1 className="text-2xl font-bold">
            {application?.status === "pending" ? "Under review" : "Affiliate access pending"}
          </h1>
          <p className="text-muted-foreground">
            {application?.status === "pending"
              ? "Your application is under review. We'll email you as soon as it's approved."
              : application?.status === "rejected"
                ? application.review_notes?.trim() || "Your application was not approved."
                : "You're not an affiliate yet. Apply to get your referral link and dashboard."}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {application?.status === "pending" ? (
              <Button variant="outline" onClick={() => reload()}>
                <RefreshCw className="mr-1 h-4 w-4" /> Check status
              </Button>
            ) : (
              <Button asChild>
                <Link to="/affiliate/apply">Apply now</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/affiliate">Affiliate program</Link>
            </Button>
          </div>

        </Card>
      </div>
    );
  }

  const link = affiliateLink(affiliate.code);
  const converted = referrals.filter((r) => r.status === "converted").length;
  const pendingCommission = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount_cents, 0);

  const savePayoutEmail = async () => {
    setSaving(true);
    try {
      await updatePayoutEmail(affiliate.id, payout.trim());
      toast.success("Payout email saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const submitPayout = async () => {
    setRequesting(true);
    try {
      const res = await requestPayout(available, payout.trim() || undefined);
      toast.success(res.message ?? "Payout requested");
      await refresh(affiliate.id);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not request payout");
    } finally {
      setRequesting(false);
    }
  };

  const copy = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh(affiliate.id)} disabled={refreshing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Affiliate dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Commission rate {affiliate.commission_rate}% ·{" "}
            <Badge variant={affiliate.status === "active" ? "secondary" : "outline"}>{affiliate.status}</Badge> ·{" "}
            <Link to="/affiliate/terms" className="underline underline-offset-2">
              Affiliate agreement
            </Link>
          </p>
        </div>

        {notifications.length > 0 && (
          <Card className="space-y-1 p-4">
            {notifications.slice(0, 3).map((n) => (
              <div key={n.id} className="text-sm">
                <strong>{n.title}</strong>{" "}
                <span className="text-muted-foreground">{n.body}</span>
              </div>
            ))}
          </Card>
        )}

        <Card className="space-y-3 p-6">
          <Label>Your referral link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} className="font-mono text-sm" />
            <Button onClick={() => copy(link, "Referral link copied")}>
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Referral code: <span className="font-mono">{affiliate.code}</span> · Clicks are attributed for 14 days.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={MousePointerClick} label="Clicks" value={String(clicks.length)} />
          <Stat icon={Users} label="Signups" value={String(referrals.length)} hint={`${converted} converted`} />
          <Stat
            icon={BadgeDollarSign}
            label="Earnings"
            value={formatCents(Number(balance?.approved_cents ?? 0))}
            hint={`${formatCents(pendingCommission)} pending approval`}
          />
          <Stat
            icon={Wallet}
            label="Available to withdraw"
            value={formatCents(available)}
            hint={`${formatCents(Number(balance?.paid_out_cents ?? 0))} paid to date`}
          />
        </div>

        <Tabs defaultValue="referrals">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="promo">Promo materials</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Referred customers</h2>
              {referrals.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No referrals yet — share your link to get started.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {referrals.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {r.referred_name || r.referred_email || "Anonymous visitor"}
                        <span className="ml-2 text-xs text-muted-foreground">{(r as any).channel ?? "Link"}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        <Badge variant={r.status === "converted" ? "secondary" : "outline"}>{r.status}</Badge>
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Commissions</h2>
              {commissions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No commissions recorded yet.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {commissions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{c.description || "Commission"}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={c.status === "paid" ? "secondary" : "outline"}>{c.status}</Badge>
                        <strong>{formatCents(c.amount_cents)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <Card className="space-y-3 p-6">
              <Label htmlFor="payout">Payout email (PayPal)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="payout"
                  value={payout}
                  onChange={(e) => setPayout(e.target.value)}
                  placeholder="you@example.com"
                />
                <Button onClick={savePayoutEmail} disabled={saving} variant="outline">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <div className="flex-1">
                  <p className="text-sm">
                    Available: <strong>{formatCents(available)}</strong> · Minimum payout {formatCents(minPayout)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Payouts are reviewed and sent manually via PayPal within 30 days.
                  </p>
                </div>
                <Button onClick={submitPayout} disabled={requesting || available < minPayout || !payout.trim()}>
                  {requesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request payout
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Payout history</h2>
              {payouts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No payout requests yet.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {new Date(p.requested_at).toLocaleDateString()} · {p.payout_email || "no email"}
                        {p.admin_note ? ` · ${p.admin_note}` : ""}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge>
                        <strong>{formatCents(p.amount_cents)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="promo">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Promo materials</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Banners and ready-made copy. Every link below already includes your referral code.
              </p>
              {assets.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No promo assets published yet.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {assets.map((a) => (
                    <Card key={a.id} className="space-y-2 p-4">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          loading="lazy"
                          className="h-32 w-full rounded-md object-cover"
                        />
                      )}
                      <p className="font-medium">{a.title}</p>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                      {a.body_text && (
                        <p className="whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{a.body_text}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {a.body_text && (
                          <Button size="sm" variant="outline" onClick={() => copy(`${a.body_text}\n${link}`, "Copy copied")}>
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copy text
                          </Button>
                        )}
                        {a.image_url && (
                          <Button asChild size="sm" variant="outline">
                            <a href={a.image_url} download target="_blank" rel="noreferrer">
                              <Download className="mr-1 h-3.5 w-3.5" /> Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="coupons">
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Ticket className="h-4 w-4" /> Your coupon codes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share these with customers who prefer a code. Redemption is applied manually by our team at checkout.
              </p>
              {coupons.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No coupon codes assigned to you yet.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {coupons.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-mono font-semibold">{c.code}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {c.discount_percent}% off
                        <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "active" : "inactive"}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => copy(c.code, "Coupon copied")}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
