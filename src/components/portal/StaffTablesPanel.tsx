import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, KeyRound } from "lucide-react";

type Waiter = { id: string; name: string; color: string; active: boolean };
type Assign = { id: string; table_number: string; waiter_id: string | null };

export function StaffTablesPanel({ flyerId }: { flyerId: string }) {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [assigns, setAssigns] = useState<Assign[]>([]);
  const [loading, setLoading] = useState(true);

  // create waiter form
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  // assignment form
  const [tableNum, setTableNum] = useState("");
  const [waiterPick, setWaiterPick] = useState<string>("");

  // bulk
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeWaiter, setRangeWaiter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: w }, { data: a }] = await Promise.all([
      supabase.from("waiters").select("id, name, color, active").eq("flyer_id", flyerId).order("name"),
      supabase.from("table_assignments").select("id, table_number, waiter_id").eq("flyer_id", flyerId).order("table_number"),
    ]);
    setWaiters((w as Waiter[]) || []);
    setAssigns((a as Assign[]) || []);
    setLoading(false);
  }, [flyerId]);
  useEffect(() => { load(); }, [load]);

  async function createWaiter() {
    if (!newName.trim() || newPin.length < 4) return toast.error("Name and 4+ digit PIN required");
    const { data, error } = await supabase.functions.invoke("waiter-master-auth", {
      body: { action: "waiter_create", flyer_id: flyerId, name: newName.trim(), color: newColor, new_pin: newPin },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Failed");
    toast.success("Waiter added");
    setNewName(""); setNewPin(""); setNewColor("#3b82f6");
    load();
  }

  async function setPin(waiterId: string) {
    const pin = prompt("New 4+ digit PIN");
    if (!pin || pin.length < 4) return;
    const { data, error } = await supabase.functions.invoke("waiter-master-auth", {
      body: { action: "waiter_set_pin", flyer_id: flyerId, waiter_id: waiterId, new_pin: pin },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || "Failed");
    toast.success("PIN updated");
  }

  async function toggleActive(w: Waiter) {
    const { error } = await supabase.from("waiters").update({ active: !w.active }).eq("id", w.id);
    if (error) return toast.error(error.message);
    load();
  }
  async function deleteWaiter(w: Waiter) {
    if (!confirm(`Delete waiter ${w.name}? Their table assignments will be cleared.`)) return;
    await supabase.from("table_assignments").update({ waiter_id: null }).eq("waiter_id", w.id);
    const { error } = await supabase.from("waiters").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function assignTable() {
    if (!tableNum.trim() || !waiterPick) return toast.error("Pick table + waiter");
    const { error } = await supabase.from("table_assignments")
      .upsert({ flyer_id: flyerId, table_number: tableNum.trim(), waiter_id: waiterPick }, { onConflict: "flyer_id,table_number" });
    if (error) return toast.error(error.message);
    setTableNum("");
    load();
  }
  async function bulkAssign() {
    const s = parseInt(rangeStart, 10), e = parseInt(rangeEnd, 10);
    if (!rangeWaiter || isNaN(s) || isNaN(e) || s > e) return toast.error("Valid range + waiter required");
    const rows = [];
    for (let i = s; i <= e; i++) rows.push({ flyer_id: flyerId, table_number: String(i), waiter_id: rangeWaiter });
    const { error } = await supabase.from("table_assignments").upsert(rows, { onConflict: "flyer_id,table_number" });
    if (error) return toast.error(error.message);
    toast.success(`Assigned tables ${s}–${e}`);
    setRangeStart(""); setRangeEnd("");
    load();
  }
  async function clearAssign(id: string) {
    if (!confirm("Remove this table assignment?")) return;
    const { error } = await supabase.from("table_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const waiterName = (id: string | null) => waiters.find((w) => w.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Waiters</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_120px_70px_auto]">
            <div><Label className="text-xs">Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Maria" /></div>
            <div><Label className="text-xs">PIN</Label><Input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} maxLength={8} placeholder="4-8 digits" /></div>
            <div><Label className="text-xs">Color</Label><Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 p-1" /></div>
            <div className="flex items-end"><Button onClick={createWaiter}><Plus className="mr-1 h-4 w-4" />Add waiter</Button></div>
          </div>
          {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
            <div className="divide-y rounded border">
              {waiters.length === 0 && <p className="p-3 text-xs text-muted-foreground">No waiters yet.</p>}
              {waiters.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: w.color }} />
                    <span className="font-medium">{w.name}</span>
                    {!w.active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setPin(w.id)}><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(w)}>{w.active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteWaiter(w)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Table assignments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[120px_1fr_auto]">
            <div><Label className="text-xs">Table #</Label><Input value={tableNum} onChange={(e) => setTableNum(e.target.value)} placeholder="12" /></div>
            <div>
              <Label className="text-xs">Waiter</Label>
              <Select value={waiterPick} onValueChange={setWaiterPick}>
                <SelectTrigger><SelectValue placeholder="Choose waiter" /></SelectTrigger>
                <SelectContent>
                  {waiters.filter((w) => w.active).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button onClick={assignTable}>Assign</Button></div>
          </div>

          <div className="grid gap-2 md:grid-cols-[100px_100px_1fr_auto] rounded border bg-muted/20 p-2">
            <div><Label className="text-xs">Range from</Label><Input value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /></div>
            <div><Label className="text-xs">to</Label><Input value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Assign all to</Label>
              <Select value={rangeWaiter} onValueChange={setRangeWaiter}>
                <SelectTrigger><SelectValue placeholder="Waiter" /></SelectTrigger>
                <SelectContent>
                  {waiters.filter((w) => w.active).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button variant="secondary" onClick={bulkAssign}>Bulk assign</Button></div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {assigns.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <div className="font-semibold">Table {a.table_number}</div>
                  <div className="text-xs text-muted-foreground">{waiterName(a.waiter_id)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => clearAssign(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            ))}
            {assigns.length === 0 && <p className="col-span-full text-xs text-muted-foreground">No tables assigned yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
