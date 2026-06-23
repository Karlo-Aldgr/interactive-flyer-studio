import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/dashboard/JobStatusBadge";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import { type UserJob } from "@/lib/userJobs";
import { UNIFIED_STEPS, getUnifiedStepIndex, getUnifiedStatusLabel } from "@/lib/jobStatus";
import { getJobUploadSignedUrl } from "@/lib/jobUploads";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const labelFor = (id: string) => INTERACTIONS.find((i) => i.id === id)?.label ?? id;

type JobDetailViewProps = {
  job: UserJob;
};

export function JobDetailView({ job }: JobDetailViewProps) {
  const currentIdx = getUnifiedStepIndex(job);
  const isCancelled = job.status === "cancelled";
  const status = getUnifiedStatusLabel(job);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold break-words sm:text-3xl">{job.title}</h1>
            <Badge className={status.className}>
              <span className="mr-1">{status.emoji}</span>
              {status.label}
            </Badge>
            <Badge variant="outline">{job.type === "upload" ? "Upload" : "Design request"}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted {format(new Date(job.created_at), "PPP")} · Updated {format(new Date(job.updated_at), "PPP")}
          </p>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Progress</h2>
        {isCancelled ? (
          <p className="mt-3 text-sm text-muted-foreground">This project was cancelled.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {UNIFIED_STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn(active ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
                    <span className="mr-1.5">{step.emoji}</span>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {job.brief && (
        <Card className="p-5">
          <h2 className="font-semibold">{job.type === "design" ? "Brief" : "Notes"}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{job.brief}</p>
        </Card>
      )}

      {(job.selected_actions?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Requested interactions</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.selected_actions.map((id) => (
              <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs">
                {labelFor(id)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {job.admin_notes && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <h2 className="font-semibold">Note from our team</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{job.admin_notes}</p>
        </Card>
      )}

      {job.upload_url && (
        <Card className="p-5">
          <h2 className="font-semibold">Your upload</h2>
          <p className="mt-1 text-sm text-muted-foreground">The file you attached when submitting this project.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={async () => {
              const url = await getJobUploadSignedUrl(job.upload_url!);
              if (!url) return toast.error("Could not open upload");
              window.open(url, "_blank", "noreferrer");
            }}
          >
            View upload
          </Button>
        </Card>
      )}
    </div>
  );
}
