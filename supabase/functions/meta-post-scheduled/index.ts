/**
 * Cron/worker entry: post due Facebook + Instagram marketing drafts.
 * Auth: header x-meta-cron-secret must match META_CRON_SECRET.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  extractLinkFromDraft,
  facebookFailurePatch,
  facebookSuccessPatch,
  postFacebookToPage,
} from "../_shared/metaFacebookPost.ts";
import {
  instagramFailurePatch,
  instagramSuccessPatch,
  postInstagramImage,
  resolveInstagramAccess,
} from "../_shared/metaInstagramPost.ts";
import { resolveMetaPageCredentials, tokenLast4 } from "../_shared/metaCredentials.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v23.0";
    const results: Array<Record<string, unknown>> = [];

    const { data: dueFacebook, error: fbDueErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("facebook_status", "scheduled")
      .lte("facebook_scheduled_for", nowIso)
      .order("facebook_scheduled_for", { ascending: true })
      .limit(10);
    if (fbDueErr) return json({ error: fbDueErr.message }, 500);

    for (const draft of dueFacebook ?? []) {
      const draftId = String(draft.id);
      const claimAt = new Date().toISOString();

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
        results.push({ channel: "facebook", draft_id: draftId, ok: false, error: claimErr.message });
        continue;
      }
      if (!claimed) {
        results.push({ channel: "facebook", draft_id: draftId, ok: false, skipped: true, reason: "already_claimed_or_not_due" });
        continue;
      }

      const message = String(claimed.facebook_post || "").trim();
      if (!message) {
        const err = "No Facebook copy is ready yet";
        await supabase.from("marketing_drafts").update(facebookFailurePatch(err, claimAt)).eq("id", draftId);
        results.push({ channel: "facebook", draft_id: draftId, ok: false, error: err });
        continue;
      }

      const creds = await resolveMetaPageCredentials(supabase, String(claimed.owner_id));
      if ("error" in creds) {
        await supabase.from("marketing_drafts").update(facebookFailurePatch(creds.error, claimAt)).eq("id", draftId);
        results.push({ channel: "facebook", draft_id: draftId, ok: false, error: creds.error });
        continue;
      }

      const link = extractLinkFromDraft(claimed as Record<string, unknown>, message);
      const thumbnailUrl = typeof claimed.thumbnail_url === "string" ? claimed.thumbnail_url.trim() : "";

      const result = await postFacebookToPage({
        pageId: creds.pageId,
        pageAccessToken: creds.pageAccessToken,
        graphVersion,
        message,
        link,
        thumbnailUrl,
      });

      if (!result.ok) {
        await supabase.from("marketing_drafts").update(facebookFailurePatch(result.error, result.attemptAt)).eq("id", draftId);
        if (creds.connectionId) {
          await supabase
            .from("meta_connections")
            .update({
              status: "error",
              last_error: result.error,
              page_access_token_last4: tokenLast4(creds.pageAccessToken),
            })
            .eq("id", creds.connectionId);
        }
        results.push({ channel: "facebook", draft_id: draftId, ok: false, error: result.error, token_source: creds.source });
        continue;
      }

      await supabase
        .from("marketing_drafts")
        .update(facebookSuccessPatch(result.provider_post_id, result.attemptAt))
        .eq("id", draftId);
      if (creds.connectionId) {
        await supabase
          .from("meta_connections")
          .update({
            status: "ready",
            last_error: null,
            page_access_token_last4: tokenLast4(creds.pageAccessToken),
          })
          .eq("id", creds.connectionId);
      }

      results.push({
        channel: "facebook",
        draft_id: draftId,
        ok: true,
        provider_post_id: result.provider_post_id,
        token_source: creds.source,
      });
    }

    const { data: dueInstagram, error: igDueErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("instagram_status", "scheduled")
      .lte("instagram_scheduled_for", nowIso)
      .order("instagram_scheduled_for", { ascending: true })
      .limit(5);
    if (igDueErr) return json({ error: igDueErr.message }, 500);

    for (const draft of dueInstagram ?? []) {
      const draftId = String(draft.id);
      const claimAt = new Date().toISOString();

      const { data: claimed, error: claimErr } = await supabase
        .from("marketing_drafts")
        .update({
          instagram_provider_status: "posting",
          instagram_last_attempt_at: claimAt,
          instagram_last_error: null,
        })
        .eq("id", draftId)
        .eq("instagram_status", "scheduled")
        .neq("instagram_provider_status", "posting")
        .select("*")
        .maybeSingle();

      if (claimErr) {
        results.push({ channel: "instagram", draft_id: draftId, ok: false, error: claimErr.message });
        continue;
      }
      if (!claimed) {
        results.push({ channel: "instagram", draft_id: draftId, ok: false, skipped: true, reason: "already_claimed_or_not_due" });
        continue;
      }

      const caption = String(claimed.instagram_caption || "").trim();
      const imageUrl = typeof claimed.thumbnail_url === "string" ? claimed.thumbnail_url.trim() : "";

      const { data: connection } = await supabase
        .from("meta_connections")
        .select("id, instagram_user_id, instagram_username")
        .eq("user_id", String(claimed.owner_id))
        .eq("provider", "meta")
        .maybeSingle();

      let igUserId = typeof connection?.instagram_user_id === "string" ? connection.instagram_user_id.trim() : "";

      // Staff often schedule client flyers while the IG ID lives on the staff Meta connection.
      if (!igUserId) {
        const { data: anyIg } = await supabase
          .from("meta_connections")
          .select("id, user_id, instagram_user_id, instagram_username")
          .eq("provider", "meta")
          .not("instagram_user_id", "is", null)
          .limit(5);
        const match = (anyIg ?? []).find((row) => typeof row.instagram_user_id === "string" && row.instagram_user_id.trim());
        if (match?.instagram_user_id) {
          igUserId = String(match.instagram_user_id).trim();
        }
      }

      const pageCreds = await resolveMetaPageCredentials(supabase, String(claimed.owner_id));
      const pageToken = !("error" in pageCreds) ? pageCreds.pageAccessToken : null;
      const access = resolveInstagramAccess({ pageAccessToken: pageToken });
      if ("error" in access) {
        await supabase.from("marketing_drafts").update(instagramFailurePatch(access.error, claimAt)).eq("id", draftId);
        results.push({ channel: "instagram", draft_id: draftId, ok: false, error: access.error });
        continue;
      }

      if (!igUserId) {
        const err = "Instagram User ID is missing on meta_connections — save it in Instagram Post Now first";
        await supabase.from("marketing_drafts").update(instagramFailurePatch(err, claimAt)).eq("id", draftId);
        results.push({ channel: "instagram", draft_id: draftId, ok: false, error: err });
        continue;
      }

      const result = await postInstagramImage({
        igUserId,
        caption,
        imageUrl,
        graphVersion,
        accessToken: access.accessToken,
        apiHost: access.apiHost,
        tokenSource: access.tokenSource,
      });

      if (!result.ok) {
        await supabase.from("marketing_drafts").update(instagramFailurePatch(result.error, result.attemptAt)).eq("id", draftId);
        results.push({
          channel: "instagram",
          draft_id: draftId,
          ok: false,
          error: result.error,
          token_source: result.token_source,
        });
        continue;
      }

      await supabase
        .from("marketing_drafts")
        .update(instagramSuccessPatch(result.provider_post_id, result.attemptAt))
        .eq("id", draftId);

      results.push({
        channel: "instagram",
        draft_id: draftId,
        ok: true,
        provider_post_id: result.provider_post_id,
        token_source: result.token_source,
      });
    }

    return json({
      ok: true,
      checked_at: nowIso,
      facebook_due_count: (dueFacebook ?? []).length,
      instagram_due_count: (dueInstagram ?? []).length,
      results,
    });
  } catch (err) {
    console.error("[meta-post-scheduled]", err);
    return json({ error: String(err) }, 500);
  }
});
