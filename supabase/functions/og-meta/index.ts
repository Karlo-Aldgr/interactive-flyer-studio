// DEPRECATED — do not use.
//
// This function was an attempt to serve OG meta tags for social previews,
// but Supabase Edge Functions inject `Content-Security-Policy: sandbox`
// on every response, which makes Facebook/Messenger ignore the OG tags.
//
// It has been replaced by a Cloudflare Worker — see /worker/share-worker.js
// and /worker/README.md in the project root.
//
// We keep this stub returning 410 Gone so any cached share links eventually
// fail loudly instead of silently serving broken previews.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    "This endpoint is deprecated. Configure the Cloudflare share Worker — see worker/README.md.",
    {
      status: 410,
      headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" },
    }
  );
});
