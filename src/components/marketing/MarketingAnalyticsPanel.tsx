import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MarketingCampaign,
  MarketingSubscriber,
  SOURCE_LABELS,
  fetchCampaigns,
  fetchEmailLog,
  fetchSubscribers,
} from "@/lib/marketing";

export function MarketingAnalyticsPanel({ clientId }: { clientId: string | null | undefined }) {
  const [subs, setSubs] = useState<MarketingSubscriber[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSubscribers({ clientId }),
      fetchCampaigns(clientId),
      fetchEmailLog(clientId),
    ])
      .then(([s, c, e]) => {
        setSubs(s);
        setCampaigns(c);
        setEmails(e);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [clientId]);

  const growth = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i));
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        date: format(d, "MMM d"),
        added: subs.filter((s) => s.created_at.slice(0, 10) === key).length,
      };
    });
  }, [subs]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    subs.forEach((s) => map.set(s.source, (map.get(s.source) ?? 0) + 1));
    return Array.from(map, ([source, count]) => ({
      source: SOURCE_LABELS[source] ?? source,
      count,
    })).sort((a, b) => b.count - a.count);
  }, [subs]);

  const sentEmails = emails.filter((e) => e.status === "sent").length;
  const failedEmails = emails.filter((e) => e.status === "failed").length;
  const deliveryRate = emails.length ? Math.round((sentEmails / emails.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    ["Subscribers", subs.length],
    ["Campaigns sent", campaigns.filter((c) => c.status === "sent").length],
    ["Emails delivered", sentEmails],
    ["Delivery rate", `${deliveryRate}%`],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="mb-3 font-semibold">Subscriber growth (30 days)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="added" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 font-semibold">Signups by source</p>
          {bySource.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySource}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 font-semibold">Recent campaigns</p>
          {campaigns.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.sent_count}/{c.recipient_count}
                  </span>
                  <Badge variant={c.status === "sent" ? "secondary" : "outline"}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          {failedEmails > 0 && (
            <p className="mt-3 text-xs text-destructive">{failedEmails} email(s) failed to send.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
