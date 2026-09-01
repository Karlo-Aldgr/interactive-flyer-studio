import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyLimits, fetchPlans, formatPrice, limitLabel } from "@/lib/plans";

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {used} / {limitLabel(max)}
        </span>
      </div>
      <Progress value={max > 0 ? Math.min(100, (used / max) * 100) : 0} />
    </div>
  );
}

export default function Billing() {
  const limits = useQuery({ queryKey: ["my-plan-limits"], queryFn: fetchMyLimits, staleTime: 30_000 });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => fetchPlans(), staleTime: 60_000 });

  const current = limits.data?.plan;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Plan &amp; usage</h1>
        <p className="text-sm text-muted-foreground">
          See what your plan includes and how much you've used this month.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {limits.isLoading ? "Loading…" : current?.name ?? "No plan assigned"}
          </CardTitle>
          {current && (
            <Badge variant="secondary">
              {formatPrice(current.price_cents, current.currency)} / {current.billing_period}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {limits.isLoading && <Skeleton className="h-24 w-full" />}
          {limits.data && (
            <>
              <UsageBar
                label="Connected social accounts"
                used={limits.data.usage.connected_accounts}
                max={current?.max_social_accounts ?? 0}
              />
              <UsageBar
                label="Posts this month"
                used={limits.data.usage.posts_this_month}
                max={current?.max_posts_per_month ?? 0}
              />
              <UsageBar
                label="Scheduled posts"
                used={limits.data.usage.scheduled_posts}
                max={current?.max_scheduled_posts ?? 0}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).map((plan) => {
          const isCurrent = plan.id === current?.id;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <p className="text-2xl font-bold">
                  {formatPrice(plan.price_cents, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {plan.billing_period}
                  </span>
                </p>
                {plan.promo_text && (
                  <p className="text-xs text-muted-foreground">{plan.promo_text}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="space-y-1 text-muted-foreground">
                  <li>{limitLabel(plan.max_social_accounts)} social accounts</li>
                  <li>{limitLabel(plan.max_posts_per_month)} posts per month</li>
                  <li>{limitLabel(plan.max_scheduled_posts)} scheduled posts</li>
                  <li className="flex items-center gap-2">
                    {plan.analytics_access ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    Analytics
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.ai_features ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    AI caption help
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.priority_support ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    Priority support
                  </li>
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                  asChild={!isCurrent}
                >
                  {isCurrent ? (
                    <span>Your current plan</span>
                  ) : (
                    <a href="mailto:support@tapthatflyer.com?subject=Plan%20upgrade">
                      Talk to us about upgrading
                    </a>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
