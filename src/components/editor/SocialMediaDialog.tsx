import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import type { SocialSlideoutSettings } from "@/types/flyer";
import { FONT_OPTIONS as FONT_LIST } from "@/lib/fontOptions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const FONT_OPTIONS = FONT_LIST.map((f) => f.family);


const PLATFORM_FIELDS: Array<{ key: keyof SocialSlideoutSettings; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "yourhandle or full URL" },
  { key: "facebook", label: "Facebook", placeholder: "yourpage or full URL" },
  { key: "tiktok", label: "TikTok", placeholder: "yourhandle or full URL" },
  { key: "twitter", label: "X / Twitter", placeholder: "yourhandle or full URL" },
  { key: "youtube", label: "YouTube", placeholder: "yourchannel or full URL" },
  { key: "linkedin", label: "LinkedIn", placeholder: "yourname or full URL" },
  { key: "snapchat", label: "Snapchat", placeholder: "yourhandle or full URL" },
  { key: "threads", label: "Threads", placeholder: "yourhandle or full URL" },
  { key: "website", label: "Website / custom link", placeholder: "https://yoursite.com" },
];

export function SocialMediaDialog({ open, onOpenChange }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const setFlyer = useEditorStore((s) => s.setFlyer);
  if (!flyer) return null;

  const social: SocialSlideoutSettings = flyer.settings.social || {};

  function patch(p: Partial<SocialSlideoutSettings>) {
    setFlyer({
      settings: {
        ...flyer.settings,
        social: { ...(flyer.settings.social || {}), ...p },
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Social media slideout
          </DialogTitle>
          <DialogDescription>
            Add a tab that slides out from the right edge of every page with your social links.
            The tab only appears once at least one link is filled in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Links</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORM_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    className="mt-1"
                    placeholder={f.placeholder}
                    value={(social[f.key] as string) || ""}
                    onChange={(e) => patch({ [f.key]: e.target.value } as any)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Appearance</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Tab label</Label>
                <Input
                  className="mt-1"
                  placeholder="SOCIAL MEDIA"
                  value={social.label || ""}
                  onChange={(e) => patch({ label: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs">Font</Label>
                <Select
                  value={social.fontFamily || "Inter"}
                  onValueChange={(v) => patch({ fontFamily: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ColorRow label="Tab background" value={social.tabBgColor || "#1a1a1a"} onChange={(v) => patch({ tabBgColor: v })} />
                <ColorRow label="Tab text" value={social.tabTextColor || "#ffffff"} onChange={(v) => patch({ tabTextColor: v })} />
                <ColorRow label="Panel background" value={social.panelBgColor || "#1a1a1a"} onChange={(v) => patch({ panelBgColor: v })} />
                <ColorRow label="Icon color" value={social.iconColor || "#ffffff"} onChange={(v) => patch({ iconColor: v })} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}
