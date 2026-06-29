import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft, ChevronRight, Download, Loader2, Pause, Play, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PHOTO_CATEGORIES,
  type ListingPhoto,
  type PhotoCategory,
  clearStagedListingPhoto,
  deleteListingPhoto,
  loadListingPhotos,
  reorderListingPhotos,
  updateListingPhoto,
  uploadListingPhoto,
  uploadStagedListingPhoto,
} from "@/lib/realtor";


type Props = {
  flyerId: string;
  ownerId: string;
  /** Show the download button (agents only). */
  canDownload?: boolean;
};

export function PhotoGalleryModule({ flyerId, ownerId, canDownload = true }: Props) {
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<PhotoCategory | "all">("all");
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>("exterior");
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    const rows = await loadListingPhotos(flyerId);
    setPhotos(rows);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyerId]);

  const filtered = useMemo(
    () => (activeCategory === "all" ? photos : photos.filter((p) => p.category === activeCategory)),
    [photos, activeCategory]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: photos.length };
    for (const c of PHOTO_CATEGORIES) map[c.value] = 0;
    for (const p of photos) map[p.category] = (map[p.category] ?? 0) + 1;
    return map;
  }, [photos]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let nextPos = photos.length;
    try {
      for (const file of Array.from(files)) {
        const created = await uploadListingPhoto({
          ownerId,
          flyerId,
          file,
          category: uploadCategory,
          position: nextPos++,
        });
        setPhotos((prev) => [...prev, created]);
      }
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await deleteListingPhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCategoryChange = async (id: string, cat: PhotoCategory) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, category: cat } : p)));
    try { await updateListingPhoto(id, { category: cat }); } catch (e: any) { toast.error(e.message); }
  };

  const handleCaptionBlur = async (id: string, caption: string) => {
    try { await updateListingPhoto(id, { caption: caption || null as any }); } catch (e: any) { toast.error(e.message); }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Reorder within the currently filtered view; persist global positions afterward.
    const oldIdx = filtered.findIndex((p) => p.id === active.id);
    const newIdx = filtered.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reorderedFiltered = arrayMove(filtered, oldIdx, newIdx);
    // Merge back into full photos array preserving non-filtered order.
    const newAll: ListingPhoto[] = [];
    let fi = 0;
    for (const p of photos) {
      if (activeCategory === "all" || p.category === activeCategory) {
        newAll.push(reorderedFiltered[fi++]);
      } else {
        newAll.push(p);
      }
    }
    setPhotos(newAll);
    try { await reorderListingPhotos(newAll.map((p) => p.id)); } catch (e: any) { toast.error(e.message); }
  };

  // Slideshow tick
  useEffect(() => {
    if (!slideshow || viewerIndex == null || filtered.length === 0) return;
    const t = setTimeout(() => {
      setViewerIndex((idx) => (idx == null ? 0 : (idx + 1) % filtered.length));
    }, 3500);
    return () => clearTimeout(t);
  }, [slideshow, viewerIndex, filtered.length]);

  const openViewer = (i: number) => { setViewerIndex(i); setSlideshow(false); };
  const closeViewer = () => { setViewerIndex(null); setSlideshow(false); };
  const next = () => setViewerIndex((i) => (i == null ? 0 : (i + 1) % filtered.length));
  const prev = () => setViewerIndex((i) => (i == null ? 0 : (i - 1 + filtered.length) % filtered.length));

  const downloadPhoto = async (photo: ListingPhoto) => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${photo.category}-${photo.id}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload bar */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <div className="text-sm font-medium">Add photos</div>
          <div className="text-xs text-muted-foreground">Upload one or many. They&apos;ll go into the category you pick.</div>
        </div>
        <div className="w-full sm:w-48">
          <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as PhotoCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload
        </Button>
      </Card>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip label={`All (${counts.all ?? 0})`} active={activeCategory === "all"} onClick={() => setActiveCategory("all")} />
        {PHOTO_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.value}
            label={`${c.label} (${counts[c.value] ?? 0})`}
            active={activeCategory === c.value}
            onClick={() => setActiveCategory(c.value)}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No photos in this section yet. Upload some above to build out the gallery.
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Drag tiles to reorder. Click a photo to view fullscreen.</div>
            <Button size="sm" variant="outline" onClick={() => { openViewer(0); setSlideshow(true); }}>
              <Play className="mr-1 h-3.5 w-3.5" />Slideshow
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filtered.map((p, i) => (
                  <SortablePhotoTile
                    key={p.id}
                    photo={p}
                    onOpen={() => openViewer(i)}
                    onDelete={() => handleDelete(p.id)}
                    onCategoryChange={(cat) => handleCategoryChange(p.id, cat)}
                    onCaptionBlur={(cap) => handleCaptionBlur(p.id, cap)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Fullscreen viewer */}
      <Dialog open={viewerIndex != null} onOpenChange={(o) => !o && closeViewer()}>
        <DialogContent className="max-w-[100vw] border-0 bg-black/95 p-0 sm:max-w-[100vw] sm:rounded-none [&>button]:hidden">
          {viewerIndex != null && filtered[viewerIndex] && (
            <div className="relative flex h-[100dvh] w-full items-center justify-center">
              <img
                src={filtered[viewerIndex].url}
                alt={filtered[viewerIndex].caption ?? ""}
                className="max-h-full max-w-full object-contain"
              />
              <Button size="icon" variant="ghost" onClick={closeViewer} className="absolute right-3 top-3 text-white hover:bg-white/10">
                <X className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 text-white hover:bg-white/10">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button size="icon" variant="ghost" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:bg-white/10">
                <ChevronRight className="h-6 w-6" />
              </Button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white">
                <span className="opacity-80">{viewerIndex + 1} / {filtered.length}</span>
                {filtered[viewerIndex].caption && <span className="ml-2 max-w-[40ch] truncate">{filtered[viewerIndex].caption}</span>}
                <Button size="sm" variant="ghost" className="ml-2 h-7 text-white hover:bg-white/10" onClick={() => setSlideshow((s) => !s)}>
                  {slideshow ? <><Pause className="mr-1 h-3.5 w-3.5" />Pause</> : <><Play className="mr-1 h-3.5 w-3.5" />Play</>}
                </Button>
                {canDownload && (
                  <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/10" onClick={() => downloadPhoto(filtered[viewerIndex])}>
                    <Download className="mr-1 h-3.5 w-3.5" />Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function SortablePhotoTile({
  photo,
  onOpen,
  onDelete,
  onCategoryChange,
  onCaptionBlur,
}: {
  photo: ListingPhoto;
  onOpen: () => void;
  onDelete: () => void;
  onCategoryChange: (c: PhotoCategory) => void;
  onCaptionBlur: (c: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const [caption, setCaption] = useState(photo.caption ?? "");

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="relative aspect-square cursor-move bg-muted" {...attributes} {...listeners}>
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="absolute inset-0 cursor-zoom-in"
          aria-label="Open fullscreen"
        />
        <Button
          size="icon"
          variant="ghost"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute right-1 top-1 h-7 w-7 bg-background/80 text-destructive hover:bg-background"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5 p-2">
        <Select value={photo.category} onValueChange={(v) => onCategoryChange(v as PhotoCategory)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PHOTO_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== (photo.caption ?? "") && onCaptionBlur(caption)}
          placeholder="Caption"
          className="h-7 text-xs"
        />
      </div>
    </Card>
  );
}
