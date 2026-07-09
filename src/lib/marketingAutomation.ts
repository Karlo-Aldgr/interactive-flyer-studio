import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { buildPublicFlyerUrl } from "@/lib/utils";
import { toast } from "sonner";

export type MarketingGenStatus = "pending" | "processing" | "ready" | "failed";
export type MarketingChannelStatus = "draft" | "scheduled" | "posted" | "failed";
export type MarketingChannel = "facebook" | "instagram";

export type MarketingDraft = {
  id: string;
  flyer_id: string;
  owner_id: string;
  status: MarketingGenStatus;
  flyer_title: string | null;
  flyer_url: string | null;
  thumbnail_url: string | null;
  facebook_post: string | null;
  instagram_caption: string | null;
  error_message: string | null;
  facebook_status: MarketingChannelStatus;
  instagram_status: MarketingChannelStatus;
  facebook_scheduled_for: string | null;
  instagram_scheduled_for: string | null;
  facebook_posted_at: string | null;
  instagram_posted_at: string | null;
  facebook_error_message: string | null;
  instagram_error_message: string | null;
  created_at: string;
  updated_at: string;
};

function asChannelStatus(value: string | null | undefined): MarketingChannelStatus {
  if (value === "scheduled" || value === "posted" || value === "failed") return value;
  return "draft";
}

