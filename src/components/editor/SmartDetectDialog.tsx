import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Check, X, Phone, Link as LinkIcon, MapPin, Calendar, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEditorStore } from "@/store/editorStore";
import { Layer, LayerAction } from "@/types/flyer";
import { uid } from "@/lib/konvaHelpers";
import { toast } from "sonner";

interface Detection {
  kind: "phone" | "url" | "email" | "address" | "date";
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  suggestedActionType: string;
  suggestedLabel: string;
}

const KIND_META: Record<Detection["kind"], { label: string; icon: any; color: string }> = {
  phone: { label: "Phone", icon: Phone, color: "bg-emerald-500" },
  url: { label: "URL", icon: LinkIcon, color: "bg-blue-500" },
  email: { label: "Email", icon: Mail, color: "bg-violet-500" },
  address: { label: "Address", icon: MapPin, color: "bg-amber-500" },
  date: { label: "Date", icon: Calendar, color: "bg-rose-500" },
};

export function SmartDetectDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const flyer = useEditorStore((s) => s.flyer);
  const page = pages.find((p) => p.id === selectedPageId);

  // Find the largest image layer on the current page (most likely the background flyer)
  const candidates: Layer[] = (page?.layers ?? []).filter((l) => l.type === "image" && l.content.src);
  const targetLayer: Layer | undefined = candidates
    .slice()
    .sort((a, b) => b.size.width * b.size.height - a.size.width * a.size.height)[0];

  const [loading, setLoading] = useState(false);
  const [detections, setDetections] = useState<Detection[] | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [ignored, setIgnored] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  async function runDetect() {
    if (!targetLayer?.content.src) {
      toast.error("Add an image to this page first");
      return;
    }
    setLoading(true);
    setDetections(null);
    setIgnored(new Set());
    setAccepted(new Set());
    setEdits({});
    try {
      const { data, error } = await supabase.functions.invoke("smart-detect", {
        body: { imageUrl: targetLayer.content.src },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: Detection[] = data?.detections ?? [];
      setDetections(list);
      if (list.length === 0) toast.info("No actionable items detected");
      else toast.success(`Found ${list.length} suggestion${list.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message || "Detection failed");
    } finally {
      setLoading(false);
    }
  }

  function buildAction(d: Detection, text: string): LayerAction {
    const id = uid();
    switch (d.kind) {
      case "phone":
        return { id, type: "call", payload: { phone: text } };
      case "url": {
        const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
        return { id, type: "open_url", payload: { url, newTab: true } };
      }
      case "email":
        return { id, type: "open_url", payload: { url: `mailto:${text}`, newTab: false } };
      case "address":
        return { id, type: "map", payload: { mapAddress: text, mapProvider: "auto" } };
      case "date":
        return { id, type: "add_to_calendar", payload: { eventTitle: text, calendarMode: "google" } };
    }
  }

  function acceptOne(idx: number) {
    if (!detections || !targetLayer || !flyer) return;
    const d = detections[idx];
    const text = (edits[idx] ?? d.text).trim();
    if (!text) return;
    // Convert normalized bbox (relative to image) into canvas coords.
    const x = targetLayer.position.x + d.bbox.x * targetLayer.size.width;
    const y = targetLayer.position.y + d.bbox.y * targetLayer.size.height;
    const width = Math.max(20, d.bbox.width * targetLayer.size.width);
    const height = Math.max(20, d.bbox.height * targetLayer.size.height);

    const action = buildAction(d, text);
    const store = useEditorStore.getState();
    store.addHotspotLayer({ x, y, width, height });
    // The new hotspot is now selected — attach the action.
    const newId = useEditorStore.getState().selectedLayerId;
    if (newId) store.setLayerAction(newId, action);
    setAccepted((s) => new Set(s).add(idx));
  }

  function acceptAll() {
    if (!detections) return;
    detections.forEach((_, i) => {
      if (!ignored.has(i) && !accepted.has(i)) acceptOne(i);
    });
    toast.success("Created hotspots from suggestions");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Smart hotspot detection
          </DialogTitle>
          <DialogDescription>
            AI scans your flyer for phone numbers, websites, addresses, and dates/times only. Logos, photos, and other graphics are ignored.
          </DialogDescription>
        </DialogHeader>

        {!targetLayer && (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Add an image to this page first, then run detection.
          </div>
        )}

        {targetLayer && !detections && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scanning: <span className="font-medium text-foreground">{targetLayer.content.src?.split("/").pop()}</span>
            </p>
            <Button onClick={runDetect} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" /> Detect hotspots
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading your flyer with AI…</p>
          </div>
        )}

        {detections && detections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                {detections.length} suggestion{detections.length === 1 ? "" : "s"} ·{" "}
                <span className="text-muted-foreground">{accepted.size} accepted</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={runDetect}>Re-scan</Button>
                <Button size="sm" onClick={acceptAll} disabled={accepted.size + ignored.size >= detections.length}>
                  Accept all
                </Button>
              </div>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {detections.map((d, i) => {
                const meta = KIND_META[d.kind];
                const Icon = meta.icon;
                const isIgnored = ignored.has(i);
                const isAccepted = accepted.has(i);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-md border p-2 transition-opacity ${
                      isIgnored ? "opacity-40" : ""
                    } ${isAccepted ? "border-emerald-500/50 bg-emerald-500/5" : "border-border bg-muted/20"}`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded ${meta.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">→ {d.suggestedLabel}</span>
                      </div>
                      <Input
                        value={edits[i] ?? d.text}
                        onChange={(e) => setEdits((s) => ({ ...s, [i]: e.target.value }))}
                        className="h-7 text-xs"
                        disabled={isAccepted || isIgnored}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      {!isAccepted && !isIgnored && (
                        <>
                          <Button size="sm" className="h-7 px-2" onClick={() => acceptOne(i)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIgnored((s) => new Set(s).add(i))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {isAccepted && <Badge className="bg-emerald-500">Added</Badge>}
                      {isIgnored && <Badge variant="outline">Ignored</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detections && detections.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">No actionable items detected.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={runDetect}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
