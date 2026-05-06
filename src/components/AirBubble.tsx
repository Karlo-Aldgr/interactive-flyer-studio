import { useLayoutEffect, useRef, useState } from "react";
import { AirMessageBubble } from "@/types/flyer";

const REACTION_EMOJI: Record<string, string> = {
  heart: "❤️", like: "👍", dislike: "👎", haha: "😂", exclaim: "‼️", question: "❓",
};

interface Props {
  bubble: AirMessageBubble;
  /** Container width in CSS px. Bubble fills this width up to its natural max. */
  maxWidth: number;
  /** If provided, bubble text auto-fits to this height (used in editor + live overlay). */
  fitHeight?: number;
  /** Default font size (px) used as the upper bound when auto-fitting. */
  baseFontSize?: number;
  /** Click handler — only wired when bubble has a tap action. */
  onClick?: () => void;
  /** Visual hint that this bubble is interactive. */
  interactive?: boolean;
  /** Render in a faded "preview" mode for the editor canvas. */
  preview?: boolean;
}

function applyCase(text: string, c?: string): string {
  if (!text) return "";
  if (c === "upper") return text.toUpperCase();
  if (c === "lower") return text.toLowerCase();
  return text;
}

export function AirBubble({
  bubble, maxWidth, fitHeight, baseFontSize = 22, onClick, interactive, preview,
}: Props) {
  const bg1 = bubble.bgColor || "#1d9bf0";
  const bg2 = bubble.bgColor2 || bg1;
  const textColor = bubble.textColor || "#ffffff";
  const tail = bubble.tail ?? "down";
  const bold = bubble.bold ?? true;
  const text = applyCase(bubble.text || "", bubble.textCase);

  // Auto-fit font size to container height when fitHeight is provided AND no manual size is set.
  const textRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const manualSize = bubble.fontSize;
  const [fontSize, setFontSize] = useState(manualSize ?? baseFontSize);

  useLayoutEffect(() => {
    if (manualSize) {
      setFontSize(manualSize);
      if (textRef.current) textRef.current.style.fontSize = manualSize + "px";
      return;
    }
    if (!fitHeight || !textRef.current || !wrapRef.current) {
      setFontSize(baseFontSize);
      return;
    }
    // Binary search for largest font size that fits.
    const wrap = wrapRef.current;
    const span = textRef.current;
    let lo = 8;
    let hi = Math.max(baseFontSize, Math.floor(fitHeight * 0.9));
    let best = lo;
    for (let i = 0; i < 12 && lo <= hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = mid + "px";
      const fits = wrap.scrollHeight <= fitHeight + 1 && wrap.scrollWidth <= maxWidth + 1;
      if (fits) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    span.style.fontSize = best + "px";
    setFontSize(best);
  }, [text, maxWidth, fitHeight, baseFontSize, bold, bubble.imageUrl, manualSize]);

  const padX = Math.max(14, Math.round((fitHeight ?? 56) * 0.32));
  const padY = Math.max(8, Math.round((fitHeight ?? 56) * 0.18));
  const radius = 9999; // pill

  const tailSize = Math.max(10, Math.round((fitHeight ?? 56) * 0.18));
  const tailStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: "absolute", width: 0, height: 0 };
    switch (tail) {
      case "down":
        return { ...base, bottom: -tailSize + 1, left: "50%", transform: "translateX(-50%)",
          borderLeft: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid transparent`,
          borderTop: `${tailSize}px solid ${bg2}` };
      case "up":
        return { ...base, top: -tailSize + 1, left: "50%", transform: "translateX(-50%)",
          borderLeft: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid ${bg1}` };
      case "left":
        return { ...base, left: -tailSize + 1, top: "50%", transform: "translateY(-50%)",
          borderTop: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid transparent`,
          borderRight: `${tailSize}px solid ${bg1}` };
      case "right":
        return { ...base, right: -tailSize + 1, top: "50%", transform: "translateY(-50%)",
          borderTop: `${tailSize}px solid transparent`,
          borderBottom: `${tailSize}px solid transparent`,
          borderLeft: `${tailSize}px solid ${bg2}` };
      default:
        return { display: "none" };
    }
  })();

  return (
    <div
      ref={wrapRef}
      onClick={interactive && onClick ? onClick : undefined}
      style={{
        position: "relative",
        maxWidth,
        width: fitHeight ? maxWidth : "auto",
        height: fitHeight,
        padding: `${padY}px ${padX}px`,
        background: bg1 === bg2 ? bg1 : `linear-gradient(135deg, ${bg1}, ${bg2})`,
        color: textColor,
        borderRadius: radius,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)",
        cursor: interactive && onClick ? "pointer" : "default",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        opacity: preview ? 0.95 : 1,
        overflow: "visible",
      }}
    >
      {bubble.imageUrl && (
        <img
          src={bubble.imageUrl}
          alt=""
          style={{ maxHeight: (fitHeight ?? 64) - padY * 2, marginRight: text ? 8 : 0, borderRadius: 12, objectFit: "cover" }}
          draggable={false}
        />
      )}
      <span
        ref={textRef}
        style={{
          fontSize,
          fontWeight: bold ? 800 : 500,
          letterSpacing: bubble.textCase === "upper" ? "0.02em" : "0",
          lineHeight: 1.05,
          whiteSpace: fitHeight && !manualSize ? "nowrap" : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </span>
      <span style={tailStyle} />
      {bubble.reaction && REACTION_EMOJI[bubble.reaction] && (
        <span
          style={{
            position: "absolute", top: -10, right: -6,
            background: "#fff", borderRadius: "9999px",
            width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)", fontSize: 14,
          }}
        >
          {REACTION_EMOJI[bubble.reaction]}
        </span>
      )}
    </div>
  );
}
