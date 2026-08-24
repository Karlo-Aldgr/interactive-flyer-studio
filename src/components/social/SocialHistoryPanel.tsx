import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlatformIcon } from "./PlatformIcon";
import { PLATFORM_LABEL, SOCIAL_PLATFORMS } from "@/lib/social/types";
import type { SocialPlatform } from "@/lib/social/types";
import { publishNow } from "@/lib/social/api";

type HistoryRow = {
  id: string;
  post_id: string;
  platform: SocialPlatform;
  caption: string;
  status: string;
  remote_post_id: string | null;
  remote_post_url: string | null;
  published_at: string | null;
  last_error: string | null;
  created_at: string;
  post: { title: string | null; content: string } | null;
  account: { account_name: string | null; username: string | null } | null;
};

const STATUS_TONE: Record<string, string> = {
  published: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  failed: "border-destructive/50 text-destructive",
  publishing: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  queued: "border-border",
};

const STATUS_ICON: Record<string, string> = {
  published: "✓",
  failed: "✕",
  publishing: "⏳",
  queued: "⏳",
};

/** Full posting history with filters and per-row retry. */
export function SocialHistoryPanel() {
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ["social-history"],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from("social_post_variants")
        .select(
          "*, post:social_posts(title, content), account:social_accounts(account_name, username)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (history.data ?? []).filter((r) => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (status !== "all" && r.status !== status) return false;
      if (since && new Date(r.created_at) < new Date(since)) return false;
      if (term) {
        const haystack = `${r.post?.title ?? ""} ${r.caption}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [history.data, platform, status, search, since]);

  const retry = async (row: HistoryRow) => {
    setRetrying(row.id);
    try {
      await publishNow(row.post_id, [row.id]);
      toast.success("Retry sent");
      history.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {SOCIAL_PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Pending</SelectItem>
            <SelectItem value="publishing">Processing</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search project or caption"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
      </div>

      {history.isLoading
        ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
        : rows.length === 0
        ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No posting history matches these filters yet.
            </CardContent>
          </Card>
        )
        : (
          <div className="space-y-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-start gap-3 p-4">
                  <PlatformIcon platform={row.platform} className="mt-1 h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {row.post?.title || "Untitled project"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PLATFORM_LABEL[row.platform]}
                      {row.account?.account_name ? ` · ${row.account.account_name}` : ""}
                      {" · "}
                      {new Date(row.published_at ?? row.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.caption}</p>
                    {row.last_error && (
                      <p className="mt-1 text-xs text-destructive">
                        This post didn't go out. Please try again.
                      </p>
                    )}

                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant="outline" className={STATUS_TONE[row.status] ?? ""}>
                      {STATUS_ICON[row.status] ?? ""} {row.status}
                    </Badge>
                    {row.remote_post_url && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={row.remote_post_url} target="_blank" rel="noreferrer">
                          View post <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {row.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retrying === row.id}
                        onClick={() => retry(row)}
                      >
                        {retrying === row.id
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : <RotateCcw className="mr-1 h-3 w-3" />}
                        Retry
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
