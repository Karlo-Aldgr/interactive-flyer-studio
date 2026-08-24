import { supabase } from "@/integrations/supabase/client";
import {
  GODS_WARRIOR_CANVAS,
  GODS_WARRIOR_HOTSPOTS,
  GODS_WARRIOR_FLYER_IMAGE,
  GODS_WARRIOR_META,
} from "@/lib/templates/godsWarrior";

export type FlyerTemplateId = "gods-warrior";

export async function createFlyerFromTemplate(
  templateId: FlyerTemplateId,
  ownerId: string,
): Promise<{ flyerId: string }> {
  if (templateId !== "gods-warrior") {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const { data: flyer, error: flyerErr } = await supabase
    .from("flyers")
    .insert([{
      owner_id: ownerId,
      title: GODS_WARRIOR_META.title,
      category: GODS_WARRIOR_META.category,
      thumbnail_url: GODS_WARRIOR_META.thumbnailUrl,
      settings: GODS_WARRIOR_CANVAS as unknown as any,
    }])
    .select("id")
    .single();

  if (flyerErr || !flyer) throw flyerErr ?? new Error("Could not create flyer");

  const { data: page, error: pageErr } = await supabase
    .from("pages")
    .insert([{
      flyer_id: flyer.id,
      index: 0,
      name: "Cover",
      background: { color: GODS_WARRIOR_CANVAS.background, size: { width: GODS_WARRIOR_CANVAS.width, height: GODS_WARRIOR_CANVAS.height } },
    }])
    .select("id")
    .single();

  if (pageErr || !page) throw pageErr ?? new Error("Could not create page");

  const { error: bgErr } = await supabase
    .from("layers")
    .insert([{
      page_id: page.id,
      type: "image",
      position: { x: 0, y: 0 },
      size: { width: GODS_WARRIOR_CANVAS.width, height: GODS_WARRIOR_CANVAS.height },
      rotation: 0,
      z_index: 0,
      style: {},
      content: { src: GODS_WARRIOR_FLYER_IMAGE },
    }]);

  if (bgErr) throw bgErr;

  for (let i = 0; i < GODS_WARRIOR_HOTSPOTS.length; i++) {
    const spot = GODS_WARRIOR_HOTSPOTS[i];
    const { data: hotspot, error: hsErr } = await supabase
      .from("layers")
      .insert([{
        page_id: page.id,
        type: "hotspot",
        position: spot.position,
        size: spot.size,
        rotation: 0,
        z_index: i + 1,
        style: { opacity: 1 },
        content: { hotspotShape: "rect" },
      }])
      .select("id")
      .single();

    if (hsErr || !hotspot) throw hsErr ?? new Error("Could not create hotspot layer");

    const { error: actErr } = await supabase.from("actions").insert([{
      layer_id: hotspot.id,
      type: spot.action.type,
      payload: spot.action.payload as unknown as any,
    }]);

    if (actErr) throw actErr;
  }

  return { flyerId: flyer.id };
}
