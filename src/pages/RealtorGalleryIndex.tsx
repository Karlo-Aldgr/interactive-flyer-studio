import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { RealtorShell } from "@/components/realtor/RealtorShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadMyListings, type Listing } from "@/lib/realtor";

export default function RealtorGalleryIndex() {
  const { user, loading: authLoading } = useAuth();
  const { isRealtor, loading: roleLoading } = useIsRealtor();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isRealtor) return;
    loadMyListings().then(({ listings }) => { setListings(listings); setLoading(false); });
  }, [isRealtor]);

  if (authLoading || roleLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isRealtor) return <Navigate to="/dashboard" replace />;

  return (
    <RealtorShell>
      <div className="space-y-6">
        <PageHeader
          title="Photo Gallery"
          description="Each property has its own dedicated standalone gallery — separate from the interactive flyer. Pick a property to manage its photos."
        />
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : listings.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            You don&apos;t have any listings yet. Create one from <Link to="/realtor" className="text-primary underline">My Listings</Link>.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.id} className="flex items-center gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {l.thumbnail_url ? (
                    <img src={l.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.address ?? l.title}</div>
                  <div className="text-xs text-muted-foreground">Gallery</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/realtor/listing/${l.id}/photos`}>Manage</Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RealtorShell>
  );
}
