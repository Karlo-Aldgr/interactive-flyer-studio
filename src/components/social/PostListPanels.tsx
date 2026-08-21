import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "./PlatformIcon";
import { cancelPost, fetchPosts, publishNow, refreshRemoteStatus } from "@/lib/social/api";
import { PLATFORM_LABEL } from "@/lib/social/types";
import type { PostWithVariants } from "@/lib/social/types";

function VariantRow({
  variant,
  onChanged,
}: {
  variant: PostWithVariants["variants"][number];
  onChanged: () => void;
}) {
  const act = async (action: "refresh" | "delete" | "retry") => {
    try {
      if (action === "retry") await publishNow(variant.post_id, [variant.id]);
      else await refreshRemoteStatus(variant.id, action);
      toast.success("Done");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <PlatformIcon platform={variant.platform} />
      <span className="font-medium">{PLATFORM_LABEL[variant.platform]}</span>
      <Badge variant={variant.status === "published" ? "default" : variant.status === "failed" ? "destructive" : "secondary"}>
        {variant.status}
      </Badge>
      {variant.published_at && (
        <span className="text-xs text-muted-foreground">
          {new Date(variant.published_at).toLocaleString()}
        </span>
      )}
      {variant.remote_post_url && (
        <a
          href={variant.remote_post_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline"
        >
          View on platform
        </a>
      )}
      {variant.last_error && (
        <span className="w-full text-xs text-destructive">{variant.last_error}</span>
      )}
      <div className="ml-auto flex gap-1">
        {variant.status === "failed" && (
          <Button size="sm" variant="outline" onClick={() => act("retry")}>Retry</Button>
        )}
        {variant.status === "published" && (
          <>
            <Button size="sm" variant="ghost" onClick={() => act("refresh")} title="Refresh status">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act("delete")} title="Delete on platform">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function PostList({
  statuses,
  emptyTitle,
  emptyBody,
  showCancel,
}: {
  statuses: string[];
  emptyTitle: string;
  emptyBody: string;
  showCancel?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["social-posts", statuses.join(",")],
    queryFn: () => fetchPosts({ statuses }),
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (error) {
    return <p className="p-4 text-sm text-destructive">{(error as Error).message}</p>;
  }
  if (!data?.length) {
    return (
      <Card>
        <CardContent className="space-y-1 p-6 text-center">
          <p className="font-medium">{emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{emptyBody}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((post) => (
        <Card key={post.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 font-medium">{post.title || post.content.slice(0, 60) || "Untitled post"}</p>
              <Badge variant="outline">{post.status}</Badge>
              {post.scheduled_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(post.scheduled_at).toLocaleString()} ({post.schedule_timezone})
                </span>
              )}
              {showCancel && ["queued", "draft"].includes(post.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await cancelPost(post.id);
                      toast.success("Schedule cancelled");
                      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not cancel");
                    }
                  }}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{post.content}</p>
            <div className="space-y-2">
              {post.variants.map((v) => (
                <VariantRow key={v.id} variant={v} onChanged={() => refetch()} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ScheduledPanel() {
  return (
    <PostList
      statuses={["draft", "queued", "publishing"]}
      emptyTitle="Nothing scheduled"
      emptyBody="Compose a post and choose Schedule Post to queue it."
      showCancel
    />
  );
}

export function PublishedPanel() {
  return (
    <PostList
      statuses={["published", "partially_published", "failed", "cancelled"]}
      emptyTitle="No published posts yet"
      emptyBody="Published posts and their per-platform results appear here."
    />
  );
}
