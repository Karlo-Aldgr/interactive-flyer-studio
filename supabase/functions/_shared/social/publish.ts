// Publishing orchestration shared by "publish now" and the scheduled worker.
// The browser never calls a platform API — everything happens here.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { getAdapter } from "./registry.ts";
import { ensureFreshToken, loadAccount, markAccountStatus, statusForError } from "./store.ts";
import { CAPABILITIES, validateVariant } from "./capabilities.ts";
import {
  adapterError,
  type AdapterError,
  type MediaItem,
  type PublishSuccess,
  type SocialPlatform,
} from "./types.ts";

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours — long enough for slow platform pulls.

export type StoredMedia = {
  type: "image" | "video";
  url?: string;
  path?: string;
  mime_type?: string;
  asset_id?: string;
};

/** Turns stored media rows into publicly fetchable URLs the platforms can pull. */
export async function resolveMedia(
  supabase: SupabaseClient,
  media: StoredMedia[],
): Promise<MediaItem[] | AdapterError> {
  const out: MediaItem[] = [];
  for (const item of media) {
    if (item.url) {
      out.push({ url: item.url, type: item.type, mime_type: item.mime_type, asset_id: item.asset_id });
      continue;
    }
    if (!item.path) {
      return adapterError("validation", "A media item has neither a URL nor a stored file path.");
    }
    const { data, error } = await supabase.storage
      .from("social-assets")
      .createSignedUrl(item.path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      return adapterError("validation", `Could not read the uploaded file: ${error?.message ?? "unknown"}`);
    }
    out.push({
      url: data.signedUrl,
      type: item.type,
      mime_type: item.mime_type,
      asset_id: item.asset_id,
    });
  }
  return out;
}

export type VariantRow = {
  id: string;
  post_id: string;
  user_id: string;
  social_account_id: string | null;
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  media: StoredMedia[];
  link_url: string | null;
  platform_options: Record<string, unknown>;
};

export type VariantResult =
  | { variant_id: string; platform: SocialPlatform; ok: true; remote_post_id: string; remote_post_url: string | null; native_scheduled: boolean }
  | { variant_id: string; platform: SocialPlatform; ok: false; code: string; message: string; retryable: boolean };

/**
 * Publishes exactly one variant. Idempotent by design: a variant that is
 * already `published` is never re-sent to the platform.
 */
export async function publishVariant(
  supabase: SupabaseClient,
  variant: VariantRow,
  opts: { scheduledAt?: string | null; idempotencyKey: string; allowNativeSchedule?: boolean },
): Promise<VariantResult> {
  const fail = async (err: AdapterError): Promise<VariantResult> => {
    await supabase
      .from("social_post_variants")
      .update({ status: "failed", last_error: err.message })
      .eq("id", variant.id);
    return {
      variant_id: variant.id,
      platform: variant.platform,
      ok: false,
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    };
  };

  // Idempotency guard.
  const { data: current } = await supabase
    .from("social_post_variants")
    .select("status, remote_post_id, remote_post_url")
    .eq("id", variant.id)
    .maybeSingle();
  if (current?.status === "published" && current.remote_post_id) {
    return {
      variant_id: variant.id,
      platform: variant.platform,
      ok: true,
      remote_post_id: current.remote_post_id,
      remote_post_url: current.remote_post_url ?? null,
      native_scheduled: false,
    };
  }

  if (!variant.social_account_id) {
    return fail(adapterError("not_connected", "No connected account is selected for this platform."));
  }

  const issues = validateVariant(variant.platform, {
    caption: variant.caption,
    hashtags: variant.hashtags,
    link: variant.link_url,
    media: variant.media,
  });
  const blocking = issues.filter((i) => i.field !== "link");
  if (blocking.length) {
    return fail(adapterError("validation", blocking.map((i) => i.message).join(" ")));
  }

  await supabase.from("social_post_variants").update({ status: "publishing", last_error: null }).eq(
    "id",
    variant.id,
  );

  const loaded = await loadAccount(supabase, variant.social_account_id);
  if ("ok" in loaded && loaded.ok === false) return fail(loaded);
  const fresh = await ensureFreshToken(supabase, loaded as never);
  if ("ok" in fresh && (fresh as AdapterError).ok === false) return fail(fresh as AdapterError);
  const account = fresh as Awaited<ReturnType<typeof loadAccount>> & { id: string };

  const media = await resolveMedia(supabase, variant.media ?? []);
  if ("ok" in media && (media as AdapterError).ok === false) return fail(media as AdapterError);

  const adapter = getAdapter(variant.platform);
  const input = {
    caption: variant.caption,
    hashtags: variant.hashtags ?? [],
    link: variant.link_url,
    media: media as MediaItem[],
    options: variant.platform_options ?? {},
    scheduledAt: opts.scheduledAt ?? null,
    idempotencyKey: opts.idempotencyKey,
  };

  const useNative = Boolean(
    opts.allowNativeSchedule && opts.scheduledAt && CAPABILITIES[variant.platform].nativeScheduling,
  );

  let result: Awaited<ReturnType<typeof adapter.publishPost>>;
  try {
    result = useNative
      // deno-lint-ignore no-explicit-any
      ? await adapter.schedulePost(account as any, input)
      // deno-lint-ignore no-explicit-any
      : await adapter.publishPost(account as any, input);
  } catch (err) {
    result = adapterError("transient", String(err));
  }

  if (result.ok === false) {
    const nextStatus = statusForError(result.code);
    if (nextStatus) await markAccountStatus(supabase, account.id, nextStatus, result.message);
    return fail(result);
  }

  const success = result as PublishSuccess & { ok: true };
  await supabase
    .from("social_post_variants")
    .update({
      status: "published",
      remote_post_id: success.remote_post_id,
      remote_post_url: success.remote_post_url,
      published_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", variant.id);

  return {
    variant_id: variant.id,
    platform: variant.platform,
    ok: true,
    remote_post_id: success.remote_post_id,
    remote_post_url: success.remote_post_url,
    native_scheduled: success.native_scheduled,
  };
}

/** Recomputes the parent post status from its variants. */
export async function rollupPostStatus(supabase: SupabaseClient, postId: string) {
  const { data } = await supabase
    .from("social_post_variants")
    .select("status")
    .eq("post_id", postId);
  const statuses = (data ?? []).map((r) => r.status as string);
  if (!statuses.length) return;
  const published = statuses.filter((s) => s === "published").length;
  const failed = statuses.filter((s) => s === "failed").length;
  const pending = statuses.filter((s) => s === "queued" || s === "publishing" || s === "draft").length;

  let status: string;
  if (pending > 0 && published === 0 && failed === 0) status = "queued";
  else if (pending > 0) status = "publishing";
  else if (published === statuses.length) status = "published";
  else if (published > 0) status = "partially_published";
  else status = "failed";

  const patch: Record<string, unknown> = { status };
  if (status === "published" || status === "partially_published") {
    patch.published_at = new Date().toISOString();
  }
  await supabase.from("social_posts").update(patch).eq("id", postId);
}

/** Bounded exponential backoff: 1m, 4m, 9m, 16m … capped at 2h. */
export function backoffMs(attempt: number) {
  return Math.min(attempt * attempt * 60_000, 2 * 60 * 60_000);
}
