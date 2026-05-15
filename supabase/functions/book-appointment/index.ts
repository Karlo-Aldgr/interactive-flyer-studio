// book-appointment: validates booking, inserts row, attempts to send confirmation email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingBody {
  flyerId: string;
  layerId?: string | null;
  actionId?: string | null;
  name?: string | null;
  email: string;
  phone?: string | null;
  note?: string | null;
  startISO: string;
  endISO: string;
  timezone?: string;
  title?: string;
  location?: string;
  description?: string;
  confirmSubject?: string;
  confirmIntro?: string;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isIso(s: string) {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as BookingBody;

    // Basic validation
    if (!body.flyerId || !body.email || !body.startISO || !body.endISO) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isEmail(body.email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isIso(body.startISO) || !isIso(body.endISO)) {
      return new Response(JSON.stringify({ error: "Invalid date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify flyer is published
    const { data: flyer, error: flyerErr } = await supabase
      .from("flyers")
      .select("id, status, title")
      .eq("id", body.flyerId)
      .maybeSingle();
    if (flyerErr || !flyer || (flyer.status !== "published" && flyer.status !== "draft")) {
      return new Response(JSON.stringify({ error: "Flyer not bookable" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Conflict check (same start time, confirmed)
    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("flyer_id", body.flyerId)
      .eq("status", "confirmed")
      .eq("start_at", body.startISO)
      .limit(1);
    if (conflict && conflict.length > 0) {
      return new Response(
        JSON.stringify({ error: "That time was just booked. Please pick another." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert
    const { data: inserted, error: insertErr } = await supabase
      .from("appointments")
      .insert({
        flyer_id: body.flyerId,
        layer_id: body.layerId,
        action_id: body.actionId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        note: body.note,
        start_at: body.startISO,
        end_at: body.endISO,
        timezone: body.timezone,
        status: "confirmed",
        metadata: {
          title: body.title,
          location: body.location,
          description: body.description,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to send confirmation email — non-fatal if email infra isn't configured
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    try {
      const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "appointment-confirmation",
          recipientEmail: body.email,
          idempotencyKey: `appt-confirm-${inserted.id}`,
          templateData: {
            name: body.name || "",
            title: body.title || flyer.title || "Appointment",
            location: body.location || "",
            description: body.description || "",
            intro: body.confirmIntro || "",
            startISO: body.startISO,
            endISO: body.endISO,
            timezone: body.timezone || "UTC",
          },
        },
      });
      emailStatus = mailErr ? "failed" : "sent";
    } catch (_e) {
      emailStatus = "failed";
    }

    return new Response(
      JSON.stringify({ id: inserted.id, emailStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
