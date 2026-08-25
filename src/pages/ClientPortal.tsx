import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, BarChart3, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fetchCustomerPortalUrl, loadCustomerPortalJobs } from "@/lib/customerPortalLink";
import type { UserJob } from "@/lib/userJobs";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function ClientPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<UserJob[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const ready = await loadCustomerPortalJobs(user.id);
        setJobs(ready);
        if (ready.length === 1 && ready[0].flyer_id) {
          const url = await fetchCustomerPortalUrl(ready[0].flyer_id);
          if (url) {
            window.location.replace(url);
            return;
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not open clients portal");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function openPortal(job: UserJob) {
    if (!job.flyer_id) return;
    setOpeningId(job.id);
    try {
      const url = await fetchCustomerPortalUrl(job.flyer_id);
      if (!url) {
        toast.error("Portal link is not available yet");
        return;
      }
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open clients portal");
    } finally {
      setOpeningId(null);
    }
  }

  if (loading) {
    return (
      <CustomerPortalShell maxWidth="3xl">
        <div className="flex h-40 flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Opening your clients portal…</p>
        </div>
      </CustomerPortalShell>
    );
  }

  if (jobs.length === 0) {
    return (
      <CustomerPortalShell maxWidth="3xl">
        <PageHeader
          title="Clients portal"
          description="View analytics, subscribers, appointments, and more for your live flyer."
        />
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold">Not available yet</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Your clients portal will be available once your flyer is live. Check back after your project is
            paid and unlocked.
          </p>
          <Button asChild className="mt-6">
            <Link to="/my-jobs">View my projects</Link>
          </Button>
        </Card>
      </CustomerPortalShell>
    );
  }

  return (
    <CustomerPortalShell maxWidth="3xl">
      <PageHeader
        title="Clients portal"
        description="Open the analytics portal for one of your live flyers."
      />
      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{job.title}</p>
              <p className="text-sm text-muted-foreground">Analytics, subscribers, appointments & more</p>
            </div>
            <Button
              size="sm"
              onClick={() => openPortal(job)}
              disabled={openingId === job.id}
            >
              {openingId === job.id ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-1 h-4 w-4" />
              )}
              Open portal
            </Button>
          </Card>
        ))}
      </div>
    </CustomerPortalShell>
  );
}
