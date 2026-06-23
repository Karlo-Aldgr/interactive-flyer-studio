import type { Database } from "@/integrations/supabase/types";

export type JobStatus = Database["public"]["Enums"]["job_status"];

export type JobStatusMeta = {
  /** Customer-facing label (dashboard, My Jobs) */
  label: string;
  /** Detailed label for admin workflows */
  adminLabel: string;
  className: string;
  /** Emoji prefix for unified UI */
  emoji?: string;
};

const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  new: {
    label: "Submitted",
    adminLabel: "New",
    emoji: "🟡",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  reviewing: {
    label: "Started",
    adminLabel: "Reviewing",
    emoji: "🟠",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  quoted: {
    label: "Payment Required",
    adminLabel: "Quote sent",
    emoji: "💰",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  },
  paid: {
    label: "Paid / Active",
    adminLabel: "Paid",
    emoji: "✅",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  in_progress: {
    label: "In Progress",
    adminLabel: "In progress",
    emoji: "🔵",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
  preview_ready: {
    label: "Reviewing",
    adminLabel: "Preview ready",
    emoji: "🟣",
    className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  delivered: {
    label: "Completed",
    adminLabel: "Delivered",
    emoji: "🟢",
    className: "bg-green-500/15 text-green-700 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    adminLabel: "Cancelled",
    emoji: "⚫",
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

/** 6-step unified workflow shown on customer + staff timelines. */
export type UnifiedStep = {
  key: "submitted" | "started" | "in_progress" | "reviewing" | "completed" | "paid";
  label: string;
  emoji: string;
};

export const UNIFIED_STEPS: UnifiedStep[] = [
  { key: "submitted", label: "Submitted", emoji: "🟡" },
  { key: "started", label: "Started", emoji: "🟠" },
  { key: "in_progress", label: "In Progress", emoji: "🔵" },
  { key: "reviewing", label: "Reviewing", emoji: "🟣" },
  { key: "completed", label: "Completed", emoji: "🟢" },
  { key: "paid", label: "Paid / Active", emoji: "✅" },
];

/** Map a DB job to its index (0-based) in the unified 6-step workflow. */
export function getUnifiedStepIndex(job: {
  status: string;
  price_cents?: number | null;
  share_unlocked?: boolean | null;
}): number {
  switch (job.status) {
    case "new":
      return 0;
    case "reviewing":
      return 1;
    case "in_progress":
      return 2;
    case "preview_ready":
      return 3;
    case "quoted":
      // Quote sent = completed work + payment required
      return 4;
    case "delivered":
      // Completed; if a price has been set but not paid, we're awaiting payment
      return 4;
    case "paid":
      return 5;
    default:
      return 0;
  }
}

/** Unified customer-facing label for a job (factoring in payment state). */
export function getUnifiedStatusLabel(job: {
  status: string;
  price_cents?: number | null;
  share_unlocked?: boolean | null;
}): { label: string; emoji: string; className: string } {
  if (job.status === "cancelled") {
    return { label: "Cancelled", emoji: "⚫", className: "bg-muted text-muted-foreground" };
  }
  // Awaiting payment when work is done + price set + not paid
  if (
    (job.status === "delivered" || job.status === "preview_ready" || job.status === "quoted") &&
    typeof job.price_cents === "number" &&
    job.price_cents > 0 &&
    !job.share_unlocked
  ) {
    return {
      label: "Payment Required",
      emoji: "💰",
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    };
  }
  const idx = getUnifiedStepIndex(job);
  const step = UNIFIED_STEPS[idx];
  const meta = getJobStatusMeta(job.status);
  return { label: step.label, emoji: step.emoji, className: meta.className };
}
