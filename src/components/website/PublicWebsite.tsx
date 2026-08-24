import { useEffect, useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LayerAction } from "@/types/flyer";
import type { WebsiteBlock, WebsiteCard, WebsiteDocument, WebsiteSection } from "@/lib/websiteDocument";

/**
 * Public Website renderer.
 *
 * Renders a SAVED website document as a normal, vertically scrolling, fully
 * responsive webpage. It contains zero editor UI and loads no editor state —
 * only the saved page/layers/actions passed in as a parsed document.
 */

/* --------------------------------------------------------------- helpers */

function fluid(size: number, designWidth: number, minRatio = 0.66) {
  const min = Math.max(11, Math.round(size * minRatio));
  const vw = ((size / designWidth) * 100).toFixed(3);
  return `clamp(${min}px, ${vw}vw, ${size}px)`;
}

function Icon({ name, color, size }: { name?: string; color?: string; size: number }) {
  const Cmp = (LucideIcons as any)[name || "Star"] || LucideIcons.Star;
  return <Cmp style={{ color: color || "currentColor", width: size, height: size }} aria-hidden />;
}

function scrollToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------------- actions */

export type WebsiteFormRequest = { action: LayerAction; layerId: string } | null;

function runAction(action: LayerAction | null | undefined, openForm: (r: WebsiteFormRequest) => void, layerId: string) {
  if (!action) return;
  const p: any = action.payload ?? {};
  switch (action.type) {
    case "open_url": {
      const url = String(p.url ?? "");
      if (!url) return;
      if (url.startsWith("#")) return scrollToAnchor(url.slice(1));
      if (p.newTab === false || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    case "call":
      if (p.phone) window.location.href = `tel:${p.phone}`;
      return;
    case "sms":
      if (p.phone) window.location.href = `sms:${p.phone}${p.smsBody ? `?&body=${encodeURIComponent(p.smsBody)}` : ""}`;
      return;
    case "map": {
      const { mapAddress, mapLat, mapLng } = p;
      const hasCoords = mapLat != null && mapLng != null;
      const url = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`
        : mapAddress
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`
          : "";
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    case "form":
    case "rsvp":
    case "subscribe":
      openForm({ action, layerId });
      return;
    default: {
      const url = p.url || p.link;
      if (url) window.open(String(url), "_blank", "noopener,noreferrer");
    }
  }
}

/* ----------------------------------------------------------------- blocks */

function BlockView({
  block,
  doc,
  openForm,
  fullWidth,
}: {
  block: WebsiteBlock;
  doc: WebsiteDocument;
  openForm: (r: WebsiteFormRequest) => void;
  fullWidth?: boolean;
}) {
  const clickable = !!block.action;
  const onClick = clickable ? () => runAction(block.action, openForm, block.id) : undefined;

  const common: React.CSSProperties = {
    cursor: clickable ? "pointer" : undefined,
    opacity: block.opacity ?? 1,
  };

  if (block.kind === "divider") {
    return <hr style={{ width: "100%", border: 0, height: 1, background: block.fill || "rgba(255,255,255,0.14)" }} />;
  }

  if (block.kind === "image" && block.src) {
    return (
      <img
        src={block.src}
        alt=""
        loading="lazy"
        onClick={onClick}
        style={{
          ...common,
          width: "100%",
          aspectRatio: `${Math.max(1, block.w)} / ${Math.max(1, block.h)}`,
          objectFit: "cover",
          borderRadius: block.radius ?? 16,
          display: "block",
        }}
      />
    );
  }

  if (block.kind === "video" && block.src) {
    return (
      <video
        src={block.src}
        poster={block.posterUrl}
        controls
        playsInline
        style={{ ...common, width: "100%", borderRadius: block.radius ?? 16, display: "block" }}
      />
    );
  }

  if (block.kind === "icon") {
    return (
      <span onClick={onClick} style={{ ...common, display: "inline-flex" }}>
        <Icon name={block.iconName} color={block.color || doc.accent} size={Math.min(48, Math.max(18, block.h))} />
      </span>
    );
  }

  if (block.kind === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...common,
          background: block.fill || doc.accent,
          color: block.color || "#fff",
          borderRadius: block.radius ?? 999,
          border: "none",
          padding: "0 22px",
          minHeight: Math.max(44, Math.min(block.h, 64)),
          width: fullWidth ? "100%" : undefined,
          fontWeight: 700,
          fontSize: fluid(block.fontSize ?? 16, doc.designWidth, 0.85),
          fontFamily: block.fontFamily || doc.fontFamily,
          cursor: "pointer",
        }}
      >
        {block.text}
      </button>
    );
  }

  if (block.kind === "shape") {
    return (
      <div
        onClick={onClick}
        style={{
          ...common,
          background: block.fill,
          borderRadius: block.radius ?? 12,
          minHeight: Math.min(block.h, 120),
          width: "100%",
        }}
      />
    );
  }

  const size = block.fontSize ?? 16;
  const Tag: any = size >= 34 ? "h2" : size >= 22 ? "h3" : "p";
  return (
    <Tag
      onClick={onClick}
      style={{
        ...common,
        margin: 0,
        color: block.color || "#F8FAFC",
        fontSize: fluid(size, doc.designWidth, size > 30 ? 0.5 : 0.86),
        fontWeight: block.fontWeight ?? 400,
        fontStyle: block.fontStyle,
        fontFamily: block.fontFamily || doc.fontFamily,
        textAlign: block.align ?? "left",
        lineHeight: size > 30 ? 1.12 : 1.5,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {block.text}
    </Tag>
  );
}

function CardView({ card, doc, openForm }: { card: WebsiteCard; doc: WebsiteDocument; openForm: (r: WebsiteFormRequest) => void }) {
  return (
    <div
      style={{
        background: card.fill,
        opacity: card.opacity ?? 1,
        borderRadius: card.radius ?? 18,
        border: card.stroke ? `1px solid ${card.stroke}` : undefined,
        padding: card.blocks.length ? "clamp(16px, 3vw, 28px)" : 0,
        minHeight: card.blocks.length ? undefined : Math.min(card.h, 220),
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {card.blocks.map((b) => (
        <BlockView key={b.id} block={b} doc={doc} openForm={openForm} fullWidth />
      ))}
    </div>
  );
}

function SectionView({ section, doc, openForm }: { section: WebsiteSection; doc: WebsiteDocument; openForm: (r: WebsiteFormRequest) => void }) {
  return (
    <section
      id={section.anchor}
      style={{
        position: "relative",
        background: section.bgColor || doc.bgColor,
        scrollMarginTop: 84,
        overflow: "hidden",
      }}
    >
      {section.bgImage && (
        <img
          src={section.bgImage}
          alt=""
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {section.overlayColor && (
        <div
          style={{ position: "absolute", inset: 0, background: section.overlayColor, opacity: section.overlayOpacity ?? 0.6 }}
        />
      )}
      <div
        style={{
          position: "relative",
          maxWidth: doc.contentWidth,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 88px) clamp(18px, 5vw, 40px)",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(16px, 2.6vw, 28px)",
        }}
      >
        {section.rows.map((row) =>
          row.kind === "grid" ? (
            <div
              key={row.id}
              style={{
                display: "grid",
                gap: "clamp(14px, 2vw, 24px)",
                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Math.max(
                  240,
                  Math.min(360, Math.round(row.cards[0]?.w ?? 320))
                )}px), 1fr))`,
              }}
            >
              {row.cards.map((c) => (
                <CardView key={c.id} card={c} doc={doc} openForm={openForm} />
              ))}
            </div>
          ) : (
            <div
              key={row.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "clamp(10px, 1.6vw, 18px)",
              }}
            >
              {row.blocks.map((b) => {
                const ratio = Math.min(1, b.w / doc.contentWidth);
                const basis = ratio > 0.75 ? "100%" : `${Math.max(18, ratio * 100)}%`;
                return (
                  <div
                    key={b.id}
                    style={{
                      flex: `1 1 ${basis}`,
                      minWidth: b.kind === "text" && b.w > doc.contentWidth * 0.5 ? "100%" : "min(100%, 180px)",
                      maxWidth: "100%",
                    }}
                  >
                    <BlockView block={b} doc={doc} openForm={openForm} />
                  </div>
                );
              })}
            </div>
          )
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
        background: doc.sections[0]?.bgColor ? "rgba(0,0,0,0.72)" : "rgba(7,11,22,0.86)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: doc.contentWidth,
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
        <nav
          className="md:hidden"
          style={{ display: "flex", flexDirection: "column", padding: "6px 20px 16px", gap: 4 }}
        >
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

/* ------------------------------------------------------------- contact form */

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
  flyerId,
  canSubmitForms = true,
}: {
  doc: WebsiteDocument;
  flyerId: string;
  canSubmitForms?: boolean;
}) {
  const [formRequest, setFormRequest] = useState<WebsiteFormRequest>(null);

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

  const sections = useMemo(() => (doc.footer ? [...doc.sections, doc.footer] : doc.sections), [doc]);

  return (
    <div style={{ background: doc.bgColor, minHeight: "100vh", width: "100%", overflowX: "hidden", fontFamily: doc.fontFamily }}>
      <SiteNav doc={doc} openForm={setFormRequest} />
      {sections.map((s) => (
        <SectionView key={s.id} section={s} doc={doc} openForm={setFormRequest} />
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
