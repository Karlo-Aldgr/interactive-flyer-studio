import type { Layer, LayerAction } from "@/types/flyer";
import type { BizadRecord } from "@/lib/bizad";
import { act, normalizeUrl } from "@/lib/bizadTemplates/kit";
import { buildSharePopupAction } from "@/lib/bizadTemplates/share";

/**
 * Standard business-card tiles carry a well-known label ("CALL", "WEBSITE", …).
 * When a tile has no saved action (older cards, or links lost on a failed save)
 * we resolve its built-in behaviour from the card record instead of dead-ending.
 */

function labelOf(layer: Pick<Layer, "content">): string {
  const raw = (layer.content as { label?: string; text?: string } | null)?.label ?? "";
  return raw
    .replace(/setup required/gi, "")
    .replace(/[\n\r▾▸›»]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function resolveBizadTileAction(
  layer: Pick<Layer, "content" | "type">,
  bizad: BizadRecord,
): LayerAction | null {
  const label = labelOf(layer);
  if (!label) return null;
  const social = bizad.social_links || {};
  const phone = bizad.phone?.trim();
  const email = bizad.email?.trim();
  const url = (raw?: string | null) => normalizeUrl(raw);

  const external = (raw?: string | null): LayerAction | null => {
    const u = url(raw);
    return u ? act("open_url", { url: u, newTab: true }) : null;
  };

  if (/^SAVE ?CONTACT$/.test(label) || label === "CONTACT" || label === "VCARD") {
    return act("download_vcard", { title: "Save contact" });
  }
  if (label === "SHARE" || label === "SHARE CARD") return buildSharePopupAction(bizad);
  if (label === "CALL" || label === "PHONE") {
    return phone ? act("call", { phone }) : null;
  }
  if (label.startsWith("TEXT") || label === "SMS" || label === "MESSAGE") {
    return phone ? act("sms", { phone }) : null;
  }
  if (label === "EMAIL" || label === "MAIL") {
    return email ? act("open_url", { url: `mailto:${email}`, newTab: false }) : null;
  }
  if (label === "WEBSITE" || label === "WEB" || label === "SITE") {
    return external(social.website || bizad.gallery_url);
  }
  if (label === "FACEBOOK") return external(social.facebook);
  if (label === "INSTAGRAM") return external(social.instagram);
  if (label === "TIKTOK") return external(social.tiktok);
  if (label === "YOUTUBE") return external(social.youtube);
  if (label === "FLYER" || label === "GALLERY" || label === "VIEW FLYER") {
    return external(bizad.gallery_url);
  }
  if (label === "VIDEO") {
    const v = url(bizad.video_url);
    return v ? act("video", { videoUrl: v }) : null;
  }
  if (label.startsWith("BOOK") || label === "SCHEDULE" || label === "APPOINTMENT") {
    const b = url(bizad.booking_url);
    return b ? act("open_url", { url: b, newTab: true }) : act("book_appointment", { title: "Book appointment" });
  }
  if (label === "DIRECTIONS" || label === "GPS" || label === "MAP" || label === "LOCATION") {
    return bizad.address?.trim() ? act("map", { mapAddress: bizad.address.trim() }) : null;
  }
  if (label.startsWith("ABOUT")) {
    const body = bizad.about_text?.trim();
    return body
      ? act("popup", { title: bizad.business_name ? `About ${bizad.business_name}` : "About", body })
      : null;
  }
  if (
    (bizad.custom_link_label?.trim() || "").toUpperCase() === label ||
    label === "BUSINESS LINK"
  ) {
    return external(bizad.custom_link_url);
  }
  return null;
}

/**
 * Links that should be (re)attached to a card page's layers — used by the
 * editor's "Repair links" control. Only fills tiles that currently have no
 * action, so hand-configured links are never overwritten.
 */
export function bizadTileActionPatches(
  layers: Layer[],
  bizad: BizadRecord,
): Record<string, LayerAction> {
  const patches: Record<string, LayerAction> = {};
  layers.forEach((l) => {
    if (l.action) return;
    if (l.type !== "button" && l.type !== "shape" && l.type !== "hotspot" && l.type !== "image") return;
    const a = resolveBizadTileAction(l, bizad);
    if (a) patches[l.id] = a;
  });
  return patches;
}
