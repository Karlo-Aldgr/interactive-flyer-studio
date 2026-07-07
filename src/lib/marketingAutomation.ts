import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { buildPublicFlyerUrl } from "@/lib/utils";
import { toast } from "sonner";

export type MarketingDraft = {
  id: string;
  flyer_id: string;
  owner_id: string;
  status: "pending" | "processing" | "ready" | "failed";
  flyer_title: string | null;
  flyer_url: string | null;
  thumbnail_url: string | null;
  facebook_post: string | null;
  instagram_caption: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

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
    }])
    .select()
    .single();

  if (error) {
    console.error("[marketing] insert draft failed", error);
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

  return draft as MarketingDraft;
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
  return data as MarketingDraft | null;
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
