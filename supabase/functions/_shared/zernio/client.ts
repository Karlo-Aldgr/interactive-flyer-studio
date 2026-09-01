// Server-only Zernio API service layer.
// The business API key lives in ZERNIO_API_KEY (or secure storage) and never
// leaves this boundary.
//
// Endpoint shapes verified against https://zernio.com/openapi.json.

import { getZernioApiKey } from "./secretStore.ts";

const BASE_URL = (Deno.env.get("ZERNIO_BASE_URL")?.trim() || "https://zernio.com/api/v1").replace(
  /\/$/,
  "",
);

export type ZernioErrorCategory =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_request"
  | "payment_required"
  | "unknown";

export type ZernioFailure = {
  ok: false;
  category: ZernioErrorCategory;
  status: number;
  /** Safe, user-facing message. Never contains secrets. */
  message: string;
};

export type ZernioSuccess<T> = { ok: true; status: number; data: T };
export type ZernioResult<T> = ZernioSuccess<T> | ZernioFailure;

export async function zernioConfigured(): Promise<boolean> {
  return Boolean(await getZernioApiKey());
}

const FRIENDLY: Record<ZernioErrorCategory, string> = {
  not_configured:
    "Social publishing is not configured yet. An administrator needs to finish the setup.",
  unauthorized: "TapThatFlyer could not authenticate with the publishing service.",
  forbidden: "The publishing service refused this request. Please contact support.",
  not_found: "That record no longer exists. Try refreshing your connected accounts.",
  rate_limited: "The publishing service is busy right now. Please wait a moment and try again.",
  unavailable: "The publishing service is temporarily unavailable. Please try again shortly.",
  invalid_request: "That request was rejected. Please check the details and try again.",
  payment_required:
    "The publishing service account has reached its limit. An administrator has been notified.",
  unknown: "Something went wrong while publishing. Please try again.",
};

function categorize(status: number): ZernioErrorCategory {
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  if (status >= 400) return "invalid_request";
  return "unknown";
}

function fail(category: ZernioErrorCategory, status = 0, message?: string): ZernioFailure {
  return { ok: false, category, status, message: message || FRIENDLY[category] };
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: {
    body?: unknown;
    query?: Record<string, string | undefined>;
    idempotencyKey?: string;
  } = {},
): Promise<ZernioResult<T>> {
  const key = await getZernioApiKey();
  if (!key) return fail("not_configured");

  const url = new URL(BASE_URL + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (_err) {
    // Network-level failure: never echo the request (it carries the key header).
    return fail("unavailable");
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const remote = parsed as
      | { message?: string; error?: string; details?: Record<string, unknown> }
      | null;
    const detail = typeof remote?.error === "string"
      ? remote.error
      : typeof remote?.message === "string"
      ? remote.message
      : undefined;
    const category = categorize(res.status);
    const showDetail = category === "invalid_request" || category === "not_found" ||
      category === "payment_required";
    const failure = fail(category, res.status, showDetail && detail ? detail.slice(0, 300) : undefined);
    // Conflict details help us recover an existing profile id.
    (failure as ZernioFailure & { details?: unknown }).details = remote?.details ?? null;
    return failure;
  }

  return { ok: true, status: res.status, data: (parsed ?? {}) as T };
}

// -------------------------------------------------------- platform names ----

/** Canonical TapThatFlyer platform slug -> Zernio platform slug. */
const TO_ZERNIO: Record<string, string> = {
  x: "twitter",
  twitter: "twitter",
  google_business: "googlebusiness",
  googlebusiness: "googlebusiness",
};

/** Zernio platform slug -> canonical TapThatFlyer slug. */
export function normalizePlatform(value: unknown): string {
  const raw = String(value ?? "").toLowerCase().trim();
  if (!raw) return "unknown";
  if (raw === "twitter") return "x";
  if (["gmb", "googlebusiness", "google-business", "google_my_business"].includes(raw)) {
    return "google_business";
  }
  return raw.replace(/[\s-]+/g, "_");
}

export function toZernioPlatform(value: string): string {
  const raw = String(value ?? "").toLowerCase().trim();
  return TO_ZERNIO[raw] ?? raw.replace(/_/g, "");
}

/** Platforms Zernio's connect endpoint accepts today. */
export const ZERNIO_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
  "pinterest",
  "threads",
  "reddit",
  "google_business",
  "telegram",
  "snapchat",
  "whatsapp",
  "discord",
  "slack",
  "bluesky",
] as const;

