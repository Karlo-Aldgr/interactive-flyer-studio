import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { normalizeExampleFlyerUrl } from "@/lib/utils";

type Example = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
};

type ExampleFlyersStripProps = {
  limit?: number;
};

export function ExampleFlyersStrip({ limit = 4 }: ExampleFlyersStripProps) {
  const [items, setItems] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("example_flyers")
        .select("id, url, title, description, thumbnail_url")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(limit);
      setItems((data as Example[]) ?? []);
      setLoading(false);
    })();
  }, [limit]);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Sample TapFlyers</h2>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            Tap to open real interactive examples — see what your finished project can look like.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="w-full shrink-0 sm:w-auto">
          <Link to="/examples">View all</Link>
        </Button>
      </div>

      {loading ? (
        <div className="mt-4 flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-4 flex items-center gap-3 border-dashed p-6 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0 opacity-50" />
          No samples published yet — check back soon or browse{" "}
          <Link to="/examples" className="text-primary underline-offset-4 hover:underline">examples</Link>.
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((ex) => (
            <a
              key={ex.id}
              href={normalizeExampleFlyerUrl(ex.url)}
              target="_blank"
              rel="noreferrer"
              className="group block"
            >
              <Card className="overflow-hidden transition hover:shadow-elegant">
                <div className="aspect-[3/4] gradient-canvas relative border-b border-border">
                  {ex.thumbnail_url ? (
                    <img
                      src={ex.thumbnail_url}
                      alt={ex.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <FileText className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium opacity-0 backdrop-blur transition group-hover:opacity-100">
                    <ExternalLink className="h-3 w-3" /> Open
                  </span>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold">{ex.title}</div>
                  {ex.description && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ex.description}</div>
                  )}
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
