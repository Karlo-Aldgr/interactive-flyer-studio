import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Loader2, RefreshCw, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProjectPicker } from "@/components/social/ProjectPicker";
import { fetchProjectLibrary, projectMedia, type ProjectLibraryItem } from "@/lib/social/projectLibrary";

import {
  cancelZernioPost,
  createZernioPost,
  deleteZernioPost,
  fetchZernioPosts,
  fetchZernioStatus,
  refreshZernioPost,
  zernioPlatformLabel,
  type ZernioPostRow,
} from "@/lib/zernio";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  published: "default",
  publishing: "secondary",
  scheduled: "secondary",
  draft: "outline",
  failed: "destructive",
  cancelled: "outline",
};

export function ZernioPostRowItem({ post }: { post: ZernioPostRow }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["zernio-posts"] });

  const refresh = useMutation({
    mutationFn: () => refreshZernioPost(post.id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => cancelZernioPost(post.id),
    onSuccess: () => { toast.success("Post cancelled"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteZernioPost(post.id),
    onSuccess: () => { toast.success("Post removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[post.status] ?? "outline"}>{post.status}</Badge>
        {post.platforms.map((p) => (
          <Badge key={p} variant="outline">{zernioPlatformLabel(p)}</Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {post.scheduled_at
            ? `Scheduled ${new Date(post.scheduled_at).toLocaleString()}`
            : post.published_at
            ? `Published ${new Date(post.published_at).toLocaleString()}`
            : new Date(post.created_at).toLocaleString()}
        </span>
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap text-sm">{post.content || "(no caption)"}</p>
      {post.last_error && <p className="text-sm text-destructive">{post.last_error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          {refresh.isPending
            ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Check status
        </Button>
        {["scheduled", "publishing", "draft"].includes(post.status) && (
          <Button size="sm" variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            <X className="mr-2 h-3.5 w-3.5" /> Cancel
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
        </Button>
      </div>
    </div>
  );
}

/** Standalone, filterable list of the signed-in client's Zernio posts. */
export function ZernioPostList({
  statuses,
  emptyMessage = "No posts here yet.",
}: {
  statuses?: string[];
  emptyMessage?: string;
}) {
  const posts = useQuery({ queryKey: ["zernio-posts"], queryFn: fetchZernioPosts });
  const filtered = useMemo(
    () => (posts.data?.posts ?? []).filter((p) => !statuses || statuses.includes(p.status)),
    [posts.data, statuses],
  );

  if (posts.isLoading) return <Skeleton className="h-24 w-full" />;
  if (posts.error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          We couldn't load your posts right now. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      )}
      {filtered.map((p) => <ZernioPostRowItem key={p.id} post={p} />)}
    </div>
  );
}

/** Zernio-backed composer: pick a project, pick accounts, publish or schedule. */
export function ZernioComposer({
  initialJobId,
  extraJobCount = 0,
}: { initialJobId?: string | null; extraJobCount?: number } = {}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [flyer, setFlyer] = useState<ProjectLibraryItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");

  // Projects come from `jobs` (designed flyers AND uploads), never stale.
  const library = useQuery({
    queryKey: ["social-project-library"],
    queryFn: fetchProjectLibrary,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Preselect the project the client came from (My projects → Post to Socials).
  // The incoming id is normally a job id; a flyer id is accepted as a fallback.
  useEffect(() => {
    if (!initialJobId || flyer) return;
    const rows = library.data ?? [];
    const match = rows.find((p) => p.job_id === initialJobId)
      ?? rows.find((p) => p.flyer_id === initialJobId);
    if (match) setFlyer(match);
  }, [initialJobId, library.data, flyer]);

  const status = useQuery({ queryKey: ["zernio-status"], queryFn: fetchZernioStatus, staleTime: 15_000 });
  const posts = useQuery({ queryKey: ["zernio-posts"], queryFn: fetchZernioPosts, staleTime: 10_000 });

  const accounts = useMemo(
    () => (status.data?.accounts ?? []).filter((a) => a.status === "connected"),
    [status.data],
  );
  const limits = status.data?.limits;
  const maxPosts = limits?.plan?.max_posts_per_month ?? 0;
  const usedPosts = limits?.usage.posts_this_month ?? 0;
  const atPostLimit = maxPosts > 0 && usedPosts >= maxPosts;

  const media = useMemo(() => {
    const item = flyer ? projectMedia(flyer) : null;
    return item?.url ? [{ type: item.type, url: item.url }] : [];
  }, [flyer]);


  const publish = useMutation({
    mutationFn: (mode: "draft" | "publish" | "schedule") =>
      createZernioPost({
        mode,
        content,
        title: flyer?.title ?? null,
        media,
        account_ids: selected,
        scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
      }),
    onSuccess: (res) => {
      (res.warnings ?? []).forEach((w) => toast.warning(w));
      toast.success(
        res.post.status === "scheduled"
          ? "Post scheduled"
          : res.post.status === "draft"
          ? "Draft saved"
          : "Sent to your platforms — checking status",
      );
      setContent("");
      setSelected([]);
      setScheduledAt("");
      setFlyer(null);
      queryClient.invalidateQueries({ queryKey: ["zernio-posts"] });
      queryClient.invalidateQueries({ queryKey: ["zernio-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (status.isLoading) return <Skeleton className="h-64 w-full" />;

  if (!status.data?.configured) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Publishing isn't switched on yet. An administrator needs to finish the setup.
        </CardContent>
      </Card>
    );
  }

  const canSubmit = (content.trim().length > 0 || media.length > 0) && !publish.isPending;

  return (
    <div className="space-y-6">
      {atPostLimit && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            You've used all {maxPosts} posts in your plan this month.{" "}
            <Link to="/dashboard/billing" className="underline">Upgrade</Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Choose a project</Label>
            {extraJobCount > 0 && (
              <p className="text-sm text-muted-foreground">
                You selected {extraJobCount + 1} projects. Posts are created one project at a
                time — this one is loaded first, then come back for the others.
              </p>
            )}
            {initialJobId && !flyer && library.isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your selected project…
              </p>
            )}
            {initialJobId && !flyer && !library.isLoading && (
              <p className="text-sm text-muted-foreground">
                We couldn't load that project automatically — pick it below.
              </p>
            )}
            {flyer && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                {media[0]?.url ? (
                  flyer.media_type === "video" ? (
                    <video
                      src={media[0].url}
                      muted
                      playsInline
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <img
                      src={media[0].url}
                      alt={`${flyer.title} media preview`}
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  )
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-md bg-muted text-center text-[11px] text-muted-foreground">
                    No media yet
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Selected project
                  </p>
                  <p className="truncate font-medium">{flyer.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {flyer.kind === "upload" ? "Uploaded project" : "Designed flyer"}
                    {flyer.status ? ` · ${flyer.status}` : ""}
                  </p>
                  {!media[0]?.url && (
                    <p className="text-xs text-destructive">
                      This project has no image yet — open it in the editor and save to generate one.
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setFlyer(null)}
                >
                  Change
                </Button>
              </div>
            )}
            <ProjectPicker
              selectedId={flyer?.job_id ?? null}
              onSelect={setFlyer}
              onClear={() => setFlyer(null)}
            />

          </div>

          <div className="space-y-2">
            <Label htmlFor="zernio-caption">Caption</Label>
            <Textarea
              id="zernio-caption"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post…"
            />
          </div>

          <div className="space-y-2">
            <Label>Post to</Label>
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No connected accounts yet — connect one on the Accounts tab first.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(a.id)}
                    onCheckedChange={(v) =>
                      setSelected((prev) =>
                        v ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                      )}
                  />
                  <span className="font-medium">{zernioPlatformLabel(a.platform)}</span>
                  <span className="truncate text-muted-foreground">
                    {a.account_name || a.username}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zernio-schedule">Schedule for later (optional)</Label>
            <Input
              id="zernio-schedule"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => publish.mutate("publish")}
              disabled={!canSubmit || selected.length === 0 || atPostLimit}
            >
              {publish.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Publish now
            </Button>
            <Button
              variant="outline"
              onClick={() => publish.mutate("schedule")}
              disabled={!canSubmit || selected.length === 0 || !scheduledAt || atPostLimit}
            >
              <CalendarClock className="mr-2 h-4 w-4" /> Schedule
            </Button>
            <Button variant="ghost" onClick={() => publish.mutate("draft")} disabled={!canSubmit}>
              Save draft
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {posts.isLoading && <Skeleton className="h-24 w-full" />}
          {posts.data?.posts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          )}
      {(posts.data?.posts ?? []).map((p) => <ZernioPostRowItem key={p.id} post={p} />)}
        </CardContent>
      </Card>
    </div>
  );
}