// ------------------------------------------------------------ unwrapping ----

export type ZernioProfile = {
  _id?: string;
  id?: string;
  name?: string;
  isDefault?: boolean;
  [key: string]: unknown;
};

export type ZernioAccount = {
  _id?: string;
  id?: string;
  platform?: string;
  name?: string;
  displayName?: string;
  username?: string;
  profileImageUrl?: string;
  avatar?: string;
  isActive?: boolean;
  needsReconnection?: boolean;
  createdAt?: string;
  profileId?: string | { _id?: string };
  [key: string]: unknown;
};

export type ZernioPost = {
  _id?: string;
  status?: string;
  publishedAt?: string;
  platforms?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export function remoteId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const obj = value as Record<string, unknown>;
  return String(obj._id ?? obj.id ?? "");
}

/** Zernio list endpoints return `{ <collection>: [...] }`. */
export function unwrapList<T>(payload: unknown, ...keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of [...keys, "data", "profiles", "accounts", "posts", "items", "results"]) {
    const value = obj?.[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export function unwrapOne<T>(payload: unknown, ...keys: string[]): T {
  const obj = payload as Record<string, unknown> | null;
  for (const key of [...keys, "data", "profile", "account", "post"]) {
    const value = obj?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  }
  return (obj ?? {}) as T;
}

// ------------------------------------------------------------------- API ----

export type ZernioMediaItem = {
  type: "image" | "video" | "gif" | "document";
  url: string;
  title?: string;
  altText?: string;
};

export type ZernioPostTarget = { platform: string; accountId: string; customContent?: string };

export const zernio = {
  /** Cheap authenticated ping used by the admin "Test connection" button. */
  verify: () => request<unknown>("GET", "/auth/verify"),

  listProfiles: (name?: string) => request<unknown>("GET", "/profiles", { query: { name } }),
  createProfile: (input: { name: string; description?: string; color?: string }, idem?: string) =>
    request<unknown>("POST", "/profiles", { body: input, idempotencyKey: idem }),
  getProfile: (profileId: string) => request<unknown>("GET", `/profiles/${profileId}`),
  deleteProfile: (profileId: string) => request<unknown>("DELETE", `/profiles/${profileId}`),

  /** Returns `{ authUrl }` for the hosted OAuth flow (selection UI included). */
  connectUrl: (input: { profileId: string; platform: string; redirectUrl: string }) =>
    request<{ authUrl?: string }>("GET", `/connect/${toZernioPlatform(input.platform)}`, {
      query: { profileId: input.profileId, redirect_url: input.redirectUrl },
    }),

  listAccounts: (profileId?: string) =>
    request<unknown>("GET", "/accounts", { query: { profileId } }),
  getAccount: (accountId: string) => request<unknown>("GET", `/accounts/${accountId}`),
  accountHealth: (accountId: string) => request<unknown>("GET", `/accounts/${accountId}/health`),
  disconnectAccount: (accountId: string) => request<unknown>("DELETE", `/accounts/${accountId}`),

  createPost: (
    input: {
      title?: string;
      content: string;
      mediaItems?: ZernioMediaItem[];
      platforms: ZernioPostTarget[];
      scheduledFor?: string;
      publishNow?: boolean;
      isDraft?: boolean;
      timezone?: string;
      metadata?: Record<string, unknown>;
    },
    idem?: string,
  ) => request<unknown>("POST", "/posts", { body: input, idempotencyKey: idem }),
  getPost: (postId: string) => request<unknown>("GET", `/posts/${postId}`),
  deletePost: (postId: string) => request<unknown>("DELETE", `/posts/${postId}`),
  retryPost: (postId: string) => request<unknown>("POST", `/posts/${postId}/retry`),
  listPosts: (profileId?: string) =>
    request<unknown>("GET", "/posts", { query: { profileId, limit: "50" } }),
};
