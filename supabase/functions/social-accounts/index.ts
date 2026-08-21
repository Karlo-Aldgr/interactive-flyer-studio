// Account lifecycle: status, sync, token refresh, disconnect/revoke.
// Responsibilities of social-account-sync, social-token-refresh,
// social-account-disconnect and social-integration-status live here behind an
// `action` field, matching this project's existing multi-action function style.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import {
  ensureFreshToken,
  loadAccount,
  markAccountStatus,
  requireUser,
  serviceClient,
  tokenEncryptionReady,
} from "../_shared/social/store.ts";
import { getAdapter, integrationStatus } from "../_shared/social/registry.ts";
import { CAPABILITIES } from "../_shared/social/capabilities.ts";
import { isSocialPlatform, SOCIAL_PLATFORMS } from "../_shared/social/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "status");
  const supabase = serviceClient();

  // ---- integration status ------------------------------------------------
  if (action === "status") {
    const { data: settings } = await supabase
      .from("social_platform_settings")
      .select("platform, enabled, notes");
    const enabled = new Map((settings ?? []).map((s) => [s.platform, s]));
    return json({
      encryption_configured: tokenEncryptionReady(),
      callback_url: Deno.env.get("SOCIAL_OAUTH_CALLBACK_URL")?.trim() ||
        `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/social-oauth-callback`,
      scheduler_configured: Boolean(Deno.env.get("SOCIAL_CRON_SECRET")?.trim()),
      platforms: SOCIAL_PLATFORMS.map((platform) => ({
        ...integrationStatus(platform),
        capabilities: CAPABILITIES[platform],
        globally_enabled: enabled.get(platform)?.enabled ?? true,
        admin_notes: enabled.get(platform)?.notes ?? null,
      })),
    });
  }

  const accountId = typeof body.account_id === "string" ? body.account_id : "";
  const owns = async () => {
    if (!accountId) return false;
    const { data } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    return Boolean(data);
  };

  // ---- sync one account's profile metadata --------------------------------
  if (action === "sync" || action === "refresh") {
    if (!(await owns())) return json({ error: "Account not found" }, 404);
    const loaded = await loadAccount(supabase, accountId);
    if ("ok" in loaded && loaded.ok === false) {
      return json({ error: loaded.message, code: loaded.code }, 400);
    }
    const fresh = await ensureFreshToken(supabase, loaded as never);
    if ("ok" in fresh && (fresh as { ok: false }).ok === false) {
      const err = fresh as { message: string; code: string };
      return json({ error: err.message, code: err.code }, 400);
    }
    const account = fresh as Awaited<ReturnType<typeof loadAccount>> & { id: string };
    if (action === "refresh") {
      await markAccountStatus(supabase, accountId, "connected", null);
      return json({ ok: true, refreshed: true });
    }
    // deno-lint-ignore no-explicit-any
    const info = await getAdapter((account as any).platform).getAccount(account as any);
    if (info.ok === false) {
      await markAccountStatus(
        supabase,
        accountId,
        info.code === "permission_missing" ? "permission_missing" : "reconnect_required",
        info.message,
      );
      return json({ error: info.message, code: info.code }, 400);
    }
    await supabase.from("social_accounts").update({
      account_name: info.account.account_name ?? undefined,
      username: info.account.username ?? undefined,
      profile_image_url: info.account.profile_image_url ?? undefined,
      metadata: info.account.metadata ?? undefined,
      connection_status: "connected",
      status_detail: null,
      last_synced_at: new Date().toISOString(),
    }).eq("id", accountId);
    return json({ ok: true, synced: true });
  }

  // ---- disconnect / revoke -------------------------------------------------
  if (action === "disconnect") {
    if (!(await owns())) return json({ error: "Account not found" }, 404);
    const loaded = await loadAccount(supabase, accountId);
    let revoked = false;
    let revokeError: string | null = null;
    if (!("ok" in loaded) || loaded.ok !== false) {
      const account = loaded as Awaited<ReturnType<typeof loadAccount>> & { platform: string };
      try {
        // deno-lint-ignore no-explicit-any
        const result = await getAdapter(account.platform as any).revoke(account as any);
        revoked = result.ok === true;
        if (result.ok === false) revokeError = result.message;
      } catch (err) {
        revokeError = String(err).slice(0, 300);
      }
    }
    const { error } = await supabase.from("social_accounts").delete().eq("id", accountId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, revoked_at_platform: revoked, revoke_error: revokeError });
  }

  // ---- reconnect hint for a platform ---------------------------------------
  if (action === "platform_status") {
    if (!isSocialPlatform(body.platform)) return json({ error: "Unknown platform" }, 400);
    return json(integrationStatus(body.platform));
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
