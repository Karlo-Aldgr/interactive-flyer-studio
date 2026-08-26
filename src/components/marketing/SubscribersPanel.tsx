import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MarketingClient,
  MarketingSubscriber,
  SOURCE_LABELS,
  SUBSCRIBER_SOURCES,
  deleteSubscriber,
  downloadCsv,
  fetchSubscribers,
  setSubscriberStatus,
  subscriberStats,
  subscribersToCsv,
} from "@/lib/marketing";
import { SubscriberDialog } from "./SubscriberDialog";
import { SubscriberProfileDialog } from "./SubscriberProfileDialog";
import { ImportSubscribersDialog } from "./ImportSubscribersDialog";

type Props = {
  /** undefined = every client (super admin), null = platform list, string = one client */
  clientId: string | null | undefined;
  isAdmin?: boolean;
  clients?: MarketingClient[];
  onClientFilterChange?: (value: string) => void;
  clientFilter?: string;
};

export function SubscribersPanel({
  clientId,
  isAdmin,
  clients = [],
  clientFilter = "all",
  onClientFilterChange,
}: Props) {
  const [rows, setRows] = useState<MarketingSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [tag, setTag] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingSubscriber | null>(null);
  const [viewing, setViewing] = useState<MarketingSubscriber | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSubscribers({
        clientId,
        search,
        status,
        source,
        tag,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load subscribers");
    } finally {
      setLoading(false);
    }
  }, [clientId, search, status, source, tag, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name || c.email || "Client"])),
    [clients],
  );

  const visible = useMemo(() => {
    if (clientId !== undefined || clientFilter === "all") return rows;
    if (clientFilter === "platform") return rows.filter((r) => !r.client_id);
    return rows.filter((r) => r.client_id === clientFilter);
  }, [rows, clientFilter, clientId]);

  const stats = subscriberStats(visible);
  const allTags = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.tags ?? []))).sort(),
    [rows],
  );

  const toggleStatus = async (row: MarketingSubscriber) => {
    try {
      await setSubscriberStatus(row, row.status === "active" ? "unsubscribed" : "active");
      toast.success("Status updated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };

  const remove = async (row: MarketingSubscriber) => {
    if (!confirm(`Delete ${row.email}? This removes the record permanently.`)) return;
    try {
      await deleteSubscriber(row.id);
      toast.success("Subscriber deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete subscriber");
    }
  };

  const statCards = [
    ["Total subscribers", stats.total],
    ["Active", stats.active],
    ["Unsubscribed", stats.unsubscribed],
    ["New this month", stats.newThisMonth],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full sm:w-56"
          />
          {isAdmin && onClientFilterChange && (
            <Select value={clientFilter} onValueChange={onClientFilterChange}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value="platform">TapThatFlyer platform</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SUBSCRIBER_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
              <SelectItem value="platform_newsletter">TapThatFlyer Newsletter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-36"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-36"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add subscriber
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(`subscribers-${new Date().toISOString().slice(0, 10)}.csv`, subscribersToCsv(visible))
            }
          >
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">
            No subscribers match these filters yet.
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Subscriber</th>
                <th className="px-4 py-3">Email</th>
                {isAdmin && <th className="px-4 py-3">Client</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3">{row.email}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.client_id
                        ? clientNameById.get(row.client_id) ?? "Client"
                        : "TapThatFlyer"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(row.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(row.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(row)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(row)}>
                        {row.status === "active" ? "Unsubscribe" : "Reactivate"}
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => remove(row)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SubscriberDialog
        open={addOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setAddOpen(false);
            setEditing(null);
          }
        }}
        clientId={
          clientId !== undefined
            ? clientId
            : clientFilter !== "all" && clientFilter !== "platform"
              ? clientFilter
              : null
        }
        subscriber={editing}
        onSaved={load}
      />
      <ImportSubscribersDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        clientId={
          clientId !== undefined
            ? clientId
            : clientFilter !== "all" && clientFilter !== "platform"
              ? clientFilter
              : null
        }
        onImported={load}
      />
      <SubscriberProfileDialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        subscriber={viewing}
        clientName={
          viewing?.client_id ? clientNameById.get(viewing.client_id) : "TapThatFlyer platform"
        }
      />
    </div>
  );
}
