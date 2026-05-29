import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ArrowLeft, ExternalLink, Eye } from "lucide-react";
import logo from "@/assets/logo.png";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import { format } from "date-fns";
import { getJobUploadSignedUrl } from "@/lib/jobUploads";
import { toast } from "sonner";


const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  new:           { label: "New",            className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  reviewing:     { label: "Reviewing",      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  quoted:        { label: "Quote sent",     className: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  paid:          { label: "Paid",           className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  in_progress:   { label: "In progress",    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  preview_ready: { label: "Preview ready",  className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  delivered:     { label: "Delivered",      className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  cancelled:     { label: "Cancelled",      className: "bg-muted text-muted-foreground" },
};

const labelFor = (id: string) => INTERACTIONS.find((i) => i.id === id)?.label ?? id;
const formatPrice = (cents?: number | null) =>
  typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : null;

export default function MyJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, flyer:flyers(public_slug, status)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error) setJobs(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-9 w-auto" />
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Link></Button>
            <Button asChild size="sm"><Link to="/submit-job"><Plus className="mr-1 h-4 w-4" />New job</Link></Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-10">
        <h1 className="font-display text-3xl font-bold md:text-4xl">My jobs</h1>
        <p className="mt-2 text-muted-foreground">Track your submitted requests, quotes and final flyers.</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : jobs.length === 0 ? (
          <Card className="mt-8 p-10 text-center">
            <p className="text-muted-foreground">You haven't submitted any jobs yet.</p>
            <Button asChild className="mt-4"><Link to="/submit-job"><Plus className="mr-1 h-4 w-4" />Submit your first job</Link></Button>
          </Card>
        ) : (
          <div className="mt-8 space-y-4">
            {jobs.map((j) => {
              const sv = STATUS_VARIANT[j.status] ?? STATUS_VARIANT.new;
              const price = formatPrice(j.price_cents);
              return (
                <Card key={j.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{j.title}</h3>
                        <Badge className={sv.className}>{sv.label}</Badge>
                        <Badge variant="outline">{j.type === "upload" ? "Upload" : "Design"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {format(new Date(j.created_at), "PPp")}
                      </p>
                      {j.brief && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{j.brief}</p>}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(j.selected_actions ?? []).map((id: string) => (
                          <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs">{labelFor(id)}</span>
                        ))}
                      </div>
                      {j.admin_notes && (
                        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                          <div className="font-medium mb-1">Note from our team</div>
                          <div className="text-muted-foreground whitespace-pre-wrap">{j.admin_notes}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {price && <div className="font-display text-2xl font-bold">{price}</div>}
                      {j.payment_link && (
                        <Button asChild size="sm" className="shadow-glow">
                          <a href={j.payment_link} target="_blank" rel="noreferrer">
                            Pay now <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {j.upload_url && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const url = await getJobUploadSignedUrl(j.upload_url);
                          if (!url) return toast.error("Could not open upload");
                          window.open(url, "_blank", "noreferrer");
                        }}>View upload</Button>
                      )}

                      {j.preview_ready && j.flyer?.public_slug && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`/f/${j.flyer.public_slug}`} target="_blank" rel="noreferrer">
                            <Eye className="mr-1 h-3.5 w-3.5" />Preview
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
