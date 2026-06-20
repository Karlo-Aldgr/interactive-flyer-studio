import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getJobStatusMeta } from "@/lib/jobStatus";

type JobStatusBadgeProps = {
  status: string;
  /** customer = friendly labels; admin = detailed workflow labels */
  variant?: "customer" | "admin";
  className?: string;
};

export function JobStatusBadge({ status, variant = "customer", className }: JobStatusBadgeProps) {
  const meta = getJobStatusMeta(status);
  const label = variant === "admin" ? meta.adminLabel : meta.label;

  return (
    <Badge className={cn(meta.className, className)}>
      {label}
    </Badge>
  );
}
