import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { LayerAction } from "@/types/flyer";
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

/**
 * Shared interactive-action runtime.
 *
 * Every surface that renders saved flyer layers outside the Konva flyer viewer
 * (digital business card, website) uses this so that ALL action types behave
 * exactly the same way: popups, galleries, carousels, coupons, forms, polls,
 * subscribe, bookings, product grids, menus, novels, surveys, etc.
 */

export function buildMapLink(p: LayerAction["payload"]) {
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

export function ActionOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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

export interface ActionRuntimeOptions {
  /** Flyer the interactions belong to (bookings, forms, orders are stored against it). */
  flyerId: string | null;
  /** Optional last-resort link for action types that need the full flyer viewer. */
  fallbackUrl?: string | null;
  /** Optional handler run before the built-in dispatch; return true to stop. */
  onBeforeAction?: (a: LayerAction) => boolean;
  /** Optional extra behaviour for the catch-all branch. */
  onUnhandled?: (a: LayerAction) => void;
}

export function useActionRuntime({ flyerId, fallbackUrl, onBeforeAction, onUnhandled }: ActionRuntimeOptions) {
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

  const sessionId = useMemo(() => {
    try {
      const key = "flyer_session_id";
      let id = localStorage.getItem(key);
      if (!id) {
        id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : "anon-" + Math.random().toString(36).slice(2);
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return "anon-" + Math.random().toString(36).slice(2);
    }
  }, []);

  useEffect(() => () => audioRef.current?.pause(), []);

  const runAction = useCallback(
    (a: LayerAction | null | undefined) => {
      if (!a) return;
      if (onBeforeAction?.(a)) return;
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
            if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener,noreferrer");
            break;
          }
          setNewInteraction(a);
          break;
        default: {
          if (onUnhandled) {
            onUnhandled(a);
            break;
          }
          const url = (p as any).url || (p as any).link || fallbackUrl;
          if (url) window.open(String(url), "_blank", "noopener,noreferrer");
          break;
        }
      }
    },
    [flyerId, fallbackUrl, onBeforeAction, onUnhandled],
  );

  const galleryImages = gallery?.payload.galleryImages || [];

  const dialogs = (
    <>
      {video && (
        <ActionOverlay onClose={() => setVideo(null)}>
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
        </ActionOverlay>
      )}

      {popup && (
        <ActionOverlay onClose={() => setPopup(null)}>
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
        </ActionOverlay>
      )}

      {gallery && (
        <ActionOverlay onClose={() => setGallery(null)}>
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
        </ActionOverlay>
      )}

      {coupon && (
        <ActionOverlay onClose={() => setCoupon(null)}>
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
        </ActionOverlay>
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
    </>
  );

  return { runAction, revealed, dialogs, sessionId };
}
