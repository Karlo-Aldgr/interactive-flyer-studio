import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import type {
  AdapterContext,
  Platform,
  PlatformResult,
  PublishExecutor,
  PublishOutcome,
  PublishRequest,
} from "./types.ts";
import { summarizeResults } from "./types.ts";
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
 * Performs the provider calls for one PublishRequest and returns terminal
 * results. This is the unit of work: an inline executor calls it during the
 * HTTP request, a future queue worker calls the exact same function when it
 * picks the job up. Never call it directly from an entry point — go through
 * `publish()` so the configured executor decides the timing.
 */
export async function executePublishRequest(
  supabase: SupabaseClient,
  request: PublishRequest,
): Promise<PublishOutcome> {
  const ctxBase: AdapterContext = {
    supabase,
    ownerId: request.ownerId,
    actorId: request.actorId,

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

  return { status: summarizeResults(results), results };
}

/** Runs the work during the caller's request — today's behaviour. */
export const inlineExecutor: PublishExecutor = {
  name: "inline",
  run: (supabase, request) => executePublishRequest(supabase, request),
};

const executorRegistry = new Map<string, PublishExecutor>([[inlineExecutor.name, inlineExecutor]]);

/**
 * Registers an alternative executor (e.g. a queue-backed one that inserts a
 * job row and returns `status: "queued"` plus a `job_id`). Because executors
 * share the PublishRequest/PublishOutcome contract, registering one is the
 * only change needed to move publishing off the request path.
 */
export function registerExecutor(executor: PublishExecutor) {
  executorRegistry.set(executor.name, executor);
}

/** Chosen with PUBLISH_EXECUTOR; falls back to inline when unset/unknown. */
export function activeExecutor(): PublishExecutor {
  const configured = Deno.env.get("PUBLISH_EXECUTOR")?.trim();
  if (configured) {
    const found = executorRegistry.get(configured);
    if (found) return found;
    console.warn(`[publishing] Unknown PUBLISH_EXECUTOR "${configured}" — using inline`);
  }
  return inlineExecutor;
}

/**
 * The single publishing entry point used by the in-app "Post now" buttons, the
 * external API, and scheduled publishing. Callers must treat the outcome as
 * possibly non-terminal: `status: "queued"` means the work was accepted and the
 * result will be available later via `job_id`.
 */
export function publish(
  supabase: SupabaseClient,
  request: PublishRequest,
): Promise<PublishOutcome> {
  return activeExecutor().run(supabase, request);
}
