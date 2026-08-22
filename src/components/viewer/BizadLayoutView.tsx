import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { IntroPreset, Layer, LayerAction, PageIntro } from "@/types/flyer";
import type { BizadAudioSettings } from "@/lib/bizadPage";
import type { BizadRecord } from "@/lib/bizad";
import { downloadVCard } from "@/lib/bizad";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import CarouselDialog from "@/components/viewer/CarouselDialog";


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

function runAction(action: LayerAction | null | undefined, bizad: BizadRecord) {
  if (!action) return;
  const p = action.payload || {};
  switch (action.type) {
    case "call":
      if (p.phone) window.location.href = `tel:${p.phone}`;
      break;
    case "sms":
      if (p.phone) window.location.href = `sms:${p.phone}`;
      break;
    case "video":
      if (p.videoUrl) window.open(p.videoUrl, "_blank", "noopener");
      break;
    case "open_url":
      if (p.url) {
        if (p.url.startsWith("mailto:") || p.url.startsWith("tel:")) window.location.href = p.url;
        else window.open(p.url, "_blank", "noopener");
      }
      break;
    default:
      downloadVCard(bizad);
  }
}

function LayerView({ layer, bizad }: { layer: Layer; bizad: BizadRecord }) {
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
  const onClick = clickable ? () => runAction(layer.action, bizad) : undefined;

  if (layer.type === "image") {
    return (
      <img
        src={(layer.content as any).src}
        alt={(layer.content as any).alt || ""}
        loading="lazy"
        onClick={onClick}
        style={{ ...base, objectFit: "contain", objectPosition: "center", borderRadius: s.cornerRadius ?? 0 }}
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

export function BizadLayoutView({ layout, bizad }: { layout: BizadLayout; bizad: BizadRecord }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / layout.width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.width]);

  const ordered = [...layout.layers].sort((a, b) => a.z_index - b.z_index);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: layout.background || "#ffffff",
        backgroundImage: layout.backgroundImage ? `url(${layout.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
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
                <LayerView layer={l} bizad={bizad} />
              </IntroWrap>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
