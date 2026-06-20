import type { Database } from "@/integrations/supabase/types";

export type JobStatus = Database["public"]["Enums"]["job_status"];

export type JobStatusMeta = {
  /** Customer-facing label (dashboard, My Jobs) */
  label: string;
  /** Detailed label for admin workflows */
  adminLabel: string;
  className: string;
};

const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  new: {
    label: "Pending",
    adminLabel: "New",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  reviewing: {
    label: "Pending",
    adminLabel: "Reviewing",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  quoted: {
    label: "Quote sent",
    adminLabel: "Quote sent",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  },
  paid: {
    label: "Paid",
    adminLabel: "Paid",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  in_progress: {
    label: "In progress",
    adminLabel: "In progress",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
  preview_ready: {
    label: "Ready for review",
    adminLabel: "Preview ready",
    className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  delivered: {
    label: "Completed",
    adminLabel: "Delivered",
    className: "bg-green-500/15 text-green-700 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    adminLabel: "Cancelled",
    className: "bg-muted text-muted-foreground",
  },
};

export function getJobStatusMeta(status: string | null | undefined): JobStatusMeta {
  if (status && status in JOB_STATUS_META) {
    return JOB_STATUS_META[status as JobStatus];
  }
  return JOB_STATUS_META.new;
}

export const JOB_STATUSES = Object.keys(JOB_STATUS_META) as JobStatus[];
