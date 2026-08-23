import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, MailCheck, Plus, PartyPopper, CreditCard, Eye } from "lucide-react";
import { ExampleFlyersStrip } from "@/components/dashboard/ExampleFlyersStrip";
import { HowItWorks } from "@/components/dashboard/HowItWorks";
import { JobProjectRow } from "@/components/dashboard/JobProjectRow";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getCustomerStatusBanner } from "@/lib/customerJobBanner";
import { greetingName } from "@/lib/displayName";
import type { UserJob } from "@/lib/userJobs";

type CustomerDashboardProps = {
  jobs: UserJob[];
  userEmail?: string | null;
};

const VISIBLE_STATUSES = ["new", "paid", "delivered"];

/** Keep only submitted / paid / completed projects, collapsing duplicates. */
function visibleProjects(jobs: UserJob[]): UserJob[] {
  const rank = (j: UserJob) =>
    (j.share_unlocked ? 4 : 0) +
    (j.status === "paid" ? 3 : j.status === "delivered" ? 2 : 1);
  const byKey = new Map<string, UserJob>();
  jobs
    .filter((j) => !j.deleted_at && VISIBLE_STATUSES.includes(j.status))
    .forEach((j) => {
      const key = j.flyer_id ?? `${j.title.trim().toLowerCase()}`;
      const prev = byKey.get(key);
      if (!prev || rank(j) > rank(prev)) byKey.set(key, j);
    });
  return [...byKey.values()].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export function CustomerDashboard({ jobs, userEmail }: CustomerDashboardProps) {
  const projects = visibleProjects(jobs);
  const hasJobs = jobs.length > 0;
  const displayName = greetingName(userEmail);
  const banner = getCustomerStatusBanner(jobs);


  const bannerIcon = (() => {
    if (!banner) return MailCheck;
    if (banner.title.includes("complete")) return PartyPopper;
    if (banner.title.includes("quote") || banner.title.includes("Quote")) return CreditCard;
    if (banner.title.includes("preview")) return Eye;
    return MailCheck;
  })();
  const BannerIcon = bannerIcon;

  return (
    <div className="w-full min-w-0 space-y-8 sm:space-y-10">
      <PageHeader
        title={hasJobs ? displayName : "Welcome to your dashboard"}
        description={
          hasJobs
            ? "Track your projects, preview samples, and submit new requests."
            : "Submit a project when you're ready — we'll review it and send you a quote."
        }
        actions={
          <>
            <Button asChild className="w-full shadow-glow sm:w-auto">
              <Link to="/submit-job">
                <Plus className="mr-1 h-4 w-4" />
                {hasJobs ? "New project" : "Submit project"}
              </Link>
            </Button>
            {hasJobs && (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/my-jobs">All projects</Link>
              </Button>
            )}
          </>
        }
      />

      {hasJobs && banner ? (
        <>
          <Card className="border-dashed p-8 text-center sm:p-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BannerIcon className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold md:text-2xl">{banner.title}</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{banner.description}</p>
          </Card>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Your projects</h2>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/my-jobs">View all</Link>
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {jobs.map((j) => (
                <JobProjectRow key={j.id} job={j} />
              ))}
            </div>
          </section>
        </>
      ) : !hasJobs ? (
        <Card className="border-dashed p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold md:text-2xl">No projects yet</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Start by submitting a flyer upload or a design request. You can track everything from here once it&apos;s in.
          </p>
          <Button asChild className="mt-6 shadow-glow">
            <Link to="/submit-job">
              <Plus className="mr-1 h-4 w-4" />
              Submit your first project
            </Link>
          </Button>
        </Card>
      ) : null}

      <ExampleFlyersStrip limit={4} />
      <HowItWorks />
    </div>
  );
}
