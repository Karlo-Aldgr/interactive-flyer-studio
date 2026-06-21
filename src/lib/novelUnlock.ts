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

export function buildNovelPaypalUrl(handle: string, amount: number): string {
  const h = handle.replace(/^@/, "").trim();
  if (!h || amount <= 0) return "";
  return `https://paypal.me/${encodeURIComponent(h)}/${encodeURIComponent(amount.toFixed(2))}`;
}
