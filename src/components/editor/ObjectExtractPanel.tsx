import { useState } from "react";
import { ScanFace, SquareDashed, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { SubjectDetectDialog } from "./SubjectDetectDialog";
import { toast } from "sonner";
import type { Layer } from "@/types/flyer";

export function ObjectExtractPanel() {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const drawMode = useEditorStore((s) => s.drawMode);
  const startObjectExtract = useEditorStore((s) => s.startObjectExtract);
  const cancelObjectExtract = useEditorStore((s) => s.cancelObjectExtract);
  const [extractOpen, setExtractOpen] = useState(false);
  const [subjectDetectOpen, setSubjectDetectOpen] = useState(false);

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
    toast.info("Drag a rectangle over the object you want to extract");
  }

  function handleToggleExtract() {
    if (extractActive && drawMode === "extract-rect") {
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
            Select part of an image to copy onto a new layer above the original. The source photo stays untouched.
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
            {drawMode === "extract-auto" ? "Detecting on canvas…" : "Auto detect subjects"}
          </Button>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Tip: select an image layer first, or we use the largest image on the page.
          </p>
        </PopoverContent>
      </Popover>

      <SubjectDetectDialog open={subjectDetectOpen} onOpenChange={setSubjectDetectOpen} />
    </>
  );
}
