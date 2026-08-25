import { useEffect, useState } from "react";
import type { IntroPreset, Layer, PageIntro } from "@/types/flyer";

/**
 * Shared visual effects used by every renderer that shows saved flyer layers
 * (flyer viewer, digital business card, website). Keeps intro animations and
 * tap highlights identical across surfaces.
 */

export function resolveIntroCfg(intro: PageIntro | null | undefined) {
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
export function introStart(preset: IntroPreset): { transform: string; opacity: number; filter?: string } | null {
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

export function IntroWrap({
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

/**
 * CSS equivalent of the flyer viewer's tappable-hotspot highlight rings.
 * `scale` and `offsetY` let scaled surfaces (website bands) place the ring
 * over the same spot as the layer itself.
 */
export function TapHighlight({
  layer,
  scale = 1,
  offsetY = 0,
}: {
  layer: Layer;
  scale?: number;
  offsetY?: number;
}) {
  const hl = layer.action?.highlight ?? {};
  const style = hl.style ?? "pulse";
  if (hl.enabled === false || style === "none") return null;
  const color = hl.color ?? "#7c3aed";
  const thickness = hl.thickness ?? 3;
  const opacity = hl.opacity ?? 0.85;
  const x = layer.position.x * scale;
  const y = (layer.position.y - offsetY) * scale;
  const w = layer.size.width * scale;
  const h = layer.size.height * scale;
  const isEllipse = layer.type === "hotspot" && (layer.content as any)?.hotspotShape === "ellipse";
  const radius = isEllipse ? "50%" : `${(layer.style?.cornerRadius ?? 12) * scale}px`;
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

export const HIGHLIGHT_KEYFRAMES = `
@keyframes bizadTapPulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
@keyframes bizadTapGlow { 0%,100% { box-shadow: 0 0 6px currentColor; opacity: .6 } 50% { box-shadow: 0 0 22px currentColor; opacity: 1 } }
@keyframes bizadTapPing { 0% { transform: scale(1); opacity: .8 } 100% { transform: scale(1.35); opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  [data-bizad-highlights] * { animation: none !important; }
}
`;

/** Layers hidden until a `reveal` action targets them. */
export function computeHiddenIds(layers: Layer[], revealed: Set<string>) {
  const ids = new Set<string>();
  layers.forEach((l) => {
    if (l.action?.type === "reveal") {
      (l.action.payload.targetLayerIds || []).forEach((id) => {
        if (!revealed.has(id)) ids.add(id);
      });
    }
  });
  return ids;
}
