import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, FileText, Inbox, Loader2, Download, Pencil, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "@/components/dashboard/JobStatusBadge";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import {
  EDITOR_JOB_STATUSES,
  EDITOR_STATUS_LABEL,
  claimEditorJob,
  releaseEditorJob,
  updateEditorJob,
} from "@/lib/editorJobs";
import { useAuth } from "@/contexts/AuthContext";
import { displayFirstName } from "@/lib/displayName";
import { getJobUploadSignedUrl, downloadJobUpload } from "@/lib/jobUploads";
import {
  jobIsCustomerDeleted,
  staffAcknowledgeJob,
  staffMarkJobSeen,
} from "@/lib/customerJobs";
import { JobDeletedBanner, JobStaffBadges } from "@/components/dashboard/JobStaffBadges";
import type { JobStatus } from "@/lib/jobStatus";
import { loadEditorJobs, type UserJob } from "@/lib/userJobs";
import type { Flyer } from "@/types/flyer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type JobFilter = "available" | "mine" | "all" | "pending" | "in_progress" | "completed";

type EditorJobQueueProps = {
  flyers: Flyer[];
};

const labelFor = (id: string) => INTERACTIONS.find((i) => i.id === id)?.label ?? id;

const PENDING = new Set(["new", "reviewing", "quoted", "paid"]);
const IN_PROGRESS = new Set(["in_progress", "preview_ready"]);
const COMPLETED = new Set(["delivered", "cancelled"]);

function matchesFilter(job: UserJob, filter: JobFilter, myId?: string) {
  if (filter === "available") return !job.assigned_editor_id && !jobIsCustomerDeleted(job) && !COMPLETED.has(job.status);
  if (filter === "mine") return !!myId && job.assigned_editor_id === myId;
  if (filter === "all") return true;
  if (filter === "pending") return PENDING.has(job.status);
  if (filter === "in_progress") return IN_PROGRESS.has(job.status);
  return COMPLETED.has(job.status);
}

