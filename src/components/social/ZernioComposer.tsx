import { useMemo, useState } from "react";
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
import { FlyerPicker } from "@/components/social/FlyerPicker";
import { flyerImageMedia, type FlyerLibraryItem } from "@/lib/social/flyerLibrary";
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

export function ZernioPostRow({ post }: { post: ZernioPostRow }) {
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

/** Zernio-backed composer: pick a project, pick accounts, publish or schedule. */
export function ZernioComposer() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [flyer, setFlyer] = useState<FlyerLibraryItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");

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
    const item = flyer ? flyerImageMedia(flyer) : null;
    return item?.url ? [{ type: "image", url: item.url }] : [];
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
            <FlyerPicker
              selectedId={flyer?.flyer_id ?? null}
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
          {(posts.data?.posts ?? []).map((p) => <PostRow key={p.id} post={p} />)}
        </CardContent>
      </Card>
    </div>
  );
}
