import { supabase } from "@/integrations/supabase/client";

export type ListingStatus = "active" | "sold" | "draft" | "pending";

export type Listing = {
  id: string;
  owner_id: string;
  title: string;
  status: "draft" | "published";
  public_slug: string | null;
  thumbnail_url: string | null;
  address: string | null;
  price_cents: number | null;
  listing_status: ListingStatus;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  created_at: string;
  updated_at: string;
};

export type PhotoCategory = "exterior" | "interior" | "kitchen" | "bathroom" | "amenities" | "other";

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "amenities", label: "Amenities" },
  { value: "other", label: "Other" },
];

export type ListingPhoto = {
  id: string;
  flyer_id: string;
  url: string;
  category: PhotoCategory;
  position: number;
  caption: string | null;
  staged_url: string | null;
};


export const LISTING_STATUSES: { value: ListingStatus; label: string; className: string; shortLabel?: string }[] = [
  { value: "active", label: "Active on market", shortLabel: "On market", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "pending", label: "Pending sale", shortLabel: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "sold", label: "Sold", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground" },
];

export function formatPrice(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

const LISTING_FIELDS =
  "id, owner_id, title, status, public_slug, thumbnail_url, address, price_cents, listing_status, beds, baths, sqft, created_at, updated_at";

export async function loadMyListings(): Promise<{ listings: Listing[]; error: any }> {
  const { data, error } = await supabase
    .from("flyers")
    .select(LISTING_FIELDS)
    .eq("category", "realtor" as any)
    .order("updated_at", { ascending: false });
  return { listings: ((data as any[]) ?? []) as Listing[], error };
}

export async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase.from("flyers").select(LISTING_FIELDS).eq("id", id).maybeSingle();
  return (data as any) ?? null;
}

export async function createListing(ownerId: string, address: string, priceCents: number | null) {
  const title = address.trim() || "Untitled listing";
  const { data: flyer, error } = await supabase
    .from("flyers")
    .insert([{ owner_id: ownerId, title, category: "realtor", address, price_cents: priceCents, listing_status: "active" } as any])
    .select(LISTING_FIELDS)
    .single();
  if (error) throw error;
  // Seed a page so the flyer can be opened in the editor later
  await supabase.from("pages").insert([{ flyer_id: (flyer as any).id, index: 0, name: "Page 1" }]);
  return flyer as any as Listing;
}

export async function updateListing(id: string, patch: Partial<Listing>) {
  const { error } = await supabase.from("flyers").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from("flyers").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateListing(listing: Listing, ownerId: string) {
  const { data: copy, error } = await supabase
    .from("flyers")
    .insert([{
      owner_id: ownerId,
      title: listing.title + " (copy)",
      category: "realtor",
      address: listing.address,
      price_cents: listing.price_cents,
      listing_status: "draft",
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
    } as any])
    .select(LISTING_FIELDS)
    .single();
  if (error) throw error;
  return copy as any as Listing;
}

export async function setListingPublished(id: string, publish: boolean) {
  const patch: Record<string, unknown> = { status: publish ? "published" : "draft" };
  if (publish) {
    const listing = await getListing(id);
    if (listing?.listing_status === "draft") {
      patch.listing_status = "active";
    }
  }
  const { error } = await supabase.from("flyers").update(patch as any).eq("id", id);
  if (error) throw error;
  if (publish) {
    // Ensure a public slug exists so the listing is openable from the public profile.
    await supabase.rpc("ensure_flyer_public_slug" as any, { _flyer_id: id });
  }
}

// ---------- Photos ----------

export async function loadListingPhotos(flyerId: string): Promise<ListingPhoto[]> {
  const { data, error } = await supabase
    .from("listing_photos" as any)
    .select("id, flyer_id, url, category, position, caption, staged_url")
    .eq("flyer_id", flyerId)
    .order("position", { ascending: true });
  if (error) {
    console.error("loadListingPhotos", error);
    return [];
  }
  return (data ?? []) as any as ListingPhoto[];
}

export async function uploadListingPhoto(args: {
  ownerId: string;
  flyerId: string;
  file: File;
  category: PhotoCategory;
  position: number;
}) {
  const ext = (args.file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${args.ownerId}/listings/${args.flyerId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("flyer-assets")
    .upload(path, args.file, { cacheControl: "31536000", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("flyer-assets").getPublicUrl(path);
  const { data, error } = await supabase
    .from("listing_photos" as any)
    .insert([{ flyer_id: args.flyerId, url: pub.publicUrl, category: args.category, position: args.position }])
    .select("id, flyer_id, url, category, position, caption, staged_url")
    .single();
  if (error) throw error;
  return data as any as ListingPhoto;
}

export async function deleteListingPhoto(id: string) {
  const { error } = await supabase.from("listing_photos" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function updateListingPhoto(id: string, patch: Partial<Pick<ListingPhoto, "category" | "caption" | "position" | "staged_url">>) {
  const { error } = await supabase.from("listing_photos" as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function uploadStagedListingPhoto(args: {
  ownerId: string;
  flyerId: string;
  photoId: string;
  file: File;
}): Promise<string> {
  const ext = (args.file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${args.ownerId}/listings/${args.flyerId}/staged-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("flyer-assets")
    .upload(path, args.file, { cacheControl: "31536000", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("flyer-assets").getPublicUrl(path);
  const { error } = await supabase
    .from("listing_photos" as any)
    .update({ staged_url: pub.publicUrl })
    .eq("id", args.photoId);
  if (error) throw error;
  return pub.publicUrl;
}

export async function clearStagedListingPhoto(id: string) {
  const { error } = await supabase
    .from("listing_photos" as any)
    .update({ staged_url: null })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderListingPhotos(orderedIds: string[]) {
  // Batch position updates
  await Promise.all(
    orderedIds.map((id, idx) => supabase.from("listing_photos" as any).update({ position: idx }).eq("id", id))
  );
}

// ---------- Stats ----------

export type ListingStats = { flyer_id: string; views: number; leads: number };

export async function loadListingStats(flyerIds: string[]): Promise<Record<string, ListingStats>> {
  if (flyerIds.length === 0) return {};
  const { data, error } = await supabase.rpc("realtor_listing_stats" as any, { _flyer_ids: flyerIds });
  if (error) {
    console.warn("realtor_listing_stats", error.message);
    return {};
  }
  const map: Record<string, ListingStats> = {};
  for (const row of (data ?? []) as any[]) {
    map[row.flyer_id] = { flyer_id: row.flyer_id, views: Number(row.views ?? 0), leads: Number(row.leads ?? 0) };
  }
  return map;
}
