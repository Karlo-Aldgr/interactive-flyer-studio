import { adapterError, type AdapterError } from "./types.ts";

export type JsonResponse = { status: number; ok: boolean; body: Record<string, unknown> };

export async function fetchJson(
  input: string | URL,
  init?: RequestInit,
): Promise<JsonResponse> {
  const res = await fetch(input, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: res.status, ok: res.ok, body };
}

/** Maps an HTTP status + provider payload onto the shared error taxonomy. */
export function mapHttpError(
  res: JsonResponse,
  fallback: string,
  providerMessage?: string,
): AdapterError {
  const message = (providerMessage || extractMessage(res.body) || fallback).slice(0, 500);
  if (res.status === 401) return adapterError("auth_expired", message, res.body);
  if (res.status === 403) return adapterError("permission_missing", message, res.body);
  if (res.status === 429) return adapterError("rate_limited", message, res.body);
  if (res.status >= 500) return adapterError("transient", message, res.body);
  if (res.status >= 400) return adapterError("validation", message, res.body);
  return adapterError("unknown", message, res.body);
}

export function extractMessage(body: Record<string, unknown>): string {
  const err = body.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.message_id === "string") return e.message_id;
  }
  if (typeof body.message === "string") return body.message;
  if (typeof body.error_description === "string") return body.error_description;
  if (Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0] as Record<string, unknown>;
    if (typeof first?.message === "string") return first.message;
    if (typeof first?.detail === "string") return first.detail;
  }
  return "";
}

/** Missing-secret guard used by every adapter. */
export function requireEnv(names: string[]): Record<string, string> | AdapterError {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (!value) missing.push(name);
    else out[name] = value;
  }
  if (missing.length) {
    return adapterError(
      "not_configured",
      `Missing server credentials: ${missing.join(", ")}. Add them in Project Settings → Secrets.`,
    );
  }
  return out;
}

export function expiresAtFrom(seconds: unknown): string | null {
  const n = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + n * 1000).toISOString();
}
