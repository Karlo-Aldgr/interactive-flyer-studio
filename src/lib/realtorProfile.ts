import { supabase } from "@/integrations/supabase/client";

export type RealtorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  photo_url: string | null;
  phone: string | null;
  brokerage: string | null;
  headline: string | null;
  profile_slug: string | null;
};

export type PublicRealtorListing = {
  id: string;
  title: string;
  public_slug: string | null;
  thumbnail_url: string | null;
  address: string | null;
  price_cents: number | null;
  listing_status: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  updated_at: string;
};

export async function loadMyRealtorProfile(userId: string): Promise<RealtorProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, photo_url, phone, brokerage, headline, profile_slug")
    .eq("id", userId)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function updateMyRealtorProfile(patch: {
  full_name?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  brokerage?: string | null;
  headline?: string | null;
  profile_slug?: string | null;
}) {
  const { data, error } = await supabase.rpc("update_my_realtor_profile" as any, {
    _full_name: patch.full_name ?? null,
    _photo_url: patch.photo_url ?? null,
    _phone: patch.phone ?? null,
    _brokerage: patch.brokerage ?? null,
    _headline: patch.headline ?? null,
    _profile_slug: patch.profile_slug ?? null,
  });
  if (error) throw error;
  const result = data as any;
  if (result && result.ok === false) throw new Error(result.error || "Update failed");
  return result;
}

export async function uploadRealtorPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/profile/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("flyer-assets")
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function loadPublicRealtorProfile(
  slug: string
): Promise<{ profile: RealtorProfile; listings: PublicRealtorListing[] } | null> {
  const { data, error } = await supabase.rpc("get_realtor_public_profile" as any, { _slug: slug });
  if (error) return null;
  const result = data as any;
  if (!result || result.ok === false) return null;
  return { profile: result.profile, listings: result.listings ?? [] };
}
