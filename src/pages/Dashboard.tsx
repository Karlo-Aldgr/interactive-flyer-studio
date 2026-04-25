import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sparkles, Plus, BarChart3, ExternalLink, MoreVertical, Trash2, Copy, Pencil, Loader2, FileText, LogOut } from "lucide-react";
import { Flyer } from "@/types/flyer";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("flyers")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFlyers((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data: flyer, error } = await supabase
        .from("flyers")
        .insert([{ owner_id: user.id, title: "Untitled flyer" }])
        .select()
        .single();
      if (error) throw error;
      const { error: pErr } = await supabase
        .from("pages")
        .insert([{ flyer_id: flyer.id, index: 0, name: "Page 1" }]);
      if (pErr) throw pErr;
      navigate(`/editor/${flyer.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("flyers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Flyer deleted");
    setFlyers((f) => f.filter((x) => x.id !== id));
  };

  const duplicate = async (flyer: Flyer) => {
    if (!user) return;
    const { data: copy, error } = await supabase
      .from("flyers")
      .insert([{ owner_id: user.id, title: flyer.title + " (copy)", settings: flyer.settings as any }])
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { data: pages } = await supabase.from("pages").select("*, layers(*, actions(*))").eq("flyer_id", flyer.id);
    if (pages) {
      for (const p of pages as any[]) {
        const { data: newPage } = await supabase
          .from("pages")
          .insert([{ flyer_id: copy.id, index: p.index, name: p.name, background: p.background }])
          .select().single();
        if (!newPage) continue;
        for (const l of p.layers ?? []) {
          const { data: newLayer } = await supabase.from("layers").insert([{
            page_id: newPage.id, type: l.type, position: l.position, size: l.size,
            rotation: l.rotation, z_index: l.z_index, style: l.style, content: l.content,
          }]).select().single();
          if (newLayer && l.actions?.[0]) {
            await supabase.from("actions").insert([{
              layer_id: newLayer.id, type: l.actions[0].type, payload: l.actions[0].payload,
            }]);
          }
        }
      }
    }
    toast.success("Duplicated");
    load();
  };

  const copyLink = (slug: string | null) => {
    if (!slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
    toast.success("Public link copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">FlyerFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1 h-4 w-4" />Sign out</Button>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Your flyers</h1>
            <p className="mt-1 text-muted-foreground">Design, publish, and track engagement.</p>
          </div>
          <Button onClick={create} disabled={creating} className="shadow-glow">
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            New flyer
          </Button>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : flyers.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-semibold">No flyers yet</h3>
              <p className="max-w-xs text-sm text-muted-foreground">Create your first interactive flyer and publish it in minutes.</p>
              <Button onClick={create} disabled={creating} className="mt-2"><Plus className="mr-1 h-4 w-4" />Create flyer</Button>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {flyers.map((f) => (
                <Card key={f.id} className="group overflow-hidden transition hover:shadow-elegant">
                  <Link to={`/editor/${f.id}`} className="block">
                    <div className="aspect-[3/4] gradient-canvas border-b border-border relative">
                      {f.thumbnail_url ? (
                        <img src={f.thumbnail_url} alt={f.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <FileText className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                      <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium ${f.status === "published" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {f.status}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{f.title}</div>
                      <div className="text-xs text-muted-foreground">Updated {new Date(f.updated_at).toLocaleDateString()}</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/editor/${f.id}`)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/analytics/${f.id}`)}><BarChart3 className="mr-2 h-4 w-4" />Analytics</DropdownMenuItem>
                        {f.public_slug && (
                          <>
                            <DropdownMenuItem onClick={() => copyLink(f.public_slug)}><Copy className="mr-2 h-4 w-4" />Copy link</DropdownMenuItem>
                            <DropdownMenuItem asChild><a href={`/f/${f.public_slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => duplicate(f)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => remove(f.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
