import type { AdapterContext, PlatformResult } from "../types.ts";
import { primaryMedia } from "../types.ts";
import { resolveMetaPageCredentials } from "../../metaCredentials.ts";
import { postInstagramMedia, resolveInstagramAccess } from "../../metaInstagramPost.ts";

/** Resolve the Instagram Business account id, discovering it from the Page when needed. */
async function resolveIgUserId(
  ctx: AdapterContext,
  accessToken: string,
  pageId: string | null,
  metaUserId: string,
): Promise<{ igUserId: string; connectionId: string | null } | { error: string }> {
  const { data: connection } = await ctx.supabase
    .from("meta_connections")
    .select("id, instagram_user_id")
    .eq("user_id", metaUserId)
    .eq("provider", "meta")
    .maybeSingle();


  const connectionId = connection?.id ? String(connection.id) : null;
  const stored = typeof connection?.instagram_user_id === "string"
    ? connection.instagram_user_id.trim()
    : "";
  if (stored) return { igUserId: stored, connectionId };

  if (pageId) {
    const url = new URL(`https://graph.facebook.com/${ctx.graphVersion}/${pageId}`);
    url.searchParams.set(
      "fields",
      "instagram_business_account{id,username},connected_instagram_account{id,username}",
    );
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    const biz = json.instagram_business_account as Record<string, unknown> | undefined;
    const linked = json.connected_instagram_account as Record<string, unknown> | undefined;
    const ig = biz?.id ? biz : (linked?.id ? linked : undefined);
    if (res.ok && ig?.id) {
      const igUserId = String(ig.id);
      if (connectionId) {
        await ctx.supabase
          .from("meta_connections")
          .update({
            instagram_user_id: igUserId,
            instagram_username: typeof ig.username === "string" ? ig.username : null,
          })
          .eq("id", connectionId);
      }
      return { igUserId, connectionId };
    }
  }

  return { error: "Instagram Business account is not connected yet." };
}

/** Instagram Business adapter: single image posts and video Reels. */
export async function publishToInstagram(ctx: AdapterContext): Promise<PlatformResult> {
  const attempt_at = new Date().toISOString();
  const item = primaryMedia(ctx.media);
  if (!item) {
    return {
      platform: "instagram",
      status: "failed",
      error: "Instagram requires an image or video",
      attempt_at,
    };
  }

  const creds = await resolveMetaPageCredentials(ctx.supabase, ctx.ownerId, ctx.actorId);
  const pageToken = !("error" in creds) ? creds.pageAccessToken : null;
  const pageId = !("error" in creds) ? creds.pageId : null;
  const metaUserId = !("error" in creds) ? creds.userId : ctx.ownerId;

  const access = await resolveInstagramAccess({
    supabase: ctx.supabase,
    userId: metaUserId,
    pageAccessToken: pageToken,
  });
  if ("error" in access) {
    return { platform: "instagram", status: "not_connected", error: access.error, attempt_at };
  }

  const resolved = await resolveIgUserId(ctx, access.accessToken, pageId, metaUserId);

  if ("error" in resolved) {
    return { platform: "instagram", status: "not_connected", error: resolved.error, attempt_at };
  }

  const result = await postInstagramMedia({
    igUserId: resolved.igUserId,
    caption: ctx.caption,
    mediaUrl: item.url,
    mediaType: item.type,
    graphVersion: ctx.graphVersion,
    accessToken: access.accessToken,
    apiHost: access.apiHost,
    tokenSource: access.tokenSource,
  });

  if (!result.ok) {
    return {
      platform: "instagram",
      status: "failed",
      error: result.error,
      attempt_at: result.attemptAt,
      token_source: access.tokenSource,
    };
  }
  return {
    platform: "instagram",
    status: "success",
    post_id: result.provider_post_id,
    attempt_at: result.attemptAt,
    token_source: access.tokenSource,
  };
}
