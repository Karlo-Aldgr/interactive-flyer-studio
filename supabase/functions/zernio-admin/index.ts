// Admin-only Zernio configuration. The API key is written and read only here;
// it is never returned to the browser.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { requireUser, serviceClient } from "../_shared/social/store.ts";
import { unwrapList, zernio } from "../_shared/zernio/client.ts";
import {
  envZernioKey,
  getZernioApiKey,
  recordZernioTest,
  removeZernioApiKey,
  saveZernioApiKey,
  zernioSecretMeta,
} from "../_shared/zernio/secretStore.ts";

async function isAdmin(userId: string) {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

function maskedHint(key: string | null) {
  if (!key) return null;
  return `${"•".repeat(8)}${key.slice(-4)}`;
}

async function statusPayload() {
  const key = await getZernioApiKey();
  const meta = await zernioSecretMeta();
  return {
    configured: Boolean(key),
    source: envZernioKey() ? "environment" : key ? "secure_storage" : null,
    key_hint: maskedHint(key),
    updated_at: meta?.updated_at ?? null,
    last_tested_at: meta?.last_tested_at ?? null,
    last_test_ok: meta?.last_test_ok ?? null,
    last_test_message: meta?.last_test_message ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);
  if (!(await isAdmin(user.id))) return json({ error: "Admin access required" }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "status");

  try {
    if (action === "status") return json(await statusPayload());

    if (action === "save") {
      const value = String(body.api_key ?? "").trim();
      if (value.length < 8 || value.length > 500) {
        return json({ error: "That does not look like a valid Zernio API key." }, 400);
      }
      const err = await saveZernioApiKey(value, user.id);
      if (err) return json({ error: "Could not save the API key. Please try again." }, 500);
      console.log(JSON.stringify({
        scope: "zernio",
        operation: "admin_save_key",
        user_id: user.id,
        success: true,
        at: new Date().toISOString(),
      }));
      return json({ ok: true, ...(await statusPayload()) });
    }

    if (action === "remove") {
      const err = await removeZernioApiKey();
      if (err) return json({ error: "Could not remove the API key. Please try again." }, 500);
      console.log(JSON.stringify({
        scope: "zernio",
        operation: "admin_remove_key",
        user_id: user.id,
        success: true,
        at: new Date().toISOString(),
      }));
      return json({ ok: true, ...(await statusPayload()) });
    }

    if (action === "test") {
      const key = await getZernioApiKey();
      if (!key) {
        return json({ ok: false, message: "No Zernio API key is configured yet.", ...(await statusPayload()) });
      }
      const verified = await zernio.verify();
      const profiles = verified.ok ? await zernio.listProfiles() : verified;
      const ok = verified.ok === true;
      const message = ok
        ? `Connected successfully (${
          profiles.ok ? unwrapList(profiles.data, "profiles").length : 0
        } profile(s) visible).`
        : `Connection failed: ${verified.message}`;
      await recordZernioTest(ok, message);
      console.log(JSON.stringify({
        scope: "zernio",
        operation: "admin_test_connection",
        user_id: user.id,
        success: ok,
        status: verified.status,
        at: new Date().toISOString(),
      }));
      return json({ ok, message, ...(await statusPayload()) });
    }

    // ---------------------------------------------------------- overview ---
    if (action === "overview") {
      const supabase = serviceClient();
      const count = async (
        table: string,
        build: (q: ReturnType<typeof supabase.from>) => unknown = (q) => q,
      ) => {
        // deno-lint-ignore no-explicit-any
        let q: any = supabase.from(table).select("id", { count: "exact", head: true });
        q = build(q);
        const { count: n } = await q;
        return n ?? 0;
      };
      const [profiles, accounts, connected, posts, failed, scheduled, clients] = await Promise.all([
        count("zernio_profiles"),
        count("zernio_accounts"),
        // deno-lint-ignore no-explicit-any
        count("zernio_accounts", (q: any) => q.eq("status", "connected")),
        count("zernio_posts"),
        // deno-lint-ignore no-explicit-any
        count("zernio_posts", (q: any) => q.eq("status", "failed")),
        // deno-lint-ignore no-explicit-any
        count("zernio_posts", (q: any) => q.in("status", ["scheduled", "publishing"])),
        supabase.from("zernio_profiles").select("user_id").then((r) =>
          new Set((r.data ?? []).map((x) => x.user_id)).size
        ),
      ]);
      return json({
        ...(await statusPayload()),
        stats: {
          profiles,
          accounts,
          connected_accounts: connected,
          clients,
          posts,
          failed_posts: failed,
          pending_posts: scheduled,
        },
      });
    }

    // ------------------------------------------- admin account management ---
    if (action === "admin_sync" || action === "admin_disconnect") {
      const supabase = serviceClient();
      if (action === "admin_disconnect") {
        const { data: row } = await supabase
          .from("zernio_accounts")
          .select("id, zernio_account_id")
          .eq("id", String(body.account_id ?? ""))
          .maybeSingle();
        if (!row) return json({ error: "Account not found." }, 404);
        const result = await zernio.disconnectAccount(row.zernio_account_id);
        if (result.ok === false && result.category !== "not_found") {
          return json({ error: result.message }, 400);
        }
        await supabase
          .from("zernio_accounts")
          .update({ status: "disconnected", last_synced_at: new Date().toISOString() })
          .eq("id", row.id);
        return json({ ok: true });
      }

      // admin_sync: refresh a single client's mirrored accounts
      const targetUser = String(body.user_id ?? "");
      const { data: profile } = await supabase
        .from("zernio_profiles")
        .select("id, zernio_profile_id")
        .eq("user_id", targetUser)
        .maybeSingle();
      if (!profile) return json({ error: "That client has no publishing profile yet." }, 404);
      const result = await zernio.listAccounts(profile.zernio_profile_id);
      if (result.ok === false) return json({ error: result.message }, 400);
      const now = new Date().toISOString();
      const remote = unwrapList<Record<string, unknown>>(result.data, "accounts");
      for (const account of remote) {
        const accountId = remoteId(account);
        if (!accountId) continue;
        await supabase.from("zernio_accounts").upsert({
          user_id: targetUser,
          profile_id: profile.id,
          zernio_profile_id: profile.zernio_profile_id,
          zernio_account_id: accountId,
          platform: normalizePlatform(account.platform),
          account_name: (account.displayName ?? account.name ?? null) as string | null,
          username: (account.username ?? null) as string | null,
          avatar_url: (account.profileImageUrl ?? account.avatar ?? null) as string | null,
          status: account.needsReconnection ? "reconnect_required" : "connected",
          last_synced_at: now,
          metadata: account,
        }, { onConflict: "zernio_profile_id,zernio_account_id" });
      }
      return json({ ok: true, synced: remote.length });
    }

    if (action === "publishing_history") {
      const supabase = serviceClient();
      let query = supabase
        .from("zernio_posts")
        .select("id, user_id, title, content, status, platforms, scheduled_at, published_at, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (body.user_id) query = query.eq("user_id", String(body.user_id));
      const { data } = await query;
      return json({ posts: data ?? [] });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (_err) {
    console.error(JSON.stringify({ scope: "zernio", operation: action, success: false }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
