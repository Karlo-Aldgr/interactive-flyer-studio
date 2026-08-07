// Idempotency support for the external publishing API.
// A record is reserved before publishing and completed afterwards, so retries
// with the same Idempotency-Key return the original response instead of
// publishing again. Records expire after 24 hours.

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export type ReserveResult =
  | { kind: "disabled" }
  | { kind: "reserved" }
  | { kind: "replay"; httpStatus: number; body: unknown }
  | { kind: "in_progress"; originalRequestId: string }
  | { kind: "conflict"; message: string };

async function fingerprint(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function readIdempotencyKey(headers: Headers): string | null {
  const raw = headers.get(IDEMPOTENCY_HEADER) ?? headers.get(IDEMPOTENCY_HEADER.toLowerCase());
  const value = raw?.trim();
  if (!value) return null;
  return value.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}

/**
 * Attempts to claim the (api key, idempotency key) pair. Returns a replay of the
 * stored response when the same request was already completed.
 */
export async function reserveIdempotency(
  supabase: any,
  opts: { keyId: string; idempotencyKey: string | null; requestId: string; rawBody: string },
): Promise<ReserveResult> {
  if (!opts.idempotencyKey) return { kind: "disabled" };

  const fp = await fingerprint(opts.rawBody);

  // Clear any expired record for this pair so the key can be reused after 24h.
  await supabase
    .from("api_idempotency_keys")
    .delete()
    .eq("key_id", opts.keyId)
    .eq("idempotency_key", opts.idempotencyKey)
    .lt("expires_at", new Date().toISOString());

  const { error } = await supabase.from("api_idempotency_keys").insert({
    key_id: opts.keyId,
    idempotency_key: opts.idempotencyKey,
    request_fingerprint: fp,
    request_id: opts.requestId,
    state: "in_progress",
  });

  if (!error) return { kind: "reserved" };

  // Unique violation -> an existing record. Anything else: fail open (publish).
  if (error.code !== "23505") {
    console.error("[idempotency] reserve failed", error);
    return { kind: "disabled" };
  }

  const { data: existing } = await supabase
    .from("api_idempotency_keys")
    .select("request_id, request_fingerprint, state, http_status, response_body")
    .eq("key_id", opts.keyId)
    .eq("idempotency_key", opts.idempotencyKey)
    .maybeSingle();

  if (!existing) return { kind: "disabled" };

  if (existing.request_fingerprint && existing.request_fingerprint !== fp) {
    return {
      kind: "conflict",
      message: "Idempotency-Key was already used with a different request body",
    };
  }

  if (existing.state === "completed" && existing.response_body) {
    return {
      kind: "replay",
      httpStatus: existing.http_status ?? 200,
      body: existing.response_body,
    };
  }

  return { kind: "in_progress", originalRequestId: existing.request_id };
}

/** Stores the final response so future retries replay it. */
export async function completeIdempotency(
  supabase: any,
  opts: {
    keyId: string;
    idempotencyKey: string | null;
    requestId: string;
    httpStatus: number;
    body: unknown;
  },
): Promise<void> {
  if (!opts.idempotencyKey) return;
  const { error } = await supabase
    .from("api_idempotency_keys")
    .update({
      state: "completed",
      http_status: opts.httpStatus,
      response_body: opts.body,
      completed_at: new Date().toISOString(),
    })
    .eq("key_id", opts.keyId)
    .eq("idempotency_key", opts.idempotencyKey)
    .eq("request_id", opts.requestId);
  if (error) console.error("[idempotency] complete failed", error);
}

/** Releases the reservation when the request failed before publishing. */
export async function releaseIdempotency(
  supabase: any,
  opts: { keyId: string; idempotencyKey: string | null; requestId: string },
): Promise<void> {
  if (!opts.idempotencyKey) return;
  await supabase
    .from("api_idempotency_keys")
    .delete()
    .eq("key_id", opts.keyId)
    .eq("idempotency_key", opts.idempotencyKey)
    .eq("request_id", opts.requestId);
}
