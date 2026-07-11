/**
 * Cron/worker entry: post due Facebook marketing drafts (test mode).
 * Auth: header x-meta-cron-secret must match META_CRON_SECRET.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  extractLinkFromDraft,
  facebookFailurePatch,
  facebookSuccessPatch,
  postFacebookToPage,
} from "../_shared/metaFacebookPost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-meta-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authorizeCron(req: Request): boolean {
  const expected = Deno.env.get("META_CRON_SECRET")?.trim();
  if (!expected) return false;
  const provided = req.headers.get("x-meta-cron-secret")?.trim();
  return !!provided && provided === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!authorizeCron(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    if ((Deno.env.get("META_TEST_MODE_ENABLED") ?? "").toLowerCase() !== "true") {
      return json({ error: "Meta test mode is not enabled" }, 400);
    }

    const pageAccessToken = Deno.env.get("META_PAGE_ACCESS_TOKEN")?.trim();
    if (!pageAccessToken) {
      return json({ error: "Missing META_PAGE_ACCESS_TOKEN secret" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const { data: dueDrafts, error: dueErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("facebook_status", "scheduled")
      .lte("facebook_scheduled_for", nowIso)
      .order("facebook_scheduled_for", { ascending: true })
      .limit(10);

    if (dueErr) return json({ error: dueErr.message }, 500);

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    const results: Array<Record<string, unknown>> = [];

    for (const draft of dueDrafts ?? []) {
      const draftId = String(draft.id);
      const claimAt = new Date().toISOString();

      // Claim row so overlapping cron ticks do not double-post.
      const { data: claimed, error: claimErr } = await supabase
        .from("marketing_drafts")
        .update({
          facebook_provider_status: "posting",
          facebook_last_attempt_at: claimAt,
          facebook_last_error: null,
        })
        .eq("id", draftId)
        .eq("facebook_status", "scheduled")
        .neq("facebook_provider_status", "posting")
        .select("*")
        .maybeSingle();

      if (claimErr) {
        results.push({ draft_id: draftId, ok: false, error: claimErr.message });
        continue;
      }
      if (!claimed) {
        results.push({ draft_id: draftId, ok: false, skipped: true, reason: "already_claimed_or_not_due" });
        continue;
      }

      const message = String(claimed.facebook_post || "").trim();
      if (!message) {
        const err = "No Facebook copy is ready yet";
        await supabase.from("marketing_drafts").update(facebookFailurePatch(err, claimAt)).eq("id", draftId);
        results.push({ draft_id: draftId, ok: false, error: err });
        continue;
      }

      // Prefer flyer owner connection; fall back to any connected page (test-mode single page).
      let { data: connection } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("user_id", claimed.owner_id)
        .eq("provider", "meta")
        .maybeSingle();

      if (!connection?.facebook_page_id) {
        const { data: fallback } = await supabase
          .from("meta_connections")
          .select("*")
          .eq("provider", "meta")
          .not("facebook_page_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        connection = fallback;
      }

      if (!connection?.facebook_page_id) {
        const err = "Facebook page is not connected yet";
        await supabase.from("marketing_drafts").update(facebookFailurePatch(err, claimAt)).eq("id", draftId);
        results.push({ draft_id: draftId, ok: false, error: err });
        continue;
      }

      const link = extractLinkFromDraft(claimed as Record<string, unknown>, message);
      const thumbnailUrl = typeof claimed.thumbnail_url === "string" ? claimed.thumbnail_url.trim() : "";

      const result = await postFacebookToPage({
        pageId: String(connection.facebook_page_id),
        pageAccessToken,
        graphVersion,
        message,
        link,
        thumbnailUrl,
      });

      if (!result.ok) {
        await supabase.from("marketing_drafts").update(facebookFailurePatch(result.error, result.attemptAt)).eq("id", draftId);
        await supabase
          .from("meta_connections")
          .update({
            status: "error",
            last_error: result.error,
            page_access_token_last4: pageAccessToken.slice(-4),
          })
          .eq("id", connection.id);
        results.push({ draft_id: draftId, ok: false, error: result.error });
        continue;
      }

      await supabase
        .from("marketing_drafts")
        .update(facebookSuccessPatch(result.provider_post_id, result.attemptAt))
        .eq("id", draftId);
      await supabase
        .from("meta_connections")
        .update({
          status: "ready",
          last_error: null,
          page_access_token_last4: pageAccessToken.slice(-4),
        })
        .eq("id", connection.id);

      results.push({ draft_id: draftId, ok: true, provider_post_id: result.provider_post_id });
    }

    return json({
      ok: true,
      checked_at: nowIso,
      due_count: (dueDrafts ?? []).length,
      results,
    });
  } catch (err) {
    console.error("[meta-post-scheduled]", err);
    return json({ error: String(err) }, 500);
  }
});
