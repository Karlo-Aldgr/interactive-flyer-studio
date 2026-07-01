import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronLeft, ChevronRight, Check, Lock, Loader2, ExternalLink } from "lucide-react";
import { NovelReaderPriceFab } from "@/components/viewer/NovelFlyerPriceBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayerAction, NovelChapter } from "@/types/flyer";
import {
  buildNovelPaypalUrl,
  isChapterUnlocked,
  loadNovelUnlock,
  saveNovelUnlock,
  type NovelUnlockState,
} from "@/lib/novelUnlock";
import { resolveNovelCoverUrl } from "@/lib/novelCover";

const READER_EMAIL_KEY = "novel_reader_email";
const READER_NAME_KEY = "novel_reader_name";

interface Props {
  action: LayerAction;
  flyerId: string;
  coverFallbackUrl?: string | null;
  onClose: () => void;
  onLog?: (eventType: string, meta?: Record<string, unknown>) => void;
}

export function NovelReaderDialog({ action, flyerId, coverFallbackUrl, onClose, onLog }: Props) {
  const p = action.payload || {};
  const chapters: NovelChapter[] = p.novelChapters || [];
  const freeCount = typeof p.novelFreeCount === "number" ? p.novelFreeCount : 3;
  const currency = p.novelCurrency || "USD";
  const chapterPrice = p.novelChapterPrice ?? 0.99;
  const bundlePrice = p.novelBundlePrice;
  const paypalHandle = (p.novelPaypalHandle || "").trim();
  const bookTitle = p.novelBookTitle || "Story";
  const author = p.novelAuthor || "";
  const coverUrl = resolveNovelCoverUrl(p.novelCoverUrl, coverFallbackUrl);

  const [email, setEmail] = useState(() => localStorage.getItem(READER_EMAIL_KEY) || "");
  const [name, setName] = useState(() => localStorage.getItem(READER_NAME_KEY) || "");
  const [unlock, setUnlock] = useState<NovelUnlockState | null>(null);
  const [view, setView] = useState<"list" | "read" | "unlock">("list");
  const [activeChapter, setActiveChapter] = useState<NovelChapter | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (email.trim()) {
      setUnlock(loadNovelUnlock(flyerId, action.id, email));
    } else {
      setUnlock(null);
    }
  }, [email, flyerId, action.id]);

  const chapterAccess = useMemo(() => {
    return chapters.map((ch, i) => {
      const isFree = ch.free === true || (ch.free !== false && i < freeCount);
      const unlocked = isChapterUnlocked(unlock, ch.number, isFree);
      return { chapter: ch, isFree, unlocked };
    });
  }, [chapters, freeCount, unlock]);

  function persistReader() {
    localStorage.setItem(READER_EMAIL_KEY, email.trim().toLowerCase());
    if (name.trim()) localStorage.setItem(READER_NAME_KEY, name.trim());
  }

  function chapterIsFree(ch: NovelChapter, index: number): boolean {
    return ch.free === true || (ch.free !== false && index < freeCount);
  }

  function priceForChapter(ch: NovelChapter): number {
    return ch.price ?? chapterPrice;
  }

  function formatMoney(amount: number): string {
    return `${currency} ${amount.toFixed(2)}`;
  }

  function chapterPriceLabel(ch: NovelChapter, index: number, isFree: boolean, unlocked: boolean) {
    if (unlocked) return { text: "Unlocked", kind: "unlocked" as const };
    if (isFree) return { text: "Free", kind: "free" as const };
    return { text: formatMoney(priceForChapter(ch)), kind: "paid" as const };
  }

  function openChapter(ch: NovelChapter, index: number) {
    if (!email.trim()) {
      toast.error("Enter your email first to read or unlock chapters");
      return;
    }
    persistReader();
    const isFree = chapterIsFree(ch, index);
    const unlocked = isChapterUnlocked(unlock, ch.number, isFree);
    if (unlocked) {
      setActiveChapter(ch);
      setView("read");
      onLog?.("novel_chapter_view", { chapter: ch.number, title: ch.title });
      return;
    }
    setActiveChapter(ch);
    setView("unlock");
  }

  async function recordPurchase(args: {
    purchaseType: "chapter" | "bundle";
    chapterNumbers: number[];
    amount: number;
  }) {
    if (!email.trim()) return toast.error("Email is required");
    setBusy(true);
    const buyerEmail = email.trim().toLowerCase();
    const { error } = await supabase.from("novel_purchases").insert([{
      flyer_id: flyerId,
      action_id: action.id,
      book_title: bookTitle,
      buyer_email: buyerEmail,
      buyer_name: name.trim() || null,
      purchase_type: args.purchaseType,
      chapter_numbers: args.chapterNumbers,
      amount: args.amount,
      currency,
      status: "pending",
    }]);
    setBusy(false);
    if (error) {
      console.error("[novel purchase]", error);
      toast.error("Could not record purchase — try again");
      return;
    }

    const prev = loadNovelUnlock(flyerId, action.id, buyerEmail) || {
      email: buyerEmail,
      name: name.trim() || undefined,
      chapters: [] as number[],
    };
    const next: NovelUnlockState = {
      ...prev,
      email: buyerEmail,
      name: name.trim() || prev.name,
      bundle: args.purchaseType === "bundle" ? true : prev.bundle,
      chapters:
        args.purchaseType === "bundle"
          ? chapters.map((c) => c.number)
          : [...new Set([...prev.chapters, ...args.chapterNumbers])],
    };
    saveNovelUnlock(flyerId, action.id, next);
    setUnlock(next);
    onLog?.(`novel_unlock_${args.purchaseType}`, { chapters: args.chapterNumbers, amount: args.amount });
    toast.success("Unlocked! Enjoy your reading.");
    if (activeChapter) {
      setView("read");
    } else {
      setView("list");
    }
  }

  async function followAuthor() {
    if (!email.trim()) return toast.error("Enter your email to follow");
    persistReader();
    setBusy(true);
    const { error } = await supabase.from("novel_subscriptions").insert([{
      flyer_id: flyerId,
      action_id: action.id,
      book_title: bookTitle,
      subscriber_email: email.trim().toLowerCase(),
      subscriber_name: name.trim() || null,
      tier: "free",
      status: "active",
    }]);
    setBusy(false);
    if (error) {
      if (String(error.message).includes("duplicate")) toast.success("You're already following!");
      else toast.error("Could not subscribe");
      return;
    }
    toast.success("You're following the author!");
  }

  function unlockPanel() {
    if (!activeChapter) return null;
    const price = activeChapter.price ?? chapterPrice;
    const paypalUrl = paypalHandle ? buildNovelPaypalUrl(paypalHandle, price) : "";
    const bundleUrl =
      bundlePrice && paypalHandle ? buildNovelPaypalUrl(paypalHandle, bundlePrice) : "";

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setView("list")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to chapters
        </Button>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{activeChapter.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This chapter is locked. Pay via PayPal to unlock.
          </p>
        </div>
        {!paypalHandle && (
          <p className="text-sm text-destructive">
            PayPal is not configured for this book — contact the author.
          </p>
        )}
        {paypalUrl && (
          <Button className="w-full" variant="outline" asChild>
            <a href={paypalUrl} target="_blank" rel="noopener noreferrer" onClick={() => onLog?.("novel_unlock_click", { type: "chapter", chapter: activeChapter.number })}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Pay {currency} {price.toFixed(2)} on PayPal
            </a>
          </Button>
        )}
        <Button
          className="w-full"
          disabled={busy || !paypalHandle}
          onClick={() =>
            recordPurchase({
              purchaseType: "chapter",
              chapterNumbers: [activeChapter.number],
              amount: price,
            })
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've paid — unlock this chapter"}
        </Button>
        {bundlePrice && bundleUrl && (
          <>
            <div className="text-center text-xs text-muted-foreground">or unlock the full book</div>
            <Button variant="secondary" className="w-full" asChild>
              <a href={bundleUrl} target="_blank" rel="noopener noreferrer">
                Full book · {currency} {bundlePrice.toFixed(2)}
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                recordPurchase({
                  purchaseType: "bundle",
                  chapterNumbers: chapters.map((c) => c.number),
                  amount: bundlePrice,
                })
              }
            >
              I've paid for the full book
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {bookTitle}
          </DialogTitle>
          {author && <DialogDescription>by {author}</DialogDescription>}
        </DialogHeader>

        {view === "list" && (
          <>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <p className="font-semibold text-foreground">Pricing</p>
              <p className="mt-0.5 text-foreground">
                {formatMoney(chapterPrice)} per chapter
                {bundlePrice != null && bundlePrice > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · Full book {formatMoney(bundlePrice)}
                  </span>
                )}
              </p>
              {freeCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  First {freeCount} chapter{freeCount === 1 ? "" : "s"} free
                </p>
              )}
            </div>

            {coverUrl && (
              <div className="mt-3 space-y-2 text-center">
                {bundlePrice != null && bundlePrice > 0 && (
                  <p className="text-sm font-semibold text-foreground">
                    Pay {formatMoney(bundlePrice)} to access the complete story
                  </p>
                )}
                <img
                  src={coverUrl}
                  alt={bookTitle}
                  className="mx-auto max-h-52 w-full max-w-xs rounded-lg object-contain shadow-sm"
                />
              </div>
            )}
          </>
        )}

        {(view === "list" || view === "unlock") && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Your email (for unlocks)</Label>
              <Input
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <Label className="text-xs">Name (optional)</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {chapterAccess.filter((c) => c.unlocked).length} of {chapters.length} chapters available
            </p>
            {chapters.map((ch, i) => {
              const { isFree, unlocked } = chapterAccess[i];
              const price = chapterPriceLabel(ch, i, isFree, unlocked);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => openChapter(ch, i)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 font-medium truncate">
                    {ch.title || `Chapter ${ch.number}`}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {price.kind === "unlocked" && (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                        <span className="text-xs font-medium text-primary">{price.text}</span>
                      </>
                    )}
                    {price.kind === "free" && (
                      <Badge variant="secondary" className="text-[10px]">{price.text}</Badge>
                    )}
                    {price.kind === "paid" && (
                      <>
                        <span className="text-xs font-semibold tabular-nums text-foreground">{price.text}</span>
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
            {(p.novelFollowEnabled !== false || p.novelSubscribeEnabled) && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {p.novelFollowEnabled !== false && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={followAuthor}>
                    Follow author (free)
                  </Button>
                )}
                {p.novelSubscribeEnabled && p.novelSubscribeUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={p.novelSubscribeUrl} target="_blank" rel="noopener noreferrer">
                      Subscribe{p.novelSubscribePrice ? ` · ${currency} ${p.novelSubscribePrice}` : ""}
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {view === "read" && activeChapter && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{activeChapter.title}</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {activeChapter.body || "(Empty chapter)"}
            </div>
            {(() => {
              const currentIndex = chapters.findIndex((c) => c.id === activeChapter.id);
              const nextCh = chapters[currentIndex + 1];
              return (
                <div className="flex items-center justify-between pt-4">
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setView("list")}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> All chapters
                  </Button>
                  {nextCh && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-2"
                      onClick={() => openChapter(nextCh, currentIndex + 1)}
                    >
                      Next chapter <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {view === "unlock" && unlockPanel()}
        </div>

        {(view === "list" || view === "unlock") && (
          <div className="shrink-0 border-t border-border bg-background px-4 pb-3 pt-1">
            <NovelReaderPriceFab payload={p} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
