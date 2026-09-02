import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug")?.trim() ?? "";
  let site: URL;
  try { site = new URL(Deno.env.get("PUBLIC_SITE_URL") || requestUrl.origin); }
  catch { return new Response("QR redirect is not configured", { status: 503 }); }
  const fallback = () => new Response(null, { status: 302, headers: { Location: site.origin } });
  if (!/^https?:$/.test(site.protocol) || !/^[a-z0-9-]{1,160}$/i.test(slug)) return fallback();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: flyer } = await db.from("flyers").select("id, public_slug, status").eq("public_slug", slug).eq("status", "published").maybeSingle();
  if (!flyer) return fallback();
  try {
    await db.functions.invoke("automation-engine", { body: { eventType: "qr_scanned", sourceType: "qr", sourceId: flyer.public_slug, clientEventId: `qr:${flyer.id}:${crypto.randomUUID()}` } });
  } catch { /* tracking must not block the trusted redirect */ }
  const destination = new URL(`/f/${encodeURIComponent(flyer.public_slug)}`, site);
  return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
});
