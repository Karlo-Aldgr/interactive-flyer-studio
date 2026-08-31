// Server-only Zernio API service layer.
// The business API key lives in ZERNIO_API_KEY and never leaves this boundary.

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

export function zernioConfigured() {
  return Boolean(Deno.env.get("ZERNIO_API_KEY")?.trim());
}

const FRIENDLY: Record<ZernioErrorCategory, string> = {
  not_configured:
    "Social publishing is not configured yet. An administrator needs to finish the Zernio setup.",
  unauthorized: "TapThatFlyer could not authenticate with Zernio. An administrator has been notified.",
  forbidden: "Zernio refused this request. Please contact support.",
  not_found: "That Zernio record no longer exists. Try refreshing your connected accounts.",
  rate_limited: "Zernio is busy right now. Please wait a moment and try again.",
  unavailable: "Zernio is temporarily unavailable. Please try again shortly.",
  invalid_request: "Zernio rejected that request. Please check the details and try again.",
  unknown: "Something went wrong talking to Zernio. Please try again.",
};

function categorize(status: number): ZernioErrorCategory {
  if (status === 401) return "unauthorized";
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
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<ZernioResult<T>> {
  const key = Deno.env.get("ZERNIO_API_KEY")?.trim();
  if (!key) return fail("not_configured");

  const url = new URL(BASE_URL + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
    const remote = (parsed as { message?: string; error?: string } | null);
    const detail = typeof remote?.message === "string"
      ? remote.message
      : typeof remote?.error === "string"
      ? remote.error
      : undefined;
    const category = categorize(res.status);
    // Only surface remote detail for client-fixable categories.
    const showDetail = category === "invalid_request" || category === "not_found";
    return fail(category, res.status, showDetail && detail ? detail.slice(0, 200) : undefined);
  }

  return { ok: true, status: res.status, data: (parsed ?? {}) as T };
}

// ------------------------------------------------------------- profiles ----

export type ZernioProfile = {
  id: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
};

export type ZernioAccount = {
  id: string;
  platform?: string;
  provider?: string;
  name?: string;
  display_name?: string;
  username?: string;
  handle?: string;
  avatar?: string;
  avatar_url?: string;
  picture?: string;
  status?: string;
  connected_at?: string;
  [key: string]: unknown;
};

export type ZernioPost = { id: string; status?: string; [key: string]: unknown };

/** Zernio list endpoints may return either an array or {data:[...]}. */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of ["data", "profiles", "accounts", "posts", "items", "results"]) {
    const value = obj?.[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

/** Zernio single endpoints may return the object or {data:{...}}. */
export function unwrapOne<T>(payload: unknown): T {
  const obj = payload as Record<string, unknown> | null;
  if (obj && typeof obj === "object" && obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as T;
  }
  return (obj ?? {}) as T;
}

export const zernio = {
  createProfile: (input: { name: string; [key: string]: unknown }) =>
    request<unknown>("POST", "/profiles", input),
  getProfile: (profileId: string) => request<unknown>("GET", `/profiles/${profileId}`),
  listProfiles: () => request<unknown>("GET", "/profiles"),
  updateProfile: (profileId: string, patch: Record<string, unknown>) =>
    request<unknown>("PATCH", `/profiles/${profileId}`, patch),

  /** Returns the hosted authorization URL the client is redirected to. */
  createConnectionUrl: (input: {
    profileId: string;
    platform?: string;
    redirectUrl?: string;
  }) =>
    request<unknown>("POST", `/profiles/${input.profileId}/connect`, {
      platform: input.platform,
      redirect_url: input.redirectUrl,
    }),

  listAccounts: (profileId: string) =>
    request<unknown>("GET", "/accounts", undefined, { profile_id: profileId }),
  getAccount: (accountId: string) => request<unknown>("GET", `/accounts/${accountId}`),
  disconnectAccount: (accountId: string) => request<unknown>("DELETE", `/accounts/${accountId}`),

  createPost: (input: Record<string, unknown>) => request<unknown>("POST", "/posts", input),
  getPost: (postId: string) => request<unknown>("GET", `/posts/${postId}`),
  listPosts: (profileId?: string) =>
    request<unknown>("GET", "/posts", undefined, { profile_id: profileId }),

  /** Platform catalogue, when the Zernio deployment exposes one. */
  listPlatforms: () => request<unknown>("GET", "/platforms"),
};
