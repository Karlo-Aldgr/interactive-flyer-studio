export interface NovelUnlockState {
  email: string;
  name?: string;
  bundle?: boolean;
  chapters: number[];
}

function storageKey(flyerId: string, actionId: string, email: string): string {
  return `novel_unlock:${flyerId}:${actionId}:${email.trim().toLowerCase()}`;
}

export function loadNovelUnlock(
  flyerId: string,
  actionId: string,
  email: string,
): NovelUnlockState | null {
  if (!email.trim()) return null;
  try {
    const raw = localStorage.getItem(storageKey(flyerId, actionId, email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NovelUnlockState;
    if (!parsed || !Array.isArray(parsed.chapters)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNovelUnlock(
  flyerId: string,
  actionId: string,
  state: NovelUnlockState,
): void {
  localStorage.setItem(storageKey(flyerId, actionId, state.email), JSON.stringify(state));
}

export function isChapterUnlocked(
  state: NovelUnlockState | null,
  chapterNumber: number,
  isFree: boolean,
): boolean {
  if (isFree) return true;
  if (!state) return false;
  if (state.bundle) return true;
  return state.chapters.includes(chapterNumber);
}

export function formatNovelMoney(amount: number, currency = "USD"): string {
  if (currency === "USD" || currency === "$") return `$${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function isDirectPaypalLink(raw: string): boolean {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) || /paypal\.com\//i.test(s);
}

function extractMeHandle(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@/, "");
  const fromUrl = trimmed.match(/paypal\.me\/([^/?#\s]+)/i);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export type NovelPaypalConfig = {
  handle?: string;
  email?: string;
  bundleLink?: string;
};

export function novelPaypalIpnUrl(): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  if (!base) return "";
  return `${base}/functions/v1/novel-paypal-ipn`;
}

/** True when PayPal can notify us after payment (email checkout with IPN). */
export function canVerifyNovelPayment(
  opts: NovelPaypalConfig,
  mode: "chapter" | "bundle",
): boolean {
  return !!opts.email?.trim() && buildNovelPaypalUrl(opts, 0.01, "USD", "test", mode, "test").includes("notify_url");
}

export function hasNovelPaypal(opts: NovelPaypalConfig): boolean {
  const h = opts.handle?.trim();
  const bundle = opts.bundleLink?.trim();
  if (bundle && isDirectPaypalLink(bundle)) return true;
  if (h && (isDirectPaypalLink(h) || extractMeHandle(h))) return true;
  return !!opts.email?.trim();
}

export function buildNovelPaypalUrl(
  opts: NovelPaypalConfig,
  amount: number,
  currency = "USD",
  itemName = "Book chapter",
  mode: "chapter" | "bundle",
  paymentRef?: string,
): string {
  if (amount <= 0) return "";

  const email = opts.email?.trim();
  const notifyUrl = novelPaypalIpnUrl();

  // Chapters always use email / PayPal.me with the exact chapter amount — never a fixed bundle link.
  if (mode === "chapter") {
    if (email) {
      const params = new URLSearchParams({
        cmd: "_xclick",
        business: email,
        amount: amount.toFixed(2),
        currency_code: currency === "$" ? "USD" : currency,
        item_name: itemName,
        charset: "utf-8",
      });
      if (paymentRef) params.set("custom", paymentRef);
      if (notifyUrl) params.set("notify_url", notifyUrl);
      return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
    }

    const rawHandle = opts.handle?.trim() ?? "";
    const meHandle = rawHandle && !isDirectPaypalLink(rawHandle) ? extractMeHandle(rawHandle) : null;
    if (meHandle) {
      return `https://paypal.me/${encodeURIComponent(meHandle)}/${encodeURIComponent(amount.toFixed(2))}`;
    }
    return "";
  }

  // Full book: optional fixed payment link, else email / PayPal.me with bundle amount.
  const bundleLink = opts.bundleLink?.trim();
  if (bundleLink && isDirectPaypalLink(bundleLink)) {
    return normalizeUrl(bundleLink);
  }

  const rawHandle = opts.handle?.trim() ?? "";
  if (rawHandle && isDirectPaypalLink(rawHandle)) {
    return normalizeUrl(rawHandle);
  }

  if (email) {
    const params = new URLSearchParams({
      cmd: "_xclick",
      business: email,
      amount: amount.toFixed(2),
      currency_code: currency === "$" ? "USD" : currency,
      item_name: itemName,
      charset: "utf-8",
    });
    if (paymentRef) params.set("custom", paymentRef);
    if (notifyUrl) params.set("notify_url", notifyUrl);
    return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
  }

  const meHandle = rawHandle ? extractMeHandle(rawHandle) : null;
  if (meHandle) {
    return `https://paypal.me/${encodeURIComponent(meHandle)}/${encodeURIComponent(amount.toFixed(2))}`;
  }

  return "";
}

export function applyVerifiedPurchase(
  flyerId: string,
  actionId: string,
  buyerEmail: string,
  buyerName: string | undefined,
  purchaseType: "chapter" | "bundle",
  chapterNumbers: number[],
  allChapterNumbers: number[],
): NovelUnlockState {
  const prev = loadNovelUnlock(flyerId, actionId, buyerEmail) || {
    email: buyerEmail,
    name: buyerName,
    chapters: [] as number[],
  };

  const next: NovelUnlockState =
    purchaseType === "bundle"
      ? {
          ...prev,
          email: buyerEmail,
          name: buyerName || prev.name,
          bundle: true,
          chapters: allChapterNumbers,
        }
      : {
          ...prev,
          email: buyerEmail,
          name: buyerName || prev.name,
          bundle: false,
          chapters: [...new Set([...prev.chapters, ...chapterNumbers])],
        };

  saveNovelUnlock(flyerId, actionId, next);
  return next;
}
