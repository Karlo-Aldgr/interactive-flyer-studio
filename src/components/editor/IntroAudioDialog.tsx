import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Music, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEditorStore } from "@/store/editorStore";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function IntroAudioDialog({ open, onOpenChange }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const setFlyer = useEditorStore((s) => s.setFlyer);
  const { user } = useAuth();
  const { flyerId } = useParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!flyer) return null;
  const url = flyer.settings.introAudioUrl || "";
  const loop = !!flyer.settings.introAudioLoop;
  const volume = flyer.settings.introAudioVolume ?? 1;
  const showControl = flyer.settings.introAudioShowControl ?? true;

  function patch(p: Partial<typeof flyer.settings>) {
    setFlyer({ settings: { ...flyer.settings, ...p } });
  }

  async function handleFile(file: File) {
    if (!user || !flyerId) return toast.error("Sign in required");
    setBusy(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${flyerId}/audio/intro-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("flyer-assets")
      .upload(path, file, { contentType: file.type || undefined });
    setBusy(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
    patch({ introAudioUrl: data.publicUrl });
    toast.success("Intro audio uploaded");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-4 w-4" /> Intro audio
          </DialogTitle>
          <DialogDescription>
            Plays automatically the first time someone opens this flyer. The viewer must tap once
            (mobile browsers block autoplay), so we'll trigger playback as soon as they interact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Audio URL (mp3, wav, m4a, ogg)</Label>
            <Input
              className="mt-1"
              placeholder="https://..."
              value={url}
              onChange={(e) => patch({ introAudioUrl: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Or upload a file</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload className="mr-1 h-3.5 w-3.5" />
                {busy ? "Uploading..." : url ? "Replace" : "Upload"}
              </Button>
              {url && <audio src={url} controls className="h-8 max-w-[220px]" />}
              {url && (
                <Button type="button" size="sm" variant="ghost" onClick={() => patch({ introAudioUrl: "" })}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Loop</div>
              <div className="text-xs text-muted-foreground">Keep playing until the viewer stops it.</div>
            </div>
            <Switch checked={loop} onCheckedChange={(v) => patch({ introAudioLoop: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
