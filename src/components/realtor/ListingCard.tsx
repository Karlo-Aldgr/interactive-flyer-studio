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
  ownerLabel?: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onOpenPendingDetails?: () => void;
};

export function ListingCard({ listing, stats, ownerLabel, onEdit, onDuplicate, onDelete, onTogglePublish, onOpenPendingDetails }: Props) {
  const statusMeta = LISTING_STATUSES.find((s) => s.value === listing.listing_status) ?? LISTING_STATUSES[3];
  const isPublished = listing.status === "published";
  const isPending = listing.listing_status === "pending";
  const marketLabel = statusMeta.shortLabel ?? statusMeta.label;

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();
  const handleCardClick = () => { if (isPending) onOpenPendingDetails?.(); };
  const handleCardKey = (e: React.KeyboardEvent) => {
    if (!isPending) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenPendingDetails?.(); }
  };


  return (
    <Card className={`flex flex-col overflow-hidden ${isPending ? "cursor-pointer ring-1 ring-amber-500/30 transition hover:ring-2 hover:ring-amber-500/60" : ""}`}>
      <div
        role={isPending ? "button" : undefined}
        tabIndex={isPending ? 0 : undefined}
        onClick={handleCardClick}
        onKeyDown={handleCardKey}
        aria-label={isPending ? "View pending sale details" : undefined}
      >
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
          {isPending && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-900/80 to-transparent px-3 py-2 text-xs font-medium text-white">
              Click for pending sale details →
            </div>
          )}
        </div>
      </div>


      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate font-semibold">{listing.address ?? listing.title}</div>
          {ownerLabel && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">Realtor: {ownerLabel}</div>
          )}
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
