/** Shared Graph posting + marketing_drafts status patches for Facebook. */

export type MetaPostResult =
  | { ok: true; provider_post_id: string; attemptAt: string }
  | { ok: false; error: string; attemptAt: string };

export function extractLinkFromDraft(draft: Record<string, unknown>, message: string): string {
  const linkFromDraft = typeof draft.flyer_url === "string" ? draft.flyer_url.trim() : "";
  const linkFromMessage = (() => {
    const match = message.match(/https?:\/\/[^\s]+/i);
    return match?.[0]?.replace(/[),.;!?]+$/g, "") || "";
  })();
  return linkFromDraft || linkFromMessage;
}

export async function postFacebookToPage(args: {
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  message: string;
  link?: string;
  thumbnailUrl?: string;
}): Promise<MetaPostResult> {
  const attemptAt = new Date().toISOString();
  const params = new URLSearchParams({
    access_token: args.pageAccessToken,
  });

  const hasLink = !!args.link && /^https:\/\//i.test(args.link);
  const canPostPhoto = !!args.thumbnailUrl && /^https:\/\//i.test(args.thumbnailUrl);
  // Prefer /feed + link: it renders a clickable link preview card back to the flyer.
  // /photos shows the image but the image is not clickable, so only use it when no link exists.
  let graphEndpoint = `https://graph.facebook.com/${args.graphVersion}/${args.pageId}/feed`;
  if (hasLink) {
    params.set("message", args.message);
    params.set("link", args.link!);
  } else if (canPostPhoto) {
    graphEndpoint = `https://graph.facebook.com/${args.graphVersion}/${args.pageId}/photos`;
    params.set("url", args.thumbnailUrl!);
    params.set("caption", args.message);
  } else {
    params.set("message", args.message);
  }

  const graphRes = await fetch(graphEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  let graphJson: Record<string, unknown> = {};
  try {
    graphJson = await graphRes.json();
  } catch {
    graphJson = {};
  }

  if (!graphRes.ok || typeof graphJson.id !== "string") {
    const providerError = String(
      graphJson.error && typeof graphJson.error === "object"
        ? (graphJson.error as Record<string, unknown>).message || "Facebook API request failed"
        : graphJson.error || "Facebook API request failed",
    ).slice(0, 500);
    return { ok: false, error: providerError, attemptAt };
  }

  return { ok: true, provider_post_id: graphJson.id, attemptAt };
}

export function facebookSuccessPatch(providerPostId: string, attemptAt: string) {
  return {
    facebook_status: "posted",
    facebook_posted_at: attemptAt,
    facebook_scheduled_for: null,
    facebook_error_message: null,
    facebook_provider_status: "posted",
    facebook_provider_post_id: providerPostId,
    facebook_last_attempt_at: attemptAt,
    facebook_last_error: null,
  };
}

export function facebookFailurePatch(error: string, attemptAt: string) {
  return {
    facebook_status: "failed",
    facebook_error_message: error,
    facebook_provider_status: "failed",
    facebook_last_attempt_at: attemptAt,
    facebook_last_error: error,
  };
}
