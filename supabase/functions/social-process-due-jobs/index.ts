// Scheduler worker: claims due publish jobs and runs them.
// Trigger with a cron/HTTP scheduler using the x-cron-secret header.
import { corsHeaders, json } from "../_shared/social/cors.ts";
import { serviceClient } from "../_shared/social/store.ts";
import { backoffMs, publishVariant, rollupPostStatus, type VariantRow } from "../_shared/social/publish.ts";

const BATCH = 20;
const LOCK_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("SOCIAL_CRON_SECRET")?.trim();
  if (!secret) {
    return json({
      error: "Scheduler is not configured. Add SOCIAL_CRON_SECRET in Project Settings → Secrets.",
      code: "scheduler_not_configured",
    }, 400);
  }
  if (req.headers.get("x-cron-secret") !== secret) return json({ error: "Forbidden" }, 403);

  const supabase = serviceClient();
  const now = new Date();
  const workerId = crypto.randomUUID();
  const staleLock = new Date(now.getTime() - LOCK_MINUTES * 60_000).toISOString();

  // Claim due jobs (also reclaiming locks that were abandoned by a dead worker).
  const { data: due } = await supabase
    .from("social_publish_jobs")
    .select("*")
    .in("status", ["pending", "locked"])
    .lte("due_at", now.toISOString())
    .or(`locked_at.is.null,locked_at.lt.${staleLock}`)
    .order("due_at", { ascending: true })
    .limit(BATCH);

  const jobs = due ?? [];
  const processed: unknown[] = [];
  const touchedPosts = new Set<string>();

  for (const job of jobs) {
    const { data: claimed } = await supabase
      .from("social_publish_jobs")
      .update({
        status: "locked",
        locked_at: now.toISOString(),
        locked_by: workerId,
        attempt_count: (job.attempt_count ?? 0) + 1,
      })
      .eq("id", job.id)
      .in("status", ["pending", "locked"])
      .lte("due_at", now.toISOString())
      .select("id, attempt_count, max_attempts")
      .maybeSingle();
    if (!claimed) continue; // another worker won the race

    const { data: variant } = await supabase
      .from("social_post_variants")
      .select("*")
      .eq("id", job.variant_id)
      .maybeSingle();

    if (!variant) {
      await supabase
        .from("social_publish_jobs")
        .update({ status: "failed", last_error: "Variant no longer exists", locked_by: null })
        .eq("id", job.id);
      continue;
    }

    const result = await publishVariant(supabase, variant as VariantRow, {
      idempotencyKey: job.idempotency_key,
      scheduledAt: job.due_at,
      allowNativeSchedule: false,
    });
    touchedPosts.add(job.post_id);

    if (result.ok) {
      await supabase.from("social_publish_jobs").update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        locked_by: null,
        last_error: null,
      }).eq("id", job.id);
    } else {
      const attempt = claimed.attempt_count ?? 1;
      const canRetry = result.retryable && attempt < (claimed.max_attempts ?? 5);
      await supabase.from("social_publish_jobs").update({
        status: canRetry ? "pending" : "failed",
        next_attempt_at: canRetry ? new Date(Date.now() + backoffMs(attempt)).toISOString() : null,
        due_at: canRetry ? new Date(Date.now() + backoffMs(attempt)).toISOString() : job.due_at,
        locked_at: null,
        locked_by: null,
        last_error: result.message.slice(0, 500),
        completed_at: canRetry ? null : new Date().toISOString(),
      }).eq("id", job.id);
    }
    processed.push({ job_id: job.id, ...result });
  }

  for (const postId of touchedPosts) await rollupPostStatus(supabase, postId);

  return json({ ok: true, claimed: jobs.length, processed });
});
