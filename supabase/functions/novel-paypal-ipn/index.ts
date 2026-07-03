import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    if (!rawBody) return new Response("ok", { headers: corsHeaders });

    const verifyRes = await fetch("https://ipnpb.paypal.com/cgi-bin/webscr", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `cmd=_notify-validate&${rawBody}`,
    });
    const verifyText = (await verifyRes.text()).trim();
    if (verifyText !== "VERIFIED") {
      console.warn("[novel-paypal-ipn] verification failed:", verifyText);
      return new Response("ok", { headers: corsHeaders });
    }

    const params = new URLSearchParams(rawBody);
    const paymentStatus = params.get("payment_status") ?? "";
    const paymentRef = params.get("custom") ?? "";
    const txnId = params.get("txn_id");

    if (!paymentRef || !["Completed", "Processed"].includes(paymentStatus)) {
      return new Response("ok", { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase
      .from("novel_purchases")
      .update({
        status: "completed",
        paypal_txn_id: txnId,
      })
      .eq("payment_ref", paymentRef)
      .eq("status", "pending");

    if (error) console.error("[novel-paypal-ipn] update failed:", error.message);

    return new Response("ok", { headers: corsHeaders });
  } catch (err) {
    console.error("[novel-paypal-ipn]", err);
    return new Response("ok", { headers: corsHeaders });
  }
});
