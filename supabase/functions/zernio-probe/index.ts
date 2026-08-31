// TEMPORARY diagnostic: verifies the Zernio API key works server-side.
// Returns HTTP status codes and shapes only — never the key.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { getZernioApiKey } from "../_shared/zernio/secretStore.ts";

const BASE = (Deno.env.get("ZERNIO_BASE_URL")?.trim() || "https://zernio.com/api/v1").replace(/\/$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = await getZernioApiKey();
  if (!key) return json({ configured: false }, 200);

  const paths = ["/profiles", "/accounts", "/platforms", "/me", "/posts"];
  const results: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const res = await fetch(BASE + p, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      const text = (await res.text()).slice(0, 400);
      results[p] = { status: res.status, body: text };
    } catch (e) {
      results[p] = { error: String((e as Error).message).slice(0, 200) };
    }
  }
  return json({ configured: true, base: BASE, results });
});
