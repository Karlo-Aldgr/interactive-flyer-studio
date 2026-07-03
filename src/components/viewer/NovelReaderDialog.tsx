import { useEffect, useMemo, useRef, useState } from "react";
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
  applyVerifiedPurchase,
  buildNovelPaypalUrl,
  canVerifyNovelPayment,
  formatNovelMoney,
  hasNovelPaypal,
  isChapterUnlocked,
  loadNovelUnlock,
  type NovelUnlockState,
} from "@/lib/novelUnlock";
import { resolveNovelCoverUrl } from "@/lib/novelCover";

const READER_EMAIL_KEY = "novel_reader_email";
const READER_NAME_KEY = "novel_reader_name";

interface Props {
  action: LayerAction;
  flyerId: string;
  coverFallbackUrl?: string | null;
  previewMode?: boolean;
  onClose: () => void;
  onLog?: (eventType: string, meta?: Record<string, unknown>) => void;
}

function openExternalUrl(url: string): boolean {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) return true;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export function NovelReaderDialog({ action, flyerId, coverFallbackUrl, previewMode = false, onClose, onLog }: Props) {
  const p = action.payload || {};
  const chapters: NovelChapter[] = p.novelChapters || [];
  const freeCount = typeof p.novelFreeCount === "number" ? p.novelFreeCount : 3;
  const currency = p.novelCurrency || "USD";
  const chapterPrice = p.novelChapterPrice ?? 0.99;
  const bundlePrice = p.novelBundlePrice;
  const paypalHandle = (p.novelPaypalHandle || "").trim();
  const paypalEmail = (p.novelPaypalEmail || "").trim();
  const paypalBundleLink = (p.novelPaypalBundleLink || "").trim();
  const paypalOpts = useMemo(
    () => ({ handle: paypalHandle, email: paypalEmail, bundleLink: paypalBundleLink }),
    [paypalHandle, paypalEmail, paypalBundleLink],
  );
  const paypalConfigured = hasNovelPaypal(paypalOpts);
  const bookTitle = p.novelBookTitle || "Story";
  const author = p.novelAuthor || "";
  const coverUrl = resolveNovelCoverUrl(p.novelCoverUrl, coverFallbackUrl);

  const [email, setEmail] = useState(() => localStorage.getItem(READER_EMAIL_KEY) || "");
  const [name, setName] = useState(() => localStorage.getItem(READER_NAME_KEY) || "");
  const [unlock, setUnlock] = useState<NovelUnlockState | null>(null);
  const [view, setView] = useState<"list" | "read" | "unlock">("list");
  const [activeChapter, setActiveChapter] = useState<NovelChapter | null>(null);
  const [unlockMode, setUnlockMode] = useState<"chapter" | "bundle">("chapter");
  const [activePaymentRef, setActivePaymentRef] = useState<string | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const pendingPurchaseRef = useRef<{
    purchaseType: "chapter" | "bundle";
    chapterNumbers: number[];
    amount: number;
  } | null>(null);
  const paymentVerifiableRef = useRef(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
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
    return formatNovelMoney(amount, currency);
  }

  function chapterPriceLabel(ch: NovelChapter, index: number, isFree: boolean, unlocked: boolean) {
    if (unlocked) return { text: "Free", kind: "unlocked" as const };
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
    setUnlockMode("chapter");
    resetPaymentFlow();
    setView("unlock");
  }

  function resetPaymentFlow() {
    setActivePaymentRef(null);
    setPaymentVerified(false);
    setVerifyingPayment(false);
    setPaymentTimedOut(false);
    pendingPurchaseRef.current = null;
    paymentVerifiableRef.current = true;
    setCheckoutError(null);
  }

  function completeVerifiedUnlock() {
    const pending = pendingPurchaseRef.current;
    if (!pending || !email.trim()) return;

    const buyerEmail = email.trim().toLowerCase();
    const next = applyVerifiedPurchase(
      flyerId,
      action.id,
      buyerEmail,
      name.trim() || undefined,
      pending.purchaseType,
      pending.chapterNumbers,
      chapters.map((c) => c.number),
    );
    setUnlock(next);
    onLog?.(`novel_unlock_${pending.purchaseType}`, {
      chapters: pending.chapterNumbers,
      amount: pending.amount,
      verified: true,
    });
    toast.success("Payment confirmed — enjoy your reading!");
    setView("read");
  }

  useEffect(() => {
    if (!activePaymentRef || paymentVerified || !paymentVerifiableRef.current) return;

    let cancelled = false;
    setVerifyingPayment(true);
    setPaymentTimedOut(false);

    const poll = async () => {
      for (let attempt = 0; attempt < 120 && !cancelled; attempt++) {
        const { data, error } = await supabase.rpc("check_novel_payment", {
          _payment_ref: activePaymentRef,
        });
        if (cancelled) return;
        if (error) {
          console.error("[novel payment poll]", error);
        } else if (data && typeof data === "object" && (data as { completed?: boolean }).completed) {
          setPaymentVerified(true);
          setVerifyingPayment(false);
          completeVerifiedUnlock();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      if (!cancelled) {
        setVerifyingPayment(false);
        setPaymentTimedOut(true);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [activePaymentRef, paymentVerified]);

  async function startPayPalCheckout(args: {
    purchaseType: "chapter" | "bundle";
    chapterNumbers: number[];
    amount: number;
    itemName: string;
    logMeta: Record<string, unknown>;
  }) {
    if (!email.trim()) return toast.error("Email is required");
    setCheckoutError(null);

    paymentVerifiableRef.current = canVerifyNovelPayment(paypalOpts, args.purchaseType);
    if (!paymentVerifiableRef.current) {
      toast.message("PayPal will open, but automatic unlock needs the author’s PayPal email in book settings.");
    }

    const buyerEmail = email.trim().toLowerCase();
    const isNewCheckout = !activePaymentRef;
    const paymentRef = activePaymentRef ?? crypto.randomUUID();
    const paypalUrl = buildNovelPaypalUrl(
      paypalOpts,
      args.amount,
      currency,
      args.itemName,
      args.purchaseType,
      paymentRef,
    );
    if (!paypalUrl) return toast.error("No valid PayPal link — check author PayPal settings");

    // Open PayPal immediately while the click is still a user gesture.
    // Browsers block window.open after await (async insert), which made Step 2 look broken.
    if (isNewCheckout) {
      pendingPurchaseRef.current = {
        purchaseType: args.purchaseType,
        chapterNumbers: args.chapterNumbers,
        amount: args.amount,
      };
      setActivePaymentRef(paymentRef);
      setPaymentVerified(false);
      setPaymentTimedOut(false);
      persistReader();
    }

    onLog?.("novel_unlock_click", { ...args.logMeta, payment_ref: paymentRef });
    openExternalUrl(paypalUrl);
    toast.message("Opening PayPal…");

    if (!isNewCheckout) return;

    setBusy(true);
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
      payment_ref: paymentRef,
    }]);
    setBusy(false);

    if (error) {
      console.error("[novel purchase]", error);
      const msg = String(error.message || "");
      if (msg.includes("row-level security") || msg.includes("policy")) {
        const hint = previewMode
          ? "PayPal opened, but checkout was not recorded. Publish the flyer or run the novel_purchases SQL migration."
          : "PayPal opened, but checkout was not recorded. Publish the flyer first.";
        setCheckoutError(hint);
        toast.error(hint);
      } else if (msg.includes("payment_ref")) {
        const hint = "PayPal opened, but database is missing payment_ref — run the novel payment migration in Supabase SQL.";
        setCheckoutError(hint);
        toast.error(hint);
      } else {
        const hint = `PayPal opened, but checkout was not recorded: ${msg || "try again"}`;
        setCheckoutError(hint);
        toast.error(hint);
      }
    }
  }

  async function recheckPayment() {
    if (!activePaymentRef) return;
    setPaymentTimedOut(false);
    setVerifyingPayment(true);
    const { data, error } = await supabase.rpc("check_novel_payment", {
      _payment_ref: activePaymentRef,
    });
    if (error) {
      console.error("[novel payment recheck]", error);
      toast.error("Could not check payment status");
      setVerifyingPayment(false);
      return;
    }
    if (data && typeof data === "object" && (data as { completed?: boolean }).completed) {
      setPaymentVerified(true);
      setVerifyingPayment(false);
      completeVerifiedUnlock();
      return;
    }
    setVerifyingPayment(false);
    toast.message("Payment not confirmed yet — finish on PayPal, then try again.");
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
    const chapterAmount = activeChapter.price ?? chapterPrice;
    const hasBundle = bundlePrice != null && bundlePrice > 0;
    const chapterVerifiable = canVerifyNovelPayment(paypalOpts, "chapter");
    const bundleVerifiable = canVerifyNovelPayment(paypalOpts, "bundle");
    const modeVerifiable = unlockMode === "chapter" ? chapterVerifiable : bundleVerifiable;

    const chapterPaypalUrl = buildNovelPaypalUrl(
      paypalOpts,
      chapterAmount,
      currency,
      activeChapter.title || `Chapter ${activeChapter.number}`,
      "chapter",
    );
    const bundlePaypalUrl = hasBundle
      ? buildNovelPaypalUrl(paypalOpts, bundlePrice, currency, bookTitle, "bundle")
      : "";

    const switchMode = (mode: "chapter" | "bundle") => {
      setUnlockMode(mode);
      resetPaymentFlow();
    };

    const activeAmount = unlockMode === "chapter" ? chapterAmount : bundlePrice!;
    const activePaypalUrl = unlockMode === "chapter" ? chapterPaypalUrl : bundlePaypalUrl;
    const payPalOpened = !!activePaymentRef;

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setView("list")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to chapters
        </Button>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{activeChapter.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what to buy, pay on PayPal, then wait for payment confirmation to unlock.
          </p>
        </div>

        {previewMode && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Preview mode — for a real payment test, publish the flyer and open the live public link (not Preview).
          </p>
        )}

        {checkoutError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {checkoutError}
          </p>
        )}
        {!paypalConfigured && (
          <p className="text-sm text-destructive">
            PayPal is not configured for this book — contact the author.
          </p>
        )}

        {!paypalEmail && paypalConfigured && (
          <p className="text-sm text-destructive">
            Author setup: add <strong>PayPal email</strong> in book settings, save the flyer, then publish.
          </p>
        )}

        {paypalConfigured && !modeVerifiable && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {unlockMode === "chapter"
              ? "Per-chapter unlock needs the author’s PayPal email — fixed payment links don’t work for chapters."
              : "For automatic unlock after payment, add the author’s PayPal email (not only a fixed payment link)."}
          </p>
        )}

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 — Choose</p>
          {hasBundle && paypalConfigured ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={unlockMode === "chapter" ? "default" : "outline"}
                size="sm"
                onClick={() => switchMode("chapter")}
              >
                This chapter · {formatMoney(chapterAmount)}
              </Button>
              <Button
                type="button"
                variant={unlockMode === "bundle" ? "default" : "outline"}
                size="sm"
                onClick={() => switchMode("bundle")}
              >
                Full book · {formatMoney(bundlePrice)}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-foreground">
              This chapter · <span className="font-semibold">{formatMoney(chapterAmount)}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 — Pay on PayPal</p>
          {activePaypalUrl ? (
            <Button
              type="button"
              className="w-full"
              variant={payPalOpened ? "secondary" : "default"}
              disabled={!activePaypalUrl || busy || verifyingPayment || !email.trim()}
              onClick={() =>
                startPayPalCheckout({
                  purchaseType: unlockMode,
                  chapterNumbers:
                    unlockMode === "bundle"
                      ? chapters.map((c) => c.number)
                      : [activeChapter.number],
                  amount: activeAmount,
                  itemName:
                    unlockMode === "chapter"
                      ? activeChapter.title || `Chapter ${activeChapter.number}`
                      : bookTitle,
                  logMeta:
                    unlockMode === "chapter"
                      ? { type: "chapter", chapter: activeChapter.number, amount: chapterAmount }
                      : { type: "bundle", amount: bundlePrice },
                })
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {payPalOpened ? "Open PayPal again" : `Pay ${formatMoney(activeAmount)} on PayPal`}
            </Button>
          ) : (
            <p className="text-sm text-destructive">
              {unlockMode === "chapter"
                ? "Add the author’s PayPal email in book settings for per-chapter purchases."
                : "No valid PayPal link — check author PayPal settings."}
            </p>
          )}
          {payPalOpened && !paymentVerified && modeVerifiable && (
            <p className="text-center text-xs text-muted-foreground">
              Finish payment on PayPal — unlock happens automatically after PayPal confirms.
            </p>
          )}
          {payPalOpened && !paymentVerified && !modeVerifiable && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-300">
              Payment opened — automatic unlock only works after the author adds their PayPal email.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3 — Confirm unlock</p>
          <Button className="w-full" disabled>
            {paymentVerified ? (
              "Unlocked"
            ) : verifyingPayment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Waiting for PayPal confirmation…
              </>
            ) : payPalOpened ? (
              "Complete payment on PayPal to unlock"
            ) : (
              "Pay on PayPal first (Step 2)"
            )}
          </Button>
          {paymentTimedOut && !paymentVerified && (
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => void recheckPayment()}
            >
              Check payment status again
            </Button>
          )}
          {!payPalOpened && modeVerifiable && paypalConfigured && (
            <p className="text-center text-xs text-muted-foreground">
              This unlocks only after PayPal confirms your payment — not when you open the link.
            </p>
          )}
        </div>
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
            {bundlePrice != null && bundlePrice > 0 && (
              <p className="text-sm font-semibold text-foreground">
                Pay {formatMoney(bundlePrice)} to access the complete story
              </p>
            )}

            {coverUrl && (
              <div className="mt-3 text-center">
                <img
                  src={coverUrl}
                  alt={bookTitle}
                  className="mx-auto max-h-52 w-full max-w-xs rounded-lg object-contain shadow-sm"
                />
              </div>
            )}

            {freeCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                First {freeCount} chapter{freeCount === 1 ? "" : "s"} free
                {chapterPrice > 0 && (
                  <>
                    {" "}
                    · {formatMoney(chapterPrice)} per chapter
                  </>
                )}
              </p>
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
                      Subscribe{p.novelSubscribePrice ? ` · ${formatNovelMoney(p.novelSubscribePrice, currency)}` : ""}
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
