import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageOff, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchFlyerLibrary, type FlyerLibraryItem } from "@/lib/social/flyerLibrary";

export function FlyerPicker({
  selectedId,
  onSelect,
  onClear,
}: {
  selectedId: string | null;
  onSelect: (flyer: FlyerLibraryItem) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["social-flyer-library"],
    queryFn: fetchFlyerLibrary,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = data ?? [];
    if (!term) return rows;
    return rows.filter((f) =>
      [f.title, f.project_title, f.category].filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [data, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your flyers or projects"
            className="pl-8"
            aria-label="Search your flyers"
          />
        </div>
        {selectedId && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your flyers…
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">Could not load your flyers. Please refresh.</p>
      )}
      {!isLoading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No flyers found. You can still upload media below as a fallback.
        </p>
      )}

      {items.length > 0 && (
        <ScrollArea className="max-h-[320px] pr-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((flyer) => {
              const active = flyer.flyer_id === selectedId;
              return (
                <button
                  key={flyer.flyer_id}
                  type="button"
                  onClick={() => onSelect(flyer)}
                  aria-pressed={active}
                  className={`group overflow-hidden rounded-lg border text-left transition ${
                    active ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"
                  }`}
                >
                  <div className="relative aspect-[4/5] bg-muted">
                    {flyer.thumbnail_url
                      ? (
                        <img
                          src={flyer.thumbnail_url}
                          alt={`${flyer.title} flyer preview`}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      )
                      : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                          <ImageOff className="h-5 w-5" />
                          <span className="text-[11px]">No preview yet</span>
                        </div>
                      )}
                    {active && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="truncate text-sm font-medium">{flyer.title}</p>
                    {flyer.project_title && flyer.project_title !== flyer.title && (
                      <p className="truncate text-xs text-muted-foreground">{flyer.project_title}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {flyer.status && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {flyer.status}
                        </Badge>
                      )}
                      {flyer.category && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {flyer.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
