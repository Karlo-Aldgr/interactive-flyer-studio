import { useEffect, useRef } from "react";
import { Group } from "react-konva";
import Konva from "konva";
import type { PageIntro, IntroPreset } from "@/types/flyer";

interface Props {
  preset: IntroPreset;
  durationMs: number;
  delayMs: number;
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

export function IntroAnimatedGroup({
  preset,
  durationMs,
  delayMs,
  cx,
  cy,
  introKey,
  children,
}: Props) {
  const ref = useRef<Konva.Group | null>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
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
    // Apply initial state (additive offset on top of pivot at cx, cy)
    node.x(cx + start.x);
    node.y(cy + start.y);
    node.scaleX(start.scaleX);
    node.scaleY(start.scaleY);
    node.opacity(start.opacity);
    node.getLayer()?.batchDraw();

    timerRef.current = window.setTimeout(() => {
      tweenRef.current?.destroy();
      tweenRef.current = new Konva.Tween({
        node,
        duration: Math.max(0.05, durationMs / 1000),
        x: cx,
        y: cy,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        easing:
          preset === "pop"
            ? Konva.Easings.BackEaseOut
            : preset === "drop"
              ? Konva.Easings.BounceEaseOut
              : Konva.Easings.EaseOut,
      });
      tweenRef.current.play();
    }, Math.max(0, delayMs));

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      tweenRef.current?.destroy();
    };
  }, [preset, durationMs, delayMs, cx, cy, introKey]);

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
