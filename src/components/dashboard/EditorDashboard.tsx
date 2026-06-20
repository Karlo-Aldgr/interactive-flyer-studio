import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Plus,
  BarChart3,
  ExternalLink,
  MoreVertical,
  Trash2,
  Copy,
  Pencil,
  Loader2,
  FileText,
  Briefcase,
  PartyPopper,
  Globe,
  FilePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Flyer } from "@/types/flyer";
import { greetingName } from "@/lib/displayName";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EditorJobQueue } from "@/components/dashboard/EditorJobQueue";

type StatusFilter = "all" | "published" | "draft";

type EditorDashboardProps = {
  flyers: Flyer[];
  loading: boolean;
  creating: boolean;
  userEmail?: string | null;
  onOpenCreate: () => void;
  onRemove: (id: string) => void;
  onDuplicate: (flyer: Flyer) => void;
  onCopyLink: (slug: string | null) => void;
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

export function EditorDashboard({
  flyers,
  loading,
  creating,
  userEmail,
  onOpenCreate,
  onRemove,
  onDuplicate,
  onCopyLink,
}: EditorDashboardProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const displayGreeting = greetingName(userEmail);

  const stats = useMemo(
    () => ({
      total: flyers.length,
      published: flyers.filter((f) => f.status === "published").length,
      draft: flyers.filter((f) => f.status === "draft").length,
    }),
    [flyers]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return flyers;
    return flyers.filter((f) => f.status === filter);
  }, [flyers, filter]);

  const filters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "published", label: "Published", count: stats.published },
    { value: "draft", label: "Draft", count: stats.draft },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <PageHeader
        title={displayGreeting}
        description="Your design studio — create, publish, and share interactive TapFlyers."
        actions={
          <Button onClick={onOpenCreate} disabled={creating} className="w-full shadow-glow sm:w-auto">
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            New flyer
          </Button>
        }
      />

      <EditorJobQueue flyers={flyers} />

      {!loading && flyers.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total flyers" value={stats.total} icon={FilePen} />
            <StatCard label="Published" value={stats.published} icon={Globe} />
            <StatCard label="Drafts" value={stats.draft} icon={FileText} />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  filter === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-70">({count})</span>
              </button>
            ))}
          </div>
        </>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Your TapFlyers</h2>
          {!loading && filtered.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "flyer" : "flyers"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : flyers.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="font-display text-lg font-semibold">No flyers yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create your first interactive TapFlyer — add links, forms, video, and more, then publish with one shareable link.
            </p>
            <Button onClick={onOpenCreate} disabled={creating} className="mt-2 shadow-glow">
              <Plus className="mr-1 h-4 w-4" />
              Create your first flyer
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed py-16 text-center text-sm text-muted-foreground">
            No {filter} flyers.{" "}
            <button type="button" onClick={() => setFilter("all")} className="text-primary underline-offset-4 hover:underline">
              Show all
            </button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((f) => (
              <Card key={f.id} className="group overflow-hidden transition hover:shadow-elegant">
                <Link to={`/editor/${f.id}`} className="block">
                  <div className="relative aspect-[3/4] gradient-canvas border-b border-border">
                    {(f.thumbnail_url || (f as any)._pageImageFallback) ? (
                      <img
                        src={f.thumbnail_url || (f as any)._pageImageFallback}
                        alt={f.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const fallback = (f as any)._pageImageFallback;
                          const el = e.currentTarget as HTMLImageElement;
                          if (fallback && el.src !== fallback) el.src = fallback;
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        f.status === "published"
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {f.status}
                    </span>
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
                      {f.category === "event" ? (
                        <PartyPopper className="h-3 w-3" />
                      ) : (
                        <Briefcase className="h-3 w-3" />
                      )}
                      {f.category === "event" ? "Event" : "Business"}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{f.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.category === "event" && f.event_date ? (
                        <>Event {format(new Date(f.event_date + "T00:00:00"), "MMM d, yyyy")}</>
                      ) : (
                        <>Updated {new Date(f.updated_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/editor/${f.id}`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/analytics/${f.id}`)}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Analytics
                      </DropdownMenuItem>
                      {f.public_slug && (
                        <>
                          <DropdownMenuItem onClick={() => onCopyLink(f.public_slug)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/f/${f.public_slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </a>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => onDuplicate(f)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRemove(f.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
