import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Globe, PenTool } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildPublicWebsiteUrl } from "@/lib/utils";

/**
 * Website status for one project: published URL (copy / open), edit link and
 * unpublish. Unpublishing only hides the public page — the draft is preserved.
 */
export function WebsiteStatusCard({ flyerId }: { flyerId: string | null }) {
  const [status, setStatus] = useState<"draft" | "published" | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!flyerId) return;
    (async () => {
      const [{ data: flyer }, { data: pages }] = await Promise.all([
        supabase.from("flyers").select("website_status, website_slug").eq("id", flyerId).maybeSingle(),
        supabase.from("pages").select("id, background").eq("flyer_id", flyerId),
      ]);
      if (cancelled) return;
      setStatus(((flyer as any)?.website_status === "published" ? "published" : "draft"));
      setSlug(((flyer as any)?.website_slug as string | null) ?? null);
      setHasWebsite((pages ?? []).some((p: any) => p?.background?.websitePage));
    })();
    return () => { cancelled = true; };
  }, [flyerId]);

  if (!flyerId || !hasWebsite) return null;

  const published = status === "published" && !!slug;
  const url = slug ? buildPublicWebsiteUrl(slug) : "";

  async function unpublish() {
    setBusy(true);
    const { error } = await supabase
      .from("flyers")
      .update({ website_status: "draft" } as any)
      .eq("id", flyerId!);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStatus("draft");
    toast.success("Website unpublished — your draft is safe");
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Website</h2>
        <Badge variant={published ? "default" : "outline"}>{published ? "Published" : "Draft"}</Badge>
      </div>

      {published ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-xs">{url}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
          >
            <Copy className="mr-1 h-4 w-4" /> Copy
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Your website is saved as a draft. Publish it from the editor to make it public.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {published && (
          <Button size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noreferrer")}>
            <ExternalLink className="mr-1 h-4 w-4" /> Open Website
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link to={`/editor/${flyerId}`}>
            <PenTool className="mr-1 h-4 w-4" /> Edit Website
          </Link>
        </Button>
        {published && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={unpublish}>
            Unpublish
          </Button>
        )}
      </div>
    </Card>
  );
}
