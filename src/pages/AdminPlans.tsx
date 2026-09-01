import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  fetchPlans,
  formatPrice,
  limitLabel,
  savePlan,
  setPlanActive,
  type Plan,
  type PlanDraft,
} from "@/lib/plans";

const BLANK: PlanDraft = {
  slug: "",
  name: "",
  description: "",
  price_cents: 0,
  currency: "USD",
  billing_period: "month",
  max_social_accounts: 3,
  max_posts_per_month: 30,
  max_scheduled_posts: 10,
  max_team_members: 1,
  analytics_access: false,
  ai_features: false,
  priority_support: false,
  promo_text: "",
  display_order: 99,
  is_default: false,
  active: true,
};

function NumberField({
  label,
  value,
  onChange,
  hint,
}: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminPlans() {
  const { isAdmin, loading } = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PlanDraft | null>(null);

  const plans = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => fetchPlans(true),
    enabled: isAdmin,
  });

  const save = useMutation({
    mutationFn: savePlan,
    onSuccess: () => {
      toast({ title: "Plan saved" });
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setPlanActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  if (loading) {
    return <AdminLayout><Skeleton className="h-40 w-full" /></AdminLayout>;
  }
  if (!isAdmin) {
    return (
      <AdminLayout>
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          You need administrator access to manage plans.
        </CardContent></Card>
      </AdminLayout>
    );
  }

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <AdminLayout active="plans">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Plans &amp; pricing</h1>
            <p className="text-sm text-muted-foreground">
              Limits are enforced on the server. Use 0 for unlimited.
            </p>
          </div>
          <Button onClick={() => setDraft({ ...BLANK })}>
            <Plus className="mr-2 h-4 w-4" /> New plan
          </Button>
        </div>

        {draft && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{draft.id ? "Edit plan" : "New plan"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Slug</Label>
                  <Input value={draft.slug} onChange={(e) => set("slug", e.target.value)} />
                </div>
                <NumberField
                  label="Price (cents)"
                  value={draft.price_cents}
                  onChange={(v) => set("price_cents", v)}
                />
                <div className="space-y-1">
                  <Label>Billing period</Label>
                  <Input
                    value={draft.billing_period}
                    onChange={(e) => set("billing_period", e.target.value)}
                  />
                </div>
                <NumberField
                  label="Max social accounts"
                  value={draft.max_social_accounts}
                  onChange={(v) => set("max_social_accounts", v)}
                  hint="0 = unlimited"
                />
                <NumberField
                  label="Max posts per month"
                  value={draft.max_posts_per_month}
                  onChange={(v) => set("max_posts_per_month", v)}
                  hint="0 = unlimited"
                />
                <NumberField
                  label="Max scheduled posts"
                  value={draft.max_scheduled_posts}
                  onChange={(v) => set("max_scheduled_posts", v)}
                  hint="0 = unlimited"
                />
                <NumberField
                  label="Max team members"
                  value={draft.max_team_members}
                  onChange={(v) => set("max_team_members", v)}
                />
                <NumberField
                  label="Display order"
                  value={draft.display_order}
                  onChange={(v) => set("display_order", v)}
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={draft.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Promo text</Label>
                <Input
                  value={draft.promo_text ?? ""}
                  onChange={(e) => set("promo_text", e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-6">
                {([
                  ["analytics_access", "Analytics"],
                  ["ai_features", "AI features"],
                  ["priority_support", "Priority support"],
                  ["is_default", "Default plan"],
                  ["active", "Active"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={Boolean(draft[key])}
                      onCheckedChange={(v) => set(key, v as never)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => save.mutate(draft)}
                  disabled={save.isPending || !draft.name.trim() || !draft.slug.trim()}
                >
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save plan
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {plans.isLoading && <Skeleton className="h-40 w-full" />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(plans.data ?? []).map((plan: Plan) => (
            <Card key={plan.id}>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  <Badge variant={plan.active ? "secondary" : "outline"}>
                    {plan.active ? "Active" : "Hidden"}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(plan.price_cents, plan.currency)} / {plan.billing_period}
                  {plan.is_default && " • default"}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{limitLabel(plan.max_social_accounts)} accounts</p>
                <p>{limitLabel(plan.max_posts_per_month)} posts / month</p>
                <p>{limitLabel(plan.max_scheduled_posts)} scheduled</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...plan })}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: plan.id, active: !plan.active })}
                  >
                    {plan.active ? "Hide" : "Show"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
