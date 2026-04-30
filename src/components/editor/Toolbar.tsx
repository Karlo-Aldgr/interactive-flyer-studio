import { useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Type, Image as ImageIcon, Square, Circle, Minus, MousePointerClick, Star, Heart, Smile, ThumbsUp, SquareDashed, CircleDashed, Sparkles } from "lucide-react";
import { SmartDetectDialog } from "./SmartDetectDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "@/store/editorStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

const ICONS = ["Star", "Heart", "Smile", "ThumbsUp", "Award", "Bell", "Bookmark", "Camera", "Check", "Cloud", "Coffee", "Crown", "Flag", "Gift", "Globe", "Home", "Mail", "MapPin", "Music", "Phone", "Rocket", "Shield", "ShoppingBag", "Sparkles", "Sun", "Zap"];

export function Toolbar() {
  const addLayer = useEditorStore((s) => s.addLayer);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const updateLayerContent = useEditorStore((s) => s.updateLayerContent);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const drawMode = useEditorStore((s) => s.drawMode);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { flyerId } = useParams();
  const [detectOpen, setDetectOpen] = useState(false);

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

  const Btn = ({ label, icon: Icon, onClick }: { label: string; icon: any; onClick: () => void }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onClick}>
          <Icon className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex w-16 flex-col items-center gap-1 border-r border-border bg-card py-3">
      <Btn label="Text" icon={Type} onClick={() => addLayer("text")} />
      <Btn label="Image" icon={ImageIcon} onClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
      />
      <Btn label="Rectangle" icon={Square} onClick={() => addLayer("shape")} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => {
              addLayer("shape");
              setTimeout(() => {
                const id = useEditorStore.getState().selectedLayerId;
                if (id) updateLayerContent(id, { shape: "circle" });
              }, 0);
            }}
          >
            <Circle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Circle</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => {
              addLayer("shape");
              setTimeout(() => {
                const id = useEditorStore.getState().selectedLayerId;
                if (id) updateLayerContent(id, { shape: "line" });
              }, 0);
            }}
          >
            <Minus className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Line</TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-12 w-12">
            <Star className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-64">
          <div className="mb-2 text-sm font-medium">Pick an icon</div>
          <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
            {ICONS.map((name) => {
              const I = (LucideIcons as any)[name];
              return (
                <Button
                  key={name}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    addLayer("icon");
                    setTimeout(() => {
                      const id = useEditorStore.getState().selectedLayerId;
                      if (id) updateLayerContent(id, { iconName: name });
                    }, 0);
                  }}
                >
                  {I ? <I className="h-4 w-4" /> : null}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Btn label="Button" icon={MousePointerClick} onClick={() => addLayer("button")} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={drawMode === "hotspot" ? "default" : "ghost"}
            size="icon"
            className="h-12 w-12"
            onClick={() => setDrawMode(drawMode === "hotspot" ? null : "hotspot")}
          >
            <SquareDashed className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Hotspot (drag to draw)</TooltipContent>
      </Tooltip>
      <div className="my-1 h-px w-8 bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 text-primary"
            onClick={() => setDetectOpen(true)}
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Detect hotspots (AI)</TooltipContent>
      </Tooltip>
      <SmartDetectDialog open={detectOpen} onOpenChange={setDetectOpen} />
    </div>
  );
}
