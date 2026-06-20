import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Fixed full-viewport background with gradient mesh + floating shapes
 * that drift slowly with scroll (~0.3x). All decorative, pointer-events-none.
 */
export default function ParallaxBackground() {
  const reduced = useReducedMotion();
  const [y, setY] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setY(window.scrollY);
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  const slow = reduced ? 0 : y * 0.15;
  const med = reduced ? 0 : y * 0.3;
  const fast = reduced ? 0 : y * 0.45;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      {/* Soft brand gradient mesh */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, hsl(199 100% 90% / 0.9), transparent 70%), radial-gradient(50% 50% at 80% 20%, hsl(35 100% 88% / 0.7), transparent 70%), radial-gradient(60% 60% at 50% 100%, hsl(220 90% 92% / 0.9), transparent 70%)",
        }}
      />

      {/* Faint grain / dots */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(220 90% 18%) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Floating shapes — translate3d for GPU compositing */}
      <div
        className="absolute -left-24 top-[8%] h-72 w-72 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(199 100% 60% / 0.55), transparent 70%)",
          transform: `translate3d(0, ${-slow}px, 0)`,
          willChange: "transform",
        }}
      />
      <div
        className="absolute right-[-6rem] top-[30%] h-[22rem] w-[22rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(35 100% 60% / 0.45), transparent 70%)",
          transform: `translate3d(0, ${-med}px, 0)`,
          willChange: "transform",
        }}
      />
      <div
        className="absolute left-[35%] top-[60%] h-80 w-80 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(220 90% 55% / 0.35), transparent 70%)",
          transform: `translate3d(0, ${-fast}px, 0)`,
          willChange: "transform",
        }}
      />

      {/* Geometric depth chips */}
      <div
        className="absolute left-[8%] top-[120vh] h-24 w-24 rounded-2xl border border-primary/20 bg-white/40 backdrop-blur-sm"
        style={{
          transform: `translate3d(0, ${-med}px, 0) rotateX(18deg) rotateY(-14deg)`,
          boxShadow: "0 30px 60px -20px hsl(199 80% 30% / 0.25)",
          willChange: "transform",
        }}
      />
      <div
        className="absolute right-[10%] top-[180vh] h-28 w-28 rounded-full border border-amber-300/40 bg-white/40 backdrop-blur-sm"
        style={{
          transform: `translate3d(0, ${-slow}px, 0) rotateX(-12deg) rotateY(20deg)`,
          boxShadow: "0 30px 60px -20px hsl(35 80% 40% / 0.25)",
          willChange: "transform",
        }}
      />
      <div
        className="absolute left-[55%] top-[240vh] h-20 w-20 rounded-xl border border-primary/20 bg-white/40 backdrop-blur-sm"
        style={{
          transform: `translate3d(0, ${-fast}px, 0) rotateX(20deg) rotateY(10deg)`,
          boxShadow: "0 30px 60px -20px hsl(220 80% 30% / 0.2)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
