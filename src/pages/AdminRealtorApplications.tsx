import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsRealtor } from "@/hooks/useIsRealtor";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ListingCard } from "@/components/realtor/ListingCard";
import { CreateListingDialog } from "@/components/realtor/CreateListingDialog";
import { RealtorAccessApplicationsPanel } from "@/components/realtor/RealtorAccessApplicationsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createListing, deleteListing, duplicateListing, loadListingStats, loadMyListings, loadOwnerLabels,
  setListingPublished, type Listing, type ListingStats, type ListingStatus, LISTING_STATUSES,
} from "@/lib/realtor";

export default function AdminRealtorApplications() {
  const { user, loading: authLoading } = useAuth();
  const { isRealtor, loading: roleLoading } = useIsRealtor();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, ListingStats>>({});
  const [ownerLabels, setOwnerLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");

  const refresh = async (showOwners: boolean) => {
    setLoading(true);
    const { listings: rows, error } = await loadMyListings();
    if (error) toast.error(error.message);
    setListings(rows);
    if (rows.length) {
      const s = await loadListingStats(rows.map((r) => r.id));
      setStats(s);
      if (showOwners) {
        const labels = await loadOwnerLabels([...new Set(rows.map((r) => r.owner_id))]);
        setOwnerLabels(labels);
      } else {
        setOwnerLabels({});
      }
    } else {
      setOwnerLabels({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading || adminLoading) return;
    if (!isRealtor && !isAdmin) return;
    refresh(isAdmin);
  }, [isRealtor, isAdmin, roleLoading, adminLoading]);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter !== "all" && l.listing_status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const owner = ownerLabels[l.owner_id]?.toLowerCase() ?? "";
        if (!`${l.address ?? ""} ${l.title} ${owner}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [listings, statusFilter, query, ownerLabels]);

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

  if (authLoading || roleLoading || adminLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isRealtor && !isAdmin) return <Navigate to="/dashboard" replace />;

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

  const title = isAdmin && !isRealtor ? "Realtor listings" : "Realtor listings overview";
  const description = isAdmin
    ? "All property listings — browse active, pending, sold, and draft across realtors."
    : "Your property listings — browse active, pending, sold, and draft.";

  return (
    <AdminLayout active="realtor-applications">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isRealtor && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />New listing
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/realtor">Realtor portal</Link>
            </Button>
          </div>
        </div>

        <Card className="border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Browse every property by market status. <span className="font-medium text-foreground">Active</span> = on market,{" "}
          <span className="font-medium text-foreground">Pending</span> = under contract,{" "}
          <span className="font-medium text-foreground">Sold</span> = closed.{" "}
          <span className="font-medium text-foreground">Live online</span> means the flyer is published.
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Total listings" value={listings.length} />
          <SummaryCard label="Active" value={counts.active ?? 0} />
          <SummaryCard label="Pending" value={counts.pending ?? 0} highlight={(counts.pending ?? 0) > 0} />
          <SummaryCard label="Sold" value={counts.sold ?? 0} />
          <SummaryCard label="Live online" value={counts.published ?? 0} />
          <SummaryCard label="Total views" value={totals.views} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAdmin ? "Search address, title, or realtor" : "Search by address or title"}
              className="pl-9"
            />
          </div>

          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as ListingStatus | "all")}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
              <TabsTrigger value="all">{statusTabLabel("all")}</TabsTrigger>
              {LISTING_STATUSES.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>
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
            <p className="mt-1 text-sm text-muted-foreground">
              {isRealtor ? "Create a listing to get started." : "No realtor property listings in the system."}
            </p>
            {isRealtor && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />New listing
              </Button>
            )}
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-lg font-semibold">No listings in this tab</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try another status or clear your search.</p>
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
                ownerLabel={isAdmin ? ownerLabels[l.owner_id] : undefined}
                onEdit={() => navigate(`/realtor/listing/${l.id}`)}
                onDuplicate={() => handleDuplicate(l)}
                onDelete={() => handleDelete(l)}
                onTogglePublish={() => handleTogglePublish(l)}
              />
            ))}
          </div>
        )}

        {isAdmin && <RealtorAccessApplicationsPanel />}
      </div>

      {isRealtor && (
        <CreateListingDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
      )}
    </AdminLayout>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-400/50 bg-amber-500/5 p-4" : "p-4"}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
