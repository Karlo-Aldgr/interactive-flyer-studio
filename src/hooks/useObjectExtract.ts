import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  cropImageRegionToBlob,
  extractSubjectCutoutToBlob,
  type CanvasRect,
} from "@/lib/imageExtraction";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  bboxToCanvasRect,
  type NormalizedPoint,
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

  const runSegmentedExtraction = useCallback(
    async (
      detection: SubjectDetection,
      polygon: NormalizedPoint[],
      options?: { stayInAutoMode?: boolean },
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
        const { blob, canvasRect, normalizedBbox } = await extractSubjectCutoutToBlob(
          source.content.src,
          sourceRect,
          { bbox: detection.bbox, polygon },
        );
        const url = await uploadFlyerAsset(user.id, flyerId, blob);
        store.addExtractedLayer({
          src: url,
          position: { x: canvasRect.x, y: canvasRect.y },
          size: { width: canvasRect.width, height: canvasRect.height },
          sourceLayerId: source.id,
          extractionBbox: normalizedBbox,
          subjectLabel: detection.label,
          stayInAutoMode: options?.stayInAutoMode ?? true,
        });
        store.markSubjectExtracted(detection.id);
        toast.success(
          `Extracted “${detection.label}” — open Action tab to make it clickable`,
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
      if (detection.extracted || detection.dismissed) return false;
      const store = useEditorStore.getState();
      const sourceId = store.extractSourceLayerId;
      const page = store.pages.find((p) => p.id === store.selectedPageId);
      const source = page?.layers.find((l) => l.id === sourceId);
      if (!source?.content.src) return false;

      setExtracting(true);
      try {
        let polygon = detection.polygon ?? [];
        if (polygon.length < 3) {
          const data = await invokeEdgeFunction<{ polygon?: NormalizedPoint[] }>("subject-segment", {
            imageUrl: source.content.src,
            bbox: detection.bbox,
            label: detection.label,
          });
          polygon = data?.polygon ?? [];
          if (polygon.length >= 3) {
            store.updateSubjectPolygon(detection.id, polygon);
          }
        } else {
          // Refine silhouette on extract for sharper cutouts.
          try {
            const data = await invokeEdgeFunction<{ polygon?: NormalizedPoint[] }>("subject-segment", {
              imageUrl: source.content.src,
              bbox: detection.bbox,
              label: detection.label,
            });
            if ((data?.polygon?.length ?? 0) >= 3) {
              polygon = data.polygon!;
              store.updateSubjectPolygon(detection.id, polygon);
            }
          } catch {
            // Keep preview polygon if refine fails.
          }
        }

        if (polygon.length < 3) {
          const sourceRect: CanvasRect = {
            x: source.position.x,
            y: source.position.y,
            width: source.size.width,
            height: source.size.height,
          };
          const canvasRect = bboxToCanvasRect(detection.bbox, sourceRect);
          setExtracting(false);
          return runExtraction(canvasRect, {
            subjectLabel: detection.label,
            detectionId: detection.id,
            stayInAutoMode: true,
          });
        }

        setExtracting(false);
        return runSegmentedExtraction(detection, polygon, { stayInAutoMode: true });
      } catch (e: any) {
        toast.error(e?.message || "Segmentation failed");
        setExtracting(false);
        return false;
      }
    },
    [runExtraction, runSegmentedExtraction],
  );

  return { extractFromRect, extractFromSubject, extracting };
}
