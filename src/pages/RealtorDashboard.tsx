import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
import {
  createListing, deleteListing, duplicateListing, loadListingStats, loadMyListings,
  setListingPublished, type Listing, type ListingStats, type ListingStatus, LISTING_STATUSES,
} from "@/lib/realtor";
import { loadMyRealtorProfile, type RealtorProfile } from "@/lib/realtorProfile";
import { RealtorProfileCard } from "@/components/realtor/RealtorProfileCard";
import { cn } from "@/lib/utils";

export default function RealtorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isRealtor, loading: roleLoading } = useIsRealtor();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, ListingStats>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");

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

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter !== "all" && l.listing_status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${l.address ?? ""} ${l.title}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [listings, statusFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: listings.length };
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
      setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: next ? "published" : "draft" } : x)));
      toast.success(next ? "Published" : "Unpublished");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <RealtorShell>
      <div className="space-y-6">
        <PageHeader
          title="My Listings"
          description="Manage every property you market with TapThatFlyer."
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />New listing
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="Total listings" value={listings.length} />
          <SummaryCard label="Active" value={counts.active ?? 0} />
          <SummaryCard label="Total views" value={totals.views} />
          <SummaryCard label="Total leads" value={totals.leads} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by address or title"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip label={`All (${counts.all})`} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {LISTING_STATUSES.map((s) => (
              <FilterChip
                key={s.value}
                label={`${s.label} (${counts[s.value] ?? 0})`}
                active={statusFilter === s.value}
                onClick={() => setStatusFilter(s.value)}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-lg font-semibold">No listings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first listing to get started.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />New listing
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
              />
            ))}
          </div>
        )}
      </div>

      <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </RealtorShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
