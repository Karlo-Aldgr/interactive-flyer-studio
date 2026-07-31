import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { CarouselSlide, LayerAction } from "@/types/flyer";

interface Props {
  action: LayerAction | null;
  onClose: () => void;
  /** Run a nested action (CTA button or media tap). */
  onRunAction: (a: LayerAction) => void;
}

/**
 * Multi-view scrolling gallery: card 1 is usually a video, the rest are flyer images.
 * Each card carries its own title, subtitle, CTA button and optional tap action.
 */
export default function CarouselDialog({ action, onClose, onRunAction }: Props) {
  const open = !!action;
  const p = action?.payload || {};
  const slides = useMemo<CarouselSlide[]>(() => p.carouselSlides || [], [p.carouselSlides]);
  const vertical = p.carouselDirection === "vertical";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  // Jump to the configured start slide when the carousel opens.
  useEffect(() => {
    if (!open) return;
    const start = Math.max(0, Math.min(slides.length - 1, p.carouselStartIndex ?? 0));
    setActive(start);
    const id = requestAnimationFrame(() => scrollTo(start, "auto"));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action?.id]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") scrollTo(active + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") scrollTo(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, slides.length]);

  function scrollTo(index: number, behavior: ScrollBehavior = "smooth") {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(slides.length - 1, index));
    const card = el.children[i] as HTMLElement | undefined;
    if (!card) return;
    if (vertical) el.scrollTo({ top: card.offsetTop - el.offsetTop, behavior });
    else el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior });
    setActive(i);
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const dist = vertical
        ? Math.abs(c.offsetTop - el.offsetTop - el.scrollTop)
        : Math.abs(c.offsetLeft - el.offsetLeft - el.scrollLeft);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    setActive(best);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-white">
            {p.carouselTitle || ""}
          </p>
          {slides.length > 0 && (
            <p className="text-[11px] text-white/50">{active + 1} / {slides.length}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close carousel"
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {slides.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            No slides yet.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className={
              vertical
                ? "flex h-full snap-y snap-mandatory flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 pb-6 [scrollbar-width:none]"
                : "flex h-full snap-x snap-mandatory items-stretch gap-4 overflow-x-auto overflow-y-hidden px-[6vw] pb-6 [scrollbar-width:none]"
            }
          >
            {slides.map((s, i) => (
              <SlideCard
                key={s.id}
                slide={s}
                vertical={vertical}
                isActive={i === active}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        )}

        {/* Desktop arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollTo(active - 1)}
              disabled={active === 0}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30 disabled:opacity-30 sm:block"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollTo(active + 1)}
              disabled={active === slides.length - 1}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30 disabled:opacity-30 sm:block"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-white" : "w-1.5 bg-white/35"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlideCard({
  slide, vertical, isActive, muted, onToggleMute, onRunAction,
}: {
  slide: CarouselSlide;
  vertical: boolean;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onRunAction: (a: LayerAction) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only the card in view plays.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && slide.videoAutoplay !== false) {
      v.play().catch(() => { /* autoplay may be blocked */ });
    } else {
      v.pause();
    }
  }, [isActive, slide.videoAutoplay]);

  const isVideo = slide.kind === "video" && !!slide.mediaUrl;
  const tap = slide.tapAction;

  return (
    <div
      className={`relative flex shrink-0 snap-center flex-col overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl ring-1 ring-white/10 ${
        vertical ? "w-full max-w-md self-center" : "h-full w-[78vw] max-w-[360px]"
      }`}
    >
      <div className="relative flex-1 overflow-hidden bg-black">
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={slide.mediaUrl}
              poster={slide.posterUrl || undefined}
              muted={muted}
              loop={slide.videoLoop !== false}
              playsInline
              controls={false}
              onClick={() => tap && onRunAction(tap)}
              className={`h-full w-full object-cover ${vertical ? "max-h-[60vh]" : ""} ${tap ? "cursor-pointer" : ""}`}
            />
            {slide.videoShowMute !== false && (
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? "Unmute video" : "Mute video"}
                className="absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
          </>
        ) : slide.mediaUrl ? (
          <img
            src={slide.mediaUrl}
            alt={slide.title || ""}
            loading="lazy"
            onClick={() => tap && onRunAction(tap)}
            className={`h-full w-full object-cover ${vertical ? "max-h-[60vh]" : ""} ${tap ? "cursor-pointer" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/40">No media</div>
        )}
      </div>

      {(slide.title || slide.subtitle || slide.ctaLabel) && (
        <div className="flex items-end justify-between gap-3 bg-neutral-900 px-3 py-3">
          <div className="min-w-0">
            {slide.title && (
              <p className="truncate text-sm font-semibold text-white">{slide.title}</p>
            )}
            {slide.subtitle && (
              <p className="line-clamp-2 text-[12px] text-white/60">{slide.subtitle}</p>
            )}
          </div>
          {slide.ctaLabel && slide.ctaAction && (
            <button
              type="button"
              onClick={() => onRunAction(slide.ctaAction as LayerAction)}
              style={{
                backgroundColor: slide.ctaBgColor || "#25D366",
                color: slide.ctaTextColor || "#ffffff",
              }}
              className="shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold shadow transition active:scale-95"
            >
              {slide.ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
