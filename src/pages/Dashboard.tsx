import { useEffect, useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Loader2, CalendarIcon, Briefcase, PartyPopper } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { CustomerDashboard } from "@/components/dashboard/CustomerDashboard";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { EditorDashboard } from "@/components/dashboard/EditorDashboard";
import { Flyer, FlyerCategory } from "@/types/flyer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn, buildPublicFlyerUrl } from "@/lib/utils";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { loadUserJobs, type UserJob } from "@/lib/userJobs";
import { useIsRealtor } from "@/hooks/useIsRealtor";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerJobs, setCustomerJobs] = useState<UserJob[]>([]);
  const [customerJobsLoading, setCustomerJobsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<FlyerCategory>("business");
  const [newEventDate, setNewEventDate] = useState<Date | undefined>(undefined);
  const { canEdit, loading: accessLoading } = useCanEdit();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isRealtor, loading: realtorLoading } = useIsRealtor();
  const [searchParams] = useSearchParams();
  const studioMode = searchParams.get("studio") === "1";
  const customerView = searchParams.get("view") === "customer";
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

  useEffect(() => {
    if (!user || accessLoading || adminLoading || realtorLoading) return;
    if (canEdit || isAdmin || isRealtor) { setOnboardingChecked(true); return; }
    supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.onboarding_completed_at);
        setOnboardingChecked(true);
      });
  }, [user, canEdit, isAdmin, isRealtor, accessLoading, adminLoading, realtorLoading]);

  useEffect(() => {
    if (!user || accessLoading) return;
    if (canEdit && !customerView) return;
    setCustomerJobsLoading(true);
    loadUserJobs(user.id, { limit: 5 }).then(({ jobs, error }) => {
      if (error) toast.error(error.message || "Could not load your projects");
      else setCustomerJobs(jobs);
      setCustomerJobsLoading(false);
    });
  }, [user, canEdit, accessLoading, customerView]);

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
    navigator.clipboard.writeText(buildPublicFlyerUrl(slug));
    toast.success("Share link copied — paste it anywhere for a rich preview");
  };

  if (adminLoading || accessLoading || realtorLoading || !onboardingChecked) {
    return (
      <DashboardShell>
        <DashboardPage maxWidth="4xl">
          <div className="flex h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        </DashboardPage>
      </DashboardShell>
    );
  }

  if (needsOnboarding && !customerView && !studioMode) {
    return <Navigate to="/onboarding" replace />;
  }

  if (customerView) {
    return (
      <CustomerPortalShell maxWidth="4xl">
        {customerJobsLoading ? (
          <div className="flex h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <CustomerDashboard jobs={customerJobs} userEmail={user?.email} />
        )}
      </CustomerPortalShell>
    );
  }

  if (isAdmin && !studioMode) {
    return <Navigate to="/admin/users" replace />;
  }

  if (isRealtor && !studioMode && !isAdmin) {
    return <Navigate to="/realtor" replace />;
  }

  if (!canEdit) {
    return (
      <CustomerPortalShell maxWidth="4xl">
        {customerJobsLoading ? (
          <div className="flex h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <CustomerDashboard jobs={customerJobs} userEmail={user?.email} />
        )}
      </CustomerPortalShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardPage maxWidth="6xl">
        <EditorDashboard
          flyers={flyers}
          loading={loading}
          creating={creating}
          userEmail={user?.email}
          onOpenCreate={openCreate}
          onRemove={remove}
          onDuplicate={duplicate}
          onCopyLink={copyLink}
        />
      </DashboardPage>

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
    </DashboardShell>
  );
}
