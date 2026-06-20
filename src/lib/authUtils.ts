/** Safe in-app redirect target (open redirect guard). */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export function buildAuthRedirectUrl(next: string): string {
  const safeNext = sanitizeNextPath(next);
  return `${window.location.origin}/auth?next=${encodeURIComponent(safeNext)}`;
}

/** True when the URL carries a Supabase password-recovery token (hash or query). */
export function isPasswordRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  if (search.includes("type=recovery")) return true;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return params.get("type") === "recovery";
}

export function buildPasswordResetRedirectUrl(next?: string | null): string {
  const safeNext = sanitizeNextPath(next ?? undefined);
  return `${window.location.origin}/auth/reset-password?next=${encodeURIComponent(safeNext)}`;
}

export function passwordRecoveryRedirectPath(): string {
  if (typeof window === "undefined") return "/auth/reset-password";
  return `/auth/reset-password${window.location.search}${window.location.hash}`;
}

export const LOGIN_ERROR_MESSAGE = "Incorrect email or password.";

export const RESET_EMAIL_SENT_MESSAGE =
  "If an account exists with this email, a password reset link has been sent.";

export const SIGNUP_DUPLICATE_MESSAGE =
  "An account with this email already exists. Please sign in instead.";

export const GOOGLE_SIGNIN_DISABLED_MESSAGE =
  "Google sign-in is not enabled on this project's authentication settings. Enable the Google provider in Lovable Cloud (or Supabase Auth → Providers).";

/** Parse OAuth / magic-link errors returned in the URL hash or query string. */
export function parseAuthCallbackError(): string | null {
  if (typeof window === "undefined") return null;
  const sources = [window.location.hash.replace(/^#/, ""), window.location.search.replace(/^\?/, "")];
  for (const raw of sources) {
    if (!raw) continue;
    const params = new URLSearchParams(raw);
    const description = params.get("error_description");
    const code = params.get("error_code") || params.get("error");
    const msg = description?.replace(/\+/g, " ") || code?.replace(/_/g, " ");
    if (!msg) continue;
    if (/provider is not enabled/i.test(msg) || /unsupported provider/i.test(msg)) {
      return GOOGLE_SIGNIN_DISABLED_MESSAGE;
    }
    return msg;
  }
  return null;
}

export function clearAuthCallbackErrorFromUrl(): void {
  if (typeof window === "undefined") return;
  const hasHashError = window.location.hash.includes("error");
  const hasQueryError = window.location.search.includes("error");
  if (!hasHashError && !hasQueryError) return;
  const path = `${window.location.pathname}${window.location.search.replace(/[?&]error[^&]*/g, "").replace(/\?$/, "")}`;
  window.history.replaceState({}, "", path);
}

/** Detect duplicate signup attempts across Supabase auth settings. */
export function isSignupDuplicate(
  user: { identities?: { id: string }[] | null } | null,
  error: { code?: string; message?: string } | null,
): boolean {
  if (error) {
    const code = (error.code ?? "").toLowerCase();
    const msg = (error.message ?? "").toLowerCase();
    return (
      code === "user_already_exists" ||
      code === "email_exists" ||
      code === "user_already_registered" ||
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("already been registered")
    );
  }
  return !!user && (user.identities?.length ?? 0) === 0;
}
