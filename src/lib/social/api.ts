import { supabase } from "@/integrations/supabase/client";
import type {
  IntegrationStatusResponse,
  PostWithVariants,
  SocialAccount,
  SocialMediaItem,
  SocialPlatform,
  SocialPost,
  SocialVariant,
} from "./types";

/** Tokens never reach the browser: this RPC returns metadata columns only. */
export async function fetchAccounts(): Promise<SocialAccount[]> {
  const { data, error } = await supabase.rpc("my_social_accounts");
  if (error) throw error;
  return (data ?? []) as unknown as SocialAccount[];
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatusResponse> {
  const { data, error } = await supabase.functions.invoke("social-accounts", {
    body: { action: "status" },
  });
  if (error) throw error;
  return data as IntegrationStatusResponse;
}

export async function startConnect(platform: SocialPlatform, redirectPath = "/dashboard/social") {
  const { data, error } = await supabase.functions.invoke("social-oauth-start", {
    body: { platform, redirect_path: redirectPath },
  });
  if (error) throw error;
  if (!data?.authorize_url) throw new Error(data?.error || "Could not start the connection.");
  return data.authorize_url as string;
}

export async function accountAction(
  action: "sync" | "refresh" | "disconnect",
  accountId: string,
) {
  const { data, error } = await supabase.functions.invoke("social-accounts", {
    body: { action, account_id: accountId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------------------------------------------------------------- posts ----

export async function fetchPosts(filter: {
  statuses?: string[];
  scheduled?: boolean;
}): Promise<PostWithVariants[]> {
  let query = supabase
    .from("social_posts")
    .select("*, variants:social_post_variants(*)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter.statuses?.length) query = query.in("status", filter.statuses as never[]);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PostWithVariants[];
}

export async function fetchPost(id: string): Promise<PostWithVariants | null> {
  const { data, error } = await supabase
    .from("social_posts")
    .select("*, variants:social_post_variants(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PostWithVariants) ?? null;
}

export type SavePostInput = {
  id?: string;
  title?: string | null;
  content: string;
  link_url?: string | null;
  hashtags: string[];
  media: SocialMediaItem[];
  flyer_id?: string | null;
  scheduled_at?: string | null;
  schedule_timezone?: string | null;
};

export async function savePost(input: SavePostInput): Promise<SocialPost> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in required");
  const row = {
    user_id: auth.user.id,
    title: input.title ?? null,
    content: input.content,
    link_url: input.link_url ?? null,
    hashtags: input.hashtags,
    media: input.media as never,
    flyer_id: input.flyer_id ?? null,
    scheduled_at: input.scheduled_at ?? null,
    schedule_timezone: input.schedule_timezone ?? null,
  };
  const query = input.id
    ? supabase.from("social_posts").update(row).eq("id", input.id).select("*").single()
    : supabase.from("social_posts").insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as SocialPost;
}

/**
 * Creates/updates the persisted variants for the selected accounts. Existing
 * variants keep their independently edited caption/media.
 */
export async function syncVariants(
  postId: string,
  accounts: { id: string; platform: SocialPlatform }[],
  master: { content: string; hashtags: string[]; media: SocialMediaItem[]; link_url: string | null },
): Promise<SocialVariant[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in required");

  const { data: existing, error: readError } = await supabase
    .from("social_post_variants")
    .select("*")
    .eq("post_id", postId);
  if (readError) throw readError;

  const keep = new Set(accounts.map((a) => a.id));
  const stale = (existing ?? []).filter((v) => !keep.has(v.social_account_id ?? ""));
  if (stale.length) {
    await supabase
      .from("social_post_variants")
      .delete()
      .in("id", stale.map((v) => v.id))
      .in("status", ["draft", "queued", "cancelled", "failed"]);
  }

  const have = new Set((existing ?? []).map((v) => v.social_account_id ?? ""));
  const inserts = accounts
    .filter((a) => !have.has(a.id))
    .map((a) => ({
      post_id: postId,
      user_id: auth.user!.id,
      social_account_id: a.id,
      platform: a.platform,
      caption: master.content,
      hashtags: master.hashtags,
      media: master.media as never,
      link_url: master.link_url,
    }));
  if (inserts.length) {
    const { error } = await supabase.from("social_post_variants").insert(inserts);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("social_post_variants")
    .select("*")
    .eq("post_id", postId);
  if (error) throw error;
  return (data ?? []) as unknown as SocialVariant[];
}

export async function updateVariant(id: string, patch: Partial<SocialVariant>) {
  const { error } = await supabase
    .from("social_post_variants")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function publishNow(postId: string, variantIds?: string[]) {
  const { data, error } = await supabase.functions.invoke("social-publish", {
    body: { action: "publish_now", post_id: postId, variant_ids: variantIds },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function schedulePost(postId: string, scheduledAtIso: string, timezone: string) {
  const { data, error } = await supabase.functions.invoke("social-publish", {
    body: { action: "schedule", post_id: postId, scheduled_at: scheduledAtIso, timezone },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function cancelPost(postId: string) {
  const { data, error } = await supabase.functions.invoke("social-publish", {
    body: { action: "cancel", post_id: postId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function refreshRemoteStatus(variantId: string, action: "refresh" | "delete" = "refresh") {
  const { data, error } = await supabase.functions.invoke("social-post-status", {
    body: { action, variant_id: variantId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function syncAnalytics(scope: { post_id?: string; variant_id?: string } = {}) {
  const { data, error } = await supabase.functions.invoke("social-analytics-sync", { body: scope });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// --------------------------------------------------------------- assets ----

const MAX_BYTES = 200 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function validateAsset(file: File): string | null {
  const allowed = [...IMAGE_TYPES, ...VIDEO_TYPES];
  if (!allowed.includes(file.type)) {
    return `${file.name}: unsupported file type (${file.type || "unknown"}).`;
  }
  if (file.size > MAX_BYTES) return `${file.name}: files must be under 200 MB.`;
  return null;
}

/** Uploads to the private social-assets bucket and records the asset row. */
export async function uploadAsset(file: File): Promise<SocialMediaItem> {
  const problem = validateAsset(file);
  if (problem) throw new Error(problem);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in required");

  const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "video" ? "mp4" : "jpg");
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("social-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data: asset, error } = await supabase
    .from("social_media_assets")
    .insert({
      user_id: auth.user.id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      byte_size: file.size,
      kind,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { type: kind, path, mime_type: file.type, asset_id: asset.id, file_name: file.name };
}

/** Short-lived signed URL so private assets can be previewed in the composer. */
export async function assetPreviewUrl(item: SocialMediaItem): Promise<string | null> {
  if (item.url) return item.url;
  if (!item.path) return null;
  const { data } = await supabase.storage.from("social-assets").createSignedUrl(item.path, 3600);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------------------ analytics ----

export type AnalyticsRow = {
  id: string;
  post_id: string;
  variant_id: string;
  platform: SocialPlatform;
  captured_at: string;
  impressions: number | null;
  reach: number | null;
  engagements: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  video_views: number | null;
};

export async function fetchAnalytics(sinceIso: string): Promise<AnalyticsRow[]> {
  const { data, error } = await supabase
    .from("social_post_analytics")
    .select("*")
    .gte("captured_at", sinceIso)
    .order("captured_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as AnalyticsRow[];
}

export async function fetchScheduledJobs() {
  const { data, error } = await supabase
    .from("social_publish_jobs")
    .select("*")
    .in("status", ["pending", "locked", "running", "failed"])
    .order("due_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
