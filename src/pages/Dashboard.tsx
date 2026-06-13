import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sparkles, Plus, BarChart3, ExternalLink, MoreVertical, Trash2, Copy, Pencil, Loader2, FileText, LogOut, CalendarIcon, Briefcase, PartyPopper, MailCheck, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";
import { Flyer, FlyerCategory } from "@/types/flyer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn, buildSocialShareUrl } from "@/lib/utils";
import { useCanEdit } from "@/hooks/useCanEdit";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<FlyerCategory>("business");
  const [newEventDate, setNewEventDate] = useState<Date | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const { canEdit, loading: accessLoading } = useCanEdit();

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role","admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("flyers")
      .select("id, owner_id, title, status, public_slug, thumbnail_url, settings, category, event_date, auto_unpublish_at, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const flyersData = (data ?? []) as any[];
    setFlyers(flyersData as any);
    setLoading(false);

    // Lazily backfill a per-flyer "page image" fallback for every flyer, so
    // we can swap it in when the saved thumbnail_url is missing or broken.
    const toBackfill = flyersData.slice(0, 24);
    if (toBackfill.length === 0) return;
    await Promise.all(
      toBackfill.map(async (f) => {
        const { data: pages } = await supabase
          .from("pages")
          .select("id, index, layers(type, z_index, content)")
          .eq("flyer_id", f.id)
          .order("index", { ascending: true })
          .limit(1);
        const firstPage = pages?.[0] as any;
        const imageLayer = firstPage?.layers
          ?.filter((l: any) => l.type === "image" && l.content?.src)
          .sort((a: any, b: any) => (a.z_index ?? 0) - (b.z_index ?? 0))[0];
        const src = imageLayer?.content?.src;
        if (src) {
          setFlyers((prev) => prev.map((x) => (x.id === f.id ? { ...x, _pageImageFallback: src } as any : x)));
        }
      })
    );
  };

  useEffect(() => { if (canEdit) load(); }, [canEdit]);

  const create = async () => {
    if (!user) return;
    if (newCategory === "event" && !newEventDate) {
      toast.error("Please pick the event date");
      return;
    }
    setCreating(true);
    try {
      const payload: any = {
        owner_id: user.id,
        title: newCategory === "event" ? "Untitled event flyer" : "Untitled flyer",
        category: newCategory,
        event_date: newCategory === "event" && newEventDate ? format(newEventDate, "yyyy-MM-dd") : null,
      };
      const { data: flyer, error } = await supabase
        .from("flyers")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      const { error: pErr } = await supabase
        .from("pages")
        .insert([{ flyer_id: flyer.id, index: 0, name: "Page 1" }]);
      if (pErr) throw pErr;
      setCreateOpen(false);
      navigate(`/editor/${flyer.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setNewCategory("business");
    setNewEventDate(undefined);
    setCreateOpen(true);
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
      .insert([{ owner_id: user.id, title: flyer.title + " (copy)", settings: flyer.settings as any, category: flyer.category, event_date: flyer.event_date }])
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
    // Use the share-worker URL so platforms (Facebook, WhatsApp, iMessage)
    // see per-flyer OG previews — same link the editor's Share dialog copies.
    navigator.clipboard.writeText(buildSocialShareUrl(slug));
    toast.success("Share link copied — paste it anywhere for a rich preview");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/my-jobs">My jobs</Link></Button>
            <Button asChild size="sm" className="shadow-glow"><Link to="/submit-job"><Plus className="mr-1 h-4 w-4" />Submit job</Link></Button>
            {isAdmin && <Button asChild variant="outline" size="sm"><Link to="/admin/jobs">Admin</Link></Button>}
            {isAdmin && <Button asChild variant="outline" size="sm"><Link to="/admin/editors"><ShieldCheck className="mr-1 h-4 w-4" />Editors</Link></Button>}
            {isAdmin && <Button asChild variant="outline" size="sm"><Link to="/admin/examples">Examples</Link></Button>}
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
          <Button onClick={openCreate} disabled={creating} className="shadow-glow">
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
              <Button onClick={openCreate} disabled={creating} className="mt-2"><Plus className="mr-1 h-4 w-4" />Create flyer</Button>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {flyers.map((f) => (
                <Card key={f.id} className="group overflow-hidden transition hover:shadow-elegant">
                  <Link to={`/editor/${f.id}`} className="block">
                    <div className="aspect-[3/4] gradient-canvas border-b border-border relative">
                      {(f.thumbnail_url || (f as any)._pageImageFallback) ? (
                        <img
                          src={f.thumbnail_url || (f as any)._pageImageFallback}
                          alt={f.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            const fallback = (f as any)._pageImageFallback;
                            const el = e.currentTarget as HTMLImageElement;
                            if (fallback && el.src !== fallback) el.src = fallback;
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <FileText className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                      <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium ${f.status === "published" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {f.status}
                      </span>
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
                        {f.category === "event" ? <PartyPopper className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {f.category === "event" ? "Event" : "Business"}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{f.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.category === "event" && f.event_date
                          ? <>Event {format(new Date(f.event_date + "T00:00:00"), "MMM d, yyyy")}</>
                          : <>Updated {new Date(f.updated_at).toLocaleDateString()}</>}
                      </div>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New flyer</DialogTitle>
            <DialogDescription>Pick a category to get started.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewCategory("business")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition",
                  newCategory === "business" ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:border-primary/40"
                )}
              >
                <Briefcase className="h-5 w-5 text-primary" />
                <div className="font-semibold">Business</div>
                <div className="text-xs text-muted-foreground">Stays published until you unpublish.</div>
              </button>
              <button
                type="button"
                onClick={() => setNewCategory("event")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition",
                  newCategory === "event" ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:border-primary/40"
                )}
              >
                <PartyPopper className="h-5 w-5 text-primary" />
                <div className="font-semibold">Event</div>
                <div className="text-xs text-muted-foreground">Auto-unpublishes the day after.</div>
              </button>
            </div>

            {newCategory === "event" && (
              <div className="space-y-2">
                <Label>Event date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newEventDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventDate ? format(newEventDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEventDate}
                      onSelect={setNewEventDate}
                      disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Flyer will auto-unpublish the day after this date.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
