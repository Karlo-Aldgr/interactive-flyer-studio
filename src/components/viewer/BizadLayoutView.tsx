import { useEffect, useRef, useState } from "react";
import type { Layer, LayerAction } from "@/types/flyer";
import type { BizadRecord } from "@/lib/bizad";
import { downloadVCard } from "@/lib/bizad";

export type BizadLayout = {
  width: number;
  height: number;
  background: string;
  layers: Layer[];
};

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
        style={{ ...base, objectFit: "cover", borderRadius: s.cornerRadius ?? 0 }}
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
      style={{ backgroundColor: layout.background || "#ffffff" }}
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
            {ordered.map((l) => (
              <LayerView key={l.id} layer={l} bizad={bizad} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
