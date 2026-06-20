import { supabase } from "@/integrations/supabase/client";

export async function uploadFlyerAsset(
  userId: string,
  flyerId: string,
  file: Blob | File,
  folder = "extracts",
): Promise<string> {
  const ext = file instanceof File ? (file.name.split(".").pop() || "png") : "png";
  const path = `${userId}/${flyerId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("flyer-assets").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
  return data.publicUrl;
}
