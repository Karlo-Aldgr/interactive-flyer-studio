import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, Mail, Phone, Globe, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type App = {
  id: string;
  full_name: string;
  email: string;
  brokerage: string | null;
  license_number: string | null;
  phone: string | null;
  website: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export function RealtorAccessApplicationsPanel() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_realtor_applications" as any);
    if (error) toast.error(error.message);
    setApps((data as App[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    const { data, error } = await supabase.rpc("admin_review_realtor_application" as any, {
      _application_id: id,
      _decision: decision,
      _notes: notes[id] ?? null,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.ok) { toast.error(res?.error ?? "Failed"); return; }
    toast.success(decision === "approved"
      ? (res.granted ? "Approved — realtor role granted." : "Approved — will activate when they sign up.")
      : "Application rejected");
    load();
  };

  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);
  const pendingCount = apps.filter((a) => a.status === "pending").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40"
          >
            <div>
              <h2 className="font-semibold">Portal access requests</h2>
              <p className="text-sm text-muted-foreground">
                Approve new realtors who applied at /realtor/apply — not property listings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && <Badge>{pendingCount} pending</Badge>}
              <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t border-border px-5 py-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="pending">
                  Pending {pendingCount > 0 && <Badge className="ml-2" variant="secondary">{pendingCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No access applications.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{a.full_name}</h3>
                          <Badge variant={a.status === "pending" ? "default" : a.status === "approved" ? "secondary" : "destructive"}>
                            {a.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PP p")}</span>
                        </div>
                        <div className="grid gap-1 text-sm sm:grid-cols-2">
                          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{a.email}</div>
                          {a.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{a.phone}</div>}
                          {a.brokerage && <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{a.brokerage}</div>}
                          {a.website && <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /><a href={a.website} target="_blank" rel="noreferrer" className="truncate underline">{a.website}</a></div>}
                        </div>
                        {a.message && <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">{a.message}</p>}
                      </div>
                    </div>
                    {a.status === "pending" && (
                      <div className="mt-4 space-y-2 border-t border-border pt-4">
                        <Textarea
                          placeholder="Optional review notes…"
                          value={notes[a.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                          rows={2}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => review(a.id, "approved")} disabled={busy === a.id}>
                            <Check className="mr-1 h-4 w-4" /> Approve & grant realtor role
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => review(a.id, "rejected")} disabled={busy === a.id}>
                            <X className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
