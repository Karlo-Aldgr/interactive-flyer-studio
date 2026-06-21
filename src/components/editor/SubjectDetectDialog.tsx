import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScanFace, Check, MousePointerClick, X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { Layer } from "@/types/flyer";
import { toast } from "sonner";
import {
  SUBJECT_CATEGORY_LABEL,
  type SubjectDetection,
} from "@/lib/subjectDetect";
import { useObjectExtract } from "@/hooks/useObjectExtract";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export function SubjectDetectDialog({
  open,
  onOpenChange,
  sourceLayer: sourceOverride,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceLayer?: Layer;
}) {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const startAutoSubjectExtract = useEditorStore((s) => s.startAutoSubjectExtract);
  const startObjectExtract = useEditorStore((s) => s.startObjectExtract);
  const dismissSubjectDetection = useEditorStore((s) => s.dismissSubjectDetection);
  const subjectDetections = useEditorStore((s) => s.subjectDetections);
  const drawMode = useEditorStore((s) => s.drawMode);
  const { extractFromSubject, extracting } = useObjectExtract();

  const page = pages.find((p) => p.id === selectedPageId);
  const candidates: Layer[] = (page?.layers ?? []).filter((l) => l.type === "image" && l.content.src);
  const targetLayer: Layer | undefined =
    sourceOverride ??
    (selectedLayerId ? candidates.find((l) => l.id === selectedLayerId) : undefined) ??
    candidates.slice().sort((a, b) => b.size.width * b.size.height - a.size.width * a.size.height)[0];

  const [loading, setLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const activeDetections =
    drawMode === "extract-auto" && subjectDetections.length > 0
      ? subjectDetections.filter((d) => !d.dismissed && !d.extracted)
      : null;

  function useRectangleInstead() {
    if (!targetLayer) return;
    onOpenChange(false);
    startObjectExtract(targetLayer.id);
    toast.info("Drag a rectangle over the object you want to extract");
  }

  async function runDetect() {
    if (!targetLayer?.content.src) {
      toast.error("Add an image to this page first");
      return;
    }
    setLoading(true);
    setDetectError(null);
    try {
      const data = await invokeEdgeFunction<{ subjects?: SubjectDetection[] }>("subject-detect", {
        imageUrl: targetLayer.content.src,
      });
      const list: SubjectDetection[] = data?.subjects ?? [];
      if (list.length === 0) {
        toast.info("No subjects detected — try manual rectangle select");
      } else {
        toast.success(`Found ${list.length} subject${list.length === 1 ? "" : "s"} — dismiss unwanted, then click to extract`);
        startAutoSubjectExtract(targetLayer.id, list);
        onOpenChange(false);
      }
    } catch (e: any) {
      const msg = e?.message || "Subject detection failed";
      setDetectError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function extractOne(det: SubjectDetection) {
    if (!targetLayer) return;
    await extractFromSubject(det);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" /> Auto subject detect
          </DialogTitle>
          <DialogDescription>
            AI finds people, products, logos, and other objects — traces each shape precisely, then extracts as a transparent cutout layer.
          </DialogDescription>
        </DialogHeader>

        {!targetLayer && (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Add an image to this page first, then run detection.
          </div>
        )}

        {targetLayer && !activeDetections && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scanning:{" "}
              <span className="font-medium text-foreground">
                {targetLayer.content.src?.split("/").pop()}
              </span>
            </p>
            {detectError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {detectError}
              </div>
            )}
            <Button onClick={runDetect} className="w-full">
              <ScanFace className="mr-2 h-4 w-4" /> {detectError ? "Try again" : "Detect subjects"}
            </Button>
            {detectError && (
              <Button variant="outline" size="sm" className="w-full" onClick={useRectangleInstead}>
                Use rectangle select instead
              </Button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Finding subjects in your image…</p>
          </div>
        )}

        {activeDetections && activeDetections.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dismiss unwanted detections with ✕, then click a shape on the canvas or extract from the list.
            </p>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {activeDetections.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-2"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {SUBJECT_CATEGORY_LABEL[s.category] ?? s.category}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    disabled={extracting}
                    onClick={() => dismissSubjectDetection(s.id)}
                    title="Dismiss detection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={extracting}
                    onClick={() => extractOne(s)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Extract
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={runDetect}>
              Re-scan
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-2 text-[11px] text-muted-foreground">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-primary" />
          After detection, shape outlines appear on the canvas — not rectangles. Click to extract a precise cutout with transparent background.
        </div>
      </DialogContent>
    </Dialog>
  );
}
