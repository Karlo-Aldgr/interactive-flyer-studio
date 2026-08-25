import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FlyerPage, Layer, LayerAction } from "@/types/flyer";
import type { WebsiteDocument } from "@/lib/websiteDocument";

/**
 * Public Website renderer.
 *
 * Renders the SAVED website page (pages → layers → actions) exactly as it was
 * composed in the editor. Nothing is regenerated: every band, layer, style and
 * action comes straight from the saved data.
 *
 * Wide viewports render the saved composition proportionally (true 1:1 match
 * with the editor). Narrow viewports reflow the same saved layers into a
 * stacked, readable layout — never a squeezed desktop composition.
 */

const REFLOW_BELOW = 900;

/* -------------------------------------------------------------- utilities */

function Icon({ name, color, size }: { name?: string; color?: string; size: number }) {
  const Cmp = (LucideIcons as any)[name || "Star"] || LucideIcons.Star;
  return <Cmp style={{ color: color || "currentColor", width: size, height: size }} aria-hidden />;
}

function scrollToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export type WebsiteFormRequest = { action: LayerAction; layerId: string } | null;

/** Dispatcher for every action type the flyer supports (provided by the root). */
export const RuntimeCtx = createContext<((a: LayerAction | null | undefined) => void) | null>(null);

function runAction(
  action: LayerAction | null | undefined,
  openForm: (r: WebsiteFormRequest) => void,
  layerId: string,
  run?: ((a: LayerAction | null | undefined) => void) | null,
) {
  if (!action) return;
  const p: any = action.payload ?? {};
  switch (action.type) {
    case "open_url": {
      const url = String(p.url ?? "");
      if (url.startsWith("#")) return scrollToAnchor(url.slice(1));
      break;
    }
    case "form":
    case "rsvp":
    case "subscribe":
      openForm({ action, layerId });
      return;
  }
  // Everything else uses the shared flyer action runtime so popups, galleries,
  // carousels, coupons, bookings, polls, menus, novels, etc. behave exactly as
  // they do on a flyer.
  if (run) return run(action);
  const url = p.url || p.link;
  if (url) window.open(String(url), "_blank", "noopener,noreferrer");
}


/* ------------------------------------------------------------ band model */

interface FormField {
  key: string;
  label: string;
  multiline: boolean;
  boxId: string;
  labelId: string;
}

interface FormModel {
  fields: FormField[];
  buttonId: string;
  action: LayerAction | null;
  consumed: Set<string>;
}

interface Band {
  id: string;
  anchor: string;
  top: number;
  height: number;
  bg?: string;
  bgLayerId: string;
  layers: Layer[];
  form: FormModel | null;
}

const isFullWidth = (l: Layer, W: number) => l.position.x <= 4 && l.size.width >= W - 8;
const centerY = (l: Layer) => l.position.y + l.size.height / 2;
const anchorOf = (a?: LayerAction | null) => {
  const url = a?.type === "open_url" ? (a.payload as any)?.url ?? "" : "";
  return typeof url === "string" && url.startsWith("#") ? url.slice(1) : null;
};

function fieldKey(label: string) {
  const t = label.toLowerCase();
  if (t.includes("name")) return "name";
  if (t.includes("email") || t.includes("@")) return "email";
  if (t.includes("phone") || t.includes("number")) return "phone";
  if (t.includes("message") || t.includes("tell us")) return "message";
  return t.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
}

