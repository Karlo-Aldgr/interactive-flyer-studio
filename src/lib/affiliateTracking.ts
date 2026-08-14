import { supabase } from "@/integrations/supabase/client";
import { classifyTrafficSource } from "@/lib/trafficSource";

const STORAGE_KEY = "ttf_affiliate_ref";
const SESSION_KEY = "ttf_affiliate_session";
/** Attribution window in days (configurable server-side later). */
export const ATTRIBUTION_DAYS = 14;

type StoredRef = { code: string; channel: string; savedAt: number };

const db = supabase as any;

function readStored(): StoredRef | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code) return null;
    const ageDays = (Date.now() - parsed.savedAt) / 86_400_000;
    if (ageDays > ATTRIBUTION_DAYS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Returns the currently attributed referral code (within the window), if any. */
export function getStoredReferral(): StoredRef | null {
  return readStored();
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Capture ?ref=CODE (or a /ref/CODE landing) from the current URL,
 * persist it for the attribution window and record the click.
 */
export async function captureReferralFromUrl(explicitCode?: string) {
  let code = explicitCode ?? null;
  let referrer: string | null = null;
  let utmSource: string | null = null;
  let landing: string | null = null;

  try {
    const params = new URLSearchParams(window.location.search);
    code = code ?? params.get("ref");
    utmSource = params.get("utm_source");
    referrer = document.referrer || null;
    landing = window.location.pathname + window.location.search;
  } catch {}

  if (!code) return null;
  code = code.trim().slice(0, 40);
  if (!code) return null;

  const channel = classifyTrafficSource({ utmSource, referrer });
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code, channel, savedAt: Date.now() } satisfies StoredRef),
    );
  } catch {}

  await db.rpc("affiliate_track_click", {
    _code: code,
    _channel: channel,
    _referrer: referrer,
    _landing: landing,
    _session: sessionId(),
  });

  return code;
}

/**
 * Attribute the signed-in user to the stored referral code.
 * Safe to call repeatedly — the server ignores duplicates.
 */
export async function attributeSignupIfPending() {
  const stored = readStored();
  if (!stored) return;
  const { data } = await db.rpc("affiliate_attribute_signup", {
    _code: stored.code,
    _channel: stored.channel,
  });
  if (data?.ok || data?.reason === "unknown_code") clearStoredReferral();
}