function normalizeDraft(row: Record<string, unknown>): MarketingDraft {
  return {
    id: String(row.id),
    flyer_id: String(row.flyer_id),
    owner_id: String(row.owner_id),
    status: (row.status as MarketingGenStatus) || "pending",
    flyer_title: (row.flyer_title as string | null) ?? null,
    flyer_url: (row.flyer_url as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    facebook_post: (row.facebook_post as string | null) ?? null,
    instagram_caption: (row.instagram_caption as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    facebook_status: asChannelStatus(row.facebook_status as string | null),
    instagram_status: asChannelStatus(row.instagram_status as string | null),
    facebook_scheduled_for: (row.facebook_scheduled_for as string | null) ?? null,
    instagram_scheduled_for: (row.instagram_scheduled_for as string | null) ?? null,
    facebook_posted_at: (row.facebook_posted_at as string | null) ?? null,
    instagram_posted_at: (row.instagram_posted_at as string | null) ?? null,
    facebook_error_message: (row.facebook_error_message as string | null) ?? null,
    instagram_error_message: (row.instagram_error_message as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function triggerMarketingOnPublish(args: {
  flyerId: string;
  ownerId: string;
  title: string;
  slug: string | null;
  thumbnailUrl?: string | null;
}): Promise<MarketingDraft | null> {
  if (!args.slug?.trim()) return null;

  const flyerUrl = buildPublicFlyerUrl(args.slug);

  const { data: draft, error } = await supabase
    .from("marketing_drafts")
    .insert([{
      flyer_id: args.flyerId,
      owner_id: args.ownerId,
      status: "pending",
      flyer_title: args.title,
      flyer_url: flyerUrl,
      thumbnail_url: args.thumbnailUrl ?? null,
      facebook_status: "draft",
      instagram_status: "draft",
    }])
    .select()
    .single();

  if (error) {
    console.error("[marketing] insert draft failed", error);
    const msg = error.message || "";
    if (/row-level security|rls|42501/i.test(msg)) {
      toast.error("Could not save marketing draft — permission denied. Run the marketing_drafts RLS fix migration.");
    } else {
      toast.error("Could not save marketing draft: " + msg);
    }
    return null;
  }

  try {
    const result = await invokeEdgeFunction<{ ok?: boolean; skipped?: boolean; reason?: string }>(
      "marketing-trigger",
      { draft_id: draft.id },
    );
    if (result.skipped) {
      toast.message("Marketing AI is not configured yet — add n8n webhook in Supabase secrets.");
    } else {
      toast.message("Creating Facebook & Instagram posts…");
    }
  } catch (err) {
    console.error("[marketing] trigger failed", err);
    toast.message("Could not start marketing AI — check n8n setup.");
  }

  return normalizeDraft(draft as Record<string, unknown>);
}

export async function loadLatestMarketingDraft(flyerId: string): Promise<MarketingDraft | null> {
  const { data, error } = await supabase
    .from("marketing_drafts")
    .select("*")
    .eq("flyer_id", flyerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[marketing] load draft failed", error);
    return null;
  }
  if (!data) return null;
  return normalizeDraft(data as Record<string, unknown>);
}

export async function regenerateMarketingDraft(flyerId: string, ownerId: string): Promise<void> {
  const { data: flyer, error } = await supabase
    .from("flyers")
    .select("id, title, public_slug, thumbnail_url, owner_id")
    .eq("id", flyerId)
    .maybeSingle();

  if (error || !flyer) {
    toast.error("Could not load flyer");
    return;
  }
  if (flyer.owner_id !== ownerId) {
    toast.error("Not allowed");
    return;
  }
  if (!flyer.public_slug) {
    toast.error("Publish the flyer first");
    return;
  }

  await triggerMarketingOnPublish({
    flyerId: flyer.id,
    ownerId,
    title: flyer.title,
    slug: flyer.public_slug,
    thumbnailUrl: flyer.thumbnail_url,
  });
}

function channelPatch(
  channel: MarketingChannel,
  patch: {
    status?: MarketingChannelStatus;
    scheduledFor?: string | null;
    postedAt?: string | null;
    errorMessage?: string | null;
  },
): Record<string, unknown> {
  if (channel === "facebook") {
    return {
      ...(patch.status !== undefined ? { facebook_status: patch.status } : {}),
      ...(patch.scheduledFor !== undefined ? { facebook_scheduled_for: patch.scheduledFor } : {}),
      ...(patch.postedAt !== undefined ? { facebook_posted_at: patch.postedAt } : {}),
      ...(patch.errorMessage !== undefined ? { facebook_error_message: patch.errorMessage } : {}),
    };
  }
  return {
    ...(patch.status !== undefined ? { instagram_status: patch.status } : {}),
    ...(patch.scheduledFor !== undefined ? { instagram_scheduled_for: patch.scheduledFor } : {}),
    ...(patch.postedAt !== undefined ? { instagram_posted_at: patch.postedAt } : {}),
    ...(patch.errorMessage !== undefined ? { instagram_error_message: patch.errorMessage } : {}),
  };
}

async function updateChannel(
  draftId: string,
  channel: MarketingChannel,
  patch: {
    status?: MarketingChannelStatus;
    scheduledFor?: string | null;
    postedAt?: string | null;
    errorMessage?: string | null;
  },
): Promise<MarketingDraft | null> {
  const { data, error } = await supabase
    .from("marketing_drafts")
    .update(channelPatch(channel, patch))
    .eq("id", draftId)
    .select()
    .single();

  if (error) {
    console.error("[marketing] update channel failed", error);
    toast.error(error.message || "Could not update marketing status");
    return null;
  }
  return normalizeDraft(data as Record<string, unknown>);
}

/** Schedule Facebook or Instagram for a future time (app-only — does not post). */
export async function scheduleMarketingChannel(
  draftId: string,
  channel: MarketingChannel,
  scheduledForIso: string,
): Promise<MarketingDraft | null> {
  const when = new Date(scheduledForIso);
  if (isNaN(when.getTime())) {
    toast.error("Pick a valid date and time");
    return null;
  }
  if (when.getTime() <= Date.now()) {
    toast.error("Schedule time must be in the future");
    return null;
  }

  const updated = await updateChannel(draftId, channel, {
    status: "scheduled",
    scheduledFor: when.toISOString(),
    postedAt: null,
    errorMessage: null,
  });
  if (updated) {
    toast.success(channel === "facebook" ? "Facebook post scheduled" : "Instagram caption scheduled");
  }
  return updated;
}

/** Clear schedule and return channel to draft. */
export async function unscheduleMarketingChannel(
  draftId: string,
  channel: MarketingChannel,
): Promise<MarketingDraft | null> {
  const updated = await updateChannel(draftId, channel, {
    status: "draft",
    scheduledFor: null,
    errorMessage: null,
  });
  if (updated) {
    toast.message(channel === "facebook" ? "Facebook unscheduled" : "Instagram unscheduled");
  }
  return updated;
}

/** Manually mark a channel as posted (Phase 2 has no Meta API — honor system). */
export async function markMarketingChannelPosted(
  draftId: string,
  channel: MarketingChannel,
): Promise<MarketingDraft | null> {
  const updated = await updateChannel(draftId, channel, {
    status: "posted",
    scheduledFor: null,
    postedAt: new Date().toISOString(),
    errorMessage: null,
  });
  if (updated) {
    toast.success(channel === "facebook" ? "Facebook marked as posted" : "Instagram marked as posted");
  }
  return updated;
}

export function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatScheduleLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
