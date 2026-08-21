import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAnalytics, syncAnalytics, type AnalyticsRow } from "@/lib/social/api";
import { PLATFORM_LABEL, SOCIAL_PLATFORMS } from "@/lib/social/types";

const METRICS: { key: keyof AnalyticsRow; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "reach", label: "Reach" },
  { key: "engagements", label: "Engagements" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "clicks", label: "Clicks" },
  { key: "video_views", label: "Video views" },
];

export function AnalyticsPanel() {
  const [days, setDays] = useState("30");
  const [platform, setPlatform] = useState("all");
  const [syncing, setSyncing] = useState(false);

  const since = useMemo(
    () => new Date(Date.now() - Number(days) * 86400000).toISOString(),
    [days],
  );
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["social-analytics", since],
    queryFn: () => fetchAnalytics(since),
  });

  const rows = (data ?? []).filter((r) => platform === "all" || r.platform === platform);

  // Latest snapshot per variant so repeated syncs do not double-count.
  const latest = useMemo(() => {
    const map = new Map<string, AnalyticsRow>();
    for (const row of rows) if (!map.has(row.variant_id)) map.set(row.variant_id, row);
    return [...map.values()];
  }, [rows]);

  const totals = METRICS.map(({ key, label }) => {
    const values = latest.map((r) => r[key] as number | null).filter((v): v is number => v !== null);
    return { label, value: values.length ? values.reduce((a, b) => a + b, 0) : null };
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAnalytics();
      toast.success("Metrics refreshed from the platforms.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {SOCIAL_PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sync now
        </Button>
      </div>

      {isLoading && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {!isLoading && !latest.length && (
        <Card>
          <CardContent className="space-y-1 p-6 text-center">
            <p className="font-medium">No metrics yet</p>
            <p className="text-sm text-muted-foreground">
              Publish a post, then use Sync now. Platforms that do not expose metrics show
              “Not available”.
            </p>
          </CardContent>
        </Card>
      )}

      {latest.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {totals.map((t) => (
              <Card key={t.label}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t.label}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {t.value === null
                      ? <span className="text-sm text-muted-foreground">Not available</span>
                      : t.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Per post</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {latest.map((row) => (
                <div key={row.id} className="flex flex-wrap gap-3 rounded-md border p-2 text-sm">
                  <span className="font-medium">{PLATFORM_LABEL[row.platform]}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.captured_at).toLocaleString()}
                  </span>
                  {METRICS.map(({ key, label }) => (
                    <span key={key} className="text-xs">
                      {label}:{" "}
                      {row[key] === null ? "Not available" : String(row[key])}
                    </span>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
