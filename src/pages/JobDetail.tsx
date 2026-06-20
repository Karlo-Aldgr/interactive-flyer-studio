import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { JobDetailView } from "@/components/dashboard/JobDetailView";
import { DeleteJobDialog } from "@/components/dashboard/DeleteJobDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadUserJobs, type UserJob } from "@/lib/userJobs";
import { customerCanDeleteJob, customerCanEditJob } from "@/lib/customerJobs";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";

export default function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<UserJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    <DashboardShell>
      <DashboardPage maxWidth="3xl">
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
          <>
            {(customerCanEditJob(job) || customerCanDeleteJob(job)) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {customerCanEditJob(job) && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/my-jobs/${job.id}/edit`}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit project
                    </Link>
                  </Button>
                )}
                {customerCanDeleteJob(job) && (
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete project
                  </Button>
                )}
              </div>
            )}
            <JobDetailView job={job} />
            <DeleteJobDialog
              jobId={job.id}
              jobTitle={job.title}
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              onDeleted={() => navigate("/my-jobs")}
            />
          </>
        ) : null}
      </DashboardPage>
    </DashboardShell>
  );
}
