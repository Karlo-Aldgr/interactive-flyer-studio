import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { upsertDailySummary } from "@/lib/menuOrderSync";

type Summary = {
  id: string;
  summary_date: string;
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  total_sales_cents: number;
  paid_orders: number;
  unpaid_orders: number;
};

type Props = {
  flyerId: string;
  flyerTitle?: string;
  currency?: string;
};

function csv(rows: Summary[]): string {
  const cols = ["summary_date", "total_orders", "completed_orders", "pending_orders", "cancelled_orders", "total_sales", "paid_orders", "unpaid_orders"];
  const esc = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const mapped = rows.map((r) => ({
    ...r,
    total_sales: (r.total_sales_cents / 100).toFixed(2),
  }));
  return [cols.join(","), ...mapped.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
}

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DailyReportsPanel({ flyerId, flyerTitle = "Restaurant", currency = "₱" }: Props) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_daily_summaries")
      .select("*")
      .eq("flyer_id", flyerId)
      .order("summary_date", { ascending: false })
      .limit(90);
    if (error?.message?.includes("does not exist")) {
      setSummaries([]);
    } else if (error) {
      toast.error(error.message);
    } else {
      setSummaries((data as Summary[]) || []);
    }
    setLoading(false);
  }, [flyerId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!filterDate) return summaries;
    return summaries.filter((s) => s.summary_date === filterDate);
  }, [summaries, filterDate]);

  const today = new Date().toISOString().slice(0, 10);

  async function generateForDate(date: string) {
    setGenerating(true);
    const { error } = await upsertDailySummary(flyerId, date);
    setGenerating(false);
    if (error) return toast.error(error);
    toast.success(`Report saved for ${dayLabel(date)}`);
    setFilterDate(date);
    load();
  }

  function printReport() {
    window.print();
  }

  function exportCsv() {
    const blob = new Blob([csv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${flyerTitle.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div id="daily-reports-print" className="space-y-4 print:space-y-4">
      <div className="hidden print:block print:mb-8 print:text-center">
        <h1 className="text-2xl font-bold">{flyerTitle}</h1>
        <p className="text-sm text-gray-600">Daily Sales Summary Report</p>
        <p className="mt-1 text-xs text-gray-500">
          Printed {new Date().toLocaleString()}
          {filterDate ? ` · Filter: ${dayLabel(filterDate)}` : ""}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5 print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Daily sales reports
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Master / owner: generate end-of-day totals, then <strong>Print / Save as PDF</strong> for records or{" "}
              <strong>Export Excel (CSV)</strong> for spreadsheets. Reports save automatically before old orders archive.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Filter by date</label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => generateForDate(today)} disabled={generating}>
              {generating ? "Generating…" : "Generate today's report"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export Excel (CSV)
              </Button>
              <Button size="sm" onClick={printReport} disabled={filtered.length === 0}>
                <Printer className="mr-1 h-3.5 w-3.5" /> Print / Save as PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card className="print:hidden">
            <CardContent className="py-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No saved reports yet</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Click <strong>Generate today&apos;s report</strong> to build a summary from today&apos;s orders.
                Then use <strong>Print / Save as PDF</strong> — in the print dialog choose &quot;Save as PDF&quot;.
              </p>
              <Button className="mt-4" onClick={() => generateForDate(today)} disabled={generating}>
                Generate today&apos;s report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((s) => (
              <Card key={s.id} className="print:break-inside-avoid print:shadow-none print:border">
                <CardHeader className="pb-2 border-b print:border-gray-300">
                  <CardTitle className="text-lg">{dayLabel(s.summary_date)}</CardTitle>
                  <p className="text-xs text-muted-foreground print:text-gray-600">End-of-day summary</p>
                </CardHeader>
                <CardContent className="grid gap-3 pt-4 text-sm sm:grid-cols-2 md:grid-cols-3">
                  <Stat label="Total orders" value={String(s.total_orders)} highlight />
                  <Stat label="Completed orders" value={String(s.completed_orders)} />
                  <Stat label="Pending orders" value={String(s.pending_orders)} />
                  <Stat label="Cancelled orders" value={String(s.cancelled_orders)} />
                  <Stat
                    label="Total sales"
                    value={`${currency}${(s.total_sales_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    highlight
                  />
                  <Stat label="Paid orders" value={String(s.paid_orders)} />
                  <Stat label="Unpaid orders" value={String(s.unpaid_orders)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 print:border-gray-300 ${highlight ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground print:text-gray-600">
        {label}
      </div>
      <div className={`text-xl font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
