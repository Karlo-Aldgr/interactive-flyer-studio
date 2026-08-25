import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { IntroPreset, Layer, LayerAction, PageIntro } from "@/types/flyer";
import type { BizadAudioSettings } from "@/lib/bizadPage";
import type { BizadRecord } from "@/lib/bizad";
import { downloadVCard } from "@/lib/bizad";
import { BizadVideoEmbed } from "@/components/bizad/BizadVideoEmbed";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import CarouselDialog from "@/components/viewer/CarouselDialog";
import AppointmentBookingDialog from "@/components/viewer/AppointmentBookingDialog";
import NewInteractionDialogs from "@/components/viewer/NewInteractionDialogs";
import {
  BizadAirMessages,
  BizadFormDialog,
  BizadPollDialog,
  BizadProductGridDialog,
  BizadRealtorGalleryDialog,
  BizadSubscribeDialog,
} from "@/components/viewer/BizadInteractionDialogs";



export type BizadLayout = {
  width: number;
  height: number;
  background: string;
  backgroundImage?: string | null;
  layers: Layer[];
  intro?: PageIntro | null;
  audio?: BizadAudioSettings | null;
};

function resolveIntroCfg(intro: PageIntro | null | undefined) {
  return {
    preset: (intro?.preset ?? "none") as IntroPreset,
    durationMs: intro?.durationMs ?? 600,
    delayMs: intro?.delayMs ?? 0,
    stagger: intro?.stagger ?? false,
    staggerStepMs: intro?.staggerStepMs ?? 80,
    loop: intro?.loop ?? false,
    loopDelayMs: intro?.loopDelayMs ?? 1000,
  };
}

/** Same intro presets as the flyer viewer, expressed as CSS transforms. */
function introStart(preset: IntroPreset): { transform: string; opacity: number; filter?: string } | null {
  switch (preset) {
    case "fade": return { transform: "none", opacity: 0 };
    case "slide-up": return { transform: "translateY(60px)", opacity: 0 };
    case "slide-down": return { transform: "translateY(-60px)", opacity: 0 };
    case "slide-left": return { transform: "translateX(60px)", opacity: 0 };
    case "slide-right": return { transform: "translateX(-60px)", opacity: 0 };
    case "zoom": return { transform: "scale(0.9)", opacity: 0 };
    case "pop": return { transform: "scale(0.6)", opacity: 0 };
    case "blur": return { transform: "scale(1.05)", opacity: 0, filter: "blur(6px)" };
    case "drop": return { transform: "translateY(-120px)", opacity: 0 };
    default: return null;
  }
}

function IntroWrap({
  intro,
  index,
  pageIntro,
  children,
}: {
  intro: PageIntro | null | undefined;
  index: number;
  pageIntro: PageIntro | null | undefined;
  children: React.ReactNode;
}) {
  const cfg = resolveIntroCfg(intro ?? pageIntro);
  const delay = intro ? cfg.delayMs : cfg.delayMs + (cfg.stagger ? index * cfg.staggerStepMs : 0);
  const start = introStart(cfg.preset);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(!start || !!reduced);

  useEffect(() => {
    if (!start || reduced) return;
    let cancelled = false;
    const timers: number[] = [];
    const run = () => {
      setShown(false);
      timers.push(window.setTimeout(() => !cancelled && setShown(true), delay + 20));
    };
    run();
    let interval: number | undefined;
    if (cfg.loop) {
      interval = window.setInterval(run, delay + cfg.durationMs + cfg.loopDelayMs);
    }
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.preset, cfg.durationMs, cfg.loop, cfg.loopDelayMs, delay]);

  if (!start) return <>{children}</>;

  return (
    <div
      style={{
        transition: `transform ${cfg.durationMs}ms ease-out, opacity ${cfg.durationMs}ms ease-out, filter ${cfg.durationMs}ms ease-out`,
        transform: shown ? "none" : start.transform,
        opacity: shown ? 1 : start.opacity,
        filter: shown ? "none" : start.filter,
      }}
    >
      {children}
    </div>
  );
}

export function isBizadLayout(v: unknown): v is BizadLayout {
  const l = v as BizadLayout | null;
  return !!l && Array.isArray(l.layers) && l.layers.length > 0 && !!l.width && !!l.height;
}

