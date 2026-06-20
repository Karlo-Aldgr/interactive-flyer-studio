import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { customerCanEditJob, customerUpdateJob } from "@/lib/customerJobs";
import { loadUserJobs } from "@/lib/userJobs";

export default function EditJob() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [type, setType] = useState<"upload" | "design">("upload");
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !jobId) return;
    (async () => {
      const { jobs, error } = await loadUserJobs(user.id, { jobId });
      if (error || jobs.length === 0) {
        toast.error("Project not found");
        navigate("/my-jobs");
        return;
      }
      const job = jobs[0];
      if (!customerCanEditJob(job)) {
        toast.error("This project can no longer be edited");
        navigate(`/my-jobs/${jobId}`);
        return;
      }
      setTitle(job.title);
      setBrief(job.brief ?? "");
      setType(job.type as "upload" | "design");
      setSelected(job.selected_actions ?? []);
      setLoading(false);
    })();
  }, [user, jobId, navigate]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!user || !jobId) return;
    if (!title.trim()) return toast.error("Please add a title");
    if (type === "design" && !brief.trim()) return toast.error("Please share a brief");
    if (selected.length === 0) return toast.error("Pick at least one interaction");

    setSaving(true);
    try {
      let uploadUrl: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("job-uploads").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        uploadUrl = path;
      }

      const { ok, error } = await customerUpdateJob(jobId, {
        title: title.trim(),
        brief: brief.trim() || null,
        selectedActions: selected,
        ...(uploadUrl ? { uploadUrl } : {}),
      });
      if (!ok) throw new Error(error ?? "Could not save");
      toast.success("Project updated — our team has been notified");
      navigate(`/my-jobs/${jobId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardPage maxWidth="3xl">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to={`/my-jobs/${jobId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to project
          </Link>
        </Button>

        <h1 className="font-display text-2xl font-bold sm:text-3xl">Edit project</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Changes are sent to your editor immediately. If work was in progress, status returns to review.
        </p>

        <Card className="mt-6 space-y-6 p-4 sm:p-8">
          {type === "upload" && (
            <div>
              <Label htmlFor="file">Replace upload (optional)</Label>
              <Input
                id="file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2"
              />
              {file && <p className="mt-2 text-xs text-muted-foreground">New file: {file.name}</p>}
            </div>
          )}

          <div>
            <Label htmlFor="title">Project title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2" />
          </div>

          <div>
            <Label htmlFor="brief">{type === "design" ? "Brief" : "Notes"}</Label>
            <Textarea id="brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} className="mt-2" />
          </div>

          <div>
            <Label>Interactions ({selected.length} selected)</Label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {INTERACTIONS.map((it) => {
                const on = selected.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {on ? <CheckCircle2 className="h-4 w-4" /> : <it.icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{it.label}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{it.short}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button size="lg" onClick={save} disabled={saving} className="w-full shadow-glow">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </Card>
      </DashboardPage>
    </DashboardShell>
  );
}
