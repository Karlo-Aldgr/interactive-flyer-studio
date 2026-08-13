import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAffiliate } from "@/hooks/useAffiliate";
import {
  affiliateLink,
  formatCents,
  loadAffiliateCommissions,
  loadAffiliateReferrals,
  updatePayoutEmail,
  type AffiliateCommission,
  type AffiliateReferral,
} from "@/lib/affiliates";

export default function AffiliateDashboard() {
  const { affiliate, application, loading } = useAffiliate();
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payout, setPayout] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (affiliateId: string) => {
    setRefreshing(true);
    const [r, c] = await Promise.all([
      loadAffiliateReferrals(affiliateId),
      loadAffiliateCommissions(affiliateId),
    ]);
    setReferrals(r);
    setCommissions(c);
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "Affiliate dashboard | TapThatFlyer";
    if (!affiliate) return;
    setPayout(affiliate.payout_email ?? "");
    refresh(affiliate.id);
  }, [affiliate]);

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
          <h1 className="text-2xl font-bold">Affiliate access pending</h1>
          <p className="text-muted-foreground">
            {application?.status === "pending"
              ? "Your application is under review. We'll email you as soon as it's approved."
              : application?.status === "rejected"
                ? application.review_notes?.trim() || "Your application was not approved."
                : "You're not an affiliate yet. Apply to get your referral link and dashboard."}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {application?.status !== "pending" && (
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
  const pending = commissions.filter((c) => c.status !== "paid").reduce((s, c) => s + c.amount_cents, 0);
  const paid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount_cents, 0);

  const savePayout = async () => {
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

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
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
            <Badge variant={affiliate.status === "active" ? "secondary" : "outline"}>{affiliate.status}</Badge>
          </p>
        </div>

        <Card className="space-y-3 p-6">
          <Label>Your referral link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={link} className="font-mono text-sm" />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Referral link copied");
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Referral code: <span className="font-mono">{affiliate.code}</span></p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Referrals</p>
            <p className="mt-1 text-2xl font-bold">{referrals.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Pending payout</p>
            <p className="mt-1 text-2xl font-bold">{formatCents(pending)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Paid to date</p>
            <p className="mt-1 text-2xl font-bold">{formatCents(paid)}</p>
          </Card>
        </div>

        <Card className="space-y-3 p-6">
          <Label htmlFor="payout">Payout email (PayPal)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="payout" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="you@example.com" />
            <Button onClick={savePayout} disabled={saving} variant="outline">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Referrals</h2>
          {referrals.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No referrals yet — share your link to get started.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{r.referred_name || r.referred_email || "Anonymous visitor"}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    <Badge variant="outline">{r.status}</Badge>
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

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
      </div>
    </div>
  );
}
