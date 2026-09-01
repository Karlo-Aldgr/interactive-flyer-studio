import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, ExternalLink, Eye, ChevronRight, Send } from "lucide-react";
import { interactionLabel } from "@/lib/interactionsCatalog";
import { format } from "date-fns";
import { getJobUploadSignedUrl } from "@/lib/jobUploads";
import { toast } from "sonner";
import { getUnifiedStatusLabel } from "@/lib/jobStatus";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { fetchZernioStatus } from "@/lib/zernio";

const formatPrice = (cents?: number | null) =>
  typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : null;

export default function MyJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [postChecking, setPostChecking] = useState(false);
  const navigate = useNavigate();

  // Single source of truth for social connections: the Zernio-backed
  // Social Media page. No legacy OAuth flows are triggered from here.
  const goPostToSocials = async () => {
    if (!selectedJobs.length) return;
    setPostChecking(true);
    try {
      const status = await fetchZernioStatus();
      const connected = (status.accounts ?? []).filter((a) => a.status === "connected");
      if (!connected.length) {
        toast.error("Connect a social account before posting.");
        navigate("/social-media/accounts");
        return;
      }
      navigate("/social-media/compose", { state: { jobId: selectedJobs[0].id } });
    } catch {
      toast.error("We couldn't check your social accounts. Please try again.");
    } finally {
      setPostChecking(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [ownJobs, flyerJobs] = await Promise.all([
        supabase
          .from("jobs")
          .select("*, flyer:flyers(public_slug, status, owner_id)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("jobs")
          .select("*, flyer:flyers!inner(public_slug, status, owner_id)")
          .eq("flyer.owner_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const merged = [...(ownJobs.data ?? []), ...(flyerJobs.data ?? [])];
      const byId = new Map<string, any>();
      merged.forEach((j) => byId.set(j.id, j));

      // Collapse duplicate job rows pointing at the same flyer, keeping the
      // most advanced one (paid/completed beats a leftover "new" duplicate).
      const rank = (j: any) =>
        (j.share_unlocked ? 2 : 0) +
        (["paid", "completed", "delivered"].includes(j.status) ? 1 : 0);
      const byFlyer = new Map<string, any>();
      const rows: any[] = [];
      for (const j of byId.values()) {
        if (!j.flyer_id) { rows.push(j); continue; }
        const prev = byFlyer.get(j.flyer_id);
        if (!prev || rank(j) > rank(prev)) byFlyer.set(j.flyer_id, j);
      }
      const all = [...rows, ...byFlyer.values()].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      );
      setJobs(all);
      setLoading(false);
    })();
  }, [user]);

  const isReady = (j: any) =>
    !!j.share_unlocked || ["paid", "completed", "delivered"].includes(j.status);
  const readyJobs = useMemo(() => jobs.filter(isReady), [jobs]);
  const pendingJobs = useMemo(() => jobs.filter((j) => !isReady(j)), [jobs]);

  const selectedJobs = useMemo(
    () => readyJobs.filter((j) => selected[j.id]).map((j) => ({ id: j.id, title: j.title })),
    [readyJobs, selected],
  );
  const allSelected = readyJobs.length > 0 && selectedJobs.length === readyJobs.length;
  const toggleAll = () =>
    setSelected(allSelected ? {} : Object.fromEntries(readyJobs.map((j) => [j.id, true])));

  const renderCard = (j: any, selectable: boolean) => {
    const status = getUnifiedStatusLabel(j);
    const price = formatPrice(j.price_cents);
    const paid = isReady(j);
    const active = j.flyer_active !== false;
    const checked = !!selected[j.id];
    const previewHref = paid && active && j.flyer?.public_slug
      ? `/f/${j.flyer.public_slug}`
      : j.flyer_id
        ? `/preview/${j.flyer_id}`
        : null;
    return (
      <Card
        key={j.id}
        className={`p-5 transition-colors ${checked ? "border-primary ring-1 ring-primary/40" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          {selectable ? (
            <label className="mt-0.5 flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs font-medium">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [j.id]: v === true }))}
                aria-label={`Select ${j.title} for posting`}
              />
              {checked ? "Selected" : "Post"}
            </label>
          ) : (
            <span className="mt-1 text-xs text-muted-foreground">Available after payment</span>
          )}
          <div className="min-w-0 flex-1">
            <Link to={`/my-jobs/${j.id}`} className="group inline-flex items-center gap-2">
              <h3 className="font-semibold group-hover:underline">{j.title}</h3>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={status.className}><span className="mr-1">{status.emoji}</span>{status.label}</Badge>
              <Badge variant="outline">{j.type === "upload" ? "Upload" : "Design"}</Badge>
              {paid && (
                <Badge variant="outline" className={active ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : ""}>
                  {active ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Submitted {format(new Date(j.created_at), "PPp")}
            </p>
            {j.brief && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{j.brief}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(j.selected_actions ?? []).map((id: string) => (
                <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs">{interactionLabel(id)}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {price && <div className="font-display text-2xl font-bold">{price}</div>}
            {!paid && j.payment_link && price && (
              <Button asChild size="sm" className="shadow-glow">
                <a href={j.payment_link} target="_blank" rel="noreferrer">
                  Pay now <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {previewHref && (
              <Button asChild size="sm" variant="outline">
                <a href={previewHref} target="_blank" rel="noreferrer">
                  <Eye className="mr-1 h-3.5 w-3.5" />Preview
                </a>
              </Button>
            )}
            {j.upload_url && (
              <Button size="sm" variant="outline" onClick={async () => {
                const url = await getJobUploadSignedUrl(j.upload_url);
                if (!url) return toast.error("Could not open upload");
                window.open(url, "_blank", "noreferrer");
              }}>View upload</Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <Link to={`/my-jobs/${j.id}`}>Manage →</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <CustomerPortalShell maxWidth="4xl">
      <PageHeader
        title="My projects"
        description="Track your projects, preview, pay, and share when ready."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="shadow-glow"
              disabled={selectedJobs.length === 0 || postChecking}
              onClick={goPostToSocials}
            >
              <Send className="mr-1 h-4 w-4" />
              Post to Socials{selectedJobs.length ? ` (${selectedJobs.length})` : ""}
            </Button>
            <Button asChild variant="outline">
              <Link to="/submit-job"><Plus className="mr-1 h-4 w-4" />New project</Link>
            </Button>
          </div>
        }
      />

      {readyJobs.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            Select all ready projects
          </label>
          <span className="text-muted-foreground">{selectedJobs.length} selected</span>
          {selectedJobs.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Clear selection
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : jobs.length === 0 ? (
        <Card className="mt-8 p-10 text-center">
          <p className="text-muted-foreground">You haven't submitted any projects yet.</p>
          <Button asChild className="mt-4"><Link to="/submit-job"><Plus className="mr-1 h-4 w-4" />Submit your first project</Link></Button>
        </Card>
      ) : (
        <div className="mt-8 space-y-10">
          {readyJobs.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Ready to share</h2>
                <p className="text-sm text-muted-foreground">
                  Check the projects you want to include in Post to Socials.
                </p>
              </div>
              {readyJobs.map((j) => renderCard(j, true))}
            </section>
          )}

          {pendingJobs.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">In progress</h2>
                <p className="text-sm text-muted-foreground">
                  These become shareable once they're completed and paid.
                </p>
              </div>
              {pendingJobs.map((j) => renderCard(j, false))}
            </section>
          )}
        </div>
      )}

    </CustomerPortalShell>
  );
}