function buildMapLink(p: LayerAction["payload"]) {
  const { mapAddress, mapLat, mapLng, mapProvider } = p;
  const isApple =
    mapProvider === "apple"
      ? true
      : mapProvider === "google"
        ? false
        : /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const hasCoords = typeof mapLat === "number" && typeof mapLng === "number";
  if (isApple) {
    if (hasCoords) return `https://maps.apple.com/?ll=${mapLat},${mapLng}${mapAddress ? `&q=${encodeURIComponent(mapAddress)}` : ""}`;
    if (mapAddress) return `https://maps.apple.com/?q=${encodeURIComponent(mapAddress)}`;
  } else {
    if (hasCoords) return `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`;
    if (mapAddress) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`;
  }
  return "";
}

function LayerView({
  layer,
  onAction,
}: {
  layer: Layer;
  onAction: (a: LayerAction) => void;
}) {
  const s = layer.style || {};
  const clickable = !!layer.action;
  const base: React.CSSProperties = {
    position: "absolute",
    left: layer.position.x,
    top: layer.position.y,
    width: layer.size.width,
    height: layer.size.height,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    opacity: s.opacity ?? 1,
    cursor: clickable ? "pointer" : undefined,
  };
  const onClick = clickable ? () => onAction(layer.action as LayerAction) : undefined;


  if (layer.type === "image") {
    return (
      <img
        src={(layer.content as any).src}
        alt={(layer.content as any).alt || ""}
        loading="lazy"
        onClick={onClick}
        style={{ ...base, objectFit: (s.objectFit as CSSProperties["objectFit"]) || "contain", objectPosition: "center", borderRadius: s.cornerRadius ?? 0 }}
      />
    );
  }

  if (layer.type === "video") {
    const c = layer.content as any;
    return (
      <video
        src={c.src || c.videoUrl}
        poster={c.poster}
        autoPlay={c.autoplay !== false}
        loop={c.loop !== false}
        muted={c.muted !== false}
        playsInline
        controls={!!c.controls}
        onClick={onClick}
        style={{ ...base, objectFit: "contain", borderRadius: s.cornerRadius ?? 0 }}
      />
    );
  }



  if (layer.type === "text") {
    return (
      <div
        onClick={onClick}
        style={{
          ...base,
          color: s.color || "#0f172a",
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight as any,
          textAlign: (s.align as any) || "left",
          whiteSpace: "pre-wrap",
          lineHeight: 1.25,
        }}
      >
        {(layer.content as any).text}
      </div>
    );
  }

  if (layer.type === "button" || layer.type === "shape") {
    const label = (layer.content as any).label;
    return (
      <div
        onClick={onClick}
        style={{
          ...base,
          background: s.fill || "#2563eb",
          color: s.color || "#ffffff",
          borderRadius: s.cornerRadius ?? 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight as any,
          textAlign: "center",
        }}
      >
        {label}
      </div>
    );
  }

  // hotspot / icon fallback — invisible tap target
  return <div onClick={onClick} style={{ ...base, background: "transparent" }} />;
}

/** CSS equivalent of the flyer viewer's tappable-hotspot highlight rings. */
function TapHighlight({ layer }: { layer: Layer }) {
  const hl = layer.action?.highlight ?? {};
  const style = hl.style ?? "pulse";
  if (hl.enabled === false || style === "none") return null;
  const color = hl.color ?? "#7c3aed";
  const thickness = hl.thickness ?? 3;
  const opacity = hl.opacity ?? 0.85;
  const { x, y } = layer.position;
  const { width: w, height: h } = layer.size;
  const isEllipse = layer.type === "hotspot" && (layer.content as any)?.hotspotShape === "ellipse";
  const radius = isEllipse ? "50%" : `${layer.style?.cornerRadius ?? 12}px`;
  const base: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    pointerEvents: "none",
    boxSizing: "border-box",
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
  };

  if (style === "circle") {
    const d = Math.max(w, h) + thickness * 4;
    return (
      <div
        style={{
          ...base,
          left: x + w / 2 - d / 2,
          top: y + h / 2 - d / 2,
          width: d,
          height: d,
          border: `${thickness}px solid ${color}`,
          borderRadius: "50%",
          opacity,
        }}
      />
    );
  }

  if (style === "corners") {
    const len = Math.max(10, Math.min(w, h) * 0.18);
    const corner = (cs: React.CSSProperties): React.CSSProperties => ({
      position: "absolute",
      width: len,
      height: len,
      ...cs,
    });
    return (
      <div style={{ ...base, opacity }}>
        <div style={corner({ left: 0, top: 0, borderLeft: `${thickness}px solid ${color}`, borderTop: `${thickness}px solid ${color}` })} />
        <div style={corner({ right: 0, top: 0, borderRight: `${thickness}px solid ${color}`, borderTop: `${thickness}px solid ${color}` })} />
        <div style={corner({ left: 0, bottom: 0, borderLeft: `${thickness}px solid ${color}`, borderBottom: `${thickness}px solid ${color}` })} />
        <div style={corner({ right: 0, bottom: 0, borderRight: `${thickness}px solid ${color}`, borderBottom: `${thickness}px solid ${color}` })} />
      </div>
    );
  }

  const borderStyle = style === "dashed" ? "dashed" : "solid";
  return (
    <div style={{ ...base }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `${thickness}px ${borderStyle} ${color}`,
          borderRadius: radius,
          opacity,
          boxShadow: style === "glow" ? `0 0 12px ${color}` : undefined,
          animation:
            style === "pulse"
              ? "bizadTapPulse 1.6s ease-in-out infinite"
              : style === "glow"
                ? "bizadTapGlow 1.6s ease-in-out infinite"
                : undefined,
        }}
      />
      {style === "pulse" && (
        <>
          <div style={{ position: "absolute", inset: 0, border: `${thickness}px solid ${color}`, borderRadius: radius, animation: "bizadTapPing 1.6s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, border: `${thickness}px solid ${color}`, borderRadius: radius, animation: "bizadTapPing 1.6s ease-out infinite", animationDelay: "0.8s" }} />
        </>
      )}
    </div>
  );
}

const HIGHLIGHT_KEYFRAMES = `
@keyframes bizadTapPulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
@keyframes bizadTapGlow { 0%,100% { box-shadow: 0 0 6px currentColor; opacity: .6 } 50% { box-shadow: 0 0 22px currentColor; opacity: 1 } }
@keyframes bizadTapPing { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(1.35); opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  [data-bizad-highlights] * { animation: none !important; }
}
`;

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full bg-muted p-1.5 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function BizadLayoutView({
  layout,
  bizad,
  embedded = false,
}: {
  layout: BizadLayout;
  bizad: BizadRecord;
  /** When true, used inside editor dialog — no full-screen bleed. */
  embedded?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [popup, setPopup] = useState<LayerAction | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [gallery, setGallery] = useState<LayerAction | null>(null);
  const [carousel, setCarousel] = useState<LayerAction | null>(null);
  const [coupon, setCoupon] = useState<LayerAction | null>(null);
  const [formAction, setFormAction] = useState<LayerAction | null>(null);
  const [subscribeAction, setSubscribeAction] = useState<LayerAction | null>(null);
  const [pollAction, setPollAction] = useState<LayerAction | null>(null);
  const [appointmentAction, setAppointmentAction] = useState<LayerAction | null>(null);
  const [newInteraction, setNewInteraction] = useState<LayerAction | null>(null);
  const [realtorGallery, setRealtorGallery] = useState<LayerAction | null>(null);
  const [productGrid, setProductGrid] = useState<LayerAction | null>(null);
  const [airMessages, setAirMessages] = useState<LayerAction | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const flyerId = (bizad as any).flyer_id || null;
  const sessionId = useMemo(() => {
    try {
      const key = "bizad_session_id";
      let id = localStorage.getItem(key);
      if (!id) {
        id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : "anon-" + Math.random().toString(36).slice(2);
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return "anon-" + Math.random().toString(36).slice(2);
    }
  }, []);


  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / layout.width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.width]);

  const runAction = useCallback(
    (a: LayerAction) => {
      if (!a) return;
      const p = a.payload || {};
      switch (a.type) {
        case "open_url":
          if (p.url) {
            if (/^(mailto:|tel:|sms:)/.test(p.url)) window.location.href = p.url;
            else window.open(p.url, p.newTab === false ? "_self" : "_blank", "noopener,noreferrer");
          }
          break;
        case "call":
          if (p.phone) window.location.href = `tel:${p.phone}`;
          break;
        case "sms":
          if (p.phone)
            window.location.href = `sms:${p.phone}${p.message ? `?body=${encodeURIComponent(p.message)}` : ""}`;
          break;
        case "video":
          if (p.videoUrl) setVideo(p.videoUrl);
          break;
        case "audio": {
          const url = p.audioUrl;
          if (!url) break;
          if (audioRef.current && !audioRef.current.paused && audioRef.current.src === url) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            break;
          }
          audioRef.current?.pause();
          const el = new Audio(url);
          el.loop = !!p.audioLoop;
          el.play().catch(() => toast.error("Could not play audio"));
          audioRef.current = el;
          break;
        }
        case "popup":
        case "buy_ticket":
        case "buy_product":
          setPopup(a);
          break;
        case "gallery":
          setGallery(a);
          break;
        case "carousel":
          setCarousel(a);
          break;
        case "coupon":
          setCoupon(a);
          break;
        case "add_to_calendar":
          runAddToCalendar(p);
          break;
        case "map": {
          const url = buildMapLink(p);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          break;
        }
        case "checkout":
          if (p.checkoutUrl) window.open(p.checkoutUrl, "_blank", "noopener,noreferrer");
          else setPopup({ ...a, type: "buy_product" } as LayerAction);
          break;
        case "form":
        case "rsvp":
          setFormAction(a);
          break;
        case "subscribe":
          setSubscribeAction(a);
          break;
        case "poll":
          setPollAction(a);
          break;
        case "book_appointment":
          if (!flyerId) {
            toast.error("Booking isn't available yet");
            break;
          }
          setAppointmentAction(a);
          break;
        case "download_vcard":
          downloadVCard(bizad);
          break;
        case "realtor_gallery":
          setRealtorGallery(a);
          break;
        case "product_grid":
          setProductGrid(a);
          break;
        case "air_messages":
          setAirMessages(a);
          break;
        case "reveal":
          setRevealed((prev) => {
            const next = new Set(prev);
            (p.targetLayerIds || []).forEach((id) => next.add(id));
            return next;
          });
          break;
        case "survey":
        case "testimonial":
        case "reserve_table":
        case "schedule_consultation":
        case "show_menu":
        case "join_challenge":
        case "business_rating":
        case "novel":
          if (!flyerId) {
            if (bizad.gallery_url) window.open(bizad.gallery_url, "_blank", "noopener,noreferrer");
            break;
          }
          setNewInteraction(a);
          break;
        default: {
          // Interactions that need the full flyer viewer open the live flyer instead,
          // so a tap never dead-ends. Contact-style buttons still save the vCard.
          const label = (p.title || "").toLowerCase();
          if (label.includes("contact")) downloadVCard(bizad);
          else if (bizad.gallery_url) window.open(bizad.gallery_url, "_blank", "noopener,noreferrer");
          break;
        }
      }
    },
    [bizad, flyerId],
  );

  useEffect(() => () => audioRef.current?.pause(), []);

  const hiddenIds = useMemo(() => {
    const ids = new Set<string>();
    layout.layers.forEach((l) => {
      if (l.action?.type === "reveal") {
        (l.action.payload.targetLayerIds || []).forEach((id) => {
          if (!revealed.has(id)) ids.add(id);
        });
      }
    });
    return ids;
  }, [layout.layers, revealed]);

  const ordered = [...layout.layers]
    .filter((l) => !hiddenIds.has(l.id))
    .sort((a, b) => a.z_index - b.z_index);
  const galleryImages = gallery?.payload.galleryImages || [];


  return (
    <div
      className={embedded ? "w-full" : "min-h-screen w-full"}
      style={{
        backgroundColor: layout.background || "#ffffff",
        backgroundImage: layout.backgroundImage ? `url(${layout.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: embedded ? undefined : "fixed",
      }}
    >
      <div ref={wrapRef} className="mx-auto w-full max-w-[430px] px-2">
        <div style={{ height: layout.height * scale, position: "relative", overflow: "hidden" }}>
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            {ordered.map((l, i) => (
              <IntroWrap key={l.id} intro={l.intro} index={i} pageIntro={layout.intro}>
                <LayerView layer={l} onAction={runAction} />
              </IntroWrap>
            ))}
            <div data-bizad-highlights style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <style>{HIGHLIGHT_KEYFRAMES}</style>
              {ordered
                .filter((l) => !!l.action || l.type === "hotspot")
                .map((l) => (
                  <TapHighlight key={"hl-" + l.id} layer={l} />
                ))}
            </div>
          </div>

        </div>

        {!embedded && bizad.video_url ? (
          <div className="px-2 pb-6">
            <BizadVideoEmbed url={bizad.video_url} className="mt-4" />
          </div>
        ) : null}
      </div>

      {video && (
        <Overlay onClose={() => setVideo(null)}>
          {/youtube\.com|youtu\.be|vimeo\.com/.test(video) ? (
            <iframe
              src={
                video.includes("watch?v=")
                  ? video.replace("watch?v=", "embed/")
                  : video.replace("youtu.be/", "www.youtube.com/embed/")
              }
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full rounded-lg"
            />
          ) : (
            <video src={video} controls autoPlay playsInline className="w-full rounded-lg" />
          )}
        </Overlay>
      )}

      {popup && (
        <Overlay onClose={() => setPopup(null)}>
          <div style={{ color: popup.payload.popupTextColor || undefined }}>
            {(popup.payload.mediaUrl || popup.payload.ticketImageUrl) && (
              <img
                src={popup.payload.mediaUrl || popup.payload.ticketImageUrl}
                alt={popup.payload.title || "Details"}
                className="mb-3 w-full rounded-lg object-contain"
              />
            )}
            {popup.payload.title && <h2 className="mb-1 text-lg font-semibold">{popup.payload.title}</h2>}
            {popup.payload.body && <p className="whitespace-pre-wrap text-sm">{popup.payload.body}</p>}
            <div className="mt-3 flex flex-col gap-2">
              {(popup.payload.buttons || []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  style={{ background: b.bgColor || undefined, color: b.textColor || undefined }}
                  onClick={() => {
                    setPopup(null);
                    runAction(b.action);
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}

      {gallery && (
        <Overlay onClose={() => setGallery(null)}>
          {gallery.payload.galleryTitle && (
            <h2 className="mb-3 text-lg font-semibold">{gallery.payload.galleryTitle}</h2>
          )}
          <div className="grid grid-cols-2 gap-2">
            {galleryImages.map((img) => (
              <button
                key={img.id}
                type="button"
                className="overflow-hidden rounded-lg"
                onClick={() => (img.action ? runAction(img.action) : window.open(img.url, "_blank", "noopener"))}
              >
                <img src={img.url} alt={img.caption || ""} className="h-32 w-full object-cover" />
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {coupon && (
        <Overlay onClose={() => setCoupon(null)}>
          {coupon.payload.couponImageUrl && (
            <img src={coupon.payload.couponImageUrl} alt="Coupon" className="mb-3 w-full rounded-lg" />
          )}
          {coupon.payload.title && <h2 className="mb-1 text-lg font-semibold">{coupon.payload.title}</h2>}
          {coupon.payload.body && <p className="whitespace-pre-wrap text-sm">{coupon.payload.body}</p>}
          {coupon.payload.couponCode && (
            <div className="mt-3 rounded-lg border border-dashed p-3 text-center text-lg font-bold tracking-widest">
              {coupon.payload.couponCode}
            </div>
          )}
          {coupon.payload.couponRedeemUrl && (
            <a
              href={coupon.payload.couponRedeemUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Redeem
            </a>
          )}
        </Overlay>
      )}

      <CarouselDialog action={carousel} onClose={() => setCarousel(null)} onRunAction={runAction} />

      <BizadFormDialog action={formAction} flyerId={flyerId} onClose={() => setFormAction(null)} />
      <BizadSubscribeDialog action={subscribeAction} flyerId={flyerId} onClose={() => setSubscribeAction(null)} />
      <BizadPollDialog action={pollAction} flyerId={flyerId} onClose={() => setPollAction(null)} />
      <BizadRealtorGalleryDialog action={realtorGallery} onClose={() => setRealtorGallery(null)} />
      <BizadProductGridDialog
        action={productGrid}
        onClose={() => setProductGrid(null)}
        onBuy={(product, size, qty) => {
          setProductGrid(null);
          const url = product.paymentUrl || product.buyUrl;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            return;
          }
          setPopup({
            id: `pg-${product.id}`,
            type: "buy_product",
            payload: {
              title: product.name,
              body: [size ? `Size: ${size}` : "", `Quantity: ${qty}`, product.description || ""]
                .filter(Boolean)
                .join("\n"),
              mediaUrl: product.imageUrl,
            },
          } as unknown as LayerAction);
        }}
      />
      <BizadAirMessages action={airMessages} onClose={() => setAirMessages(null)} />

      {appointmentAction && flyerId && (
        <AppointmentBookingDialog
          flyerId={flyerId}
          layerId={null}
          action={appointmentAction}
          open
          onClose={() => setAppointmentAction(null)}
        />
      )}

      <NewInteractionDialogs
        action={newInteraction}
        flyerId={flyerId}
        sessionId={sessionId}
        onClose={() => setNewInteraction(null)}
      />
    </div>

  );
}
