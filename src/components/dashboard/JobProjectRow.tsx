import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/dashboard/JobStatusBadge";
import type { UserJob } from "@/lib/userJobs";

type JobProjectRowProps = {
  job: Pick<UserJob, "id" | "title" | "status" | "created_at" | "type">;
};

export function JobProjectRow({ job }: JobProjectRowProps) {
  return (
    <Link to={`/my-jobs/${job.id}`} className="block">
      <Card className="flex flex-col gap-3 p-4 transition hover:border-primary/40 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-left">
          <div className="font-medium break-words">{job.title}</div>
          <div className="text-xs text-muted-foreground">
            {job.type === "upload" ? "Upload" : "Design request"} · {format(new Date(job.created_at), "MMM d, yyyy")}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <JobStatusBadge status={job.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  );
}
