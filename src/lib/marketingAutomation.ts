import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { buildMarketingPublicUrl } from "@/lib/utils";
import { toast } from "sonner";

async function resolveMarketingLandingIds(flyerId: string): Promise<{
  landingPageId: string | null;
  openPageId: string | null;
}> {
  const { data: pages } = await supabase
    .from("pages")
    .select("id, background")
    .eq("flyer_id", flyerId);

  for (const page of pages ?? []) {
    const background = page.background as { linkPageId?: string | null } | null;
    const openPageId = background?.linkPageId ?? null;
    if (openPageId) {
      return { landingPageId: page.id, openPageId };
    }
  }
  return { landingPageId: null, openPageId: null };
}

export type MarketingGenStatus = "pending" | "processing" | "ready" | "failed";
export type MarketingChannelStatus = "draft" | "scheduled" | "posted" | "failed";
export type MarketingChannel = "facebook" | "instagram";
export type MarketingProviderStatus = "not_connected" | "connected" | "ready" | "posting" | "posted" | "failed";

export type MetaConnection = {
  id: string;
  user_id: string;
  provider: string;
  meta_app_id: string | null;
  connection_mode: string;
  status: "not_connected" | "connected" | "ready" | "error";
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  instagram_user_id: string | null;
  instagram_username: string | null;
  page_access_token_last4: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingDraft = {
  id: string;
  flyer_id: string;
  owner_id: string;
  status: MarketingGenStatus;
  flyer_title: string | null;
  flyer_url: string | null;
  thumbnail_url: string | null;
  facebook_post: string | null;
  instagram_caption: string | null;
  error_message: string | null;
  facebook_status: MarketingChannelStatus;
  instagram_status: MarketingChannelStatus;
  facebook_scheduled_for: string | null;
  instagram_scheduled_for: string | null;
  facebook_posted_at: string | null;
  instagram_posted_at: string | null;
  facebook_error_message: string | null;
  facebook_provider_status: MarketingProviderStatus;
  facebook_provider_post_id: string | null;
  facebook_last_attempt_at: string | null;
  facebook_last_error: string | null;
  instagram_error_message: string | null;
  instagram_provider_status: MarketingProviderStatus;
  instagram_provider_post_id: string | null;
  instagram_last_attempt_at: string | null;
  instagram_last_error: string | null;
  created_at: string;
  updated_at: string;
};

function asChannelStatus(value: string | null | undefined): MarketingChannelStatus {
  if (value === "scheduled" || value === "posted" || value === "failed") return value;
  return "draft";
}

function asProviderStatus(value: string | null | undefined): MarketingProviderStatus {
  if (value === "connected" || value === "ready" || value === "posting" || value === "posted" || value === "failed") {
    return value;
  }
  return "not_connected";
}

function normalizeMetaConnection(row: Record<string, unknown>): MetaConnection {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    provider: String(row.provider ?? "meta"),
    meta_app_id: (row.meta_app_id as string | null) ?? null,
    connection_mode: String(row.connection_mode ?? "manual_test"),
    status: (row.status as MetaConnection["status"]) || "not_connected",
    facebook_page_id: (row.facebook_page_id as string | null) ?? null,
    facebook_page_name: (row.facebook_page_name as string | null) ?? null,
    instagram_user_id: (row.instagram_user_id as string | null) ?? null,
    instagram_username: (row.instagram_username as string | null) ?? null,
    page_access_token_last4: (row.page_access_token_last4 as string | null) ?? null,
    last_error: (row.last_error as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeDraft(row: Record<string, unknown>): MarketingDraft {
  return {
    id: String(row.id),
    flyer_id: String(row.flyer_id),
    owner_id: String(row.owner_id),
    status: (row.status as MarketingGenStatus) || "pending",
    flyer_title: (row.flyer_title as string | null) ?? null,
    flyer_url: (row.flyer_url as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    facebook_post: (row.facebook_post as string | null) ?? null,
    instagram_caption: (row.instagram_caption as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    facebook_status: asChannelStatus(row.facebook_status as string | null),
    instagram_status: asChannelStatus(row.instagram_status as string | null),
    facebook_scheduled_for: (row.facebook_scheduled_for as string | null) ?? null,
    instagram_scheduled_for: (row.instagram_scheduled_for as string | null) ?? null,
    facebook_posted_at: (row.facebook_posted_at as string | null) ?? null,
    instagram_posted_at: (row.instagram_posted_at as string | null) ?? null,
    facebook_error_message: (row.facebook_error_message as string | null) ?? null,
    facebook_provider_status: asProviderStatus(row.facebook_provider_status as string | null),
    facebook_provider_post_id: (row.facebook_provider_post_id as string | null) ?? null,
    facebook_last_attempt_at: (row.facebook_last_attempt_at as string | null) ?? null,
    facebook_last_error: (row.facebook_last_error as string | null) ?? null,
    instagram_error_message: (row.instagram_error_message as string | null) ?? null,
    instagram_provider_status: asProviderStatus(row.instagram_provider_status as string | null),
    instagram_provider_post_id: (row.instagram_provider_post_id as string | null) ?? null,
    instagram_last_attempt_at: (row.instagram_last_attempt_at as string | null) ?? null,
    instagram_last_error: (row.instagram_last_error as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function triggerMarketingOnPublish(args: {
  flyerId: string;
  ownerId: string;
  title: string;
  slug: string | null;
  thumbnailUrl?: string | null;
  landingPageId?: string | null;
  openPageId?: string | null;
}): Promise<MarketingDraft | null> {
  if (!args.slug?.trim()) return null;

  let landingPageId = args.landingPageId ?? null;
  let openPageId = args.openPageId ?? null;
  if (!landingPageId) {
    const resolved = await resolveMarketingLandingIds(args.flyerId);
    landingPageId = resolved.landingPageId;
    openPageId = resolved.openPageId;
  }

  const flyerUrl = buildMarketingPublicUrl({
    slug: args.slug,
    landingPageId,
    openPageId,
  });

  const { data: draft, error } = await supabase
    .from("marketing_drafts")
    .insert([{
      flyer_id: args.flyerId,
      owner_id: args.ownerId,
      status: "pending",
      flyer_title: args.title,
      flyer_url: flyerUrl,
      thumbnail_url: args.thumbnailUrl ?? null,
      facebook_status: "draft",
      instagram_status: "draft",
    }])
    .select()
    .single();

  if (error) {
    console.error("[marketing] insert draft failed", error);
    const msg = error.message || "";
    if (/row-level security|rls|42501/i.test(msg)) {
      toast.error("Could not save marketing draft — permission denied. Run the marketing_drafts RLS fix migration.");
    } else {
      toast.error("Could not save marketing draft: " + msg);
    }
    return null;
  }

  try {
    const result = await invokeEdgeFunction<{ ok?: boolean; skipped?: boolean; reason?: string }>(
      "marketing-trigger",
      { draft_id: draft.id },
    );
    if (result.skipped) {
      toast.message("Marketing AI is not configured yet — add n8n webhook in Supabase secrets.");
    } else {
      toast.message("Creating Facebook & Instagram posts…");
    }
  } catch (err) {
    console.error("[marketing] trigger failed", err);
    toast.message("Could not start marketing AI — check n8n setup.");
  }

  return normalizeDraft(draft as Record<string, unknown>);
}

export async function loadLatestMarketingDraft(flyerId: string): Promise<MarketingDraft | null> {
  const { data, error } = await supabase
    .from("marketing_drafts")
    .select("*")
    .eq("flyer_id", flyerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[marketing] load draft failed", error);
    return null;
  }
  if (!data) return null;
  return normalizeDraft(data as Record<string, unknown>);
}

/** Manual save when n8n callback is stuck — marks draft ready with typed copy. */
export async function saveManualMarketingCopy(args: {
  draftId: string;
  facebookPost: string;
  instagramCaption: string;
}): Promise<MarketingDraft | null> {
  const facebookPost = args.facebookPost.trim();
  const instagramCaption = args.instagramCaption.trim();
  if (!facebookPost && !instagramCaption) {
    toast.error("Type a Facebook post or Instagram caption first");
    return null;
  }

  const { data, error } = await supabase
    .from("marketing_drafts")
    .update({
      status: "ready",
      facebook_post: facebookPost || null,
      instagram_caption: instagramCaption || null,
      error_message: null,
    })
    .eq("id", args.draftId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[marketing] save manual copy failed", error);
    toast.error(error?.message || "Could not save marketing copy");
    return null;
  }

  toast.success("Marketing copy saved");
  return normalizeDraft(data as Record<string, unknown>);
}

export async function loadMetaConnection(userId: string): Promise<MetaConnection | null> {
  const { data, error } = await supabase
    .from("meta_connections")
    .select(
      "id, user_id, provider, meta_app_id, connection_mode, status, facebook_page_id, facebook_page_name, instagram_user_id, instagram_username, page_access_token_last4, last_error, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("provider", "meta")
    .maybeSingle();

  if (error) {
    console.error("[marketing] load meta connection failed", error);
    toast.error("Could not load Facebook connection");
    return null;
  }
  if (!data) return null;
  return normalizeMetaConnection(data as Record<string, unknown>);
}

export async function startMetaOAuth(returnTo?: string): Promise<string | null> {
  try {
    const result = await invokeEdgeFunction<{ authorize_url: string }>(
      "meta-oauth-start",
      { return_to: returnTo || (typeof window !== "undefined" ? window.location.href : undefined) },
    );
    if (!result.authorize_url) {
      toast.error("Could not start Facebook connect");
      return null;
    }
    return result.authorize_url;
  } catch (err) {
    console.error("[marketing] meta oauth start failed", err);
    toast.error(err instanceof Error ? err.message : "Could not start Facebook connect");
    return null;
  }
}

export async function saveMetaConnection(args: {
  pageId: string;
  pageName: string;
}): Promise<MetaConnection | null> {
  const pageId = args.pageId.trim();
  const pageName = args.pageName.trim();
  if (!pageId || !pageName) {
    toast.error("Enter both Facebook page ID and page name");
    return null;
  }

  try {
    const result = await invokeEdgeFunction<{ connection: Record<string, unknown> }>(
      "meta-connect-start",
      {
        provider: "meta",
        facebook_page_id: pageId,
        facebook_page_name: pageName,
      },
    );
    const connection = normalizeMetaConnection(result.connection);
    toast.success(connection.status === "ready" ? "Facebook test connection saved" : "Facebook page saved");
    return connection;
  } catch (err) {
    console.error("[marketing] save meta connection failed", err);
    toast.error(err instanceof Error ? err.message : "Could not save Facebook connection");
    return null;
  }
}

/** Manual Instagram IG User ID save when Graph auto-detect fails (Business Manager pages). */
export async function saveInstagramManualLink(args: {
  userId: string;
  instagramUserId: string;
  instagramUsername?: string;
}): Promise<MetaConnection | null> {
  const igId = args.instagramUserId.trim();
  if (!/^\d{5,}$/.test(igId)) {
    toast.error("Instagram User ID must be a numeric ID from Graph API Explorer");
    return null;
  }
  const username = (args.instagramUsername || "").trim().replace(/^@/, "") || null;

  const { data, error } = await supabase
    .from("meta_connections")
    .update({
      instagram_user_id: igId,
      instagram_username: username,
      last_error: null,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", args.userId)
    .eq("provider", "meta")
    .select(
      "id, user_id, provider, meta_app_id, connection_mode, status, facebook_page_id, facebook_page_name, instagram_user_id, instagram_username, page_access_token_last4, last_error, created_at, updated_at",
    )
    .maybeSingle();

  if (error || !data) {
    console.error("[marketing] save instagram manual link failed", error);
    toast.error(error?.message || "Could not save Instagram link — connect Facebook Page first");
    return null;
  }

  const connection = normalizeMetaConnection(data as Record<string, unknown>);
  toast.success(`Instagram saved: @${connection.instagram_username || connection.instagram_user_id}`);
  return connection;
}

export async function regenerateMarketingDraft(flyerId: string, ownerId: string): Promise<void> {
  const { data: flyer, error } = await supabase
    .from("flyers")
    .select("id, title, public_slug, thumbnail_url, owner_id")
    .eq("id", flyerId)
    .maybeSingle();

  if (error || !flyer) {
    toast.error("Could not load flyer");
    return;
  }
  if (flyer.owner_id !== ownerId) {
    toast.error("Not allowed");
    return;
  }
  if (!flyer.public_slug) {
    toast.error("Publish the flyer first");
    return;
  }

  await triggerMarketingOnPublish({
    flyerId: flyer.id,
    ownerId,
    title: flyer.title,
    slug: flyer.public_slug,
    thumbnailUrl: flyer.thumbnail_url,
  });
}

function channelPatch(
  channel: MarketingChannel,
  patch: {
    status?: MarketingChannelStatus;
    scheduledFor?: string | null;
    postedAt?: string | null;
    errorMessage?: string | null;
  },
): Record<string, unknown> {
  if (channel === "facebook") {
    return {
      ...(patch.status !== undefined ? { facebook_status: patch.status } : {}),
      ...(patch.scheduledFor !== undefined ? { facebook_scheduled_for: patch.scheduledFor } : {}),
      ...(patch.postedAt !== undefined ? { facebook_posted_at: patch.postedAt } : {}),
      ...(patch.errorMessage !== undefined ? { facebook_error_message: patch.errorMessage } : {}),
    };
  }
  return {
    ...(patch.status !== undefined ? { instagram_status: patch.status } : {}),
    ...(patch.scheduledFor !== undefined ? { instagram_scheduled_for: patch.scheduledFor } : {}),
    ...(patch.postedAt !== undefined ? { instagram_posted_at: patch.postedAt } : {}),
    ...(patch.errorMessage !== undefined ? { instagram_error_message: patch.errorMessage } : {}),
  };
}

async function updateChannel(
  draftId: string,
  channel: MarketingChannel,
  patch: {
    status?: MarketingChannelStatus;
    scheduledFor?: string | null;
    postedAt?: string | null;
    errorMessage?: string | null;
  },
): Promise<MarketingDraft | null> {
  const { data, error } = await supabase
    .from("marketing_drafts")
    .update(channelPatch(channel, patch) as never)
    .eq("id", draftId)
    .select()
    .single();

  if (error) {
    console.error("[marketing] update channel failed", error);
    toast.error(error.message || "Could not update marketing status");
    return null;
  }
  return normalizeDraft(data as Record<string, unknown>);
}

/** Schedule Facebook or Instagram for a future time (app-only — does not post). */
export async function scheduleMarketingChannel(
  draftId: string,
  channel: MarketingChannel,
  scheduledForIso: string,
): Promise<MarketingDraft | null> {
  const when = new Date(scheduledForIso);
  if (isNaN(when.getTime())) {
    toast.error("Pick a valid date and time");
    return null;
  }
  if (when.getTime() <= Date.now()) {
    toast.error("Schedule time must be in the future");
    return null;
  }

  const updated = await updateChannel(draftId, channel, {
    status: "scheduled",
    scheduledFor: when.toISOString(),
    postedAt: null,
    errorMessage: null,
  });
  if (updated) {
    toast.success(channel === "facebook" ? "Facebook post scheduled" : "Instagram caption scheduled");
  }
  return updated;
}

/** Clear schedule and return channel to draft. */
export async function unscheduleMarketingChannel(
  draftId: string,
  channel: MarketingChannel,
): Promise<MarketingDraft | null> {
  const updated = await updateChannel(draftId, channel, {
    status: "draft",
    scheduledFor: null,
    errorMessage: null,
  });
  if (updated) {
    toast.message(channel === "facebook" ? "Facebook unscheduled" : "Instagram unscheduled");
  }
  return updated;
}

/** Manually mark a channel as posted (Phase 2 has no Meta API — honor system). */
export async function markMarketingChannelPosted(
  draftId: string,
  channel: MarketingChannel,
): Promise<MarketingDraft | null> {
  const updated = await updateChannel(draftId, channel, {
    status: "posted",
    scheduledFor: null,
    postedAt: new Date().toISOString(),
    errorMessage: null,
  });
  if (updated) {
    toast.success(channel === "facebook" ? "Facebook marked as posted" : "Instagram marked as posted");
  }
  return updated;
}

export async function postFacebookNow(
  draftId: string,
  messageOverride?: string,
): Promise<MarketingDraft | null> {
  try {
    const result = await invokeEdgeFunction<{ draft: Record<string, unknown> }>(
      "meta-post-now",
      {
        draft_id: draftId,
        message: messageOverride?.trim() || undefined,
      },
    );
    const updated = normalizeDraft(result.draft);
    toast.success("Facebook post sent in test mode");
    return updated;
  } catch (err) {
    console.error("[marketing] post facebook failed", err);
    toast.error(err instanceof Error ? err.message : "Could not post to Facebook");
    return null;
  }
}

export async function postInstagramNow(
  draftId: string,
  captionOverride?: string,
): Promise<MarketingDraft | null> {
  try {
    const result = await invokeEdgeFunction<{ draft: Record<string, unknown> }>(
      "meta-instagram-post-now",
      {
        draft_id: draftId,
        caption: captionOverride?.trim() || undefined,
      },
    );
    const updated = normalizeDraft(result.draft);
    toast.success("Instagram post sent in test mode");
    return updated;
  } catch (err) {
    console.error("[marketing] post instagram failed", err);
    toast.error(err instanceof Error ? err.message : "Could not post to Instagram");
    return null;
  }
}

/** Exchange/refresh Instagram Login token to ~60 days and store in meta_connection_secrets. */
export async function extendInstagramToken(accessToken?: string): Promise<{
  expires_at?: string;
  expires_in_days?: number;
  mode?: string;
} | null> {
  try {
    const result = await invokeEdgeFunction<{
      ok?: boolean;
      expires_at?: string;
      expires_in_days?: number;
      mode?: string;
      message?: string;
    }>("meta-instagram-token-extend", {
      access_token: accessToken?.trim() || undefined,
    });
    toast.success(
      result.message
        || (result.expires_in_days
          ? `Instagram token saved (~${result.expires_in_days} days)`
          : "Instagram token extended"),
    );
    return result;
  } catch (err) {
    console.error("[marketing] extend instagram token failed", err);
    toast.error(err instanceof Error ? err.message : "Could not extend Instagram token");
    return null;
  }
}

export function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatScheduleLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
