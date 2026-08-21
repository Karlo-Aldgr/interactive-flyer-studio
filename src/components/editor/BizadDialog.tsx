import { useEffect, useState } from "react";
import { ExternalLink, Copy, Loader2, IdCard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getMyOnboarding } from "@/lib/onboarding";
import {
  buildBizadPayloadFromOnboarding,
  getBizadForFlyer,
  upsertBizad,
  type BizadRecord,
} from "@/lib/bizad";
import { buildPublicBizadUrl } from "@/lib/utils";
import type { Flyer } from "@/types/flyer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  flyer: Flyer;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BizadDialog({ flyer, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bizad, setBizad] = useState<BizadRecord | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [buttonColor, setButtonColor] = useState("#2563eb");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [videoUrl, setVideoUrl] = useState("");
  const [copyrightText, setCopyrightText] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const existing = await getBizadForFlyer(flyer.id);
        if (existing) {
          setBizad(existing);
          setEnabled(existing.enabled);
          setButtonColor(existing.button_color);
          setBackgroundColor(existing.background_color);
          setVideoUrl(existing.video_url ?? "");
          setCopyrightText(existing.copyright_text ?? "");
        } else {
          setBizad(null);
          setEnabled(false);
          setButtonColor("#2563eb");
          setBackgroundColor("#ffffff");
          setVideoUrl("");
          setCopyrightText("");
        }
      } catch (e: any) {
        toast.error(e?.message || "Could not load bizad settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, flyer.id]);

  const publicUrl = bizad?.slug ? buildPublicBizadUrl(bizad.slug) : null;

  async function save(nextEnabled = enabled) {
    if (!user) return toast.error("Sign in to enable your digital card");
    setSaving(true);
    try {
      const onboarding = await getMyOnboarding(user.id);
      const base = buildBizadPayloadFromOnboarding(onboarding, {
        id: flyer.id,
        public_slug: flyer.public_slug,
        thumbnail_url: flyer.thumbnail_url,
        title: flyer.title,
      }, bizad);

      const saved = await upsertBizad({
        ...base,
        enabled: nextEnabled,
        button_color: buttonColor,
        background_color: backgroundColor,
        video_url: videoUrl.trim() || null,
        copyright_text: copyrightText.trim() || base.copyright_text,
      });
      setBizad(saved);
      setEnabled(saved.enabled);
      toast.success(nextEnabled ? "Digital business card enabled" : "Digital business card saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save bizad");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    await save(checked);
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-4 w-4" /> Digital business card
          </DialogTitle>
          <DialogDescription>
            Logo and contact info come from onboarding. Flyer button links to the interactive flyer. Intro/background audio stays in the editor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="bizad-enabled" className="text-sm font-medium">Add bizad to this flyer</Label>
                <p className="text-xs text-muted-foreground">Creates a public /bizads page from onboarding data</p>
              </div>
              <Switch
                id="bizad-enabled"
                checked={enabled}
                disabled={saving}
                onCheckedChange={handleToggle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bizad-btn-color" className="text-xs">Button color</Label>
                <Input
                  id="bizad-btn-color"
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="h-10 cursor-pointer p-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bizad-bg-color" className="text-xs">Background color</Label>
                <Input
                  id="bizad-bg-color"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-10 cursor-pointer p-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bizad-video" className="text-xs">Video URL (optional)</Label>
              <Input
                id="bizad-video"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="YouTube or direct .mp4 link"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bizad-copyright" className="text-xs">Copyright footer</Label>
              <Input
                id="bizad-copyright"
                value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
                placeholder="© Your Business Name"
                className="h-8 text-xs"
              />
            </div>

            {publicUrl && enabled && (
              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <Label className="text-xs">Public link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={publicUrl} className="h-8 text-xs" />
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {!flyer.public_slug && enabled && (
              <p className="text-xs text-amber-700">
                Publish this flyer to get a stable public slug. Flyer button links to the interactive flyer.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => save()} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
