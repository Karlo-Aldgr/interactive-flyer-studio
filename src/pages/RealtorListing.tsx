import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { RealtorShell } from "@/components/realtor/RealtorShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoGalleryModule } from "@/components/realtor/PhotoGalleryModule";
import {
  LISTING_STATUSES, getListing, setListingPublished, updateListing,
  type Listing, type ListingStatus,
} from "@/lib/realtor";
import { buildPublicFlyerUrl } from "@/lib/utils";

type Props = { focusPhotos?: boolean };

export default function RealtorListing({ focusPhotos = false }: Props) {
  const { listingId } = useParams<{ listingId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isRealtor, loading: roleLoading } = useIsRealtor();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [listingStatus, setListingStatus] = useState<ListingStatus>("active");

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      setLoading(true);
      const l = await getListing(listingId);
      setListing(l);
      if (l) {
        setAddress(l.address ?? "");
        setPrice(l.price_cents != null ? String(l.price_cents / 100) : "");
        setBeds(l.beds != null ? String(l.beds) : "");
        setBaths(l.baths != null ? String(l.baths) : "");
        setSqft(l.sqft != null ? String(l.sqft) : "");
        setListingStatus(l.listing_status);
      }
      setLoading(false);
    })();
  }, [listingId]);

  if (authLoading || roleLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isRealtor) return <Navigate to="/dashboard" replace />;
  if (!loading && !listing) return <Navigate to="/realtor" replace />;

  const save = async () => {
    if (!listing) return;
    setSaving(true);
    try {
      const priceCents = price ? Math.round(parseFloat(price) * 100) : null;
      await updateListing(listing.id, {
        address: address || null,
        title: address || listing.title,
        price_cents: priceCents,
        beds: beds ? parseInt(beds, 10) : null,
        baths: baths ? parseFloat(baths) : null,
        sqft: sqft ? parseInt(sqft, 10) : null,
        listing_status: listingStatus,
      } as any);
      toast.success("Saved");
      setListing({ ...listing, address, price_cents: priceCents, beds: beds ? +beds : null, baths: baths ? +baths : null, sqft: sqft ? +sqft : null, listing_status: listingStatus });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!listing) return;
    const next = listing.status !== "published";
    try {
      await setListingPublished(listing.id, next);
      const listing_status =
        next && listing.listing_status === "draft" ? "active" : listing.listing_status;
      setListing({ ...listing, status: next ? "published" : "draft", listing_status });
      toast.success(next ? "Published — flyer is live online" : "Unpublished");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <RealtorShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/realtor"><ArrowLeft className="mr-1 h-4 w-4" />All listings</Link>
        </Button>

        <PageHeader
          title={listing?.address ?? listing?.title ?? "Listing"}
          description={focusPhotos ? "Manage the standalone photo gallery for this property." : "Edit listing details and the photo gallery."}
          actions={
            listing && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/editor/${listing.id}`)}>
                  <Wand2 className="mr-1 h-4 w-4" />Flyer editor
                </Button>
                <Button variant="outline" onClick={togglePublish}>
                  {listing.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                {listing.status === "published" && listing.public_slug && (
                  <Button asChild>
                    <a href={buildPublicFlyerUrl(listing.public_slug)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" />View live
                    </a>
                  </Button>
                )}
              </div>
            )
          }
        />

        {loading || !listing ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {!focusPhotos && (
              <Card className="p-5">
                <h2 className="font-display text-lg font-semibold">Listing details</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">Property address</Label>
                    <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="price">Price (USD)</Label>
                    <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
                  </div>
                  <div>
                    <Label htmlFor="status">Market status</Label>
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      Where the property is in the sales process — separate from publishing the flyer.
                    </p>
                    <Select value={listingStatus} onValueChange={(v) => setListingStatus(v as ListingStatus)}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LISTING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="beds">Bedrooms</Label>
                    <Input id="beds" inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value.replace(/[^0-9]/g, ""))} />
                  </div>
                  <div>
                    <Label htmlFor="baths">Bathrooms</Label>
                    <Input id="baths" inputMode="decimal" value={baths} onChange={(e) => setBaths(e.target.value.replace(/[^0-9.]/g, ""))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="sqft">Square footage</Label>
                    <Input id="sqft" inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/[^0-9]/g, ""))} />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    Save details
                  </Button>
                </div>
              </Card>
            )}

            <section>
              <h2 className="font-display text-lg font-semibold">Photo gallery</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Standalone visual library for this property. Drag to reorder and organize by room.
              </p>
              <div className="mt-4">
                <PhotoGalleryModule flyerId={listing.id} ownerId={listing.owner_id} canDownload />
              </div>
            </section>
          </>
        )}
      </div>
    </RealtorShell>
  );
}
