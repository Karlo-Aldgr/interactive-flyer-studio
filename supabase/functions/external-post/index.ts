import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { authenticateApiKey, hasScope } from "../_shared/publishing/apiKeys.ts";
import { checkRateLimit, logApiRequest } from "../_shared/publishing/rateLimit.ts";
import {
  fieldErrors,
  MAX_PAYLOAD_BYTES,
  parsePostRequest,
  verifyMediaReachable,
} from "../_shared/publishing/schema.ts";
import { publish } from "../_shared/publishing/service.ts";
import { resolveDraftRequests } from "../_shared/publishing/resolve.ts";
import { summarizeResults } from "../_shared/publishing/types.ts";
import type { MediaItem, Platform, PlatformResult } from "../_shared/publishing/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const endpoint = "/api/v1/post";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = await authenticateApiKey(supabase, req.headers.get("x-api-key"));
  if ("error" in auth) {
    return json({ request_id: requestId, error: auth.error }, auth.status);
  }
  const key = auth.key;

  const finish = async (
    status: string,
    body: unknown,
    httpStatus: number,
    meta: { platforms?: string[]; mediaType?: string | null; error?: string | null } = {},
    headers: Record<string, string> = {},
  ) => {
    await logApiRequest(supabase, {
      request_id: requestId,
      key_id: key.id,
      key_prefix: key.key_prefix,
      owner_id: key.owner_id,
      endpoint,
      platforms: meta.platforms ?? [],
      media_type: meta.mediaType ?? null,
      status,
      duration_ms: Date.now() - startedAt,
      error_message: meta.error ?? null,
    });
    return json(body, httpStatus, headers);
  };

  if (!hasScope(key, "publish")) {
    return finish("forbidden", { request_id: requestId, error: "Key is missing the publish scope" }, 403, {
      error: "missing scope",
    });
  }

  const limit = await checkRateLimit(supabase, key.id);
  if (!limit.allowed) {
    return finish(
      "rate_limited",
      { request_id: requestId, error: limit.message },
      429,
      { error: limit.message },
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return finish("invalid", {
      request_id: requestId,
      error: "Payload too large",
    }, 413, { error: "payload too large" });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody || "{}");
  } catch {
    return finish("invalid", {
      request_id: requestId,
      error: "Body must be valid JSON",
    }, 400, { error: "invalid json" });
  }

  const parsed = parsePostRequest(parsedJson);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return finish("invalid", {
      request_id: requestId,
      error: "Validation failed",
      errors,
    }, 400, { error: errors.map((e) => `${e.field}: ${e.message}`).join("; ").slice(0, 500) });
  }

  const input = parsed.data;
  const platforms = input.platforms as Platform[];

  try {
    if (input.mode === "draft") {
      const resolved = await resolveDraftRequests(supabase, {
        draftId: input.draft_id,
        ownerId: key.owner_id,
        platforms,
        requestId,
      });

      if (!resolved.ok) {
        return finish(
          resolved.reason === "forbidden" ? "forbidden" : "invalid",
          {
            request_id: requestId,
            error: resolved.message,
            ...(resolved.reason === "not_found"
              ? { errors: [{ field: "draft_id", message: resolved.message }] }
              : {}),
          },
          resolved.reason === "forbidden" ? 403 : 404,
          { platforms, error: resolved.message },
        );
      }

      const results: PlatformResult[] = [...resolved.skipped];
      const jobIds: string[] = [];
      for (const request of resolved.requests) {
        const outcome = await publish(supabase, request);
        if (outcome.job_id) jobIds.push(outcome.job_id);
        results.push(...outcome.results);
      }

      const status = summarizeResults(results);
      return finish(status, {
        request_id: requestId,
        status,
        results,
        ...(jobIds.length ? { job_ids: jobIds } : {}),
      }, 200, {
        platforms,
        mediaType: resolved.media[0]?.type ?? null,
        error: status === "failed" ? results.map((r) => r.error).filter(Boolean).join("; ").slice(0, 500) : null,
      });
    }

    // Manual mode
    const media = (input.media ?? []) as MediaItem[];
    for (const item of media) {
      const check = await verifyMediaReachable(item.url, item.type);
      if (!check.ok) {
        return finish("invalid", {
          request_id: requestId,
          error: "Validation failed",
          errors: [{ field: "media.url", message: check.message }],
        }, 400, { platforms, mediaType: item.type, error: check.message });
      }
    }

    const outcome = await publish(supabase, {
      ownerId: key.owner_id,
      platforms,
      caption: input.caption,
      media,
      link: input.link,
      requestId,
    });

    return finish(outcome.status, {
      request_id: requestId,
      status: outcome.status,
      results: outcome.results,
      ...(outcome.job_id ? { job_id: outcome.job_id } : {}),
    }, 200, {
      platforms,
      mediaType: media[0]?.type ?? null,
      error: outcome.status === "failed"
        ? outcome.results.map((r) => r.error).filter(Boolean).join("; ").slice(0, 500)
        : null,
    });

  } catch (err) {
    console.error("[external-post]", err);
    return finish("error", {
      request_id: requestId,
      error: "Publishing failed",
      details: String(err).slice(0, 500),
    }, 500, { platforms, error: String(err).slice(0, 500) });
  }
});
