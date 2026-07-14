import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Mail, Trash2, Search, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { MassEmailDialog, type MassEmailRecipient } from "./MassEmailDialog";

interface SubscriberRow {
  id: string;
  flyer_id: string;
  name: string | null;
  email: string;
  phone: string | null;
  list_name: string | null;
  source: string;
  unsubscribed_at: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flyerId: string;
  flyerTitle: string;
  flyerUrl: string;
}

function csvEscape(v: string) {
  if (v == null) return "";
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(filename: string, rows: SubscriberRow[]) {
  const header = ["Name", "Email", "Phone", "List", "Source", "Subscribed at", "Unsubscribed at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.name || "",
      r.email,
      r.phone || "",
      r.list_name || "",
      r.source,
      new Date(r.created_at).toISOString(),
      r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : "",
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SubscribersPanel({ open, onOpenChange, flyerId, flyerTitle, flyerUrl }: Props) {
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [showUnsub, setShowUnsub] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscribers")
      .select("*")
      .eq("flyer_id", flyerId)
      .order("created_at", { ascending: false })
      .limit(5000);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data || []) as SubscriberRow[]);
    setSelected(new Set());
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flyerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showUnsub && r.unsubscribed_at) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.list_name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, showUnsub]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    setSelected(next);
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const selectedRows = filtered.filter((r) => selected.has(r.id) && !r.unsubscribed_at);
  const recipients: MassEmailRecipient[] = selectedRows.length > 0
    ? selectedRows.map((r) => ({ email: r.email, name: r.name }))
    : filtered.filter((r) => !r.unsubscribed_at).map((r) => ({ email: r.email, name: r.name }));

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} subscriber${selected.size === 1 ? "" : "s"}?`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("subscribers").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  async function markUnsubscribed() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Marked unsubscribed");
    load();
  }

  function exportCsv(scope: "all" | "selected") {
    const data = scope === "selected" && selected.size > 0
      ? filtered.filter((r) => selected.has(r.id))
      : filtered;
    if (data.length === 0) return toast.error("Nothing to export");
    const safe = flyerTitle.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40) || "flyer";
    downloadCsv(`subscribers-${safe}.csv`, data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 rounded-none border-0 sm:rounded-none flex flex-col">
        <DialogHeader className="border-b border-border bg-card px-4 py-3 shrink-0">
          <DialogTitle>Subscribers — {flyerTitle}</DialogTitle>
          <DialogDescription>
            People who signed up via the Subscribe action on this flyer. Export to Excel/CSV or compose a mass email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, list…"
              className="h-8 w-72 pl-7 text-sm"
            />
          </div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Checkbox checked={showUnsub} onCheckedChange={(v) => setShowUnsub(!!v)} />
            Show unsubscribed
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(selected.size > 0 ? "selected" : "all")}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Export {selected.size > 0 ? `${selected.size} selected` : "all"} (CSV/Excel)
            </Button>
            <Button size="sm" variant="outline" onClick={markUnsubscribed} disabled={selected.size === 0}>
              Mark unsubscribed
            </Button>
            <Button size="sm" variant="outline" onClick={deleteSelected} disabled={selected.size === 0} className="text-destructive">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" onClick={() => setComposeOpen(true)} disabled={recipients.length === 0}>
              <Mail className="mr-1 h-3.5 w-3.5" />
              Compose mass email ({recipients.length})
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <div className="text-sm">No subscribers yet.</div>
              <div className="text-xs">
                Add a Subscribe action to a layer, publish your flyer, and signups will land here.
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                <tr className="text-left">
                  <th className="w-10 border-b border-border px-3 py-2">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="border-b border-border px-3 py-2 font-medium">#</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Name</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Email</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Phone</th>
                  <th className="border-b border-border px-3 py-2 font-medium">List</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Source</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Subscribed</th>
                  <th className="border-b border-border px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-muted/40 ${selected.has(r.id) ? "bg-primary/5" : ""}`}>
                    <td className="border-b border-border px-3 py-1.5">
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    </td>
                    <td className="border-b border-border px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="border-b border-border px-3 py-1.5">{r.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="border-b border-border px-3 py-1.5 font-mono text-xs">{r.email}</td>
                    <td className="border-b border-border px-3 py-1.5">{r.phone || <span className="text-muted-foreground">—</span>}</td>
                    <td className="border-b border-border px-3 py-1.5">{r.list_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="border-b border-border px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">{r.source}</td>
                    <td className="border-b border-border px-3 py-1.5 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="border-b border-border px-3 py-1.5 text-xs">
                      {r.unsubscribed_at ? (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">Unsubscribed</span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <MassEmailDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          recipients={recipients}
          flyerId={flyerId}
          flyerTitle={flyerTitle}
          flyerUrl={flyerUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
