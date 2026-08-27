import type { LayerAction } from "@/types/flyer";
import type { BizadRecord } from "@/lib/bizad";
import { buildBizadQrImageUrl } from "@/lib/bizadLayoutUtils";
import { buildPublicBizadUrl } from "@/lib/utils";
import { act } from "@/lib/bizadTemplates/kit";

function shareTitle(bizad: BizadRecord): string {
  return bizad.business_name?.trim() || bizad.owner_name?.trim() || "My digital business card";
}

/**
 * Share popup built on the existing bizad share infrastructure:
 * public /bizads URL + QR image, with email / SMS / native-share-or-copy options.
 */
export function buildSharePopupAction(bizad: BizadRecord): LayerAction {
  const url = bizad.slug ? buildPublicBizadUrl(bizad.slug) : null;
  const title = shareTitle(bizad);
  if (!url) {
    return act("popup", {
      title: "Share card",
      body: "Publish this card to get a shareable link and QR code.",
    });
  }
  return act("popup", {
    title: "Share this card",
    body: url,
    mediaUrl: buildBizadQrImageUrl(bizad.slug, 512),
    copyUrl: url,
    shareTitle: title,
    buttons: [
      {
        id: "share-sms",
        label: "Text Message",
        action: act("open_url", {
          url: `sms:?&body=${encodeURIComponent(`${title} — ${url}`)}`,
          newTab: false,
        }),
      },
      {
        id: "share-email",
        label: "Email",
        action: act("open_url", {
          url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
            `Here's my digital business card:\n\n${url}`,
          )}`,
          newTab: false,
        }),
      },
    ],
  });

}

/** Tile/button action for an integration the customer has not configured yet. */
export function setupRequiredAction(name: string): LayerAction {
  return act("popup", {
    title: `${name}: Setup required`,
    body: `Add your ${name} link in the digital business card settings and it will appear here.`,
  });
}
