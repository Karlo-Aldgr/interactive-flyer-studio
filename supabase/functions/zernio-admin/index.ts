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
      const result = await zernio.listProfiles();
      const ok = result.ok === true;
      const message = ok
        ? `Connected successfully (${unwrapList(result.data).length} profile(s) visible).`
        : `Connection failed: ${result.message}`;
      await recordZernioTest(ok, message);
      console.log(JSON.stringify({
        scope: "zernio",
        operation: "admin_test_connection",
        user_id: user.id,
        success: ok,
        status: result.ok ? result.status : result.status,
        at: new Date().toISOString(),
      }));
      return json({ ok, message, ...(await statusPayload()) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    console.error(JSON.stringify({ scope: "zernio", operation: action, success: false }));
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
