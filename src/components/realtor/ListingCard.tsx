import { Link } from "react-router-dom";
import { Eye, Users, Edit3, Copy, Trash2, ExternalLink, Image as ImageIcon, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LISTING_STATUSES, type Listing, type ListingStats, formatPrice } from "@/lib/realtor";
import { buildPublicFlyerUrl } from "@/lib/utils";

type Props = {
  listing: Listing;
  stats?: ListingStats;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
};

export function ListingCard({ listing, stats, onEdit, onDuplicate, onDelete, onTogglePublish }: Props) {
  const statusMeta = LISTING_STATUSES.find((s) => s.value === listing.listing_status) ?? LISTING_STATUSES[3];
  const isPublished = listing.status === "published";
  const marketLabel = statusMeta.shortLabel ?? statusMeta.label;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {listing.thumbnail_url ? (
          <img src={listing.thumbnail_url} alt={listing.address ?? listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 opacity-40" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-2">
          <Badge className={statusMeta.className}>{marketLabel}</Badge>
          {isPublished ? (
            <Badge className="bg-sky-500/15 text-sky-800 dark:text-sky-200">Live online</Badge>
          ) : (
            <Badge variant="outline" className="bg-background/80">Flyer offline</Badge>
          )}
        </div>
        <div className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-sm font-bold shadow">
          {formatPrice(listing.price_cents)}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate font-semibold">{listing.address ?? listing.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {listing.beds != null && <span>{listing.beds} bd</span>}
            {listing.baths != null && <span>{listing.baths} ba</span>}
            {listing.sqft != null && <span>{listing.sqft.toLocaleString()} sqft</span>}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{stats?.views ?? 0} views</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{stats?.leads ?? 0} leads</span>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit3 className="mr-1 h-3.5 w-3.5" />Edit
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/realtor/listing/${listing.id}/photos`}>
              <ImageIcon className="mr-1 h-3.5 w-3.5" />Photos
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={onTogglePublish}>
            <Send className="mr-1 h-3.5 w-3.5" />{isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDuplicate}>
            <Copy className="mr-1 h-3.5 w-3.5" />Duplicate
          </Button>
          {isPublished && listing.public_slug && (
            <Button asChild size="sm" variant="ghost">
              <a href={buildPublicFlyerUrl(listing.public_slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />Open
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
