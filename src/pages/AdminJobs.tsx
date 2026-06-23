import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ExternalLink, Trash2, Pencil, FileText, Database, X, Sparkles } from "lucide-react";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import { format, formatDistanceToNow } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { JobDeletedBanner, JobStaffBadges } from "@/components/dashboard/JobStaffBadges";
import { jobIsCustomerDeleted } from "@/lib/customerJobs";
import { checkIsAdmin } from "@/lib/roles";
import { getJobUploadSignedUrl, jobUploadFilename } from "@/lib/jobUploads";
import { uploadFlyerAsset } from "@/lib/uploadFlyerAsset";
import { adminAssignJobEditor, fetchEditorDisplayNames } from "@/lib/editorJobs";
import { displayFirstName } from "@/lib/displayName";


const STATUSES = ["new","reviewing","quoted","paid","in_progress","preview_ready","delivered","cancelled"] as const;
const STATUS_LABEL: Record<string,string> = {
  new: "New", reviewing: "Reviewing", quoted: "Quote sent", paid: "Paid",
  in_progress: "In progress", preview_ready: "Preview ready", delivered: "Delivered", cancelled: "Cancelled",
};

const labelFor = (id: string) => INTERACTIONS.find((i) => i.id === id)?.label ?? id;

const NEW_BADGE_MS = 1000 * 60 * 60 * 24; // 24h "new" highlight
const BACKUP_REMINDER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export default function AdminJobs() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [flyers, setFlyers] = useState<any[]>([]);
  const [editors, setEditors] = useState<{ user_id: string; email: string }[]>([]);
  const [editorEmails, setEditorEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editorFilter, setEditorFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteFlyerId, setDeleteFlyerId] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);

  // Editor form state
  const [eStatus, setEStatus] = useState<string>("new");
  const [ePrice, setEPrice] = useState<string>("");
  const [ePayLink, setEPayLink] = useState<string>("");
  const [eFlyerId, setEFlyerId] = useState<string>("");
  const [ePreviewReady, setEPreviewReady] = useState<boolean>(false);
  const [eNotes, setENotes] = useState<string>("");

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin(user.id).then(setIsAdmin);
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    const [jr, fr, sr, er] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("flyers").select("id, title, owner_id, status, public_slug").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key","last_backup_at").maybeSingle(),
      supabase.rpc("list_editors"),
    ]);
    const jobsData = jr.data ?? [];
    setJobs(jobsData);
    setFlyers(fr.data ?? []);
    const editorRows = ((er.data ?? []) as any[]).map((r) => ({ user_id: r.user_id as string, email: r.email as string }));
    setEditors(editorRows);
    const ids = jobsData.map((j: any) => j.assigned_editor_id).filter(Boolean) as string[];
    const map = await fetchEditorDisplayNames([...ids, ...editorRows.map((e) => e.user_id)]);
    setEditorEmails(map);
    const lb = (sr.data?.value as any)?.at;
    setLastBackup(lb ? new Date(lb) : null);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  // Real-time + polling fallback so admin sees editor updates without manual refresh.
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-jobs-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        refresh();
      })
      .subscribe();
    const interval = window.setInterval(() => { refresh(); }, 20000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (editorFilter !== "all") {
        if (editorFilter === "unassigned") {
          if (j.assigned_editor_id) return false;
        } else if (j.assigned_editor_id !== editorFilter) return false;
      }
      if (q) {
        const hay = `${j.title ?? ""} ${j.customer_email ?? ""} ${j.brief ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, filter, editorFilter, search]);

  const counts = useMemo(() => {
    const c = { total: jobs.length, pending: 0, active: 0, review: 0, completed: 0, paid: 0 };
    for (const j of jobs) {
      if (j.deleted_at) continue;
      if (j.status === "new" || j.status === "reviewing") c.pending++;
      else if (j.status === "in_progress") c.active++;
      else if (j.status === "preview_ready" || j.status === "quoted") c.review++;
      else if (j.status === "delivered") c.completed++;
      else if (j.status === "paid") c.paid++;
    }
    return c;
  }, [jobs]);

  const editorWorkload = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      if (!j.assigned_editor_id || j.deleted_at) continue;
      if (["delivered", "paid", "cancelled"].includes(j.status)) continue;
      m.set(j.assigned_editor_id, (m.get(j.assigned_editor_id) ?? 0) + 1);
    }
    return m;
  }, [jobs]);

  const staleJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === "new" &&
          !j.deleted_at &&
          Date.now() - new Date(j.created_at).getTime() > NEW_BADGE_MS,
      ),
    [jobs],
  );
  const [staleDismissed, setStaleDismissed] = useState(false);
  const showStalePrompt = !loading && !staleDismissed && staleJobs.length > 0;

  const openEdit = (j: any) => {
    setEditing(j);
    setEStatus(j.status);
    setEPrice(j.price_cents ? (j.price_cents / 100).toFixed(2) : "");
    setEPayLink(j.payment_link ?? "");
    setEFlyerId(j.flyer_id ?? "");
    setEPreviewReady(!!j.preview_ready);
    setENotes(j.admin_notes ?? "");
  };

  const saveJob = async () => {
    if (!editing) return;
    const priceNum = ePrice ? Math.round(parseFloat(ePrice) * 100) : null;
    if (ePrice && (priceNum === null || isNaN(priceNum))) { toast.error("Invalid price"); return; }
    const { error } = await supabase.from("jobs").update({
      status: eStatus as any,
      price_cents: priceNum,
      payment_link: ePayLink || null,
      flyer_id: eFlyerId || null,
      preview_ready: ePreviewReady,
      admin_notes: eNotes || null,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job updated");
    setEditing(null);
    refresh();
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Job deleted");
    refresh();
  };

  const openJob = async (j: any) => {
    if (openingJobId) return;
    // If a flyer is already linked, NEVER overwrite — just open it as-is.
    if (j.flyer_id) {
      navigate(`/editor/${j.flyer_id}`);
      return;
    }
    if (!user) return;
    setOpeningJobId(j.id);
    const toastId = toast.loading("Opening flyer for this job...");
    try {
      // Re-check latest job row in case flyer_id was set elsewhere — never overwrite.
      const { data: fresh } = await supabase
        .from("jobs")
        .select("flyer_id")
        .eq("id", j.id)
        .maybeSingle();
      if (fresh?.flyer_id) {
        toast.dismiss(toastId);
        navigate(`/editor/${fresh.flyer_id}`);
        return;
      }

      // 1. Create flyer owned by the customer
      const { data: flyer, error: fErr } = await supabase
        .from("flyers")
        .insert([{ owner_id: j.user_id, title: j.title || "Untitled flyer", category: "business" }])
        .select()
        .single();
      if (fErr) throw fErr;

      // 2. Create first page
      const { data: page, error: pErr } = await supabase
        .from("pages")
        .insert([{ flyer_id: flyer.id, index: 0, name: "Page 1" }])
        .select()
        .single();
      if (pErr) throw pErr;

      // 3. If the job has an upload, copy it into flyer-assets and add an image layer
      if (j.upload_url) {
        try {
          const signed = await getJobUploadSignedUrl(j.upload_url, 600);
          if (signed) {
            const res = await fetch(signed);
            if (res.ok) {
              const blob = await res.blob();
              if (blob.type.startsWith("image/")) {
                const filename = jobUploadFilename(j.upload_url) || "upload.png";
                const file = new File([blob], filename, { type: blob.type });
                const publicUrl = await uploadFlyerAsset(user.id, flyer.id, file, "uploads");
                const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                  const img = new Image();
                  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                  img.onerror = () => resolve({ w: 600, h: 400 });
                  img.src = publicUrl;
                });
                const maxW = 800;
                const ratio = dims.w / Math.max(dims.h, 1);
                const width = Math.min(dims.w, maxW);
                const height = ratio > 0 ? width / ratio : 600;
                await supabase.from("layers").insert([{
                  page_id: page.id,
                  type: "image" as any,
                  position: { x: 60, y: 60 } as any,
                  size: { width, height } as any,
                  rotation: 0,
                  z_index: 0,
                  style: {} as any,
                  content: { src: publicUrl } as any,
                }]);
              }
            }
          }
        } catch (e) {
          console.warn("Failed to insert job upload into flyer", e);
        }
      }

      // 4. Link the flyer to the job — surface errors so we don't silently leave job unlinked
      const { error: linkErr } = await supabase
        .from("jobs")
        .update({ flyer_id: flyer.id })
        .eq("id", j.id);
      if (linkErr) throw linkErr;

      toast.success("Flyer created", { id: toastId });
      navigate(`/editor/${flyer.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create flyer", { id: toastId });
    } finally {
      setOpeningJobId(null);
    }
  };


  const deleteFlyer = async () => {
    if (!deleteFlyerId) return;
    const { error } = await supabase.from("flyers").delete().eq("id", deleteFlyerId);
    if (error) return toast.error(error.message);
    toast.success("Flyer deleted");
    setDeleteFlyerId(null);
    refresh();
  };

  // Backup reminder
  const backupOverdue = !backupDismissed && (!lastBackup || (Date.now() - lastBackup.getTime()) > BACKUP_REMINDER_MS);

  const runBackup = async () => {
    setExporting(true);
    try {
      const [{ data: f }, { data: p }, { data: l }, { data: a }, { data: subs }, { data: forms }, { data: appts }, { data: jobsAll }] = await Promise.all([
        supabase.from("flyers").select("*"),
        supabase.from("pages").select("*"),
        supabase.from("layers").select("*"),
        supabase.from("actions").select("*"),
        supabase.from("subscribers").select("*"),
        supabase.from("form_submissions").select("*"),
        supabase.from("appointments").select("*"),
        supabase.from("jobs").select("*"),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        flyers: f, pages: p, layers: l, actions: a,
        subscribers: subs, form_submissions: forms, appointments: appts, jobs: jobsAll,
      };

      // Build a zip with JSZip (lazy import)
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(data, null, 2));

      // Bundle uploaded job files (best-effort)
      const assets = zip.folder("uploads")!;
      await Promise.all(((jobsAll ?? []) as any[]).filter((j) => j.upload_url).map(async (j) => {
        try {
          const signed = await getJobUploadSignedUrl(j.upload_url, 600);
          if (!signed) return;
          const res = await fetch(signed);
          if (!res.ok) return;
          const blob = await res.blob();
          const filename = jobUploadFilename(j.upload_url) || `${j.id}.bin`;
          assets.file(`${j.id}-${filename}`, blob);
        } catch {}
      }));


      const blob = await zip.generateAsync({ type: "blob" });
      const ts = format(new Date(), "yyyy-MM-dd-HHmm");
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement("a");
      a2.href = url; a2.download = `tapthatflyer-backup-${ts}.zip`;
      document.body.appendChild(a2); a2.click(); a2.remove();
      URL.revokeObjectURL(url);

      await supabase.from("app_settings").upsert({ key: "last_backup_at", value: { at: new Date().toISOString() } });
      toast.success("Backup downloaded — save it to your flash drive.");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Backup failed");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AdminLayout active="jobs">
      <div className="space-y-8">
        {backupOverdue && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <div className="font-semibold">Time to back up your data</div>
                <div className="text-sm text-muted-foreground">
                  {lastBackup ? `Last backup ${formatDistanceToNow(lastBackup)} ago.` : "No backup on record yet."} Download a ZIP and save it to your flash drive.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={runBackup} disabled={exporting}>
                {exporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Building...</> : "Download backup"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setBackupDismissed(true)} aria-label="Dismiss"><X className="h-4 w-4" /></Button>
            </div>
          </Card>
        )}

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold">Jobs</h1>
              <p className="text-sm text-muted-foreground">
                {jobs.length} total {newCount > 0 && <Badge className="ml-2 bg-primary text-primary-foreground"><Sparkles className="mr-1 h-3 w-3" />{newCount} new</Badge>}
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={runBackup} disabled={exporting}>
                <Database className="mr-2 h-4 w-4" />Backup
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card className="mt-6 p-10 text-center text-muted-foreground">No jobs.</Card>
          ) : (
            <div className="mt-6 space-y-3">
              {filtered.map((j) => {
                const isNew = j.status === "new" && (Date.now() - new Date(j.created_at).getTime() < NEW_BADGE_MS);
                const linkedFlyer = flyers.find((f) => f.id === j.flyer_id);
                const customerDeleted = jobIsCustomerDeleted(j);
                const assignedEditorEmail = j.assigned_editor_id ? editorEmails.get(j.assigned_editor_id) : null;
                return (
                  <Card
                    key={j.id}
                    role="button"
                    tabIndex={customerDeleted ? -1 : 0}
                    onClick={() => !customerDeleted && openJob(j)}
                    onKeyDown={(e) => {
                      if (customerDeleted) return;
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openJob(j); }
                    }}
                    className={`p-5 transition cursor-pointer hover:border-primary/50 hover:shadow-md ${isNew ? "ring-2 ring-primary/60 shadow-glow" : ""} ${customerDeleted ? "border-destructive/30 cursor-default" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isNew && <Badge className="bg-primary text-primary-foreground"><Sparkles className="mr-1 h-3 w-3" />NEW</Badge>}
                          <h3 className="font-semibold">{j.title}</h3>
                          <Badge variant="secondary">{STATUS_LABEL[j.status]}</Badge>
                          <Badge variant={j.assigned_editor_id ? "default" : "outline"}>
                            Editor: {j.assigned_editor_id ? displayFirstName(assignedEditorEmail) : "Unassigned"}
                          </Badge>
                          <Badge variant="outline">{j.type}</Badge>
                          <JobStaffBadges job={j} />
                          {openingJobId === j.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {j.customer_email ?? "—"} · {format(new Date(j.created_at), "PPp")}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="font-medium text-primary">Editor handling project:</span>{" "}
                          <span className="text-muted-foreground">
                            {j.assigned_editor_id ? displayFirstName(assignedEditorEmail) : "Not assigned yet"}
                          </span>
                          {j.assigned_at && (
                            <span className="text-muted-foreground"> · started {format(new Date(j.assigned_at), "PPp")}</span>
                          )}
                        </p>
                        {j.brief && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{j.brief}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(j.selected_actions ?? []).map((id: string) => (
                            <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs">{labelFor(id)}</span>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          {typeof j.price_cents === "number" && <span className="font-semibold">${(j.price_cents / 100).toFixed(2)}</span>}
                          {j.payment_link && <a href={j.payment_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary underline-offset-2 hover:underline inline-flex items-center">Pay link <ExternalLink className="ml-1 h-3 w-3" /></a>}
                          {j.upload_url && (
                            <button type="button" onClick={async (e) => {
                              e.stopPropagation();
                              const url = await getJobUploadSignedUrl(j.upload_url);
                              if (!url) return toast.error("Could not open upload");
                              window.open(url, "_blank", "noreferrer");
                            }} className="inline-flex items-center text-muted-foreground hover:text-foreground"><FileText className="mr-1 h-3.5 w-3.5" />Upload</button>
                          )}

                          {linkedFlyer && <Link to={`/editor/${linkedFlyer.id}`} onClick={(e) => e.stopPropagation()} className="text-primary underline-offset-2 hover:underline">Open editor</Link>}
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); openEdit(j); }}><Pencil className="mr-1 h-3.5 w-3.5" />Manage</Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteJob(j.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">All flyers</h2>
          <p className="text-sm text-muted-foreground">Super admin can open or remove any flyer in the system.</p>
          {flyers.length === 0 ? (
            <Card className="mt-4 p-8 text-center text-muted-foreground">No flyers yet.</Card>
          ) : (
            <div className="mt-4 grid gap-2">
              {flyers.map((f) => (
                <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.title}</div>
                    <div className="text-xs text-muted-foreground">{f.status}{f.public_slug ? ` · /${f.public_slug}` : ""}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline"><Link to={`/editor/${f.id}`}>Open</Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteFlyerId(f.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

      {/* Manage job dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing && jobIsCustomerDeleted(editing) ? "Cancelled project" : "Manage job"}
            </DialogTitle>
          </DialogHeader>
          {editing && jobIsCustomerDeleted(editing) ? (
            <JobDeletedBanner job={editing} mode="admin" />
          ) : editing && (
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={eStatus} onValueChange={setEStatus}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="price">Price (USD)</Label>
                  <Input id="price" inputMode="decimal" value={ePrice} onChange={(e) => setEPrice(e.target.value)} placeholder="149.00" className="mt-2" />
                  <p className="mt-1 text-xs text-muted-foreground">Set price after preview/completion to request payment. Marking status <strong>Paid</strong> automatically unlocks the customer's share link and QR.</p>
                </div>
                <div>
                  <Label htmlFor="paylink">Payment link</Label>
                  <Input id="paylink" value={ePayLink} onChange={(e) => setEPayLink(e.target.value)} placeholder="https://..." className="mt-2" />
                </div>
              </div>
              <div>
                <Label>Linked flyer (for editor access)</Label>
                <Select value={eFlyerId || "none"} onValueChange={(v) => setEFlyerId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Not linked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {flyers.map((f) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned editor</Label>
                <Select
                  value={editing.assigned_editor_id ?? "none"}
                  onValueChange={async (v) => {
                    const editorId = v === "none" ? null : v;
                    const { ok, error } = await adminAssignJobEditor(editing.id, editorId);
                    if (!ok) return toast.error(error ?? "Could not assign");
                    toast.success(editorId ? "Editor assigned" : "Editor cleared");
                    await refresh();
                    setEditing((prev: any) => prev ? { ...prev, assigned_editor_id: editorId, assigned_at: editorId ? new Date().toISOString() : null } : prev);
                  }}
                >
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {editors.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editing.assigned_at && (
                  <p className="mt-1 text-xs text-muted-foreground">Since {format(new Date(editing.assigned_at), "PPp")}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ePreviewReady} onChange={(e) => setEPreviewReady(e.target.checked)} />
                Preview ready (let customer view the linked flyer)
              </label>
              <div>
                <Label htmlFor="notes">Note to customer</Label>
                <Textarea id="notes" rows={4} value={eNotes} onChange={(e) => setENotes(e.target.value)} className="mt-2" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && !jobIsCustomerDeleted(editing) && (
              <Button onClick={saveJob}>Save</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFlyerId} onOpenChange={(o) => !o && setDeleteFlyerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flyer?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the flyer and all its pages, layers and actions. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFlyer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      <AlertDialog open={showStalePrompt} onOpenChange={(o) => !o && setStaleDismissed(true)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {staleJobs.length} job{staleJobs.length === 1 ? "" : "s"} waiting more than 24h
            </AlertDialogTitle>
            <AlertDialogDescription>
              These new jobs have not been started yet. Open one to begin, or dismiss to review later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {staleJobs.map((j) => (
              <button
                key={j.id}
                onClick={() => { setStaleDismissed(true); openJob(j); }}
                className="flex w-full items-center justify-between rounded-md border bg-card p-3 text-left transition hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{j.title || "Untitled job"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {j.customer_email ?? "—"} · created {formatDistanceToNow(new Date(j.created_at))} ago
                  </div>
                </div>
                <Badge variant="destructive" className="ml-3 shrink-0">Waiting</Badge>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaleDismissed(true)}>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setStaleDismissed(true); setFilter("new"); }}>
              Show all new jobs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
