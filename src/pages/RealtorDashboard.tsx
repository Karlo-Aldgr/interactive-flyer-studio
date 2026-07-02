import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { RealtorShell } from "@/components/realtor/RealtorShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ListingCard } from "@/components/realtor/ListingCard";
import { CreateListingDialog } from "@/components/realtor/CreateListingDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createListing, deleteListing, duplicateListing, loadListingStats, loadMyListings,
  setListingPublished, type Listing, type ListingStats, type ListingStatus, LISTING_STATUSES,
} from "@/lib/realtor";
import { loadMyRealtorProfile, type RealtorProfile } from "@/lib/realtorProfile";
import { RealtorProfileCard } from "@/components/realtor/RealtorProfileCard";
import { PendingSaleDetailsDialog } from "@/components/realtor/PendingSaleDetailsDialog";

import { cn } from "@/lib/utils";

type ListingFilter = ListingStatus | "all" | "published";

export default function RealtorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isRealtor, loading: roleLoading } = useIsRealtor();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, ListingStats>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingFilter>("all");
  const [profile, setProfile] = useState<RealtorProfile | null>(null);
  const [pendingFor, setPendingFor] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { listings: rows, error } = await loadMyListings();
    if (error) toast.error(error.message);
    setListings(rows);
    setLoading(false);
    if (rows.length) {
      const s = await loadListingStats(rows.map((r) => r.id));
      setStats(s);
    }
  };

  useEffect(() => { if (isRealtor) refresh(); }, [isRealtor]);
  useEffect(() => {
    if (isRealtor && user) loadMyRealtorProfile(user.id).then((p) => p && setProfile(p));
  }, [isRealtor, user]);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter === "published") {
        if (l.status !== "published") return false;
      } else if (statusFilter !== "all" && l.listing_status !== statusFilter) {
        return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (!`${l.address ?? ""} ${l.title}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [listings, statusFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: listings.length,
      published: listings.filter((l) => l.status === "published").length,
    };
    for (const s of LISTING_STATUSES) c[s.value] = 0;
    for (const l of listings) c[l.listing_status] = (c[l.listing_status] ?? 0) + 1;
    return c;
  }, [listings]);

  const totals = useMemo(() => {
    let views = 0, leads = 0;
    for (const id of Object.keys(stats)) { views += stats[id].views; leads += stats[id].leads; }
    return { views, leads };
  }, [stats]);

  if (authLoading || roleLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isRealtor) return <Navigate to="/dashboard" replace />;

  const handleCreate = async ({ address, price }: { address: string; price: string }) => {
    if (!user) return;
    try {
      const priceCents = price ? Math.round(parseFloat(price) * 100) : null;
      const listing = await createListing(user.id, address, priceCents);
      toast.success("Listing created");
      setCreateOpen(false);
      navigate(`/realtor/listing/${listing.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (l: Listing) => {
    if (!confirm(`Delete "${l.address ?? l.title}"? This cannot be undone.`)) return;
    try {
      await deleteListing(l.id);
      setListings((prev) => prev.filter((x) => x.id !== l.id));
      toast.success("Deleted");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicate = async (l: Listing) => {
    if (!user) return;
    try {
      const copy = await duplicateListing(l, user.id);
      setListings((prev) => [copy, ...prev]);
      toast.success("Duplicated");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleTogglePublish = async (l: Listing) => {
    const next = l.status === "published" ? false : true;
    try {
      await setListingPublished(l.id, next);
      setListings((prev) =>
        prev.map((x) => {
          if (x.id !== l.id) return x;
          const listing_status =
            next && x.listing_status === "draft" ? "active" : x.listing_status;
          return { ...x, status: next ? "published" : "draft", listing_status };
        }),
      );
      toast.success(next ? "Published — flyer is live online" : "Unpublished");
    } catch (e: any) { toast.error(e.message); }
  };

  const statusTabLabel = (value: ListingStatus | "all") => {
    if (value === "all") return `All (${counts.all})`;
    const meta = LISTING_STATUSES.find((s) => s.value === value);
    const label = meta?.shortLabel ?? meta?.label ?? value;
    return `${label} (${counts[value] ?? 0})`;
  };

  return (
    <RealtorShell>
      <div className="space-y-6">
        <PageHeader
          title="My Listings"
          description="Your property overview — filter by market status, publish flyers, and track views and leads."
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />New listing
            </Button>
          }
        />

        <Card className="border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Flyer live</span> (Publish) is separate from{" "}
          <span className="font-medium text-foreground">market status</span> (On market, Pending sale, Sold).
          A listing can be live online and still show Pending sale if the property is under contract.
        </Card>

        {profile && (
          <RealtorProfileCard
            profile={profile}
            activeCount={counts.active ?? 0}
            onSaved={setProfile}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard
            label="Total listings"
            value={listings.length}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <SummaryCard
            label="On market"
            value={counts.active ?? 0}
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          />
          <SummaryCard
            label="Pending sale"
            value={counts.pending ?? 0}
            highlight={counts.pending > 0}
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <SummaryCard
            label="Live online"
            value={counts.published ?? 0}
            active={statusFilter === "published"}
            onClick={() => setStatusFilter("published")}
          />
          <SummaryCard label="Total views" value={totals.views} />
          <SummaryCard label="Total leads" value={totals.leads} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by address or title"
              className="pl-9"
            />
          </div>

          <Tabs
            value={statusFilter === "published" ? "" : statusFilter}
            onValueChange={(v) => { if (v) setStatusFilter(v as ListingStatus | "all"); }}
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {statusTabLabel("all")}
              </TabsTrigger>
              {LISTING_STATUSES.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {statusTabLabel(s.value)}
                  {s.value === "pending" && (counts.pending ?? 0) > 0 && statusFilter !== "pending" && (
                    <Badge className="ml-2 bg-amber-500/20 text-amber-800 dark:text-amber-200" variant="secondary">
                      {counts.pending}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : listings.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-lg font-semibold">No listings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first listing to get started.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />New listing
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-lg font-semibold">No listings match this filter</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another tab or clear your search.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => { setStatusFilter("all"); setQuery(""); }}>
              Show all listings
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                stats={stats[l.id]}
                onEdit={() => navigate(`/realtor/listing/${l.id}`)}
                onDuplicate={() => handleDuplicate(l)}
                onDelete={() => handleDelete(l)}
                onTogglePublish={() => handleTogglePublish(l)}
                onOpenPendingDetails={() => setPendingFor(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
      <PendingSaleDetailsDialog
        flyerId={pendingFor}
        open={pendingFor !== null}
        onOpenChange={(v) => { if (!v) setPendingFor(null); }}
      />
    </RealtorShell>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  active,
  onClick,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "p-4 text-left transition",
    highlight && "border-amber-400/50 bg-amber-500/5",
    onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted/30",
    active && "border-primary ring-1 ring-primary/30",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn("w-full rounded-lg border border-border bg-card", className)}>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </button>
    );
  }

  return (
    <Card className={className}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
