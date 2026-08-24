import { useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  MousePointerClick, SquareDashed, CircleDashed, Sparkles, Star, ScanFace, Wand2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { BUTTON_PRESETS } from "@/lib/editorToolPresets";
import { SmartDetectDialog } from "./SmartDetectDialog";
import { SubjectDetectDialog } from "./SubjectDetectDialog";
import { toast } from "sonner";
import type { Layer } from "@/types/flyer";

const ICONS = ["Star", "Heart", "Smile", "ThumbsUp", "Award", "Bell", "Bookmark", "Camera", "Check", "Cloud", "Coffee", "Crown", "Flag", "Gift", "Globe", "Home", "Mail", "MapPin", "Music", "Phone", "Rocket", "Shield", "ShoppingBag", "Sparkles", "Sun", "Zap"];

export function InteractiveToolsPanel() {
  const addButtonLayer = useEditorStore((s) => s.addButtonLayer);
  const addLayer = useEditorStore((s) => s.addLayer);
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const drawMode = useEditorStore((s) => s.drawMode);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);
  const startObjectExtract = useEditorStore((s) => s.startObjectExtract);
  const cancelObjectExtract = useEditorStore((s) => s.cancelObjectExtract);
  const [open, setOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [detectOpen, setDetectOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [subjectDetectOpen, setSubjectDetectOpen] = useState(false);

  const hotspotActive = drawMode === "hotspot" || drawMode === "hotspot-ellipse";
  const extractActive = drawMode === "extract-rect" || drawMode === "extract-auto";

  function pickSourceImage(): Layer | undefined {
    const page = pages.find((p) => p.id === selectedPageId);
    const images = (page?.layers ?? []).filter((l) => l.type === "image" && l.content.src);
    if (!images.length) return undefined;
    const selected = selectedLayerId ? images.find((l) => l.id === selectedLayerId) : undefined;
    if (selected) return selected;
    return images.slice().sort((a, b) => b.size.width * b.size.height - a.size.width * a.size.height)[0];
  }

  function handleStartExtract() {
    const source = pickSourceImage();
    if (!source) {
      toast.error("Add an image to this page first");
      return;
    }
    startObjectExtract(source.id);
    setExtractOpen(false);
    setOpen(false);
    toast.info("Drag a rectangle over the object you want to extract");
  }

  function handleToggleExtract() {
    if (extractActive) {
      cancelObjectExtract();
      return;
    }
    handleStartExtract();
  }

  function handleAutoDetect() {
    const source = pickSourceImage();
    if (!source) {
      toast.error("Add an image to this page first");
      return;
    }
    setExtractOpen(false);
    setSubjectDetectOpen(true);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={open || hotspotActive ? "secondary" : "ghost"}
                size="icon"
                className="h-12 w-12"
              >
                <MousePointerClick className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Interactive tools</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="start" className="w-60 p-3">
          <div className="mb-2 text-sm font-semibold">Hot spots &amp; Buttons</div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hotspots</div>
          <div className="mb-3 grid grid-cols-2 gap-1">
            <Button
              variant={drawMode === "hotspot" ? "default" : "outline"}
              size="sm"
              className="h-auto flex-col gap-1 py-2 text-[10px]"
              onClick={() => {
                setDrawMode(drawMode === "hotspot" ? null : "hotspot");
                setOpen(false);
              }}
            >
              <SquareDashed className="h-4 w-4" />
              Rectangle
            </Button>
            <Button
              variant={drawMode === "hotspot-ellipse" ? "default" : "outline"}
              size="sm"
              className="h-auto flex-col gap-1 py-2 text-[10px]"
              onClick={() => {
                setDrawMode(drawMode === "hotspot-ellipse" ? null : "hotspot-ellipse");
                setOpen(false);
              }}
            >
              <CircleDashed className="h-4 w-4" />
              Ellipse
            </Button>
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Buttons</div>
          <div className="grid grid-cols-2 gap-1">
            {BUTTON_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                className="h-auto justify-start py-1.5 text-[10px]"
                onClick={() => {
                  addButtonLayer(preset.id);
                  setOpen(false);
                }}
              >
                <span
                  className="mr-1.5 inline-block h-3 w-3 shrink-0 rounded-full border"
                  style={{
                    background: preset.style.fill === "transparent" ? "transparent" : preset.style.fill,
                    borderColor: preset.style.stroke || preset.style.fill,
                  }}
                />
                {preset.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={iconOpen} onOpenChange={setIconOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant={iconOpen ? "secondary" : "ghost"} size="icon" className="h-12 w-12">
                <Star className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Icons</TooltipContent>
        </Tooltip>
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
                    addLayer("icon", { content: { iconName: name } });
                    setIconOpen(false);
                  }}
                >
                  {I ? <I className="h-4 w-4" /> : null}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <div className="my-1 h-px w-8 bg-border" />

      <Popover open={extractOpen} onOpenChange={setExtractOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={extractOpen || extractActive ? "secondary" : "ghost"}
                size="icon"
                className="h-12 w-12"
              >
                <ScanFace className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Extract interactive object</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="start" className="w-64 p-3">
          <div className="mb-2 text-sm font-semibold">Object extract</div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Cut out part of an image onto a new layer (for logos, people, products). For phone/URL hotspots, use Detect hotspots (AI) instead.
          </p>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Manual</div>
          <Button
            variant={drawMode === "extract-rect" ? "default" : "outline"}
            size="sm"
            className="mb-2 h-auto w-full flex-col gap-1 py-2 text-[10px]"
            onClick={handleToggleExtract}
          >
            <SquareDashed className="h-4 w-4" />
            {drawMode === "extract-rect" ? "Cancel rectangle mode" : "Rectangle select"}
          </Button>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Automatic</div>
          <Button
            variant={drawMode === "extract-auto" ? "default" : "outline"}
            size="sm"
            className="h-auto w-full flex-col gap-1 py-2 text-[10px]"
            onClick={handleAutoDetect}
          >
            <Wand2 className="h-4 w-4" />
            {drawMode === "extract-auto" ? "Detecting on canvas…" : "Auto detect image subjects"}
          </Button>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Tip: select an image layer first, or we use the largest image on the page.
          </p>
        </PopoverContent>
      </Popover>

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
      <SubjectDetectDialog open={subjectDetectOpen} onOpenChange={setSubjectDetectOpen} />
    </>
  );
}
