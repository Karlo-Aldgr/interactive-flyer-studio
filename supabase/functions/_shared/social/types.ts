// Shared contracts for every social platform adapter.
// Keep this file free of platform-specific logic.

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "x"
  | "youtube";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
];

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORMS as string[]).includes(value);
}

export type MediaKind = "image" | "video";

export type MediaItem = {
  url: string;
  type: MediaKind;
  mime_type?: string;
  asset_id?: string;
};

/** Normalized error taxonomy shared by every adapter. */
export type AdapterErrorCode =
  | "not_configured" // app credentials/secrets missing in the environment
  | "approval_required" // platform app review / product access not granted
  | "not_connected" // user has no usable account for this platform
  | "auth_expired" // token dead — user must reconnect
  | "permission_missing" // scope/permission not granted
  | "validation" // permanent payload problem, retry will not help
  | "unsupported" // capability not supported by the platform/adapter
  | "rate_limited"
  | "transient" // network / 5xx — retry is worthwhile
  | "unknown";

export type AdapterError = {
  ok: false;
  code: AdapterErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
};

export function adapterError(
  code: AdapterErrorCode,
  message: string,
  details?: unknown,
): AdapterError {
  const retryable = code === "transient" || code === "rate_limited";
  return { ok: false, code, message: message.slice(0, 500), retryable, details };
}

export type Ok<T> = { ok: true } & T;
export type AdapterResult<T> = Ok<T> | AdapterError;

export function isErr<T>(r: AdapterResult<T>): r is AdapterError {
  return r.ok === false;
}

/** Account discovered during OAuth or a sync. */
export type ResolvedAccount = {
  platform_account_id: string;
  account_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scopes: string[];
  metadata?: Record<string, unknown>;
};

/** Decrypted account handed to adapters at publish time. */
export type AdapterAccount = {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  platform_account_id: string;
  account_name: string | null;
  username: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
};

export type PublishInput = {
  caption: string;
  hashtags: string[];
  link: string | null;
  media: MediaItem[];
  options: Record<string, unknown>;
  scheduledAt: string | null;
  idempotencyKey: string;
};

export type PublishSuccess = {
  remote_post_id: string;
  remote_post_url: string | null;
  native_scheduled: boolean;
};

export type AnalyticsSnapshot = {
  impressions: number | null;
  reach: number | null;
  engagements: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  video_views: number | null;
  platform_metrics: Record<string, unknown>;
};

export type AuthStartInput = {
  redirectUri: string;
  state: string;
  scopes: string[];
};

export type AuthStart = { authorize_url: string; code_verifier?: string };

export type CallbackInput = {
  code: string;
  redirectUri: string;
  codeVerifier?: string | null;
};

/**
 * Every platform module implements this interface. Methods that a platform
 * genuinely cannot support must return an `unsupported` adapter error rather
 * than silently succeeding.
 */
export interface SocialPlatformAdapter {
  readonly platform: SocialPlatform;
  /** Env variable NAMES (never values) required for this adapter to work. */
  readonly requiredSecrets: string[];
  readonly defaultScopes: string[];
  /** Platform products/approvals a real app must be granted. */
  readonly approvalNotes: string;
  readonly developerConsoleUrl: string;

  startOAuth(input: AuthStartInput): AdapterResult<AuthStart> | Promise<AdapterResult<AuthStart>>;
  handleCallback(input: CallbackInput): Promise<AdapterResult<{ accounts: ResolvedAccount[] }>>;
  refreshToken(
    account: AdapterAccount,
  ): Promise<AdapterResult<{ access_token: string; refresh_token?: string | null; token_expires_at?: string | null }>>;
  getAccount(account: AdapterAccount): Promise<AdapterResult<{ account: Partial<ResolvedAccount> }>>;
  uploadMedia(
    account: AdapterAccount,
    item: MediaItem,
  ): Promise<AdapterResult<{ remote_media_id: string }>>;
  publishPost(
    account: AdapterAccount,
    input: PublishInput,
  ): Promise<AdapterResult<PublishSuccess>>;
  schedulePost(
    account: AdapterAccount,
    input: PublishInput,
  ): Promise<AdapterResult<PublishSuccess>>;
  deletePost(account: AdapterAccount, remotePostId: string): Promise<AdapterResult<Record<never, never>>>;
  getPostStatus(
    account: AdapterAccount,
    remotePostId: string,
  ): Promise<AdapterResult<{ status: string; remote_post_url?: string | null }>>;
  getAnalytics(
    account: AdapterAccount,
    remotePostId: string,
  ): Promise<AdapterResult<AnalyticsSnapshot>>;
  revoke(account: AdapterAccount): Promise<AdapterResult<Record<never, never>>>;
}

export function emptyAnalytics(
  platform_metrics: Record<string, unknown> = {},
): AnalyticsSnapshot {
  return {
    impressions: null,
    reach: null,
    engagements: null,
    likes: null,
    comments: null,
    shares: null,
    clicks: null,
    video_views: null,
    platform_metrics,
  };
}

export function composeText(caption: string, hashtags: string[], link: string | null) {
  const tags = hashtags
    .map((t) => t.trim().replace(/^#*/, ""))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ");
  return [caption.trim(), tags, link?.trim()].filter(Boolean).join("\n\n");
}
