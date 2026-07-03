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

/** Display amounts with $ for USD (client preference). */
export function formatNovelMoney(amount: number, currency = "USD"): string {
  if (currency === "USD" || currency === "$") return `$${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function hasNovelPaypal(handle?: string, email?: string): boolean {
  return !!(handle?.replace(/^@/, "").trim() || email?.trim());
}

export function buildNovelPaypalUrl(
  opts: { handle?: string; email?: string },
  amount: number,
  currency = "USD",
  itemName = "Book chapter",
): string {
  if (amount <= 0) return "";
  const handle = opts.handle?.replace(/^@/, "").trim();
  if (handle) {
    return `https://paypal.me/${encodeURIComponent(handle)}/${encodeURIComponent(amount.toFixed(2))}`;
  }
  const email = opts.email?.trim();
  if (email) {
    const params = new URLSearchParams({
      cmd: "_xclick",
      business: email,
      amount: amount.toFixed(2),
      currency_code: currency === "$" ? "USD" : currency,
      item_name: itemName,
    });
    return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
  }
  return "";
}
