import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import type { AdapterContext, Platform, PlatformResult, PublishOutcome, PublishRequest } from "./types.ts";
import { publishToFacebook } from "./adapters/facebook.ts";
import { publishToInstagram } from "./adapters/instagram.ts";
import { publishToTikTok } from "./adapters/tiktok.ts";
import { facebookFailurePatch, facebookSuccessPatch } from "../metaFacebookPost.ts";
import { instagramFailurePatch, instagramSuccessPatch } from "../metaInstagramPost.ts";

const ADAPTERS: Record<Platform, (ctx: AdapterContext) => Promise<PlatformResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  tiktok: publishToTikTok,
};

function graphVersion() {
  return Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
}

async function markPosting(supabase: SupabaseClient, draftId: string, platform: Platform) {
  const attemptAt = new Date().toISOString();
  if (platform === "facebook") {
    await supabase.from("marketing_drafts").update({
      facebook_provider_status: "posting",
      facebook_last_attempt_at: attemptAt,
      facebook_last_error: null,
    }).eq("id", draftId);
  } else if (platform === "instagram") {
    await supabase.from("marketing_drafts").update({
      instagram_provider_status: "posting",
      instagram_last_attempt_at: attemptAt,
      instagram_last_error: null,
    }).eq("id", draftId);
  }
}

async function applyDraftPatch(
  supabase: SupabaseClient,
  draftId: string,
  result: PlatformResult,
) {
  if (result.platform === "facebook") {
    const patch = result.status === "success"
      ? facebookSuccessPatch(result.post_id!, result.attempt_at)
      : facebookFailurePatch(result.error || "Publish failed", result.attempt_at);
    await supabase.from("marketing_drafts").update(patch).eq("id", draftId);
  } else if (result.platform === "instagram") {
    const patch = result.status === "success"
      ? instagramSuccessPatch(result.post_id!, result.attempt_at)
      : instagramFailurePatch(result.error || "Publish failed", result.attempt_at);
    await supabase.from("marketing_drafts").update(patch).eq("id", draftId);
  }
}

/**
 * The single publishing code path used by the in-app "Post now" buttons,
 * the external API, and scheduled publishing.
 */
export async function publish(
  supabase: SupabaseClient,
  request: PublishRequest,
): Promise<PublishOutcome> {
  const ctxBase = {
    supabase,
    ownerId: request.ownerId,
    caption: request.caption,
    media: request.media,
    link: request.link,
    graphVersion: graphVersion(),
  };

  const results: PlatformResult[] = [];
  for (const platform of request.platforms) {
    const adapter = ADAPTERS[platform];
    if (!adapter) {
      results.push({
        platform,
        status: "failed",
        error: `Unsupported platform: ${platform}`,
        attempt_at: new Date().toISOString(),
      });
      continue;
    }

    if (request.draftId) await markPosting(supabase, request.draftId, platform);

    let result: PlatformResult;
    try {
      result = await adapter(ctxBase);
    } catch (err) {
      result = {
        platform,
        status: "failed",
        error: String(err).slice(0, 500),
        attempt_at: new Date().toISOString(),
      };
    }

    if (request.draftId) await applyDraftPatch(supabase, request.draftId, result);
    results.push(result);
  }

  const successes = results.filter((r) => r.status === "success").length;
  const status = successes === results.length && successes > 0
    ? "success"
    : successes > 0
    ? "partial_success"
    : "failed";

  return { status, results };
}
