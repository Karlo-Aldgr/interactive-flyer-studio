import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Mail, Phone, Building2, UserCircle2, Bed, Bath, Ruler, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  loadPublicRealtorProfile,
  type PublicRealtorListing,
  type RealtorProfile,
} from "@/lib/realtorProfile";
import { buildPublicFlyerUrl } from "@/lib/utils";
import { formatPrice, LISTING_STATUSES } from "@/lib/realtor";

export default function PublicRealtorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<RealtorProfile | null>(null);
  const [listings, setListings] = useState<PublicRealtorListing[]>([]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const res = await loadPublicRealtorProfile(slug);
      if (res) {
        setProfile(res.profile);
        setListings(res.listings);
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (profile?.full_name) {
      document.title = `${profile.full_name} — Listings`;
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Realtor not found</h1>
        <p className="text-sm text-muted-foreground">This realtor page doesn't exist or has been removed.</p>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer" className="h-8 w-auto" />
          </Link>
          <Link to="/for-realtors" className="text-sm text-muted-foreground hover:text-foreground">
            For Realtors
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.full_name ?? "Realtor"} className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">
                {profile.full_name || "Realtor"}
              </h1>
              {profile.headline && (
                <p className="mt-1 text-muted-foreground">{profile.headline}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.brokerage && (
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="h-3.5 w-3.5" />{profile.brokerage}
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.phone && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${profile.phone}`}><Phone className="mr-1 h-3.5 w-3.5" />{profile.phone}</a>
                  </Button>
                )}
                {profile.email && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${profile.email}`}><Mail className="mr-1 h-3.5 w-3.5" />Email</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <section className="mt-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Active listings</h2>
            <span className="text-sm text-muted-foreground">{listings.length}</span>
          </div>

          {listings.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No active listings right now.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <ListingTile key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ListingTile({ listing }: { listing: PublicRealtorListing }) {
  const status = LISTING_STATUSES.find((s) => s.value === listing.listing_status);
  const href = listing.public_slug ? buildPublicFlyerUrl(listing.public_slug) : null;
  const inner = (
    <Card className="flex h-full flex-col overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {listing.thumbnail_url ? (
          <img src={listing.thumbnail_url} alt={listing.address ?? listing.title} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        {status && <Badge className={`absolute left-2 top-2 ${status.className}`}>{status.label}</Badge>}
        <div className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-sm font-bold shadow">
          {formatPrice(listing.price_cents)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-1 text-sm font-medium">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{listing.address ?? listing.title}</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {listing.beds != null && <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{listing.beds} bd</span>}
          {listing.baths != null && <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{listing.baths} ba</span>}
          {listing.sqft != null && <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{listing.sqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </Card>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer">{inner}</a> : inner;
}
