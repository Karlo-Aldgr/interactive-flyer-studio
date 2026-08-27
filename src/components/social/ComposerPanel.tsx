import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Eye, Loader2, Send, Smile, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaPicker } from "./MediaPicker";
import { FlyerPicker } from "./FlyerPicker";
import { TikTokPublishSettings } from "./TikTokPublishSettings";
import { PostPreview } from "./PostPreview";
import { PlatformIcon } from "./PlatformIcon";
import { CAPABILITIES, validateVariant } from "@/lib/social/capabilities";
import { PLATFORM_LABEL } from "@/lib/social/types";
import type { SocialMediaItem, SocialVariant } from "@/lib/social/types";
import {
  fetchFlyerVideos,
  flyerImageMedia,
  type FlyerLibraryItem,
} from "@/lib/social/flyerLibrary";
import {
  generateFlyerCaption,
  publishNow,
  savePost,
  schedulePost,
  syncVariants,
  updateVariant,
} from "@/lib/social/api";
import type { useSocialAccounts } from "@/hooks/useSocialAccounts";

const EMOJIS = ["🎉", "🔥", "✨", "📣", "👀", "❤️", "✅", "📍", "🕒", "💡", "🍽️", "🏡"];

function parseHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}


export function ComposerPanel({ social }: { social: ReturnType<typeof useSocialAccounts> }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hashtagText, setHashtagText] = useState("");
  const [link, setLink] = useState("");
  const [media, setMedia] = useState<SocialMediaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [postId, setPostId] = useState<string | null>(null);
  const [variants, setVariants] = useState<SocialVariant[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<null | "save" | "publish" | "schedule">(null);
  const [showPreview, setShowPreview] = useState(false);
  const [tiktokConfirmed, setTiktokConfirmed] = useState(false);

  const hashtags = useMemo(() => parseHashtags(hashtagText), [hashtagText]);
  const connected = social.accounts.filter((a) => a.connection_status === "connected");
  const tiktokAccounts = connected.filter(
    (a) => a.platform === "tiktok" && selected.includes(a.id),
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  // Keep variant rows aligned with the selected accounts while editing.
  useEffect(() => {
    if (!postId || !selected.length) return;
    const accounts = connected
      .filter((a) => selected.includes(a.id))
      .map((a) => ({ id: a.id, platform: a.platform }));
    syncVariants(postId, accounts, { content, hashtags, media, link_url: link || null })
      .then(setVariants)
      .catch((err) => toast.error(err.message));
    // Only re-sync when the selection or the post changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, selected.join(",")]);

  const persist = async () => {
    if (!content.trim() && media.length === 0) {
      toast.error("Add a caption or media before saving.");
      return null;
    }
    if (!selected.length) {
      toast.error("Select at least one connected account.");
      return null;
    }
    setBusy("save");
    try {
      const post = await savePost({
        id: postId ?? undefined,
        title: title || null,
        content,
        hashtags,
        media,
        link_url: link || null,
      });
      setPostId(post.id);
      const accounts = connected
        .filter((a) => selected.includes(a.id))
        .map((a) => ({ id: a.id, platform: a.platform }));
      const rows = await syncVariants(post.id, accounts, {
        content,
        hashtags,
        media,
        link_url: link || null,
      });
      setVariants(rows);
      return post.id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the post.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    if (tiktokAccounts.length && !tiktokConfirmed) {
      toast.error("Confirm the TikTok upload before publishing.");
      return;
    }
    const id = await persist();
    if (!id) return;
    setBusy("publish");
    try {
      const result = await publishNow(id);
      const failures = (result.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (!failures.length) toast.success("Published to every selected account.");
      else if (failures.length === result.results.length) {
        toast.error(`Publishing failed: ${failures[0].message}`);
      } else {
        toast.warning(`Partially published. ${failures[0].platform}: ${failures[0].message}`);
      }
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleAt) {
      toast.error("Pick a date and time first.");
      return;
    }
    const id = await persist();
    if (!id) return;
    setBusy("schedule");
    try {
      const iso = new Date(scheduleAt).toISOString();
      const result = await schedulePost(id, iso, timezone);
      toast.success(`Scheduled for ${new Date(iso).toLocaleString()} (${timezone}).`);
      if (!result.scheduler_configured) {
        toast.warning(
          "The scheduler worker is not triggered yet — see Settings → Integrations for the cron setup.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule the post.");
    } finally {
      setBusy(null);
    }
  };

  const patchVariant = async (id: string, patch: Partial<SocialVariant>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    try {
      await updateVariant(id, patch);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this variant.");
    }
  };

  if (!connected.length) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-medium">No connected accounts yet</p>
          <p className="text-sm text-muted-foreground">
            Connect at least one account on the Accounts tab before composing a post.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Content</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="post-title">Internal title (optional)</Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Spring open house"
              />
            </div>
            <div>
              <Label htmlFor="post-content">Message</Label>
              <Textarea
                id="post-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Write the post everyone starts from…"
              />
              <div className="mt-1 flex items-center justify-between">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      <Smile className="mr-1 h-4 w-4" /> Emoji
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="grid grid-cols-6 gap-1">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="rounded p-1 text-lg hover:bg-muted"
                          onClick={() => setContent((c) => c + e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">{content.length} characters</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="post-link">Link (optional)</Label>
                <Input
                  id="post-link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://tapthatflyer.com/f/your-flyer"
                />
              </div>
              <div>
                <Label htmlFor="post-tags">Hashtags</Label>
                <Input
                  id="post-tags"
                  value={hashtagText}
                  onChange={(e) => setHashtagText(e.target.value)}
                  placeholder="openhouse realestate"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {tiktokAccounts.map((account) => (
          <TikTokPublishSettings
            key={account.id}
            account={account}
            confirmed={tiktokConfirmed}
            onConfirmedChange={setTiktokConfirmed}
          />
        ))}

        <Card>
          <CardHeader><CardTitle className="text-base">Media</CardTitle></CardHeader>
          <CardContent>
            <MediaPicker media={media} onChange={setMedia} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Platforms &amp; accounts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {connected.map((account) => {
              const cap = CAPABILITIES[account.platform];
              const issues = validateVariant(account.platform, {
                caption: content,
                hashtags,
                link: link || null,
                media,
              });
              const blocking = issues.filter((i) => i.field !== "link");
              return (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={selected.includes(account.id)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked ? [...prev, account.id] : prev.filter((id) => id !== account.id)
                      )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <PlatformIcon platform={account.platform} />
                      {account.account_name || PLATFORM_LABEL[account.platform]}
                      {cap.maxCharacters && (
                        <Badge variant="outline" className="text-[10px]">
                          max {cap.maxCharacters}
                        </Badge>
                      )}
                    </p>
                    {account.platform === "tiktok" &&
                      !(account.scopes ?? []).includes("video.publish") && (
                      <p className="mt-1 text-xs text-amber-600">
                        TikTok direct publishing is pending TikTok app approval.
                      </p>
                    )}
                    {issues.map((issue) => (
                      <p
                        key={issue.field + issue.message}
                        className={`mt-1 text-xs ${
                          blocking.includes(issue) ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {issue.message}
                      </p>
                    ))}

                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {variants.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Per-platform variants</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue={variants[0].id}>
                <TabsList className="flex-wrap">
                  {variants.map((v) => (
                    <TabsTrigger key={v.id} value={v.id} className="gap-1">
                      <PlatformIcon platform={v.platform} className="h-3.5 w-3.5" />
                      {PLATFORM_LABEL[v.platform]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {variants.map((v) => {
                  const cap = CAPABILITIES[v.platform];
                  const issues = validateVariant(v.platform, {
                    caption: v.caption,
                    hashtags: v.hashtags,
                    link: v.link_url,
                    media: v.media,
                  });
                  return (
                    <TabsContent key={v.id} value={v.id} className="space-y-3 pt-3">
                      <Textarea
                        rows={5}
                        value={v.caption}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x) => (x.id === v.id ? { ...x, caption: e.target.value } : x))
                          )}
                        onBlur={(e) => patchVariant(v.id, { caption: e.target.value })}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{cap.notes}</span>
                        <span>
                          {v.caption.length}
                          {cap.maxCharacters ? ` / ${cap.maxCharacters}` : ""}
                        </span>
                      </div>
                      <Input
                        value={v.hashtags.join(" ")}
                        placeholder="Hashtags for this platform"
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, hashtags: parseHashtags(e.target.value) } : x
                            )
                          )}
                        onBlur={(e) => patchVariant(v.id, { hashtags: parseHashtags(e.target.value) })}
                      />
                      {cap.links
                        ? (
                          <Input
                            value={v.link_url ?? ""}
                            placeholder="Link for this platform"
                            onChange={(e) =>
                              setVariants((prev) =>
                                prev.map((x) => (x.id === v.id ? { ...x, link_url: e.target.value } : x))
                              )}
                            onBlur={(e) => patchVariant(v.id, { link_url: e.target.value || null })}
                          />
                        )
                        : (
                          <p className="text-xs text-muted-foreground">
                            {PLATFORM_LABEL[v.platform]} does not support clickable links, so the link
                            field is disabled here.
                          </p>
                        )}
                      <MediaPicker
                        media={v.media}
                        onChange={(next) => patchVariant(v.id, { media: next })}
                      />
                      {issues.map((i) => (
                        <p key={i.message} className="text-xs text-destructive">{i.message}</p>
                      ))}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Publishing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="schedule-at">Schedule for ({timezone})</Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePublish} disabled={busy !== null}>
                {busy === "publish"
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Send className="mr-2 h-4 w-4" />}
                Publish Now
              </Button>
              <Button variant="secondary" onClick={handleSchedule} disabled={busy !== null}>
                {busy === "schedule"
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <CalendarClock className="mr-2 h-4 w-4" />}
                Schedule Post
              </Button>
              <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Hide preview" : "Preview"}
              </Button>
              <Button variant="ghost" onClick={persist} disabled={busy !== null}>
                {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`space-y-3 ${showPreview ? "" : "hidden lg:block"}`}>
        <h3 className="text-sm font-semibold text-muted-foreground">Previews</h3>
        {selected.length === 0 && (
          <p className="text-sm text-muted-foreground">Select an account to see a preview.</p>
        )}
        {connected
          .filter((a) => selected.includes(a.id))
          .map((account) => {
            const variant = variants.find((v) => v.social_account_id === account.id);
            return (
              <PostPreview
                key={account.id}
                platform={account.platform}
                accountName={account.account_name || PLATFORM_LABEL[account.platform]}
                caption={variant?.caption ?? content}
                hashtags={variant?.hashtags ?? hashtags}
                link={variant?.link_url ?? (link || null)}
                media={variant?.media ?? media}
              />
            );
          })}
      </div>
    </div>
  );
}
