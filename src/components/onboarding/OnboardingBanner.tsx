import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { cn } from "@/lib/utils";

/**
 * Persistent, non-blocking reminder shown until the customer finishes onboarding.
 */
export function OnboardingBanner({ className }: { className?: string }) {
  const { completed, loading } = useOnboardingStatus();
  if (loading || completed) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Finish your onboarding</p>
          <p className="text-sm text-muted-foreground">
            Share your business details, logo and links so we can personalize your flyers and marketing.
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/onboarding">Complete onboarding</Link>
      </Button>
    </div>
  );
}
