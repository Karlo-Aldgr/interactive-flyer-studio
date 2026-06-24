import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CustomerPortalShell } from "@/components/portal-customer/CustomerPortalShell";
import { JobDetailView } from "@/components/dashboard/JobDetailView";
import { JobBillingActivationPanel } from "@/components/dashboard/JobBillingActivationPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadUserJobs, type UserJob } from "@/lib/userJobs";
import { customerCanEditJob } from "@/lib/customerJobs";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";

export default function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<UserJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !jobId) return;
    (async () => {
      setLoading(true);
      const { jobs, error } = await loadUserJobs(user.id, { jobId });
      if (error) {
        toast.error(error.message || "Could not load project");
        setLoading(false);
        return;
      }
      if (jobs.length === 0) {
        setNotFound(true);
        setJob(null);
      } else {
        setJob(jobs[0]);
        setNotFound(false);
      }
      setLoading(false);
    })();
  }, [user, jobId]);

  return (
    <CustomerPortalShell maxWidth="3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 sm:mb-6">
        <Link to="/my-jobs">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All projects
        </Link>
      </Button>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : notFound ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">Project not found.</p>
          <Button asChild className="mt-4">
            <Link to="/my-jobs">Back to projects</Link>
          </Button>
        </Card>
      ) : job ? (
        <div className="space-y-6">
          {customerCanEditJob(job) && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/my-jobs/${job.id}/edit`}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit project
                </Link>
              </Button>
            </div>
          )}
          <JobBillingActivationPanel
            job={job}
            onJobChanged={(patch) => setJob((j) => (j ? { ...j, ...patch } : j))}
          />
          <JobDetailView job={job} />
        </div>
      ) : null}
    </CustomerPortalShell>
  );
}
