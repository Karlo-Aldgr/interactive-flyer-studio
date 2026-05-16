import { useEffect, useRef } from "react";
import { Group } from "react-konva";
import Konva from "konva";
import type { PageIntro, IntroPreset } from "@/types/flyer";

interface Props {
  preset: IntroPreset;
  durationMs: number;
  delayMs: number;
  loop?: boolean;
  loopDelayMs?: number;
  // Center coordinates of the wrapped node (canvas space) — used as the
  // pivot for scale-based presets so they zoom around the layer center.
  cx: number;
  cy: number;
  // Bumps on replay / page change to retrigger the animation
  introKey: number | string;
  children: React.ReactNode;
}

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Initial transform values for each preset. The wrapper is positioned at
// (cx, cy) with offset (cx, cy) so scale tweens pivot around the node center
// while leaving the child's own coordinates untouched.
function startState(preset: IntroPreset) {
  switch (preset) {
    case "fade":
      return { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 0 };
    case "slide-up":
      return { x: 0, y: 60, scaleX: 1, scaleY: 1, opacity: 0 };
    case "slide-down":
      return { x: 0, y: -60, scaleX: 1, scaleY: 1, opacity: 0 };
    case "slide-left":
      return { x: 60, y: 0, scaleX: 1, scaleY: 1, opacity: 0 };
    case "slide-right":
      return { x: -60, y: 0, scaleX: 1, scaleY: 1, opacity: 0 };
    case "zoom":
      return { x: 0, y: 0, scaleX: 0.9, scaleY: 0.9, opacity: 0 };
    case "pop":
      return { x: 0, y: 0, scaleX: 0.6, scaleY: 0.6, opacity: 0 };
    case "blur":
      return { x: 0, y: 0, scaleX: 1.05, scaleY: 1.05, opacity: 0 };
    case "drop":
      return { x: 0, y: -120, scaleX: 1, scaleY: 1, opacity: 0 };
    default:
      return null;
  }
}

// Konva's Tween.destroy() throws "Cannot convert undefined or null to object"
// when the underlying node is already detached or its tween bookkeeping was
// cleared. Swallow that — there's nothing to clean up at that point.
function safeDestroy(tween: Konva.Tween | null) {
  if (!tween) return;
  try {
    tween.destroy();
  } catch {
    /* node already gone */
  }
}

export function IntroAnimatedGroup({
  preset,
  durationMs,
  delayMs,
  loop = false,
  loopDelayMs = 1000,
  cx,
  cy,
  introKey,
  children,
}: Props) {
  const ref = useRef<Konva.Group | null>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);
  const timerRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  // Capture cx/cy at animation start — we don't want re-animating when the
  // user drags the wrapped layer (which would change cx/cy on every frame).
  const cxRef = useRef(cx);
  const cyRef = useRef(cy);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    cxRef.current = cx;
    cyRef.current = cy;
    const start = startState(preset);
    if (!start || reduced()) {
      node.x(cx);
      node.y(cy);
      node.scaleX(1);
      node.scaleY(1);
      node.opacity(1);
      node.getLayer()?.batchDraw();
      return;
    }

    const runOnce = (initialDelay: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      node.x(cx + start.x);
      node.y(cy + start.y);
      node.scaleX(start.scaleX);
      node.scaleY(start.scaleY);
      node.opacity(start.opacity);
      node.getLayer()?.batchDraw();

      timerRef.current = window.setTimeout(() => {
        safeDestroy(tweenRef.current);
        tweenRef.current = null;
        tweenRef.current = new Konva.Tween({
          node,
          duration: Math.max(0.05, durationMs / 1000),
          x: cxRef.current,
          y: cyRef.current,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          easing:
            preset === "pop"
              ? Konva.Easings.BackEaseOut
              : preset === "drop"
                ? Konva.Easings.BounceEaseOut
                : Konva.Easings.EaseOut,
          onFinish: () => {
            if (!loop) return;
            if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
            loopTimerRef.current = window.setTimeout(() => {
              runOnce(0);
            }, Math.max(0, loopDelayMs));
          },
        });
        tweenRef.current.play();
      }, Math.max(0, initialDelay));
    };

    runOnce(delayMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
      safeDestroy(tweenRef.current);
      tweenRef.current = null;
    };
    // Intentionally exclude cx/cy — only animate on preset/timing/replay changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, durationMs, delayMs, loop, loopDelayMs, introKey]);

  // When not animating (steady state), keep the wrapper anchored to the latest
  // cx/cy. This way layer drags update the pivot for the *next* animation but
  // don't retrigger the current one.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (tweenRef.current && tweenRef.current.anim?.isRunning?.()) return;
    node.x(cx);
    node.y(cy);
    node.offsetX(cx);
    node.offsetY(cy);
  }, [cx, cy]);

  return (
    <Group ref={ref as any} x={cx} y={cy} offsetX={cx} offsetY={cy}>
      {children}
    </Group>
  );
}

export function resolveIntro(intro: PageIntro | null | undefined) {
  const preset: IntroPreset = intro?.preset ?? "none";
  return {
    preset,
    durationMs: intro?.durationMs ?? 600,
    delayMs: intro?.delayMs ?? 0,
    stagger: intro?.stagger ?? false,
    staggerStepMs: intro?.staggerStepMs ?? 80,
  };
}
