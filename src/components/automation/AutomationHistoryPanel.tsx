import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { listAutomationHistory } from "@/lib/automations/service";
import type { Automation, AutomationExecutionHistory, AutomationExecutionStatus } from "@/lib/automations/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "—";
const duration = (row: { started_at: string | null; completed_at: string | null }) => {
  if (!row.started_at || !row.completed_at) return "—";
  const ms = new Date(row.completed_at).getTime() - new Date(row.started_at).getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};
const pretty = (value: unknown) => value && typeof value === "object" && Object.keys(value).length ? JSON.stringify(value, null, 2) : "No output";

export function AutomationHistoryPanel({ automations, supportMode = false, initialAutomationId = "all" }: { automations: Automation[]; supportMode?: boolean; initialAutomationId?: string }) {
  const [automationId, setAutomationId] = useState(initialAutomationId);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filters = { automationId: automationId === "all" ? undefined : automationId, status: status === "all" ? undefined : status as AutomationExecutionStatus, from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T23:59:59.999Z` : undefined, page, pageSize: PAGE_SIZE };
  const history = useQuery({ queryKey: ["automation-history", filters], queryFn: () => listAutomationHistory(filters) });
  const pages = Math.max(1, Math.ceil((history.data?.count ?? 0) / PAGE_SIZE));
  const resetPage = (fn: () => void) => { fn(); setPage(1); };
  return <div className="space-y-4">
    {supportMode && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Read-only support view.</strong> Customer definitions and executions cannot be changed from this interface.</div>}
    <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Select value={automationId} onValueChange={(value) => resetPage(() => setAutomationId(value))}><SelectTrigger><SelectValue placeholder="Automation" /></SelectTrigger><SelectContent><SelectItem value="all">All automations</SelectItem>{automations.map((item) => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(value) => resetPage(() => setStatus(value))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["pending", "running", "waiting", "succeeded", "failed", "cancelled"].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Input type="date" aria-label="Started on or after" value={from} onChange={(event) => resetPage(() => setFrom(event.target.value))} />
      <Input type="date" aria-label="Started on or before" value={to} onChange={(event) => resetPage(() => setTo(event.target.value))} />
    </div>
    {history.isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : history.error ? <Card><CardContent className="p-5 text-sm text-destructive">{history.error.message}</CardContent></Card> : !history.data?.rows.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No executions match these filters.</CardContent></Card> : history.data.rows.map((row) => <HistoryRow key={row.id} row={row} expanded={expanded === row.id} onToggle={() => setExpanded(expanded === row.id ? null : row.id)} />)}
    <div className="flex items-center justify-between text-sm"><span>{history.data?.count ?? 0} executions</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
  </div>;
}

function HistoryRow({ row, expanded, onToggle }: { row: AutomationExecutionHistory; expanded: boolean; onToggle: () => void }) {
  return <Card><CardContent className="p-0"><button type="button" className="grid w-full gap-2 p-4 text-left sm:grid-cols-[auto_2fr_1fr_1fr_1.3fr] sm:items-center" onClick={onToggle}>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<div><p className="font-medium">{row.automation_name}</p><p className="text-xs text-muted-foreground">Version {row.version} · {row.event_type ?? row.trigger_type}</p></div><Badge className="w-fit" variant={row.status === "failed" ? "destructive" : row.status === "succeeded" ? "default" : "secondary"}>{row.status}</Badge><div className="text-sm"><p>{duration(row)}</p><p className="text-xs text-muted-foreground">Duration</p></div><div className="text-sm"><p>{formatDate(row.started_at ?? row.created_at)}</p><p className="truncate text-xs text-muted-foreground">Correlation {row.correlation_id}</p></div></button>{expanded && <div className="border-t p-4"><div className="space-y-3">{row.steps.map((step, index) => <div key={step.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{index + 1}</Badge><span className="font-medium">{step.action_type ?? step.step_key}</span><Badge variant={step.status === "failed" ? "destructive" : "secondary"}>{step.status}</Badge><span className="text-xs text-muted-foreground">Attempt {step.attempt} · {duration(step)}</span></div>{(step.error_code || step.error_message) && <p className="mt-2 text-sm text-destructive">{step.error_code}{step.error_message ? `: ${step.error_message}` : ""}</p>}<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{pretty(step.output)}</pre></div>)}</div>{row.steps.length === 0 && <p className="text-sm text-muted-foreground">No action steps were recorded.</p>}</div>}</CardContent></Card>;
}
