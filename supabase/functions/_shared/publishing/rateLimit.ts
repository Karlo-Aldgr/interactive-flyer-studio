import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

export const PER_MINUTE_LIMIT = Number(Deno.env.get("API_RATE_LIMIT_PER_MINUTE") ?? 60);
export const PER_DAY_LIMIT = Number(Deno.env.get("API_RATE_LIMIT_PER_DAY") ?? 1000);

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; message: string };

/** Per-key sliding-window limit backed by api_request_logs counts. */
export async function checkRateLimit(
  supabase: SupabaseClient,
  keyId: string,
): Promise<RateLimitVerdict> {
  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  const [minuteRes, dayRes] = await Promise.all([
    supabase
      .from("api_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("key_id", keyId)
      .gte("created_at", minuteAgo),
    supabase
      .from("api_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("key_id", keyId)
      .gte("created_at", dayAgo),
  ]);

  if ((minuteRes.count ?? 0) >= PER_MINUTE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: 60,
      message: `Rate limit exceeded: ${PER_MINUTE_LIMIT} requests per minute`,
    };
  }
  if ((dayRes.count ?? 0) >= PER_DAY_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: 3600,
      message: `Rate limit exceeded: ${PER_DAY_LIMIT} requests per day`,
    };
  }
  return { allowed: true };
}

export async function logApiRequest(supabase: SupabaseClient, entry: {
  request_id: string;
  key_id: string | null;
  key_prefix: string | null;
  owner_id: string | null;
  endpoint: string;
  platforms: string[];
  media_type: string | null;
  status: string;
  duration_ms: number;
  error_message: string | null;
}) {
  const { error } = await supabase.from("api_request_logs").insert(entry);
  if (error) console.error("[api_request_logs]", error.message);
}
