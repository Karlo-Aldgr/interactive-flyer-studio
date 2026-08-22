import { useRef, type ComponentType } from "react";
import { Type, Image as ImageIcon, RectangleHorizontal, Video } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ShapesLinesPanel } from "./ShapesLinesPanel";
import { InteractiveToolsPanel } from "./InteractiveToolsPanel";

export function Toolbar() {
  const addLayer = useEditorStore((s) => s.addLayer);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const addVideoLayer = useEditorStore((s) => s.addVideoLayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { flyerId } = useParams();

  async function uploadImage(file: File) {
    if (!user || !flyerId) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${flyerId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("flyer-assets").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
    const url = data.publicUrl;
    const img = new Image();
    img.onload = () => addImageLayer(url, img.naturalWidth, img.naturalHeight);
    img.src = url;
  }

  async function uploadVideo(file: File) {
    if (!user || !flyerId) return;
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/${flyerId}/videos/${Date.now()}.${ext}`;
    const toastId = toast.loading("Uploading video…");
    const { error } = await supabase.storage
      .from("flyer-assets")
      .upload(path, file, { contentType: file.type || "video/mp4" });
    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }
    const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
    const url = data.publicUrl;
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      addVideoLayer(url, probe.videoWidth || 640, probe.videoHeight || 360);
      toast.success("Video added", { id: toastId });
    };
    probe.onerror = () => {
      addVideoLayer(url);
      toast.success("Video added", { id: toastId });
    };
    probe.src = url;
  }

  const Btn = ({ label, icon: Icon, onClick }: { label: string; icon: ComponentType<{ className?: string }>; onClick: () => void }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 transition-colors duration-200 hover:bg-primary/10 hover:text-primary"
          onClick={onClick}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
      <Btn label="Text" icon={Type} onClick={() => addLayer("text")} />
      <Btn label="Image" icon={ImageIcon} onClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
      />
      <Btn label="Video" icon={Video} onClick={() => videoRef.current?.click()} />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) uploadVideo(f);
        }}
      />
      <Btn label="Button" icon={RectangleHorizontal} onClick={() => addLayer("button")} />
      <ShapesLinesPanel />
      <InteractiveToolsPanel />
    </div>
  );
}