export function EditorJobQueue({ flyers }: EditorJobQueueProps) {
  const { user } = useAuth();
  const myId = user?.id;
  const [jobs, setJobs] = useState<UserJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobFilter>("available");
  const [selected, setSelected] = useState<UserJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [eStatus, setEStatus] = useState<JobStatus>("reviewing");
  const [eFlyerId, setEFlyerId] = useState<string>("");
  const [ePreviewReady, setEPreviewReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { jobs: rows, error } = await loadEditorJobs();
    if (error) toast.error(error.message || "Could not load customer requests");
    setJobs(rows);
    setLoading(false);
    return rows;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openManage = async (job: UserJob) => {
    if (!jobIsCustomerDeleted(job)) {
      await staffMarkJobSeen(job.id);
    }
    setSelected(job);
    const status = EDITOR_JOB_STATUSES.includes(job.status as JobStatus)
      ? (job.status as JobStatus)
      : "reviewing";
    setEStatus(status);
    setEFlyerId(job.flyer_id ?? "");
    setEPreviewReady(job.preview_ready);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id && !jobIsCustomerDeleted(j)
          ? { ...j, staff_content_seen_at: new Date().toISOString() }
          : j
      )
    );
  };

  const sendPreview = async (job: UserJob) => {
    if (!job.flyer_id) {
      toast.error("Link a TapFlyer in Manage first");
      openManage(job);
      return;
    }
    await applyPatch(job, {
      status: "preview_ready",
      previewReady: true,
      flyerId: job.flyer_id,
    });
  };

  const acknowledgeDeleted = async (job: UserJob) => {
    setSaving(true);
    const { ok, error } = await staffAcknowledgeJob(job.id);
    setSaving(false);
    if (!ok) return toast.error(error ?? "Could not acknowledge");
    toast.success("Removed from queue");
    setSelected(null);
    refresh();
  };

  const applyPatch = async (job: UserJob, patch: Parameters<typeof updateEditorJob>[1]) => {
    setSaving(true);
    const { ok, error } = await updateEditorJob(job.id, patch);
    setSaving(false);
    if (!ok) {
      toast.error(error ?? "Could not update job");
      return false;
    }
    toast.success("Job updated");
    const rows = await refresh();
    const updated = rows.find((j) => j.id === job.id);
    if (updated && selected?.id === job.id) {
      setSelected(updated);
      openManage(updated);
    }
    return true;
  };

  const saveManage = async () => {
    if (!selected) return;
    if (ePreviewReady && !eFlyerId) {
      toast.error("Link a TapFlyer before marking preview ready");
      return;
    }
    const status = ePreviewReady && eStatus !== "delivered" ? "preview_ready" : eStatus;
    setSaving(true);
    const { ok, error } = await updateEditorJob(selected.id, {
      status,
      flyerId: eFlyerId || null,
      previewReady: ePreviewReady,
      clearFlyer: !eFlyerId,
    });
    setSaving(false);
    if (!ok) return toast.error(error ?? "Could not save");
    toast.success("Job saved");
    const rows = await refresh();
    const updated = rows.find((j) => j.id === selected.id);
    if (updated) openManage(updated);
  };

  const filtered = useMemo(() => jobs.filter((j) => matchesFilter(j, filter)), [jobs, filter]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      pending: jobs.filter((j) => PENDING.has(j.status)).length,
      in_progress: jobs.filter((j) => IN_PROGRESS.has(j.status)).length,
      completed: jobs.filter((j) => COMPLETED.has(j.status)).length,
    }),
    [jobs]
  );

  const filters: { value: JobFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "in_progress", label: "In progress", count: counts.in_progress },
    { value: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Customer requests</h2>
          <p className="text-pretty text-sm text-muted-foreground">
            Review briefs, link your TapFlyer, update status, and send previews to customers.
          </p>
        </div>
        {!loading && counts.pending > 0 && (
          <Badge className="w-fit bg-primary/15 text-primary">{counts.pending} pending</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(({ value, label, count }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              filter === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            {jobs.length === 0
              ? "No customer requests yet. They will appear here when someone submits a project."
              : "No requests in this filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <Card key={job.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{job.title}</h3>
                    <JobStatusBadge status={job.status} />
                    <JobStaffBadges job={job} />
                    <Badge variant="outline">{job.type === "upload" ? "Upload" : "Design"}</Badge>
                    {job.flyer_id && (
                      <Badge variant="secondary" className="text-xs">
                        Flyer linked
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.customer_email ?? "Customer"} · Submitted {format(new Date(job.created_at), "PPp")}
                  </p>
                  {job.brief && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.brief}</p>
                  )}
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    {!jobIsCustomerDeleted(job) && PENDING.has(job.status) && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={saving}
                        onClick={() => applyPatch(job, { status: "in_progress" })}
                      >
                        Start work
                      </Button>
                    )}
                    {!jobIsCustomerDeleted(job) && IN_PROGRESS.has(job.status) && job.status !== "preview_ready" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        disabled={saving}
                        onClick={() => sendPreview(job)}
                      >
                        Send preview
                      </Button>
                    )}
                    {!jobIsCustomerDeleted(job) && job.status === "preview_ready" && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={saving}
                        onClick={() => applyPatch(job, { status: "delivered" })}
                      >
                        Mark completed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => openManage(job)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Manage
                    </Button>
                    {job.upload_url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            const url = await getJobUploadSignedUrl(job.upload_url!);
                            if (!url) return toast.error("Could not open upload");
                            window.open(url, "_blank", "noreferrer");
                          }}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View upload
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            const ok = await downloadJobUpload(job.upload_url!);
                            if (!ok) toast.error("Could not download file");
                          }}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Download
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                  {selected.title}
                  <JobStatusBadge status={selected.status} variant="admin" />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <JobDeletedBanner
                  job={selected}
                  mode="editor"
                  onAcknowledge={jobIsCustomerDeleted(selected) ? () => acknowledgeDeleted(selected) : undefined}
                  acknowledging={saving}
                />

                {!jobIsCustomerDeleted(selected) && (
                <>
                <div className="text-muted-foreground">
                  <div>{selected.customer_email ?? "—"}</div>
                  <div>Submitted {format(new Date(selected.created_at), "PPP")}</div>
                  <div>Type: {selected.type === "upload" ? "Customer upload" : "Design request"}</div>
                </div>

                {selected.brief && (
                  <div>
                    <div className="font-medium">{selected.type === "design" ? "Brief" : "Notes"}</div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.brief}</p>
                  </div>
                )}

                {(selected.selected_actions?.length ?? 0) > 0 && (
                  <div>
                    <div className="font-medium">Requested interactions</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.selected_actions.map((id) => (
                        <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs">
                          {labelFor(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.admin_notes && (
                  <div>
                    <div className="font-medium">Note from admin</div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.admin_notes}</p>
                  </div>
                )}

                {selected.upload_url && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const url = await getJobUploadSignedUrl(selected.upload_url!);
                      if (!url) return toast.error("Could not open upload");
                      window.open(url, "_blank", "noreferrer");
                    }}
                  >
                    <FileText className="mr-1 h-4 w-4" />
                    View customer upload
                  </Button>
                )}

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="font-medium">Workflow</div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={eStatus} onValueChange={(v) => setEStatus(v as JobStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDITOR_JOB_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {EDITOR_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Linked TapFlyer</Label>
                    <Select
                      value={eFlyerId || "__none__"}
                      onValueChange={(v) => setEFlyerId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a flyer you created" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {flyers.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.title} ({f.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {eFlyerId && (
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link to={`/editor/${eFlyerId}`}>
                          Open in editor <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    {flyers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Create a TapFlyer below first, then link it here.
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="preview-ready"
                      checked={ePreviewReady}
                      onCheckedChange={(v) => setEPreviewReady(!!v)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="preview-ready" className="cursor-pointer">
                        Customer can preview flyer
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Shows the preview link on the customer&apos;s My Projects page. Requires a linked TapFlyer.
                      </p>
                    </div>
                  </div>

                  {selected.preview_ready && selected.flyer?.public_slug && (
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <a href={`/f/${selected.flyer.public_slug}`} target="_blank" rel="noreferrer">
                        View live preview <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
                </>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelected(null)}>
                  Close
                </Button>
                {!jobIsCustomerDeleted(selected) && (
                  <Button className="w-full sm:w-auto" onClick={saveManage} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