/** Detects an in-canvas contact form: input rectangles + placeholder text + a form button. */
function detectForm(layers: Layer[], W: number): FormModel | null {
  const button = layers.find(
    (l) => l.type === "button" && ["form", "rsvp", "subscribe"].includes(String(l.action?.type))
  );
  if (!button) return null;

  const boxes = layers.filter(
    (l) =>
      l.type === "shape" &&
      !isFullWidth(l, W) &&
      l.size.height >= 36 &&
      l.size.height <= 200 &&
      l.size.width >= 160 &&
      l.content.shape !== "line"
  );

  const consumed = new Set<string>();
  const fields: FormField[] = [];
  for (const box of boxes) {
    const inner = layers.find(
      (l) =>
        l.type === "text" &&
        !consumed.has(l.id) &&
        l.position.x >= box.position.x - 4 &&
        l.position.y >= box.position.y - 4 &&
        l.position.x + l.size.width <= box.position.x + box.size.width + 8 &&
        l.position.y + l.size.height <= box.position.y + box.size.height + 8
    );
    if (!inner) continue;
    const label = (inner.content.text ?? "").trim();
    if (!label || label.length > 40) continue;
    consumed.add(box.id);
    consumed.add(inner.id);
    fields.push({
      key: fieldKey(label),
      label,
      multiline: box.size.height > 70,
      boxId: box.id,
      labelId: inner.id,
    });
  }
  if (!fields.length) return null;
  consumed.add(button.id);
  return { fields, buttonId: button.id, action: button.action ?? null, consumed };
}

function buildBands(page: FlyerPage, doc: WebsiteDocument): { W: number; nav: Band | null; bands: Band[] } {
  const W = page.background?.size?.width || doc.designWidth || 1440;
  const layers = [...(page.layers ?? [])].sort((a, b) => a.z_index - b.z_index);

  const candidates = layers
    .filter((l) => l.type === "shape" && isFullWidth(l, W) && l.size.height > 60)
    .sort((a, b) => a.position.y - b.position.y || b.size.height - a.size.height);

  // A full-width shape that sits INSIDE an already accepted band is an overlay /
  // tint, not a new section — otherwise the section would be duplicated and the
  // page would grow a large empty gap.
  const ranges: { shape: Layer; top: number; bottom: number }[] = [];
  for (const s of candidates) {
    const top = s.position.y;
    const bottom = top + s.size.height;
    const inside = ranges.some((r) => top >= r.top - 2 && bottom <= r.bottom + 2);
    if (inside) continue;
    ranges.push({ shape: s, top, bottom });
  }

  const used = new Set(ranges.map((r) => r.shape.id));

  const anchorQueue = doc.nav.map((n) => n.anchor);

  const make = (r: (typeof ranges)[number], anchor: string): Band => {
    const own = layers.filter((l) => !used.has(l.id) && centerY(l) >= r.top - 2 && centerY(l) < r.bottom + 2);
    own.forEach((l) => used.add(l.id));
    return {
      id: r.shape.id,
      anchor,
      top: r.top,
      height: r.bottom - r.top,
      bg: r.shape.style.fill,
      bgLayerId: r.shape.id,
      layers: own,
      form: detectForm(own, W),
    };
  };

  const navBand = ranges.length ? make(ranges[0], "site-nav") : null;
  const rest = ranges.slice(1);
  const bands = rest.map((r, i) => {
    const anchorFromLayers = null;
    return make(r, anchorFromLayers || anchorQueue[i] || (i === rest.length - 1 ? "footer" : `section-${i + 1}`));
  });

  // Any layer that fell outside every band still has to render — append it in
  // a synthetic band so nothing saved is silently dropped.
  const orphans = layers.filter((l) => !used.has(l.id));
  if (orphans.length) {
    const top = Math.min(...orphans.map((l) => l.position.y));
    const bottom = Math.max(...orphans.map((l) => l.position.y + l.size.height));
    bands.push({
      id: "orphans",
      anchor: "more",
      top,
      height: bottom - top,
      bg: undefined,
      bgLayerId: "",
      layers: orphans,
      form: detectForm(orphans, W),
    });
  }

  return { W, nav: navBand, bands };
}

/* ------------------------------------------------------- absolute rendering */

