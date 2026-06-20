import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cropImageRegionToBlob, type CanvasRect } from "@/lib/imageExtraction";
import {
  bboxToCanvasRect,
  type SubjectDetection,
} from "@/lib/subjectDetect";
import { uploadFlyerAsset } from "@/lib/uploadFlyerAsset";
import { useEditorStore } from "@/store/editorStore";

export function useObjectExtract() {
  const { user } = useAuth();
  const { flyerId } = useParams();
  const [extracting, setExtracting] = useState(false);

  const runExtraction = useCallback(
    async (
      selectionRect: CanvasRect,
      options?: { subjectLabel?: string; detectionId?: string; stayInAutoMode?: boolean },
    ) => {
      if (!user || !flyerId) {
        toast.error("Sign in to extract objects");
        return false;
      }

      const store = useEditorStore.getState();
      const sourceId = store.extractSourceLayerId;
      const page = store.pages.find((p) => p.id === store.selectedPageId);
      const source = page?.layers.find((l) => l.id === sourceId);
      if (!source?.content.src || source.type !== "image") {
        toast.error("Source image not found");
        store.cancelObjectExtract();
        return false;
      }

      const sourceRect: CanvasRect = {
        x: source.position.x,
        y: source.position.y,
        width: source.size.width,
        height: source.size.height,
      };

      setExtracting(true);
      try {
        const { blob, canvasRect, normalizedBbox } = await cropImageRegionToBlob(
          source.content.src,
          sourceRect,
          selectionRect,
        );
        const url = await uploadFlyerAsset(user.id, flyerId, blob);
        store.addExtractedLayer({
          src: url,
          position: { x: canvasRect.x, y: canvasRect.y },
          size: { width: canvasRect.width, height: canvasRect.height },
          sourceLayerId: source.id,
          extractionBbox: normalizedBbox,
          subjectLabel: options?.subjectLabel,
          stayInAutoMode: options?.stayInAutoMode,
        });
        if (options?.detectionId) {
          store.markSubjectExtracted(options.detectionId);
        }
        toast.success(
          options?.subjectLabel
            ? `Extracted “${options.subjectLabel}” — open Action tab to make it clickable`
            : "Object extracted — open Action tab to make it clickable",
        );
        return true;
      } catch (e: any) {
        toast.error(e?.message || "Extraction failed");
        return false;
      } finally {
        setExtracting(false);
      }
    },
    [user, flyerId],
  );

  const extractFromRect = useCallback(
    (selectionRect: CanvasRect) => runExtraction(selectionRect),
    [runExtraction],
  );

  const extractFromSubject = useCallback(
    async (detection: SubjectDetection) => {
      if (detection.extracted) return false;
      const store = useEditorStore.getState();
      const sourceId = store.extractSourceLayerId;
      const page = store.pages.find((p) => p.id === store.selectedPageId);
      const source = page?.layers.find((l) => l.id === sourceId);
      if (!source) return false;

      const sourceRect: CanvasRect = {
        x: source.position.x,
        y: source.position.y,
        width: source.size.width,
        height: source.size.height,
      };
      const canvasRect = bboxToCanvasRect(detection.bbox, sourceRect);
      return runExtraction(canvasRect, {
        subjectLabel: detection.label,
        detectionId: detection.id,
        stayInAutoMode: true,
      });
    },
    [runExtraction],
  );

  return { extractFromRect, extractFromSubject, extracting };
}
