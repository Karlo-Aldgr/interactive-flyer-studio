import { Badge } from "@/components/ui/badge";
import { jobHasCustomerUpdate, jobIsCustomerDeleted } from "@/lib/customerJobs";
import type { UserJob } from "@/lib/userJobs";

export function JobStaffBadges({ job }: { job: UserJob }) {
  const deleted = jobIsCustomerDeleted(job);
  const updated = !deleted && jobHasCustomerUpdate(job);

  if (!deleted && !updated) return null;

  return (
    <>
      {deleted && (
        <Badge variant="destructive" className="text-xs">
          Deleted by customer
        </Badge>
      )}
      {updated && (
        <Badge className="bg-rose-500 text-xs text-white">Updated</Badge>
      )}
    </>
  );
}

type JobDeletedBannerProps = {
  job: UserJob;
  /** editor = can remove from queue; admin = read-only audit */
  mode?: "editor" | "admin";
  onAcknowledge?: () => void;
  acknowledging?: boolean;
};

export function JobDeletedBanner({
  job,
  mode = "editor",
  onAcknowledge,
  acknowledging,
}: JobDeletedBannerProps) {
  if (!jobIsCustomerDeleted(job)) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-medium text-destructive">
        This project has been deleted by the customer and is no longer available.
      </p>
      {job.customer_deletion_reason && (
        <p className="mt-2 text-muted-foreground">
          <span className="font-medium text-foreground">Reason: </span>
          {job.customer_deletion_reason}
        </p>
      )}
      {mode === "admin" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Audit only — this cancellation stays visible until an editor removes it from their queue.
          You cannot delete or dismiss this record.
        </p>
      ) : (
        onAcknowledge &&
        !job.staff_acknowledged_at && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={onAcknowledge}
            disabled={acknowledging}
          >
            {acknowledging ? "Removing..." : "Remove from queue"}
          </button>
        )
      )}
    </div>
  );
}