function AbsLayer({
  layer,
  band,
  s,
  doc,
  openForm,
  fullBleed = false,
}: {
  layer: Layer;
  band: Band;
  s: number;
  doc: WebsiteDocument;
  openForm: (r: WebsiteFormRequest) => void;
  fullBleed?: boolean;
}) {
  const clickable = !!layer.action;
  const box: React.CSSProperties = {
    position: "absolute",
    left: fullBleed ? 0 : layer.position.x * s,
    top: (layer.position.y - band.top) * s,
    width: fullBleed ? "100%" : layer.size.width * s,
    height: layer.size.height * s,
    opacity: layer.style.opacity ?? 1,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: "top left",
    cursor: clickable ? "pointer" : undefined,
  };
  const onClick = clickable ? () => runAction(layer.action, openForm, layer.id) : undefined;


  switch (layer.type) {
    case "text": {
      const size = (layer.style.fontSize ?? 16) * s;
      return (
        <div
          onClick={onClick}
          style={{
            ...box,
            height: undefined,
            minHeight: layer.size.height * s,
            color: layer.style.color || "#F8FAFC",
            fontSize: size,
            fontWeight: (layer.style.fontWeight as any) ?? 400,
            fontStyle: layer.style.fontStyle,
            fontFamily: layer.style.fontFamily || doc.fontFamily,
            textAlign: layer.style.align ?? "left",
            lineHeight: 1.32,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {layer.content.text}
        </div>
      );
    }
    case "image":
      return layer.content.src ? (
        <img
          src={layer.content.src}
          alt=""
          loading="lazy"
          onClick={onClick}
          style={{ ...box, objectFit: "cover", borderRadius: (layer.style.cornerRadius ?? 0) * s, display: "block" }}
        />
      ) : null;
    case "video":
      return (
        <video
          src={layer.content.videoUrl || layer.content.src}
          poster={layer.content.posterUrl}
          autoPlay={layer.content.videoAutoplay !== false}
          loop={layer.content.videoLoop !== false}
          muted={layer.content.videoMuted !== false}
          playsInline
          controls={layer.content.videoAutoplay === false}
          style={{ ...box, objectFit: "cover", borderRadius: (layer.style.cornerRadius ?? 0) * s }}
        />
      );
    case "icon":
      return (
        <span onClick={onClick} style={{ ...box, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon
            name={layer.content.iconName || (layer.style as any).iconName}
            color={layer.style.color || doc.accent}
            size={Math.min(layer.size.width, layer.size.height) * s}
          />
        </span>
      );
    case "button":
      return (
        <button
          type="button"
          onClick={onClick}
          style={{
            ...box,
            background: layer.style.fill || doc.accent,
            color: layer.style.color || "#fff",
            border: layer.style.stroke ? `${(layer.style.strokeWidth ?? 1) * s}px solid ${layer.style.stroke}` : "none",
            borderRadius: (layer.style.cornerRadius ?? 999) * s,
            fontSize: (layer.style.fontSize ?? 16) * s,
            fontWeight: (layer.style.fontWeight as any) ?? 700,
            fontFamily: layer.style.fontFamily || doc.fontFamily,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {layer.content.label || layer.content.text}
        </button>
      );
    case "shape": {
      if (layer.content.shape === "line") {
        return (
          <div
            style={{
              ...box,
              height: Math.max(1, (layer.style.strokeWidth ?? layer.size.height) * s),
              background: layer.style.fill || layer.style.stroke || "rgba(255,255,255,0.14)",
            }}
          />
        );
      }
      return (
        <div
          onClick={onClick}
          style={{
            ...box,
            background: layer.style.fill,
            border: layer.style.stroke ? `${(layer.style.strokeWidth ?? 1) * s}px solid ${layer.style.stroke}` : undefined,
            borderRadius:
              layer.content.shape === "circle" ? "50%" : (layer.style.cornerRadius ?? 0) * s,
          }}
        />
      );
    }
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- the form */

function useFormState(fields: FormField[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const reset = () => setValues({});
  return { values, set, reset, fields };
}

function useFormSubmit(flyerId: string, canSubmit: boolean) {
  const [busy, setBusy] = useState(false);
  const submit = async (fields: FormField[], values: Record<string, string>, action: LayerAction | null, onDone: () => void) => {
    for (const f of fields) {
      if (!values[f.key]?.trim()) return toast.error(`Please enter your ${f.label.toLowerCase()}`);
    }
    if (!canSubmit) {
      toast.info("This is a preview — messages are only saved on the published website.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("form_submissions")
      .insert([{ flyer_id: flyerId, layer_id: null, data: { ...values, _preset: "website" } as any }]);
    setBusy(false);
    if (error) return toast.error("Could not send your message");
    toast.success(((action?.payload as any)?.successMessage as string) || "Thanks — we'll be in touch.");
    onDone();
  };
  return { busy, submit };
}

function inputStyle(box: Layer, s: number, band: Band, absolute: boolean): React.CSSProperties {
  return absolute
    ? {
        position: "absolute",
        left: box.position.x * s,
        top: (box.position.y - band.top) * s,
        width: box.size.width * s,
        height: box.size.height * s,
        borderRadius: (box.style.cornerRadius ?? 10) * s,
        background: box.style.fill || "#161F32",
        border: box.style.stroke ? `1px solid ${box.style.stroke}` : "1px solid rgba(255,255,255,0.08)",
      }
    : {
        width: "100%",
        minHeight: box.size.height > 70 ? 110 : 50,
        borderRadius: 12,
        background: box.style.fill || "#161F32",
        border: box.style.stroke ? `1px solid ${box.style.stroke}` : "1px solid rgba(255,255,255,0.08)",
      };
}

/* --------------------------------------------------------------- band view */

function BandView({
  band,
  W,
  width,
  doc,
  flyerId,
  canSubmitForms,
  openForm,
}: {
  band: Band;
  W: number;
  width: number;
  doc: WebsiteDocument;
  flyerId: string;
  canSubmitForms: boolean;
  openForm: (r: WebsiteFormRequest) => void;
}) {
  const scaled = width >= REFLOW_BELOW;
  const s = Math.min(1, width / W);
  const form = band.form;
  const { values, set, reset } = useFormState(form?.fields ?? []);
  const { busy, submit } = useFormSubmit(flyerId, canSubmitForms);

  const byId = useMemo(() => new Map(band.layers.map((l) => [l.id, l])), [band.layers]);
  const ordered = useMemo(() => [...band.layers].sort((a, b) => a.z_index - b.z_index), [band.layers]);
  const formButton = form ? byId.get(form.buttonId) : undefined;

  const doSubmit = () => form && submit(form.fields, values, form.action, reset);

  /* ------------------------------------------------ scaled (desktop) mode */
  if (scaled) {
    const contentW = W * s;
    // Full-bleed layers (section background photos / tint overlays) span the
    // whole viewport; everything else lives in a centered content container.
    const isBleed = (l: Layer) =>
      (l.type === "image" || l.type === "shape") && isFullWidth(l, W) && l.size.height >= band.height - 12;
    const bleed = ordered.filter(isBleed);
    const content = ordered.filter((l) => !isBleed(l));

    return (
      <section
        id={band.anchor}
        style={{
          position: "relative",
          width: "100%",
          height: band.height * s,
          background: band.bg,
          overflow: "hidden",
          scrollMarginTop: 80,
        }}
      >
        {bleed.map((l) => (
          <AbsLayer key={l.id} layer={l} band={band} s={s} doc={doc} openForm={openForm} fullBleed />
        ))}

        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: contentW,
            maxWidth: "100%",
            height: "100%",
          }}
        >
          {content.map((l) => {
            if (form?.consumed.has(l.id)) return null;
            return <AbsLayer key={l.id} layer={l} band={band} s={s} doc={doc} openForm={openForm} />;
          })}

          {form?.fields.map((f) => {
            const box = byId.get(f.boxId);
            const label = byId.get(f.labelId);
            if (!box) return null;
            const common = {
              placeholder: f.label,
              value: values[f.key] ?? "",
              onChange: (e: any) => set(f.key, e.target.value),
              style: {
                ...inputStyle(box, s, band, true),
                color: label?.style.color || "#E2E8F0",
                fontSize: (label?.style.fontSize ?? 15) * s,
                fontFamily: doc.fontFamily,
                padding: `${10 * s}px ${16 * s}px`,
                outline: "none",
                resize: "none" as const,
              },
            };
            return f.multiline ? <textarea key={f.key} {...common} /> : <input key={f.key} {...common} />;
          })}

          {form && formButton && (
            <button
              type="button"
              disabled={busy}
              onClick={doSubmit}
              style={{
                position: "absolute",
                left: formButton.position.x * s,
                top: (formButton.position.y - band.top) * s,
                width: formButton.size.width * s,
                height: formButton.size.height * s,
                background: formButton.style.fill || doc.accent,
                color: formButton.style.color || "#fff",
                border: "none",
                borderRadius: (formButton.style.cornerRadius ?? 999) * s,
                fontSize: (formButton.style.fontSize ?? 16) * s,
                fontWeight: 700,
                fontFamily: doc.fontFamily,
                cursor: "pointer",
              }}
            >
              {busy ? "Sending…" : formButton.content.label || "Send"}
            </button>
          )}
        </div>
      </section>
    );

  }

  /* ---------------------------------------------------- reflow (narrow) mode */
  const bgImage = band.layers.find(
    (l) => l.type === "image" && isFullWidth(l, W) && l.size.height >= band.height - 12
  );
  const overlay = band.layers.find(
    (l) => l.type === "shape" && isFullWidth(l, W) && l.size.height >= band.height - 12
  );
  const flowLayers = ordered.filter(
    (l) => l.id !== bgImage?.id && l.id !== overlay?.id && !form?.consumed.has(l.id) && l.type !== "hotspot"
  );
  const scaleText = Math.min(1, Math.max(0.52, width / W + 0.18));

  return (
    <section
      id={band.anchor}
      style={{
        position: "relative",
        background: band.bg,
        overflow: "hidden",
        scrollMarginTop: 72,
      }}
    >
      {bgImage?.content.src && (
        <img
          src={bgImage.content.src}
          alt=""
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {overlay && (
        <div style={{ position: "absolute", inset: 0, background: overlay.style.fill, opacity: overlay.style.opacity ?? 0.6 }} />
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: "40px 20px",
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        {flowLayers.map((l) => {
          const clickable = !!l.action;
          const onClick = clickable ? () => runAction(l.action, openForm, l.id) : undefined;
          switch (l.type) {
            case "text":
              return (
                <div
                  key={l.id}
                  onClick={onClick}
                  style={{
                    color: l.style.color || "#F8FAFC",
                    fontSize: Math.max(13, (l.style.fontSize ?? 16) * scaleText),
                    fontWeight: (l.style.fontWeight as any) ?? 400,
                    fontStyle: l.style.fontStyle,
                    fontFamily: l.style.fontFamily || doc.fontFamily,
                    textAlign: l.style.align ?? "left",
                    lineHeight: (l.style.fontSize ?? 16) > 30 ? 1.15 : 1.5,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    cursor: clickable ? "pointer" : undefined,
                  }}
                >
                  {l.content.text}
                </div>
              );
            case "image":
              return l.content.src ? (
                <img
                  key={l.id}
                  src={l.content.src}
                  alt=""
                  loading="lazy"
                  onClick={onClick}
                  style={{
                    width: "100%",
                    aspectRatio: `${Math.max(1, l.size.width)} / ${Math.max(1, l.size.height)}`,
                    objectFit: "cover",
                    borderRadius: l.style.cornerRadius ?? 14,
                    display: "block",
                  }}
                />
              ) : null;
            case "video":
              return (
                <video
                  key={l.id}
                  src={l.content.videoUrl || l.content.src}
                  poster={l.content.posterUrl}
                  controls
                  playsInline
                  style={{ width: "100%", borderRadius: l.style.cornerRadius ?? 14 }}
                />
              );
            case "icon":
              return (
                <span key={l.id} onClick={onClick} style={{ display: "inline-flex" }}>
                  <Icon
                    name={l.content.iconName || (l.style as any).iconName}
                    color={l.style.color || doc.accent}
                    size={Math.min(40, Math.max(18, l.size.height))}
                  />
                </span>
              );
            case "button":
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={onClick}
                  style={{
                    background: l.style.fill || doc.accent,
                    color: l.style.color || "#fff",
                    border: "none",
                    borderRadius: l.style.cornerRadius ?? 999,
                    minHeight: 50,
                    width: "100%",
                    fontWeight: 700,
                    fontSize: 16,
                    fontFamily: doc.fontFamily,
                    cursor: "pointer",
                  }}
                >
                  {l.content.label || l.content.text}
                </button>
              );
            case "shape":
              if (l.content.shape === "line" || l.size.height <= 3) {
                return <hr key={l.id} style={{ width: "100%", border: 0, height: 1, background: l.style.fill || "rgba(255,255,255,0.14)" }} />;
              }
              return null;
            default:
              return null;
          }
        })}

        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            {form.fields.map((f) => {
              const box = byId.get(f.boxId)!;
              const label = byId.get(f.labelId);
              const common = {
                placeholder: f.label,
                value: values[f.key] ?? "",
                onChange: (e: any) => set(f.key, e.target.value),
                style: {
                  ...inputStyle(box, s, band, false),
                  color: label?.style.color || "#E2E8F0",
                  fontSize: 15,
                  fontFamily: doc.fontFamily,
                  padding: "12px 14px",
                  outline: "none",
                  resize: "none" as const,
                },
              };
              return f.multiline ? <textarea key={f.key} rows={4} {...common} /> : <input key={f.key} {...common} />;
            })}
            <button
              type="button"
              disabled={busy}
              onClick={doSubmit}
              style={{
                background: formButton?.style.fill || doc.accent,
                color: formButton?.style.color || "#fff",
                border: "none",
                borderRadius: 999,
                minHeight: 52,
                fontWeight: 700,
                fontSize: 16,
                fontFamily: doc.fontFamily,
                cursor: "pointer",
              }}
            >
              {busy ? "Sending…" : formButton?.content.label || "Send message"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- nav */

function SiteNav({ doc, openForm }: { doc: WebsiteDocument; openForm: (r: WebsiteFormRequest) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(7,11,22,0.86)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "10px clamp(18px, 5vw, 40px)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {doc.logoUrl ? (
          <img src={doc.logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
        ) : null}
        <span style={{ color: "#fff", fontWeight: 800, fontSize: "clamp(15px, 2.2vw, 21px)", fontFamily: doc.fontFamily }}>
          {doc.brandName}
        </span>
        <div style={{ flex: 1 }} />
        <nav className="hidden md:flex" style={{ gap: 22, alignItems: "center" }}>
          {doc.nav.map((n) => (
            <button
              key={n.anchor}
              type="button"
              onClick={() => scrollToAnchor(n.anchor)}
              style={{ background: "none", border: 0, color: "#CBD5E1", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
            >
              {n.label}
            </button>
          ))}
          {doc.navCta && (
            <button
              type="button"
              onClick={() => runAction(doc.navCta!.action, openForm, "nav-cta")}
              style={{
                background: doc.accent,
                color: "#fff",
                border: 0,
                borderRadius: 999,
                padding: "10px 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {doc.navCta.label}
            </button>
          )}
        </nav>
        <button
          type="button"
          className="md:hidden"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: 0, color: "#fff", cursor: "pointer", padding: 6 }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden" style={{ display: "flex", flexDirection: "column", padding: "6px 20px 16px", gap: 4 }}>
          {doc.nav.map((n) => (
            <button
              key={n.anchor}
              type="button"
              onClick={() => {
                setOpen(false);
                scrollToAnchor(n.anchor);
              }}
              style={{
                background: "none",
                border: 0,
                color: "#E2E8F0",
                textAlign: "left",
                padding: "10px 0",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {n.label}
            </button>
          ))}
          {doc.navCta && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                runAction(doc.navCta!.action, openForm, "nav-cta");
              }}
              style={{
                background: doc.accent,
                color: "#fff",
                border: 0,
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 700,
                marginTop: 6,
                cursor: "pointer",
              }}
            >
              {doc.navCta.label}
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------- form dialog */

function ContactFormDialog({
  request,
  flyerId,
  canSubmit,
  onClose,
  accent,
}: {
  request: WebsiteFormRequest;
  flyerId: string;
  canSubmit: boolean;
  onClose: () => void;
  accent: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues({}), [request?.layerId]);
  if (!request) return null;
  const p: any = request.action.payload ?? {};
  const fields: string[] = (p.fields?.length ? p.fields : ["name", "email", "message"]) as string[];

  async function submit() {
    for (const f of fields) {
      if (!values[f]?.trim()) return toast.error(`Please enter your ${f}`);
    }
    if (!canSubmit) {
      toast.info("This is a preview — messages are only saved on the published website.");
      onClose();
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("form_submissions")
      .insert([{ flyer_id: flyerId, layer_id: null, data: { ...values, _preset: "website" } as any }]);
    setBusy(false);
    if (error) return toast.error("Could not send your message");
    toast.success(p.successMessage || "Thanks — we'll be in touch.");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0F172A", borderRadius: 18, padding: 22, width: "min(440px, 100%)", color: "#F8FAFC" }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: 19, fontWeight: 700 }}>{p.title || "Send a message"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fields.map((f) => (
            <input
              key={f}
              placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
              value={values[f] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
              style={{
                background: "#1E293B",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: "12px 14px",
                color: "#F8FAFC",
                fontSize: 15,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, background: "#1E293B", color: "#CBD5E1", border: 0, borderRadius: 10, padding: 12, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            style={{ flex: 1, background: accent, color: "#fff", border: 0, borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- root */

export function PublicWebsite({
  doc,
  page,
  flyerId,
  canSubmitForms = true,
}: {
  doc: WebsiteDocument;
  page: FlyerPage;
  flyerId: string;
  canSubmitForms?: boolean;
}) {
  const [formRequest, setFormRequest] = useState<WebsiteFormRequest>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || window.innerWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc.fontFamily) return;
    const id = "website-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(doc.fontFamily)}:wght@400;600;700;800&display=swap`;
    document.head.appendChild(link);
  }, [doc.fontFamily]);

  const { W, bands } = useMemo(() => buildBands(page, doc), [page, doc]);

  return (
    <div
      ref={rootRef}
      style={{ background: doc.bgColor, minHeight: "100vh", width: "100%", overflowX: "hidden", fontFamily: doc.fontFamily }}
    >
      <SiteNav doc={doc} openForm={setFormRequest} />
      {bands.map((b) => (
        <BandView
          key={b.id}
          band={b}
          W={W}
          width={width}
          doc={doc}
          flyerId={flyerId}
          canSubmitForms={canSubmitForms}
          openForm={setFormRequest}
        />
      ))}
      <ContactFormDialog
        request={formRequest}
        flyerId={flyerId}
        canSubmit={canSubmitForms}
        accent={doc.accent}
        onClose={() => setFormRequest(null)}
      />
    </div>
  );
}

export default PublicWebsite;
