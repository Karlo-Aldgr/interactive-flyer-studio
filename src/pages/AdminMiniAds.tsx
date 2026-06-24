import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, Upload, ExternalLink } from "lucide-react";
import { checkIsAdmin } from "@/lib/roles";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildPublicFlyerUrl } from "@/lib/utils";

type FlyerOpt = { id: string; title: string; public_slug: string };

type MiniAd = {
  id: string;
  image_url: string;
  click_url: string;
  alt_text: string | null;
  active: boolean;
  weight: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type Stat = { mini_ad_id: string; impressions: number; clicks: number };

export default function AdminMiniAds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ads, setAds] = useState<MiniAd[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [weight, setWeight] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [flyerOpts, setFlyerOpts] = useState<FlyerOpt[]>([]);
  const [selectedFlyerId, setSelectedFlyerId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    checkIsAdmin(user.id).then((ok) => {
      setIsAdmin(ok);
      if (!ok) navigate("/dashboard");
    });
  }, [user, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mini_ads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAds((data ?? []) as MiniAd[]);

    const { data: events } = await supabase
      .from("mini_ad_events")
      .select("mini_ad_id, event_type");
    const agg: Record<string, Stat> = {};
    for (const e of events ?? []) {
      const k = (e as any).mini_ad_id as string;
      if (!agg[k]) agg[k] = { mini_ad_id: k, impressions: 0, clicks: 0 };
      if ((e as any).event_type === "impression") agg[k].impressions++;
      else if ((e as any).event_type === "click") agg[k].clicks++;
    }
    setStats(agg);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/mini-ads/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("flyer-assets")
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const createAd = async () => {
    if (!imageUrl || !clickUrl) {
      toast.error("Image and click URL required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("mini_ads").insert({
      image_url: imageUrl,
      click_url: clickUrl,
      alt_text: altText || null,
      weight: Math.max(1, weight),
      active: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mini-ad added");
    setImageUrl("");
    setClickUrl("");
    setAltText("");
    setWeight(1);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const toggleActive = async (ad: MiniAd, next: boolean) => {
    const { error } = await supabase
      .from("mini_ads")
      .update({ active: next })
      .eq("id", ad.id);
    if (error) return toast.error(error.message);
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, active: next } : a)));
  };

  const removeAd = async (ad: MiniAd) => {
    if (!confirm("Delete this mini-ad? Event history will also be removed.")) return;
    const { error } = await supabase.from("mini_ads").delete().eq("id", ad.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout active={"mini-ads" as any}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Mini-ads</h1>
        <p className="mt-1 text-muted-foreground">
          Banners shown at the bottom of flyers that have the mini-ad add-on enabled. One ad is picked
          per viewer session (weighted random).
        </p>

        <Card className="mt-6 p-6 space-y-4">
          <h2 className="font-semibold">Add a new mini-ad</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Banner image</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Input
                className="mt-2"
                placeholder="…or paste an image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="mt-2 max-h-24 rounded border border-border bg-black/80 object-contain"
                />
              )}
            </div>
            <div>
              <Label htmlFor="click">Click URL</Label>
              <Input
                id="click"
                placeholder="https://advertiser.example"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alt">Alt text</Label>
              <Input
                id="alt"
                placeholder="Brand name / short description"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="weight">Weight (higher = more often)</Label>
              <Input
                id="weight"
                type="number"
                min={1}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <Button onClick={createAd} disabled={saving || !imageUrl || !clickUrl}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add mini-ad
          </Button>
        </Card>

        <h2 className="mt-10 font-display text-xl font-semibold">All mini-ads ({ads.length})</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : ads.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No mini-ads yet.</Card>
          ) : (
            ads.map((ad) => {
              const s = stats[ad.id];
              const impressions = s?.impressions ?? 0;
              const clicks = s?.clicks ?? 0;
              const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "—";
              return (
                <Card key={ad.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={ad.image_url}
                      alt={ad.alt_text || "ad"}
                      className="h-16 w-40 rounded border border-border bg-black/80 object-contain"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ad.active ? "default" : "secondary"}>
                          {ad.active ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline">weight {ad.weight}</Badge>
                        <a
                          href={ad.click_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                        >
                          {ad.click_url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {ad.alt_text && (
                        <div className="truncate text-sm">{ad.alt_text}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {impressions} impressions · {clicks} clicks · CTR {ctr}
                        {typeof ctr === "string" && ctr !== "—" ? "%" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={ad.active}
                        onCheckedChange={(v) => toggleActive(ad, v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAd(ad)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
