import { useState } from "react";
import { X } from "lucide-react";
import type { ActionPayload } from "@/types/flyer";
import { formatNovelMoney } from "@/lib/novelUnlock";

interface Props {
  payload: ActionPayload;
}

/**
 * White PRICE FAB inside the novel reader (after the user opens the book).
 * Sits in a pinned footer bar so it stays visible while scrolling chapters.
 */
export function NovelReaderPriceFab({ payload: p }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || p.novelShowFlyerPrice === false) return null;

  const currency = p.novelCurrency || "USD";
  const chapterPrice = p.novelChapterPrice ?? 0.99;
  const bundlePrice = p.novelBundlePrice;
  const freeCount = typeof p.novelFreeCount === "number" ? p.novelFreeCount : 3;
  const hasBundle = bundlePrice != null && bundlePrice > 0;
  const hasChapter = chapterPrice > 0;

  if (!hasBundle && !hasChapter) return null;

  return (
    <div
      className="flex justify-end py-1"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex flex-row-reverse items-center gap-2">
        <button
          type="button"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-[9px] font-black uppercase leading-tight tracking-tight text-black shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-transform hover:scale-105 active:scale-95"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide pricing" : "Show pricing"}
          onClick={() => setExpanded((v) => !v)}
        >
          Price
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            expanded ? "max-w-[210px] opacity-100" : "max-w-0 opacity-0"
          }`}
          aria-hidden={!expanded}
        >
          <div className="relative w-[176px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-center shadow-2xl">
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-foreground shadow-md hover:bg-muted"
              aria-label="Close pricing"
              onClick={() => {
                setExpanded(false);
                setDismissed(true);
              }}
            >
              <X className="h-3 w-3" />
            </button>
            {hasBundle ? (
              <div className="text-base font-extrabold leading-tight text-white">
                {formatNovelMoney(bundlePrice!, currency)}
              </div>
            ) : (
              <div className="text-base font-extrabold leading-tight text-white">
                {formatNovelMoney(chapterPrice, currency)}
              </div>
            )}
            {hasBundle && hasChapter && (
              <div className="mt-1 text-[11px] font-medium text-slate-200">
                or {formatNovelMoney(chapterPrice, currency)}/chapter
              </div>
            )}
            {!hasBundle && hasChapter && (
              <div className="mt-1 text-[11px] font-medium text-slate-200">per chapter</div>
            )}
            {freeCount > 0 && (
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                First {freeCount} free
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
