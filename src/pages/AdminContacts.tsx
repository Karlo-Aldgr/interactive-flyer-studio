import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Download, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Contact = {
  source: "subscriber" | "checkout";
  name: string | null;
  email: string | null;
  phone: string | null;
  flyer_id: string;
  flyer_title?: string;
  created_at: string;
  extra?: any;
};

export default function AdminContacts() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const [subsRes, subsForms, flyersRes] = await Promise.all([
        supabase.from("subscribers").select("name,email,phone,flyer_id,created_at,list_name").order("created_at", { ascending: false }),
        supabase.from("form_submissions").select("data,flyer_id,created_at").order("created_at", { ascending: false }),
        supabase.from("flyers").select("id,title"),
      ]);
      const titleMap = new Map((flyersRes.data ?? []).map((f: any) => [f.id, f.title]));
      const subs: Contact[] = (subsRes.data ?? []).map((s: any) => ({
        source: "subscriber",
        name: s.name,
        email: s.email,
        phone: s.phone,
        flyer_id: s.flyer_id,
        flyer_title: titleMap.get(s.flyer_id),
        created_at: s.created_at,
        extra: { list_name: s.list_name },
      }));
      const orders: Contact[] = (subsForms.data ?? [])
        .map((row: any) => {
          const d = row.data || {};
          const c = d.customer || d;
          if (!c?.email && !c?.phone) return null;
          return {
            source: "checkout" as const,
            name: c.name ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            flyer_id: row.flyer_id,
            flyer_title: titleMap.get(row.flyer_id),
            created_at: row.created_at,
            extra: { kind: d.kind, total: d.total, currency: d.currency, items: d.items },
          };
        })
        .filter(Boolean) as Contact[];
      setContacts([...subs, ...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setLoading(false);
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.phone, c.flyer_title].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [contacts, q]);

  function exportCSV(rows: Contact[], filename: string) {
    const header = ["source", "name", "email", "phone", "flyer", "created_at"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [r.source, r.name ?? "", r.email ?? "", r.phone ?? "", r.flyer_title ?? r.flyer_id, r.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  if (authLoading || isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground">Your account doesn't have super-admin access.</p>
        <Link to="/dashboard"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Button></Link>
      </div>
    );
  }

  const subs = filtered.filter((c) => c.source === "subscriber");
  const orders = filtered.filter((c) => c.source === "checkout");

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Super Admin · Contacts</h1>
          <p className="text-sm text-muted-foreground">All emails and phone numbers collected across every flyer.</p>
        </div>
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email, phone, flyer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => exportCSV(filtered, "contacts.csv")}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="subs">Subscribers ({subs.length})</TabsTrigger>
            <TabsTrigger value="orders">Checkout ({orders.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><Table rows={filtered} /></TabsContent>
          <TabsContent value="subs"><Table rows={subs} /></TabsContent>
          <TabsContent value="orders"><Table rows={orders} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Table({ rows }: { rows: Contact[] }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No contacts yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Source</th>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Phone</th>
            <th className="p-2">Flyer</th>
            <th className="p-2">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="p-2"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.source}</span></td>
              <td className="p-2">{r.name ?? "—"}</td>
              <td className="p-2">{r.email ? <a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a> : "—"}</td>
              <td className="p-2">{r.phone ? <a className="text-primary hover:underline" href={`tel:${r.phone}`}>{r.phone}</a> : "—"}</td>
              <td className="p-2">{r.flyer_title ?? r.flyer_id.slice(0, 8)}</td>
              <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
