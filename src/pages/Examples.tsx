import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, FileText, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

type Example = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
};

export default function Examples() {
  const [items, setItems] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("example_flyers")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      setItems((data as Example[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-10 w-auto" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Home</Link>
          </Button>
        </div>
      </header>

      <main className="container py-12">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Interactive flyer <span className="text-gradient">examples</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Tap any flyer below to open and interact with it, just like your customers would.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="mx-auto max-w-md p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground opacity-40" />
            <p className="mt-3 text-muted-foreground">No examples have been published yet. Check back soon.</p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((ex) => (
              <a
                key={ex.id}
                href={ex.url}
                target="_blank"
                rel="noreferrer"
                className="group block"
              >
                <Card className="overflow-hidden transition hover:shadow-elegant">
                  <div className="aspect-[3/4] gradient-canvas border-b border-border relative">
                    {ex.thumbnail_url ? (
                      <img src={ex.thumbnail_url} alt={ex.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur opacity-0 group-hover:opacity-100 transition">
                      <ExternalLink className="h-3 w-3" /> Open
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="truncate font-semibold">{ex.title}</div>
                    {ex.description && (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ex.description}</div>
                    )}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
