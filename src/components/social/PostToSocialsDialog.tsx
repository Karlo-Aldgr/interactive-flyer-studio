import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformIcon } from "./PlatformIcon";
import { SOCIAL_PLATFORMS, PLATFORM_LABEL } from "@/lib/social/types";
import type { SocialPlatform } from "@/lib/social/types";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import { bulkPostToSocials, type BulkResponse } from "@/lib/social/bulk";

type Project = { id: string; title: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onPosted?: () => void;
};

export function PostToSocialsDialog({ open, onOpenChange, projects, onPosted }: Props) {
  const social = useSocialAccounts("/my-jobs");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [report, setReport] = useState<BulkResponse | null>(null);

  const connected = useMemo(
    () => social.accounts.filter((a) => a.connection_status !== "revoked"),
    [social.accounts],
  );
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const missing = SOCIAL_PLATFORMS.filter(
    (p) => !connected.some((a) => a.platform === p),
  ) as SocialPlatform[];

  // Default to every connected account so "Post Now" posts the checked
  // projects to all of the customer's socials without extra clicks.
  useEffect(() => {
    if (!open) return;
    setSelected((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const a of connected) {
        if (next[a.id] === undefined) {
          next[a.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, connected]);


  const post = async () => {
    setPosting(true);
    try {
      const response = await bulkPostToSocials(projects.map((p) => p.id), selectedIds);
      setReport(response);
      if (response.published) toast.success(`${response.published} post(s) published`);
      if (response.failed) toast.error(`${response.failed} post(s) failed — see details`);
      onPosted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setPosting(false);
    }
  };

  const close = (next: boolean) => {
    if (!next) setReport(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Post to Socials</DialogTitle>
          <DialogDescription>
            {projects.length} project{projects.length === 1 ? "" : "s"} selected
          </DialogDescription>
        </DialogHeader>

        {report
          ? (
            <ScrollArea className="max-h-[50vh] pr-3">
              <div className="space-y-2">
                {report.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border/60 p-2 text-sm"
                  >
                    {r.ok
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {r.job_title ?? "Project"}
                        {r.platform ? ` · ${PLATFORM_LABEL[r.platform]}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.ok ? "Published" : "Couldn't publish — please try again."}
                      </p>

                    </div>
                    {r.ok && r.remote_post_url && (
                      <a
                        href={r.remote_post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        View <ExternalLink className="inline h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )
          : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Projects</p>
                <ScrollArea className="max-h-28 rounded-md border border-border/60 p-2">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {projects.map((p) => <li key={p.id} className="truncate">✓ {p.title}</li>)}
                  </ul>
                </ScrollArea>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Publish to</p>
                <div className="space-y-2">
                  {connected.map((account) => (
                    <label
                      key={account.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 p-2"
                    >
                      <Checkbox
                        checked={!!selected[account.id]}
                        onCheckedChange={(v) =>
                          setSelected((s) => ({ ...s, [account.id]: v === true }))}
                      />
                      <PlatformIcon platform={account.platform} className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {PLATFORM_LABEL[account.platform]}
                        <span className="text-muted-foreground">
                          {account.account_name ? ` · ${account.account_name}` : ""}
                        </span>
                      </span>
                      {account.connection_status === "connected"
                        ? <Badge variant="outline" className="shrink-0">🟢 Connected</Badge>
                        : <Badge variant="secondary" className="shrink-0">⚠ Needs attention</Badge>}
                    </label>
                  ))}

                  {missing.map((platform) => (
                    <div
                      key={platform}
                      className="flex items-center gap-3 rounded-md border border-dashed border-border/60 p-2"
                    >
                      <PlatformIcon platform={platform} className="h-4 w-4 opacity-60" />
                      <span className="flex-1 text-sm text-muted-foreground">
                        {PLATFORM_LABEL[platform]} · Not connected
                      </span>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/dashboard/social">Connect</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        <DialogFooter>
          {report
            ? <Button onClick={() => close(false)}>Done</Button>
            : (
              <>
                <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
                <Button
                  onClick={post}
                  disabled={posting || !selectedIds.length || !projects.length}
                >
                  {posting
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Send className="mr-2 h-4 w-4" />}
                  Post Now
                </Button>
              </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
