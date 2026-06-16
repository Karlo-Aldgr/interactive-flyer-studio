import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, Download, CheckCircle2, XCircle } from "lucide-react";
import type { NovelChapter } from "@/types/flyer";

interface NovelAction {
  id: string;        // action row id (db)
  actionId: string;  // logical action id stored in payload (LayerAction.id)
  type: string;
  payload: any;
  layer_id: string;
}

interface Props {
  flyerId: string;
  actions: Array<{ id: string; type: string; payload?: any; layer_id: string }>;
  onRefresh?: () => void;
}

function csvFor(rows: any[], cols: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function NovelsPanel({ flyerId, actions, onRefresh }: Props) {
  const novels: NovelAction[] = useMemo(() => {
    const out: NovelAction[] = [];
    for (const a of actions) {
      if (a.type === "novel") {
        out.push({ id: a.id, actionId: (a.payload?.id) || a.id, type: a.type, payload: a.payload || {}, layer_id: a.layer_id });
      }
    }
    return out;
  }, [actions]);

  if (novels.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No novels yet. Add a "Novel / Story" action in the editor to manage books here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {novels.map((n) => (
        <NovelCard key={n.id} flyerId={flyerId} novel={n} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function NovelCard({ flyerId, novel, onRefresh }: { flyerId: string; novel: NovelAction; onRefresh?: () => void }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState<any>(novel.payload);
  const [saving, setSaving] = useState(false);

  const chapters: NovelChapter[] = draft.novelChapters || [];
  const currency = draft.novelCurrency || "USD";
  const freeCount = typeof draft.novelFreeCount === "number" ? draft.novelFreeCount : 3;

  async function load() {
    setLoading(true);
    const aid = novel.actionId;
    const [p, s, e] = await Promise.all([
      supabase.from("novel_purchases").select("*").eq("flyer_id", flyerId).eq("action_id", aid).order("created_at", { ascending: false }),
      supabase.from("novel_subscriptions").select("*").eq("flyer_id", flyerId).eq("action_id", aid).order("created_at", { ascending: false }),
      supabase.from("analytics_events").select("id, event_type, created_at, metadata").eq("flyer_id", flyerId).order("created_at", { ascending: false }).limit(2000),
    ]);
    setPurchases(p.data || []);
    setSubs(s.data || []);
    setEvents((e.data || []).filter((ev: any) => String(ev.metadata?.action_type || "").startsWith("novel_")));
    setLoading(false);
  }
  useEffect(() => { load(); }, [flyerId, novel.actionId]);

  const completedRevenue = purchases.filter((p) => p.status === "completed").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = purchases.filter((p) => p.status === "pending").length;

  async function saveDraft() {
    setSaving(true);
    const { error } = await supabase.from("actions").update({ payload: draft }).eq("id", novel.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onRefresh?.();
  }

  function patchChapter(id: string, patch: Partial<NovelChapter>) {
    setDraft({ ...draft, novelChapters: chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }

  async function setPurchaseStatus(id: string, status: string) {
    const { error } = await supabase.from("novel_purchases").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  const chapterViewCounts = useMemo(() => {
    const m: Record<number, number> = {};
    for (const e of events) {
      if (e.metadata?.action_type === "novel_chapter_view") {
        const n = Number(e.metadata?.chapter);
        if (!isNaN(n)) m[n] = (m[n] || 0) + 1;
      }
    }
    return m;
  }, [events]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {draft.novelBookTitle || "Untitled Book"}
            {draft.novelAuthor && <span className="text-xs font-normal text-muted-foreground">by {draft.novelAuthor}</span>}
          </span>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending payments</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Chapters</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="payments">Payments ({purchases.length})</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers ({subs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 pt-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Chapters</div><div className="text-lg font-semibold">{chapters.length}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Free</div><div className="text-lg font-semibold">{chapters.filter((c, i) => c.free ?? i < freeCount).length}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-lg font-semibold">{currency} {completedRevenue.toFixed(2)}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Followers / Subs</div><div className="text-lg font-semibold">{subs.length}</div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-2 pt-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Free preview chapters</Label>
              <Input type="number" className="h-7 w-20" value={freeCount} onChange={(e) => setDraft({ ...draft, novelFreeCount: Number(e.target.value) || 0 })} />
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {chapters.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-2 rounded bg-muted/30 p-2">
                  <span className="w-6 text-xs text-muted-foreground">{idx + 1}.</span>
                  <Input className="h-7 flex-1 text-xs" value={c.title} onChange={(e) => patchChapter(c.id, { title: e.target.value })} />
                  <label className="flex items-center gap-1 text-[11px]"><Switch checked={!!c.free} onCheckedChange={(v) => patchChapter(c.id, { free: v })} />Free</label>
                  <Input type="number" step="0.01" className="h-7 w-20 text-xs" placeholder="price" value={c.price ?? ""} onChange={(e) => patchChapter(c.id, { price: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  <Badge variant="outline" className="text-[10px]">{chapterViewCounts[c.number] || 0} views</Badge>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={saveDraft} disabled={saving}>{saving ? "Saving…" : "Save chapter changes"}</Button>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-3 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Bundle</Label><Input type="number" step="0.01" value={draft.novelBundlePrice ?? ""} onChange={(e) => setDraft({ ...draft, novelBundlePrice: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Per-chapter</Label><Input type="number" step="0.01" value={draft.novelChapterPrice ?? ""} onChange={(e) => setDraft({ ...draft, novelChapterPrice: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Currency</Label><Input value={draft.novelCurrency || "USD"} onChange={(e) => setDraft({ ...draft, novelCurrency: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">PayPal.me handle</Label><Input value={draft.novelPaypalHandle || ""} onChange={(e) => setDraft({ ...draft, novelPaypalHandle: e.target.value })} /></div>
              <div><Label className="text-xs">PayPal email</Label><Input value={draft.novelPaypalEmail || ""} onChange={(e) => setDraft({ ...draft, novelPaypalEmail: e.target.value })} /></div>
            </div>
            <Button size="sm" onClick={saveDraft} disabled={saving}>{saving ? "Saving…" : "Save pricing"}</Button>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-2 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total events</div><div className="text-lg font-semibold">{events.length}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Unlock clicks</div><div className="text-lg font-semibold">{events.filter((e) => String(e.metadata?.action_type || "").startsWith("novel_unlock_")).length}</div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Chapter views</div><div className="text-lg font-semibold">{events.filter((e) => e.metadata?.action_type === "novel_chapter_view").length}</div></CardContent></Card>
            </div>
            <div className="space-y-1 rounded-md border border-border p-2">
              <div className="text-xs font-semibold">Views by chapter</div>
              {chapters.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span>{idx + 1}. {c.title}</span>
                  <span className="text-muted-foreground">{chapterViewCounts[c.number] || 0}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-2 pt-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => downloadCsv(`${draft.novelBookTitle || "novel"}-payments.csv`, csvFor(purchases, ["created_at","buyer_email","buyer_name","purchase_type","chapter_numbers","amount","currency","paypal_txn_id","status"]))}>
                <Download className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {purchases.length === 0 ? <p className="text-sm text-muted-foreground">No purchases yet.</p> : purchases.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs">
                  <span className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</span>
                  <span className="font-medium">{p.buyer_email}</span>
                  <Badge variant="outline">{p.purchase_type}{p.purchase_type === "chapter" && p.chapter_numbers?.length ? ` #${p.chapter_numbers.join(",")}` : ""}</Badge>
                  <span>{p.currency} {Number(p.amount || 0).toFixed(2)}</span>
                  {p.paypal_txn_id && <span className="text-muted-foreground">txn:{p.paypal_txn_id}</span>}
                  <Badge variant={p.status === "completed" ? "default" : p.status === "pending" ? "destructive" : "secondary"}>{p.status}</Badge>
                  <div className="ml-auto flex gap-1">
                    {p.status !== "completed" && <Button size="sm" variant="outline" onClick={() => setPurchaseStatus(p.id, "completed")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve</Button>}
                    {p.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => setPurchaseStatus(p.id, "cancelled")}><XCircle className="mr-1 h-3.5 w-3.5" /> Cancel</Button>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subscribers" className="space-y-2 pt-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => downloadCsv(`${draft.novelBookTitle || "novel"}-subscribers.csv`, csvFor(subs, ["created_at","subscriber_email","subscriber_name","tier","status"]))}>
                <Download className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold">Free followers ({subs.filter((s) => s.tier === "free").length})</div>
                {subs.filter((s) => s.tier === "free").map((s) => (
                  <div key={s.id} className="rounded border border-border p-2 text-xs">{s.subscriber_email}{s.subscriber_name ? ` — ${s.subscriber_name}` : ""}</div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold">Paid subscribers ({subs.filter((s) => s.tier === "paid").length})</div>
                {subs.filter((s) => s.tier === "paid").map((s) => (
                  <div key={s.id} className="rounded border border-border p-2 text-xs">{s.subscriber_email}{s.subscriber_name ? ` — ${s.subscriber_name}` : ""}</div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
