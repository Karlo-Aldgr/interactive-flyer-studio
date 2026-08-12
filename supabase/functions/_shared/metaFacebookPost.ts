/** Shared Graph posting + marketing_drafts status patches for Facebook. */

export type MetaPostResult =
  | { ok: true; provider_post_id: string; attemptAt: string }
  | { ok: false; error: string; attemptAt: string };

/** Cloudflare share worker that serves crawler-friendly og:image for flyers. */
const SHARE_WORKER_ORIGIN = "https://tapthatflyer-share.showoffgrafixs.workers.dev";

/** Rewrite tapthatflyer.com flyer links to the share worker so FB gets the flyer og:image. */
export function toShareWorkerUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const isMainSite = /^(www\.)?tapthatflyer\.com$/i.test(parsed.hostname);
    if (!isMainSite) return url;
    if (!/^\/f\//i.test(parsed.pathname)) return url;
    return `${SHARE_WORKER_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function extractLinkFromDraft(draft: Record<string, unknown>, message: string): string {
  const urlsInMessage = (message.match(/https?:\/\/[^\s]+/gi) ?? []).map((u) =>
    u.replace(/[),.;!?]+$/g, "")
  );
  // Prefer an explicit share-worker URL already present in the caption.
  const workerUrl = urlsInMessage.find((u) => /workers\.dev/i.test(u));
  if (workerUrl) return workerUrl;

  const linkFromDraft = typeof draft.flyer_url === "string" ? draft.flyer_url.trim() : "";
  const link = linkFromDraft || urlsInMessage[0] || "";
  return toShareWorkerUrl(link);
}

/** Graph error codes worth retrying (transient), not token death. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function postFacebookToPage(args: {
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  message: string;
  link?: string;
  thumbnailUrl?: string;
  /** Total attempts including the first one. */
  maxAttempts?: number;
}): Promise<MetaPostResult> {
  const params = new URLSearchParams({
    access_token: args.pageAccessToken,
  });

  const link = args.link ? toShareWorkerUrl(args.link) : "";
  const hasLink = !!link && /^https:\/\//i.test(link);
  const canPostPhoto = !!args.thumbnailUrl && /^https:\/\//i.test(args.thumbnailUrl);
  // Prefer /feed + link: it renders a clickable link preview card back to the flyer.
  // /photos shows the image but the image is not clickable, so only use it when no link exists.
  let graphEndpoint = `https://graph.facebook.com/${args.graphVersion}/${args.pageId}/feed`;
  if (hasLink) {
    params.set("message", args.message);
    params.set("link", link);
  } else if (canPostPhoto) {
    graphEndpoint = `https://graph.facebook.com/${args.graphVersion}/${args.pageId}/photos`;
    params.set("url", args.thumbnailUrl!);
    params.set("caption", args.message);
  } else {
    params.set("message", args.message);
  }

  const maxAttempts = Math.max(1, args.maxAttempts ?? 3);
  let lastError = "Facebook API request failed";
  let attemptAt = new Date().toISOString();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptAt = new Date().toISOString();
    let status = 0;
    let graphJson: Record<string, unknown> = {};
    let networkError = "";

    try {
      const graphRes = await fetch(graphEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      status = graphRes.status;
      try {
        graphJson = await graphRes.json();
      } catch {
        graphJson = {};
      }
      if (graphRes.ok && typeof graphJson.id === "string") {
        return { ok: true, provider_post_id: graphJson.id, attemptAt };
      }
    } catch (err) {
      networkError = String(err);
    }

    const errObj = (graphJson.error ?? {}) as Record<string, unknown>;
    lastError = String(
      networkError ||
        errObj.message ||
        graphJson.error ||
        "Facebook API request failed",
    ).slice(0, 500);
    const code = Number(errObj.code ?? 0);
    const retryable = !!networkError || status >= 500 || RETRYABLE_CODES.has(code);

    if (!retryable || attempt === maxAttempts) break;
    // Exponential backoff: 1s, 2s, 4s ...
    await sleep(1000 * 2 ** (attempt - 1));
  }

  return { ok: false, error: lastError, attemptAt };
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
