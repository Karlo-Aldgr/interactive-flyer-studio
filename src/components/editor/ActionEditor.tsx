import { useEffect, useRef, useState } from "react";
import { ActionType, LayerAction, PopupButton, PopupHotspot, AirMessageBubble, PollOption, GalleryImage } from "@/types/flyer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useEditorStore } from "@/store/editorStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Lock, Save, Undo2, Upload, Plus, Trash2, ChevronUp, ChevronDown, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

interface Props {
  action: LayerAction | null;
  onChange: (a: LayerAction | null) => void;
  /** Recursion depth to prevent infinite nesting in popup buttons. */
  depth?: number;
  /** Hide save/discard footer when used as nested editor. */
  embedded?: boolean;
}

const ACTION_LABELS: Record<ActionType, string> = {
  open_url: "Open URL",
  popup: "Show popup",
  video: "Play video",
  audio: "Play audio",
  call: "Call phone",
  sms: "Send SMS",
  form: "Capture form",
  navigate: "Go to page",
  reveal: "Reveal layer",
  add_to_calendar: "Add to calendar",
  buy_ticket: "Buy ticket",
  rsvp: "RSVP",
  checkout: "Link to checkout",
  coupon: "Coupon",
  map: "Open in maps (GPS)",
  buy_product: "Buy product",
  air_messages: "Air messages (chat bubbles)",
  poll: "Poll",
  subscribe: "Subscribe (email signup)",
  book_appointment: "Book appointment",
  gallery: "Photo gallery",
  survey: "Survey",
  testimonial: "Testimonials",
  reserve_table: "Reserve a table",
  schedule_consultation: "Schedule consultation",
  show_menu: "Show menu",
  join_challenge: "Join challenge",
  business_rating: "Business rating (5 stars)",
};

const PRESET_TYPES: ActionType[] = ["book_appointment", "subscribe", "air_messages", "poll", "buy_product", "buy_ticket", "rsvp", "checkout", "coupon", "map", "gallery", "survey", "testimonial", "reserve_table", "schedule_consultation", "show_menu", "join_challenge", "business_rating"];
const BASIC_TYPES: ActionType[] = [
  "open_url", "popup", "video", "audio", "call", "sms", "form", "navigate", "reveal", "add_to_calendar",
];

function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function isValid(draft: LayerAction | null): boolean {
  if (!draft) return true;
  const p = draft.payload || {};
  switch (draft.type) {
    case "open_url": return !!p.url;
    case "popup": return !!(p.title || p.body || (p.buttons && p.buttons.length));
    case "video": return !!p.videoUrl;
    case "audio": return !!p.audioUrl;
    case "call": return !!p.phone;
    case "sms": return !!p.phone;
    case "form": return !!(p.fields && p.fields.length);
    case "navigate": return !!p.pageId;
    case "reveal": return !!(p.targetLayerIds && p.targetLayerIds.length);
    case "add_to_calendar": return !!(p.eventTitle && p.startISO);
    case "buy_ticket": return !!(p.ticketImageUrl || p.checkoutUrl);
    case "rsvp": return !!(p.rsvpFields && p.rsvpFields.length);
    case "checkout": return !!p.checkoutUrl;
    case "coupon":
      if (!(p.couponImageUrl || p.couponCode)) return false;
      if (p.couponUnlock && !p.couponUnlockCode) return false;
      return true;
    case "map":
      return !!(p.mapAddress || (typeof p.mapLat === "number" && typeof p.mapLng === "number"));
    case "buy_product":
      return !!(p.productName && (p.productCartEnabled || p.productPaymentUrl));
    case "air_messages":
      return !!(p.bubbles && p.bubbles.some((b) => b.text || b.imageUrl));
    case "poll":
      return !!(p.pollQuestion && p.pollOptions && p.pollOptions.filter((o) => o.label?.trim()).length >= 2);
    case "subscribe":
      return true;
    case "book_appointment":
      return !!(p.apptTitle && p.apptDurationMin);
    case "gallery":
      return !!(p.galleryImages && p.galleryImages.length > 0);
    case "survey":
      return !!(p.surveyTitle && p.surveyQuestions && p.surveyQuestions.length > 0 && p.surveyQuestions.every((q) => q.label?.trim()));
    case "testimonial":
      return true;
    case "reserve_table":
      return true;
    case "schedule_consultation":
      return !!(p.consultDurations && p.consultDurations.length > 0);
    case "show_menu":
      return true;
    case "join_challenge":
      return !!(p.challengeTitle);
    case "business_rating":
      return true;
    default: return true;
  }
}

function AssetUpload({
  label, value, onChange, accept = "image/*", kind = "image",
}: { label: string; value?: string; onChange: (url: string) => void; accept?: string; kind?: "image" | "audio" }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { flyerId } = useParams();
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    if (!user || !flyerId) return toast.error("Sign in required");
    setBusy(true);
    const ext = file.name.split(".").pop();
    const folder = kind === "audio" ? "audio" : "assets";
    const path = `${user.id}/${flyerId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("flyer-assets").upload(path, file, {
      contentType: file.type || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
    onChange(data.publicUrl);
    toast.success(kind === "audio" ? "Audio uploaded" : "Image uploaded");
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="mr-1 h-3.5 w-3.5" /> {busy ? "Uploading..." : value ? "Replace" : "Upload"}
        </Button>
        {value && kind === "image" && (
          <img src={value} alt="" className="h-10 w-10 rounded border border-border object-cover" />
        )}
        {value && kind === "audio" && (
          <audio src={value} controls className="h-8 max-w-[200px]" />
        )}
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

const MAX_GALLERY_IMAGES = 12;

function GalleryEditor({
  title, images, onTitleChange, onImagesChange, depth,
}: {
  title: string;
  images: GalleryImage[];
  onTitleChange: (v: string) => void;
  onImagesChange: (imgs: GalleryImage[]) => void;
  depth: number;
}) {
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { flyerId } = useParams();
  const [busy, setBusy] = useState(false);

  async function uploadFiles(files: FileList) {
    if (!user || !flyerId) return toast.error("Sign in required");
    const remaining = MAX_GALLERY_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_GALLERY_IMAGES} photos`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Only added the first ${remaining} (max ${MAX_GALLERY_IMAGES} photos)`);
    }
    setBusy(true);
    const uploaded: GalleryImage[] = [];
    for (const file of list) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${flyerId}/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("flyer-assets").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("flyer-assets").getPublicUrl(path);
      uploaded.push({ id: crypto.randomUUID(), url: data.publicUrl });
    }
    setBusy(false);
    if (uploaded.length) {
      onImagesChange([...images, ...uploaded]);
      toast.success(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? "" : "s"}`);
    }
  }

  function update(id: string, patch: Partial<GalleryImage>) {
    onImagesChange(images.map((im) => (im.id === id ? { ...im, ...patch } : im)));
  }
  function remove(id: string) {
    onImagesChange(images.filter((im) => im.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = images.findIndex((im) => im.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onImagesChange(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Show a popup gallery of up to {MAX_GALLERY_IMAGES} photos. Tap an image to view it full-size.
      </p>
      <div>
        <Label className="text-xs">Gallery title (optional)</Label>
        <Input
          className="mt-1"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Event photos"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Photos ({images.length}/{MAX_GALLERY_IMAGES})</Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={busy || images.length >= MAX_GALLERY_IMAGES}
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          {busy ? "Uploading..." : "Upload photos"}
        </Button>
      </div>
      {images.length === 0 ? (
        <div className="rounded border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
          No photos yet. Upload up to {MAX_GALLERY_IMAGES} images.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((im, i) => (
            <div key={im.id} className="group relative rounded border border-border bg-muted/30 p-1">
              <img src={im.url} alt={im.caption || ""} className="h-20 w-full rounded object-cover" />
              <Input
                className="mt-1 h-6 text-[11px]"
                value={im.caption || ""}
                onChange={(e) => update(im.id, { caption: e.target.value })}
                placeholder="Caption"
              />
              <div className="mt-1 flex items-center justify-between">
                <div className="flex">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(im.id, -1)} disabled={i === 0}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(im.id, 1)} disabled={i === images.length - 1}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={im.action ? "default" : "ghost"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setOpenActionId(openActionId === im.id ? null : im.id)}
                  >
                    {im.action ? ACTION_LABELS[im.action.type] : "+ Action"}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(im.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {openActionId && images.find((im) => im.id === openActionId) && (
        <div className="rounded border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-semibold">Tap action for selected photo</Label>
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setOpenActionId(null)}>
              Close
            </Button>
          </div>
          <ActionEditor
            embedded
            depth={depth + 1}
            action={images.find((im) => im.id === openActionId)?.action || null}
            onChange={(a) => update(openActionId, { action: a })}
          />
          {images.find((im) => im.id === openActionId)?.action && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 h-6 text-[11px] text-destructive"
              onClick={() => update(openActionId, { action: null })}
            >
              Remove tap action
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function PopupButtonsEditor({
  buttons, onChange, depth,
}: { buttons: PopupButton[]; onChange: (b: PopupButton[]) => void; depth: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function add() {
    const next: PopupButton = {
      id: crypto.randomUUID(),
      label: "Button",
      style: "primary",
      action: { id: crypto.randomUUID(), type: "open_url", payload: {} },
    };
    onChange([...buttons, next]);
    setOpenIdx(buttons.length);
  }
  function update(i: number, patch: Partial<PopupButton>) {
    onChange(buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= buttons.length) return;
    const next = [...buttons];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(buttons.filter((_, idx) => idx !== i));
    if (openIdx === i) setOpenIdx(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Buttons</Label>
        <Button type="button" size="sm" variant="ghost" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {buttons.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No buttons. Add one to chain another action after the popup.</p>
      )}
      <div className="space-y-2">
        {buttons.map((b, i) => (
          <div key={b.id} className="rounded border border-border bg-muted/30 p-2">
            <div className="flex items-center gap-1">
              <Input
                className="h-7 flex-1 text-xs"
                value={b.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Button label"
              />
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === buttons.length - 1}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                {openIdx === i ? "−" : "…"}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {openIdx === i && (
              <div className="mt-2 border-t border-border pt-2">
                <div className="mb-2 flex items-center gap-2">
                  <Label className="text-[11px]">Style</Label>
                  <Select value={b.style || "primary"} onValueChange={(v) => update(i, { style: v as any })}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Background</Label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                        value={b.bgColor || "#7c3aed"}
                        onChange={(e) => update(i, { bgColor: e.target.value })}
                      />
                      <Input
                        className="h-7 flex-1 text-xs"
                        value={b.bgColor || ""}
                        placeholder="auto"
                        onChange={(e) => update(i, { bgColor: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Text</Label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        className="h-7 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                        value={b.textColor || "#ffffff"}
                        onChange={(e) => update(i, { textColor: e.target.value })}
                      />
                      <Input
                        className="h-7 flex-1 text-xs"
                        value={b.textColor || ""}
                        placeholder="auto"
                        onChange={(e) => update(i, { textColor: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                </div>
                <ActionEditor
                  embedded
                  depth={depth + 1}
                  action={b.action}
                  onChange={(a) => a && update(i, { action: a })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PopupHotspotsEditor({
  imageUrl,
  hotspots,
  onChange,
  depth,
  onPersist,
}: {
  imageUrl?: string;
  hotspots: PopupHotspot[];
  onChange: (h: PopupHotspot[]) => void;
  depth: number;
  onPersist?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [mode, setMode] = useState<"select" | "draw">("draw");
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function update(i: number, patch: Partial<PopupHotspot>) {
    onChange(hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function remove(i: number) {
    onChange(hotspots.filter((_, idx) => idx !== i));
    if (openIdx === i) setOpenIdx(null);
  }

  function relCoords(e: React.PointerEvent) {
    const el = containerRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (mode !== "draw" || !imageUrl) return;
    if ((e.target as HTMLElement).closest("[data-hotspot]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = relCoords(e);
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    const p = relCoords(e);
    const s = startRef.current;
    setDraft({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }
  function onPointerUp() {
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      const next: PopupHotspot = {
        id: crypto.randomUUID(),
        x: draft.x,
        y: draft.y,
        width: draft.w,
        height: draft.h,
        shape: "rect",
        action: { id: crypto.randomUUID(), type: "open_url", payload: {} },
      };
      onChange([...hotspots, next]);
      setOpenIdx(hotspots.length);
    }
    setDraft(null);
    startRef.current = null;
  }

  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Hotspots on image</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setFullscreen(true)}
          disabled={!imageUrl}
        >
          <Maximize2 className="mr-1 h-3.5 w-3.5" />
          {hotspots.length > 0 ? `Edit (${hotspots.length})` : "Edit hotspots"}
        </Button>
      </div>

      {!imageUrl && (
        <p className="text-[11px] text-muted-foreground">Add an image above to draw hotspots on it.</p>
      )}
      {imageUrl && hotspots.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Click "Edit hotspots" to draw clickable regions on the image.
        </p>
      )}
      {hotspots.length > 0 && (
        <div className="rounded border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
          {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"} configured.
        </div>
      )}

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          className="max-w-none w-screen h-screen p-0 gap-0 rounded-none border-0 sm:rounded-none flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">Popup hotspots</h2>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "draw" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setMode("draw")}
                  disabled={!imageUrl}
                >
                  Draw
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "select" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setMode("select")}
                >
                  Select
                </Button>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {mode === "draw" ? "Drag on the image to draw a hotspot." : "Click a hotspot to edit its action."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onPersist?.();
                  toast.success(`Saved ${hotspots.length} hotspot${hotspots.length === 1 ? "" : "s"}`);
                  setFullscreen(false);
                }}
              >
                <Save className="mr-1 h-3.5 w-3.5" /> Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFullscreen(false)}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Close
              </Button>
            </div>
          </div>

          {/* Body: image canvas + side panel */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto bg-muted/40 p-6 flex items-start justify-center">
              {imageUrl ? (
                <div
                  ref={containerRef}
                  className="relative max-w-full select-none shadow-lg"
                  style={{ touchAction: "none", cursor: mode === "draw" ? "crosshair" : "default" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  <img
                    src={imageUrl}
                    alt=""
                    className="block max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto pointer-events-none"
                    draggable={false}
                  />
                  {hotspots.map((h, i) => (
                    <div
                      key={h.id}
                      data-hotspot
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenIdx(openIdx === i ? null : i);
                      }}
                      className={`absolute border-2 cursor-pointer ${
                        openIdx === i
                          ? "border-primary bg-primary/30"
                          : "border-primary/70 bg-primary/15 hover:bg-primary/25"
                      } ${h.shape === "ellipse" ? "rounded-full" : "rounded-sm"}`}
                      style={{
                        left: `${h.x * 100}%`,
                        top: `${h.y * 100}%`,
                        width: `${h.width * 100}%`,
                        height: `${h.height * 100}%`,
                      }}
                      title={h.label || `Hotspot ${i + 1}`}
                    >
                      <span className="absolute -top-2 -left-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  {draft && (
                    <div
                      className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                      style={{
                        left: `${draft.x * 100}%`,
                        top: `${draft.y * 100}%`,
                        width: `${draft.w * 100}%`,
                        height: `${draft.h * 100}%`,
                      }}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No image set.</p>
              )}
            </div>

            <aside className="w-96 shrink-0 border-l border-border bg-card overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Hotspots ({hotspots.length})</Label>
              </div>
              {hotspots.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Drag on the image to create your first hotspot.
                </p>
              )}
              {hotspots.map((h, i) => (
                <div key={h.id} className="rounded border border-border bg-muted/30 p-2">
                  <div className="flex items-center gap-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <Input
                      className="h-7 flex-1 text-xs"
                      value={h.label || ""}
                      placeholder={`Hotspot ${i + 1}`}
                      onChange={(e) => update(i, { label: e.target.value })}
                    />
                    <Select value={h.shape || "rect"} onValueChange={(v) => update(i, { shape: v as any })}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rect">Rectangle</SelectItem>
                        <SelectItem value="ellipse">Ellipse</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                      {openIdx === i ? "−" : "…"}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {openIdx === i && (
                    <div className="mt-2 border-t border-border pt-2">
                      <ActionEditor
                        embedded
                        depth={depth + 1}
                        action={h.action}
                        onChange={(a) => a && update(i, { action: a })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AirMessagesEditor({
  bubbles, onChange, depth, staggerMs, onStaggerChange, startDelayMs, onStartDelayChange, onAddAsLayer,
}: {
  bubbles: AirMessageBubble[];
  onChange: (b: AirMessageBubble[]) => void;
  depth: number;
  staggerMs: number;
  onStaggerChange: (ms: number) => void;
  startDelayMs: number;
  onStartDelayChange: (ms: number) => void;
  /** When provided, the "Add bubble" button creates a brand new layer instead of
   *  pushing into the current layer's bubbles array. */
  onAddAsLayer?: () => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function defaultBubble(): AirMessageBubble {
    return {
      id: crypto.randomUUID(),
      text: "",
      action: null,
      bgColor: "#1d9bf0",
      bgColor2: "#0a66c2",
      textColor: "#ffffff",
      textCase: "upper",
      tail: "down",
      bold: true,
    };
  }
  function add() {
    if (onAddAsLayer) { onAddAsLayer(); return; }
    onChange([...bubbles, defaultBubble()]);
    setOpenIdx(bubbles.length);
  }
  function update(i: number, patch: Partial<AirMessageBubble>) {
    onChange(bubbles.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= bubbles.length) return;
    const next = [...bubbles];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(bubbles.filter((_, idx) => idx !== i));
    if (openIdx === i) setOpenIdx(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Bright pill-shaped chat bubbles that animate in one after another. Resize the bubble area on the canvas — text auto-fits to the box.
      </p>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Start delay</Label>
        <Input
          type="number"
          min={0}
          max={60000}
          step={100}
          className="h-7 w-24 text-xs"
          value={startDelayMs}
          onChange={(e) => onStartDelayChange(Math.max(0, Math.min(60000, Number(e.target.value) || 0)))}
        />
        <span className="text-[11px] text-muted-foreground">ms before first bubble</span>
      </div>

      {bubbles.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">Delay between bubbles</Label>
          <Input
            type="number"
            min={100}
            max={5000}
            step={100}
            className="h-7 w-24 text-xs"
            value={staggerMs}
            onChange={(e) => onStaggerChange(Math.max(100, Number(e.target.value) || 900))}
          />
          <span className="text-[11px] text-muted-foreground">ms</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-xs">Bubbles ({bubbles.length})</Label>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add bubble
        </Button>
      </div>

      {bubbles.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No bubbles yet. Click "Add bubble" to create one.</p>
      )}

      <div className="space-y-2">
        {bubbles.map((b, i) => (
          <div key={b.id} className="rounded border border-border bg-muted/30 p-2">
            <div className="flex items-center gap-1">
              <span
                className="h-4 w-4 rounded-full border border-border"
                style={{
                  background: (b.bgColor && b.bgColor2 && b.bgColor !== b.bgColor2)
                    ? `linear-gradient(135deg, ${b.bgColor}, ${b.bgColor2})`
                    : (b.bgColor || "#1d9bf0"),
                }}
              />
              <Input
                className="h-7 flex-1 text-xs"
                value={b.text || ""}
                placeholder={b.imageUrl ? "(image only)" : "Message text"}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === bubbles.length - 1}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                {openIdx === i ? "−" : "…"}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {openIdx === i && (
              <div className="mt-2 space-y-2 border-t border-border pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Color</Label>
                    <Input type="color" className="mt-1 h-8 w-full" value={b.bgColor || "#1d9bf0"}
                      onChange={(e) => update(i, { bgColor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Gradient end</Label>
                    <Input type="color" className="mt-1 h-8 w-full" value={b.bgColor2 || b.bgColor || "#0a66c2"}
                      onChange={(e) => update(i, { bgColor2: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Text color</Label>
                    <Input type="color" className="mt-1 h-8 w-full" value={b.textColor || "#ffffff"}
                      onChange={(e) => update(i, { textColor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Case</Label>
                    <Select value={b.textCase || "as-is"} onValueChange={(v) => update(i, { textCase: v as any })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="as-is">As typed</SelectItem>
                        <SelectItem value="upper">UPPERCASE</SelectItem>
                        <SelectItem value="lower">lowercase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Tail</Label>
                    <Select value={b.tail || "down"} onValueChange={(v) => update(i, { tail: v as any })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="down">Down ▼</SelectItem>
                        <SelectItem value="up">Up ▲</SelectItem>
                        <SelectItem value="left">Left ◀</SelectItem>
                        <SelectItem value="right">Right ▶</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={b.bold ?? true} onCheckedChange={(v) => update(i, { bold: v })} />
                      <Label className="text-[11px]">Bold</Label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-[11px] w-28">Desktop font size</Label>
                  <Input
                    type="number"
                    min={8}
                    max={200}
                    className="h-7 w-20 text-xs"
                    placeholder="Auto"
                    value={b.fontSize ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      update(i, { fontSize: v === "" ? undefined : Math.max(8, Math.min(200, Number(v) || 0)) });
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">px — mobile auto-fits for readability</span>
                  {b.fontSize !== undefined && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => update(i, { fontSize: undefined })}>
                      Auto
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20">Intro at</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60000}
                    step={100}
                    className="h-7 w-24 text-xs"
                    placeholder="Auto"
                    value={b.delayMs ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      update(i, { delayMs: v === "" ? undefined : Math.max(0, Math.min(60000, Number(v) || 0)) });
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">ms from start — blank uses delay between bubbles</span>
                  {b.delayMs !== undefined && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => update(i, { delayMs: undefined })}>
                      Auto
                    </Button>
                  )}
                </div>
                <AssetUpload
                  label="Image (optional)"
                  value={b.imageUrl}
                  onChange={(url) => update(i, { imageUrl: url })}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-[11px]">Tapback reaction</Label>
                  <Select value={b.reaction || "none"} onValueChange={(v) => update(i, { reaction: v === "none" ? "" : (v as any) })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="heart">❤️ Heart</SelectItem>
                      <SelectItem value="like">👍 Like</SelectItem>
                      <SelectItem value="dislike">👎 Dislike</SelectItem>
                      <SelectItem value="haha">😂 Haha</SelectItem>
                      <SelectItem value="exclaim">‼️ Emphasize</SelectItem>
                      <SelectItem value="question">❓ Question</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded border border-border bg-background p-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tap action (optional)</Label>
                  <div className="mt-1">
                    <ActionEditor
                      embedded
                      depth={depth + 1}
                      action={b.action || null}
                      onChange={(a) => update(i, { action: a })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PollEditor({
  question, options, multiple, onChange,
}: {
  question: string;
  options: PollOption[];
  multiple: boolean;
  onChange: (patch: { pollQuestion?: string; pollOptions?: PollOption[]; pollMultiple?: boolean }) => void;
}) {
  function setOpts(opts: PollOption[]) { onChange({ pollOptions: opts }); }
  function addOpt() {
    setOpts([...(options || []), { id: crypto.randomUUID(), label: "" }]);
  }
  function updateOpt(i: number, label: string) {
    setOpts(options.map((o, idx) => (idx === i ? { ...o, label } : o)));
  }
  function removeOpt(i: number) {
    setOpts(options.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Anonymous poll with live results. Each viewer can vote once per option from their device. Results update in real time for everyone.
      </p>
      <div>
        <Label className="text-xs">Question</Label>
        <Input
          className="mt-1"
          value={question}
          onChange={(e) => onChange({ pollQuestion: e.target.value })}
          placeholder="What's your favorite?"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Options</Label>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={addOpt}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {(options || []).map((o, i) => (
          <div key={o.id} className="flex items-center gap-1">
            <Input
              className="h-8 flex-1 text-sm"
              value={o.label}
              placeholder={`Option ${i + 1}`}
              onChange={(e) => updateOpt(i, e.target.value)}
            />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOpt(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {(options?.length || 0) < 2 && (
          <p className="text-[11px] text-muted-foreground">Add at least 2 options.</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Allow multiple choices</Label>
        <Switch checked={multiple} onCheckedChange={(v) => onChange({ pollMultiple: v })} />
      </div>
    </div>
  );
}

export function ActionEditor({ action, onChange, depth = 0, embedded = false }: Props) {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setPreviewAction = useEditorStore((s) => s.setPreviewAction);
  const addAirBubbleLayer = useEditorStore((s) => s.addAirBubbleLayer);
  const currentPage = pages.find((p) => p.id === selectedPageId);

  const [draft, setDraft] = useState<LayerAction | null>(action);

  useEffect(() => {
    setDraft(action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.id, action?.type, JSON.stringify(action?.payload)]);

  // For embedded editors, propagate drafts immediately (they're saved with the parent)
  useEffect(() => {
    if (embedded) onChange(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Publish the current draft to the editor store so the canvas can render
  // a live preview (e.g. air-message bubbles) before the user clicks Save.
  useEffect(() => {
    if (embedded || !selectedLayerId) return;
    setPreviewAction({ layerId: selectedLayerId, action: draft });
    return () => setPreviewAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedLayerId, embedded]);

  const type = draft?.type ?? "open_url";
  const p = draft?.payload ?? {};

  const update = (patch: any) =>
    setDraft({
      id: draft?.id || crypto.randomUUID(),
      type: type as ActionType,
      payload: { ...p, ...patch },
    });

  const dirty = JSON.stringify(draft) !== JSON.stringify(action);
  const valid = isValid(draft);
  // Restrict popup nesting (depth 0 = root layer; allow buttons up to depth 1)
  const allowPopupButtons = type === "popup" && depth < 1;

  function save() {
    onChange(draft);
    toast.success(draft ? "Action saved" : "Action cleared");
  }
  function discard() { setDraft(action); }

  // Highlight (visual cue) edits propagate live without requiring a Save click —
  // they're purely presentational and users expect immediate feedback on the canvas.
  function updateHighlight(patch: Partial<NonNullable<LayerAction["highlight"]>>) {
    if (!draft) return;
    const next: LayerAction = {
      ...draft,
      highlight: { ...(draft.highlight || {}), ...patch },
    };
    setDraft(next);
    if (!embedded) onChange(next);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        <div>
          <Label className="text-xs">Action type</Label>
          <Select
            value={draft ? type : "none"}
            onValueChange={(v) => {
              if (v === "none") setDraft(null);
              else setDraft({ id: draft?.id || crypto.randomUUID(), type: v as ActionType, payload: {} });
            }}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {!embedded && <SelectItem value="none">No action</SelectItem>}
              <SelectGroup>
                <SelectLabel>Presets</SelectLabel>
                {PRESET_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>{ACTION_LABELS[k]}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Basic</SelectLabel>
                {BASIC_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>{ACTION_LABELS[k]}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {type === "open_url" && (
          <>
            <div>
              <Label className="text-xs">URL</Label>
              <Input className="mt-1" value={p.url || ""} onChange={(e) => update({ url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Open in new tab</Label>
              <Switch checked={p.newTab ?? true} onCheckedChange={(v) => update({ newTab: v })} />
            </div>
          </>
        )}

        {type === "popup" && (
          <>
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.title || ""} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea className="mt-1" rows={3} value={p.body || ""} onChange={(e) => update({ body: e.target.value })} />
            </div>
            <AssetUpload
              label="Image (optional)"
              value={p.mediaUrl}
              onChange={(url) => update({ mediaUrl: url })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Background color</Label>
                <Input
                  type="color"
                  className="mt-1 h-9 p-1"
                  value={p.popupBgColor || "#ffffff"}
                  onChange={(e) => update({ popupBgColor: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Text color</Label>
                <Input
                  type="color"
                  className="mt-1 h-9 p-1"
                  value={p.popupTextColor || "#000000"}
                  onChange={(e) => update({ popupTextColor: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Title size ({p.popupTitleSize ?? 18}px)</Label>
                <Slider
                  className="mt-2"
                  min={12}
                  max={48}
                  step={1}
                  value={[p.popupTitleSize ?? 18]}
                  onValueChange={(v) => update({ popupTitleSize: v[0] })}
                />
              </div>
              <div>
                <Label className="text-xs">Body size ({p.popupBodySize ?? 14}px)</Label>
                <Slider
                  className="mt-2"
                  min={10}
                  max={32}
                  step={1}
                  value={[p.popupBodySize ?? 14]}
                  onValueChange={(v) => update({ popupBodySize: v[0] })}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Background color is used when no image is set.</p>

            <div className="rounded border border-border bg-muted/30 p-3 space-y-3">
              <Label className="text-xs font-semibold">Popup audio (optional)</Label>
              <p className="text-[11px] text-muted-foreground">Plays while the popup is open. Stops when closed.</p>
              <div>
                <Label className="text-xs">Audio URL</Label>
                <Input
                  className="mt-1"
                  value={p.popupAudioUrl || ""}
                  onChange={(e) => update({ popupAudioUrl: e.target.value })}
                  placeholder="https://.../sound.mp3"
                />
              </div>
              <AssetUpload
                label="Or upload audio file"
                value={p.popupAudioUrl}
                onChange={(url) => update({ popupAudioUrl: url })}
                accept="audio/*"
                kind="audio"
              />
              {p.popupAudioUrl && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Autoplay</Label>
                    <Switch
                      checked={p.popupAudioAutoplay ?? true}
                      onCheckedChange={(v) => update({ popupAudioAutoplay: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Loop</Label>
                    <Switch
                      checked={p.popupAudioLoop ?? false}
                      onCheckedChange={(v) => update({ popupAudioLoop: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show volume controls to viewers</Label>
                    <Switch
                      checked={p.popupAudioShowControl ?? true}
                      onCheckedChange={(v) => update({ popupAudioShowControl: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Default volume ({Math.round((p.popupAudioVolume ?? 0.8) * 100)}%)</Label>
                    <Slider
                      className="mt-2"
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round((p.popupAudioVolume ?? 0.8) * 100)]}
                      onValueChange={(v) => update({ popupAudioVolume: (v[0] ?? 80) / 100 })}
                    />
                  </div>
                </>
              )}
            </div>
            {depth < 1 && (
              <PopupHotspotsEditor
                depth={depth}
                imageUrl={p.mediaUrl}
                hotspots={p.hotspots || []}
                onChange={(hotspots) => update({ hotspots })}
                onPersist={() => {
                  if (!embedded) {
                    // Commit current draft (with latest hotspots) to parent immediately
                    onChange({
                      id: draft?.id || crypto.randomUUID(),
                      type: type as ActionType,
                      payload: { ...p },
                      ...(draft?.highlight ? { highlight: draft.highlight } : {}),
                    });
                  }
                }}
              />
            )}
            {allowPopupButtons && (
              <PopupButtonsEditor
                depth={depth}
                buttons={p.buttons || []}
                onChange={(buttons) => update({ buttons })}
              />
            )}
            {!allowPopupButtons && depth >= 1 && (
              <p className="text-[11px] text-muted-foreground">Nested popups can't have their own buttons.</p>
            )}
          </>
        )}

        {type === "video" && (
          <div>
            <Label className="text-xs">Video URL (YouTube, Vimeo, mp4)</Label>
            <Input className="mt-1" value={p.videoUrl || ""} onChange={(e) => update({ videoUrl: e.target.value })} />
          </div>
        )}

        {type === "audio" && (
          <>
            <p className="text-[11px] text-muted-foreground">Plays an audio file (mp3, wav, ogg, m4a) when this layer is tapped.</p>
            <div>
              <Label className="text-xs">Audio URL</Label>
              <Input
                className="mt-1"
                value={p.audioUrl || ""}
                onChange={(e) => update({ audioUrl: e.target.value })}
                placeholder="https://.../song.mp3"
              />
            </div>
            <AssetUpload
              label="Or upload audio file"
              value={p.audioUrl}
              onChange={(url) => update({ audioUrl: url })}
              accept="audio/*"
              kind="audio"
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Loop</Label>
              <Switch checked={!!p.audioLoop} onCheckedChange={(v) => update({ audioLoop: v })} />
            </div>
          </>
        )}

        {type === "call" && (
          <div>
            <Label className="text-xs">Phone number</Label>
            <Input className="mt-1" value={p.phone || ""} onChange={(e) => update({ phone: e.target.value })} placeholder="+1..." />
          </div>
        )}

        {type === "sms" && (
          <>
            <div>
              <Label className="text-xs">Phone number</Label>
              <Input className="mt-1" value={p.phone || ""} onChange={(e) => update({ phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Prefilled message</Label>
              <Textarea className="mt-1" rows={2} value={p.message || ""} onChange={(e) => update({ message: e.target.value })} />
            </div>
          </>
        )}

        {type === "form" && (
          <>
            <Label className="text-xs">Fields to collect</Label>
            {(["name", "email", "phone"] as const).map((f) => {
              const enabled = (p.fields || []).includes(f);
              return (
                <div key={f} className="flex items-center gap-2">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(v) => {
                      const set = new Set(p.fields || []);
                      if (v) set.add(f); else set.delete(f);
                      update({ fields: Array.from(set) });
                    }}
                  />
                  <Label className="text-sm capitalize">{f}</Label>
                </div>
              );
            })}
            <div>
              <Label className="text-xs">Success message</Label>
              <Input className="mt-1" value={p.successMessage || ""} onChange={(e) => update({ successMessage: e.target.value })} />
            </div>
          </>
        )}

        {type === "subscribe" && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Collect name + email signups. Subscribers appear in your Subscribers list (top bar) where you can export to Excel/CSV or compose a mass email.
            </p>
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                className="mt-1"
                value={p.subscribeTitle || ""}
                placeholder="Join our list"
                onChange={(e) => update({ subscribeTitle: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={p.subscribeBody || ""}
                placeholder="Get updates straight to your inbox."
                onChange={(e) => update({ subscribeBody: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Button label</Label>
                <Input
                  className="mt-1"
                  value={p.subscribeButtonLabel || ""}
                  placeholder="Subscribe"
                  onChange={(e) => update({ subscribeButtonLabel: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">List name (optional)</Label>
                <Input
                  className="mt-1"
                  value={p.subscribeListName || ""}
                  placeholder="Newsletter"
                  onChange={(e) => update({ subscribeListName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2 rounded border border-border p-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Require name</Label>
                <Switch
                  checked={p.subscribeNameRequired ?? true}
                  onCheckedChange={(v) => update({ subscribeNameRequired: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Also collect phone</Label>
                <Switch
                  checked={!!p.subscribePhoneEnabled}
                  onCheckedChange={(v) => update({ subscribePhoneEnabled: v })}
                />
              </div>
              {p.subscribePhoneEnabled && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Phone required</Label>
                  <Switch
                    checked={!!p.subscribePhoneRequired}
                    onCheckedChange={(v) => update({ subscribePhoneRequired: v })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Success message</Label>
              <Input
                className="mt-1"
                value={p.subscribeSuccessMessage || ""}
                placeholder="You're in! Thanks for subscribing."
              />
            </div>
          </>
        )}

        {type === "book_appointment" && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Viewers pick a time on a calendar and get a confirmation email with a calendar invite. Manage bookings in the flyer Portal.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mode</Label>
                <Select
                  value={p.apptMode || "slots"}
                  onValueChange={(v) => update({ apptMode: v as "slots" | "free" })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slots">Pick from open slots</SelectItem>
                    <SelectItem value="free">Free pick any time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Duration (min)</Label>
                <Select
                  value={String(p.apptDurationMin || 30)}
                  onValueChange={(v) => update({ apptDurationMin: Number(v) })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                className="mt-1"
                value={p.apptTitle || ""}
                placeholder="Consultation call"
                onChange={(e) => update({ apptTitle: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Location (optional)</Label>
              <Input
                className="mt-1"
                value={p.apptLocation || ""}
                placeholder="Zoom / 123 Main St"
                onChange={(e) => update({ apptLocation: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={p.apptDescription || ""}
                onChange={(e) => update({ apptDescription: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Bookable days ahead</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="mt-1"
                  value={p.apptDateRangeDays ?? 30}
                  onChange={(e) => update({ apptDateRangeDays: Number(e.target.value) || 30 })}
                />
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Input
                  className="mt-1"
                  value={p.apptTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={(e) => update({ apptTimezone: e.target.value })}
                />
              </div>
            </div>

            {(p.apptMode || "slots") === "slots" && (
              <div className="space-y-2 rounded border border-border p-2">
                <Label className="text-xs font-semibold">Weekly availability</Label>
                {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((dayName, idx) => {
                  const wa = p.apptWeeklyAvailability || Array.from({ length: 7 }, (_, i) => ({
                    enabled: i >= 1 && i <= 5,
                    startMinute: 9 * 60,
                    endMinute: 17 * 60,
                  }));
                  const day = wa[idx] || { enabled: false, startMinute: 9 * 60, endMinute: 17 * 60 };
                  const setDay = (patch: Partial<typeof day>) => {
                    const next = wa.map((d, i) => (i === idx ? { ...day, ...patch } : d));
                    update({ apptWeeklyAvailability: next });
                  };
                  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                  const fromTime = (s: string) => {
                    const [h, m] = s.split(":").map(Number);
                    return (h || 0) * 60 + (m || 0);
                  };
                  return (
                    <div key={dayName} className="flex items-center gap-2 text-xs">
                      <div className="w-10">{dayName}</div>
                      <Switch checked={day.enabled} onCheckedChange={(v) => setDay({ enabled: v })} />
                      {day.enabled && (
                        <>
                          <Input
                            type="time"
                            className="h-7 w-24 text-xs"
                            value={toTime(day.startMinute)}
                            onChange={(e) => setDay({ startMinute: fromTime(e.target.value) })}
                          />
                          <span>–</span>
                          <Input
                            type="time"
                            className="h-7 w-24 text-xs"
                            value={toTime(day.endMinute)}
                            onChange={(e) => setDay({ endMinute: fromTime(e.target.value) })}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">Buffer (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      className="mt-1"
                      value={p.apptBufferMin ?? 0}
                      onChange={(e) => update({ apptBufferMin: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max per day</Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1"
                      placeholder="No limit"
                      value={p.apptMaxPerDay ?? ""}
                      onChange={(e) => update({ apptMaxPerDay: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded border border-border p-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Collect phone</Label>
                <Switch
                  checked={!!p.apptCollectPhone}
                  onCheckedChange={(v) => update({ apptCollectPhone: v })}
                />
              </div>
              {p.apptCollectPhone && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Phone required</Label>
                  <Switch
                    checked={!!p.apptPhoneRequired}
                    onCheckedChange={(v) => update({ apptPhoneRequired: v })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Add note field</Label>
                <Switch
                  checked={!!p.apptCollectNote}
                  onCheckedChange={(v) => update({ apptCollectNote: v })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Email subject (optional)</Label>
              <Input
                className="mt-1"
                value={p.apptConfirmSubject || ""}
                placeholder="Your appointment is confirmed"
                onChange={(e) => update({ apptConfirmSubject: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Email intro (optional)</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={p.apptConfirmIntro || ""}
                placeholder="Thanks for booking — looking forward to meeting you!"
                onChange={(e) => update({ apptConfirmIntro: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Success message</Label>
              <Input
                className="mt-1"
                value={p.apptSuccessMessage || ""}
                placeholder="You're booked! Check your email for the calendar invite."
                onChange={(e) => update({ apptSuccessMessage: e.target.value })}
              />
            </div>
          </>
        )}


        {type === "navigate" && (
          <div>
            <Label className="text-xs">Go to page</Label>
            <Select value={p.pageId || ""} onValueChange={(v) => update({ pageId: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a page" /></SelectTrigger>
              <SelectContent>
                {pages.map((pg) => (
                  <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === "reveal" && (
          <div>
            <Label className="text-xs">Layers to reveal on this page</Label>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
              {currentPage?.layers.map((l) => {
                const ids = p.targetLayerIds || [];
                const checked = ids.includes(l.id);
                return (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const set = new Set(ids);
                        if (v) set.add(l.id); else set.delete(l.id);
                        update({ targetLayerIds: Array.from(set) });
                      }}
                    />
                    <span className="truncate">{l.content.text || l.content.label || l.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {type === "add_to_calendar" && (
          <>
            <div>
              <Label className="text-xs">Event title</Label>
              <Input className="mt-1" value={p.eventTitle || ""} onChange={(e) => update({ eventTitle: e.target.value })} placeholder="Summer launch party" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={2} value={p.eventDescription || ""} onChange={(e) => update({ eventDescription: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input className="mt-1" value={p.eventLocation || ""} onChange={(e) => update({ eventLocation: e.target.value })} placeholder="123 Main St or Zoom link" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">All-day</Label>
              <Switch checked={!!p.allDay} onCheckedChange={(v) => update({ allDay: v })} />
            </div>
            <div>
              <Label className="text-xs">Starts</Label>
              <Input
                type={p.allDay ? "date" : "datetime-local"}
                className="mt-1"
                value={p.allDay ? (p.startISO ? p.startISO.slice(0, 10) : "") : toLocalInputValue(p.startISO)}
                onChange={(e) =>
                  update({
                    startISO: p.allDay
                      ? (e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : undefined)
                      : fromLocalInputValue(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Ends</Label>
              <Input
                type={p.allDay ? "date" : "datetime-local"}
                className="mt-1"
                value={p.allDay ? (p.endISO ? p.endISO.slice(0, 10) : "") : toLocalInputValue(p.endISO)}
                onChange={(e) =>
                  update({
                    endISO: p.allDay
                      ? (e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : undefined)
                      : fromLocalInputValue(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Behavior on click</Label>
              <Select value={p.calendarMode || "ics"} onValueChange={(v) => update({ calendarMode: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ics">Download .ics file</SelectItem>
                  <SelectItem value="google">Open Google Calendar</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {type === "buy_ticket" && (
          <>
            <p className="text-[11px] text-muted-foreground">Shows your ticket image in a popup with a Buy button that opens your checkout link.</p>
            <AssetUpload label="Ticket image" value={p.ticketImageUrl} onChange={(url) => update({ ticketImageUrl: url })} />
            <div>
              <Label className="text-xs">Checkout URL</Label>
              <Input className="mt-1" value={p.checkoutUrl || ""} onChange={(e) => update({ checkoutUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Buy button label</Label>
              <Input className="mt-1" value={p.ticketCtaLabel || ""} onChange={(e) => update({ ticketCtaLabel: e.target.value })} placeholder="Buy ticket" />
            </div>
            <div>
              <Label className="text-xs">Title (optional)</Label>
              <Input className="mt-1" value={p.title || ""} onChange={(e) => update({ title: e.target.value })} placeholder="Get your ticket" />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea className="mt-1" rows={2} value={p.body || ""} onChange={(e) => update({ body: e.target.value })} />
            </div>
          </>
        )}

        {type === "buy_product" && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Shows your product (image, name, price, description) in a popup with a Buy button that opens your payment link — works with Stripe, PayPal, Venmo, Cash App, or any URL.
            </p>
            <AssetUpload label="Product image (optional)" value={p.productImageUrl} onChange={(url) => update({ productImageUrl: url })} />
            <div>
              <Label className="text-xs">Product name</Label>
              <Input className="mt-1" value={p.productName || ""} onChange={(e) => update({ productName: e.target.value })} placeholder="e.g. Signed poster" />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <div>
                <Label className="text-xs">Price</Label>
                <Input className="mt-1" value={p.productPrice || ""} onChange={(e) => update({ productPrice: e.target.value })} placeholder="25.00" />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Input className="mt-1" value={p.productCurrency || ""} onChange={(e) => update({ productCurrency: e.target.value })} placeholder="USD" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea className="mt-1" rows={2} value={p.productDescription || ""} onChange={(e) => update({ productDescription: e.target.value })} placeholder="Short product details, size, pickup info, etc." />
            </div>
            <div>
              <Label className="text-xs">Payment link</Label>
              <Input className="mt-1" value={p.productPaymentUrl || ""} onChange={(e) => update({ productPaymentUrl: e.target.value })} placeholder="https://buy.stripe.com/... or https://venmo.com/..." />
              <p className="mt-1 text-[11px] text-muted-foreground">Tip: use the "Generate payment link" tool in the toolbar to create a Venmo / Cash App / PayPal link.</p>
            </div>
            <div>
              <Label className="text-xs">Buy button label</Label>
              <Input className="mt-1" value={p.productCtaLabel || ""} onChange={(e) => update({ productCtaLabel: e.target.value })} placeholder="Buy now" />
            </div>
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!p.productCartEnabled}
                onChange={(e) => update({ productCartEnabled: e.target.checked })}
              />
              <span className="text-xs">
                <span className="font-medium">Add to cart instead of direct buy</span>
                <span className="block text-muted-foreground">
                  Viewers can collect multiple products and check out from a single cart. Orders are saved in the Subscribers/Submissions panel — no payment link required.
                </span>
              </span>
            </label>
            {p.productCartEnabled && (
              <p className="text-[11px] text-muted-foreground">
                Tip: open <strong>Checkout</strong> in the top bar to set this flyer's Venmo / Cash App / Apple Cash so buyers can pay you directly when they check out.
              </p>
            )}
          </>
        )}

        {type === "air_messages" && (
          <AirMessagesEditor
            depth={depth}
            bubbles={p.bubbles || []}
            staggerMs={p.bubbleStaggerMs ?? 900}
            startDelayMs={p.bubbleStartDelayMs ?? 0}
            onChange={(bubbles) => update({ bubbles })}
            onStaggerChange={(ms) => update({ bubbleStaggerMs: ms })}
            onStartDelayChange={(ms) => update({ bubbleStartDelayMs: ms })}
            onAddAsLayer={embedded ? undefined : () => {
              const newAction: LayerAction = {
                id: crypto.randomUUID(),
                type: "air_messages",
                payload: {
                  bubbles: [{
                    id: crypto.randomUUID(),
                    text: "",
                    action: null,
                    bgColor: "#1d9bf0",
                    bgColor2: "#0a66c2",
                    textColor: "#ffffff",
                    textCase: "upper",
                    tail: "down",
                    bold: true,
                  }],
                  // Inherit playback config from the source layer so the new bubble
                  // actually appears on its own (it would otherwise sit on a hotspot
                  // with no trigger).
                  autoTrigger: p.autoTrigger !== false,
                  bubbleStartDelayMs: p.bubbleStartDelayMs ?? 0,
                  bubbleStaggerMs: p.bubbleStaggerMs ?? 900,
                },
              };
              addAirBubbleLayer(newAction);
              toast.success("New bubble layer added — drag it to position");
            }}
          />
        )}

        {type === "poll" && (
          <>
            <PollEditor
              question={p.pollQuestion || ""}
              options={p.pollOptions || []}
              multiple={!!p.pollMultiple}
              onChange={(patch) => update(patch)}
            />
            {useEditorStore.getState().flyer?.id && (
              <a
                href={`/analytics/${useEditorStore.getState().flyer!.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                View live results →
              </a>
            )}
          </>
        )}

        {type === "rsvp" && (
          <>
            <p className="text-[11px] text-muted-foreground">Pops up an RSVP form. Submissions are saved and visible in your dashboard.</p>
            <Label className="text-xs">Fields to collect</Label>
            {(["name", "email", "phone"] as const).map((f) => {
              const enabled = (p.rsvpFields || ["name", "email"]).includes(f);
              return (
                <div key={f} className="flex items-center gap-2">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(v) => {
                      const set = new Set(p.rsvpFields || ["name", "email"]);
                      if (v) set.add(f); else set.delete(f);
                      update({ rsvpFields: Array.from(set) });
                    }}
                  />
                  <Label className="text-sm capitalize">{f}</Label>
                </div>
              );
            })}
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.title || ""} onChange={(e) => update({ title: e.target.value })} placeholder="RSVP" />
            </div>
            <div>
              <Label className="text-xs">Success message</Label>
              <Input className="mt-1" value={p.successMessage || ""} onChange={(e) => update({ successMessage: e.target.value })} placeholder="Thanks for your RSVP!" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Offer "Add to calendar" after RSVP</Label>
              <Switch checked={!!p.rsvpAddToCalendar} onCheckedChange={(v) => update({ rsvpAddToCalendar: v })} />
            </div>
            {p.rsvpAddToCalendar && (
              <div className="space-y-2 rounded border border-border p-2">
                <div>
                  <Label className="text-[11px]">Event title</Label>
                  <Input className="mt-1" value={p.eventTitle || ""} onChange={(e) => update({ eventTitle: e.target.value })} />
                </div>
                <div>
                  <Label className="text-[11px]">Starts</Label>
                  <Input
                    type="datetime-local" className="mt-1"
                    value={toLocalInputValue(p.startISO)}
                    onChange={(e) => update({ startISO: fromLocalInputValue(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Ends</Label>
                  <Input
                    type="datetime-local" className="mt-1"
                    value={toLocalInputValue(p.endISO)}
                    onChange={(e) => update({ endISO: fromLocalInputValue(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Location</Label>
                  <Input className="mt-1" value={p.eventLocation || ""} onChange={(e) => update({ eventLocation: e.target.value })} />
                </div>
              </div>
            )}
          </>
        )}

        {type === "checkout" && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Add product details below to open a quantity picker that drops the item into the shopping cart. Leave them blank to simply open a checkout URL.
            </p>

            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2">
              <div className="text-xs font-medium">Product (optional — enables cart)</div>
              <div>
                <Label className="text-xs">Product name</Label>
                <Input className="mt-1" value={p.productName || ""} onChange={(e) => update({ productName: e.target.value, productCartEnabled: true })} placeholder="T-shirt" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Price</Label>
                  <Input className="mt-1" value={p.productPrice || ""} onChange={(e) => update({ productPrice: e.target.value })} placeholder="25" />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input className="mt-1" value={p.productCurrency || ""} onChange={(e) => update({ productCurrency: e.target.value })} placeholder="$" />
                </div>
              </div>
              <AssetUpload label="Product image" value={p.productImageUrl} onChange={(url) => update({ productImageUrl: url })} />
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea className="mt-1" rows={2} value={p.productDescription || ""} onChange={(e) => update({ productDescription: e.target.value })} placeholder="Short description shown in the popup" />
              </div>
              <div>
                <Label className="text-xs">Add-to-cart button label</Label>
                <Input className="mt-1" value={p.productCtaLabel || ""} onChange={(e) => update({ productCtaLabel: e.target.value })} placeholder="Add to cart" />
              </div>
              {!!p.productName && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: open <strong>Checkout</strong> in the top bar to set this flyer's Venmo / Cash App / Apple Cash so buyers can pay you directly.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Checkout URL (used only when no product is set)</Label>
              <Input className="mt-1" value={p.checkoutUrl || ""} onChange={(e) => update({ checkoutUrl: e.target.value })} placeholder="https://buy.stripe.com/..." />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Confirm before opening</Label>
              <Switch checked={!!p.title} onCheckedChange={(v) => update({ title: v ? "Continue to checkout?" : "" })} />
            </div>
            {!!p.title && (
              <div>
                <Label className="text-xs">Confirmation message</Label>
                <Input className="mt-1" value={p.body || ""} onChange={(e) => update({ body: e.target.value })} placeholder="You'll be sent to a secure page." />
              </div>
            )}
          </>
        )}

        {type === "coupon" && (
          <>
            <p className="text-[11px] text-muted-foreground">Show a coupon, optionally locked behind a code.</p>
            <AssetUpload label="Coupon image" value={p.couponImageUrl} onChange={(url) => update({ couponImageUrl: url })} />
            <div>
              <Label className="text-xs">Coupon code (shown to viewer)</Label>
              <Input className="mt-1" value={p.couponCode || ""} onChange={(e) => update({ couponCode: e.target.value })} placeholder="SAVE20" />
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.title || ""} onChange={(e) => update({ title: e.target.value })} placeholder="Your coupon" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={2} value={p.body || ""} onChange={(e) => update({ body: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Require unlock code</Label>
              <Switch checked={!!p.couponUnlock} onCheckedChange={(v) => update({ couponUnlock: v })} />
            </div>
            {p.couponUnlock && (
              <div>
                <Label className="text-xs">Unlock code (viewers must type this)</Label>
                <Input className="mt-1" value={p.couponUnlockCode || ""} onChange={(e) => update({ couponUnlockCode: e.target.value })} placeholder="VIP123" />
              </div>
            )}
            <div>
              <Label className="text-xs">Redeem URL (optional)</Label>
              <Input className="mt-1" value={p.couponRedeemUrl || ""} onChange={(e) => update({ couponRedeemUrl: e.target.value })} placeholder="https://..." />
            </div>
          </>
        )}

        {type === "map" && (
          <>
            <p className="text-[11px] text-muted-foreground">Opens the viewer's maps app (Google Maps, or Apple Maps on iOS) at the address or GPS coordinates you provide.</p>
            <div>
              <Label className="text-xs">Address (recommended)</Label>
              <Input
                className="mt-1"
                value={p.mapAddress || ""}
                onChange={(e) => update({ mapAddress: e.target.value })}
                placeholder="123 Main St, San Francisco, CA"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Latitude (optional)</Label>
                <Input
                  type="number" step="any" className="mt-1"
                  value={typeof p.mapLat === "number" ? p.mapLat : ""}
                  onChange={(e) => update({ mapLat: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="37.7749"
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  type="number" step="any" className="mt-1"
                  value={typeof p.mapLng === "number" ? p.mapLng : ""}
                  onChange={(e) => update({ mapLng: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="-122.4194"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Maps provider</Label>
              <Select value={p.mapProvider || "auto"} onValueChange={(v) => update({ mapProvider: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect (Apple on iOS, Google elsewhere)</SelectItem>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="apple">Apple Maps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {type === "gallery" && (
          <GalleryEditor
            title={p.galleryTitle || ""}
            images={p.galleryImages || []}
            onTitleChange={(v) => update({ galleryTitle: v })}
            onImagesChange={(imgs) => update({ galleryImages: imgs })}
            depth={depth}
          />
        )}

        {type === "survey" && (
          <>
            <p className="text-[11px] text-muted-foreground">Collect multi-question feedback. Responses appear in your dashboard.</p>
            <div>
              <Label className="text-xs">Survey title</Label>
              <Input className="mt-1" value={p.surveyTitle || ""} onChange={(e) => update({ surveyTitle: e.target.value })} placeholder="Quick survey" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={2} value={p.surveyDescription || ""} onChange={(e) => update({ surveyDescription: e.target.value })} />
            </div>
            <Label className="text-xs">Questions</Label>
            {(p.surveyQuestions || []).map((q, idx) => (
              <div key={q.id} className="rounded border border-border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={q.label} onChange={(e) => {
                    const arr = [...(p.surveyQuestions || [])];
                    arr[idx] = { ...q, label: e.target.value };
                    update({ surveyQuestions: arr });
                  }} placeholder="Question text" />
                  <Button size="icon" variant="ghost" onClick={() => {
                    const arr = [...(p.surveyQuestions || [])];
                    arr.splice(idx, 1);
                    update({ surveyQuestions: arr });
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Select value={q.type} onValueChange={(v) => {
                  const arr = [...(p.surveyQuestions || [])];
                  arr[idx] = { ...q, type: v as any };
                  update({ surveyQuestions: arr });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Free text</SelectItem>
                    <SelectItem value="choice">Multiple choice</SelectItem>
                    <SelectItem value="rating">Star rating (1–5)</SelectItem>
                  </SelectContent>
                </Select>
                {q.type === "choice" && (
                  <Textarea rows={2} placeholder="Option per line" value={(q.options || []).join("\n")} onChange={(e) => {
                    const arr = [...(p.surveyQuestions || [])];
                    arr[idx] = { ...q, options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) };
                    update({ surveyQuestions: arr });
                  }} />
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => update({ surveyQuestions: [...(p.surveyQuestions || []), { id: crypto.randomUUID(), label: "", type: "text" }] })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add question
            </Button>
            <div>
              <Label className="text-xs">Thank-you message</Label>
              <Input className="mt-1" value={p.surveySuccessMessage || ""} onChange={(e) => update({ surveySuccessMessage: e.target.value })} placeholder="Thanks for your feedback!" />
            </div>
          </>
        )}

        {type === "testimonial" && (
          <>
            <p className="text-[11px] text-muted-foreground">Visitors leave a star rating + comment. Approve them in your dashboard before they appear publicly.</p>
            <div>
              <Label className="text-xs">Headline</Label>
              <Input className="mt-1" value={p.testimonialTitle || ""} onChange={(e) => update({ testimonialTitle: e.target.value })} placeholder="What people are saying" />
            </div>
            <div>
              <Label className="text-xs">"Leave a review" button label</Label>
              <Input className="mt-1" value={p.testimonialCtaLabel || ""} onChange={(e) => update({ testimonialCtaLabel: e.target.value })} placeholder="Leave a review" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Allow photo upload</Label>
              <Switch checked={!!p.testimonialAllowPhoto} onCheckedChange={(v) => update({ testimonialAllowPhoto: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-approve (skip moderation)</Label>
              <Switch checked={!!p.testimonialAutoApprove} onCheckedChange={(v) => update({ testimonialAutoApprove: v })} />
            </div>
            <div>
              <Label className="text-xs">Thank-you message</Label>
              <Input className="mt-1" value={p.testimonialSuccessMessage || ""} onChange={(e) => update({ testimonialSuccessMessage: e.target.value })} placeholder="Thanks for the kind words!" />
            </div>
          </>
        )}

        {type === "reserve_table" && (
          <>
            <p className="text-[11px] text-muted-foreground">Restaurant table reservations. Bookings appear in your dashboard.</p>
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.reserveTitle || ""} onChange={(e) => update({ reserveTitle: e.target.value })} placeholder="Reserve a table" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Opens at</Label>
                <Input type="time" className="mt-1" value={p.reserveOpenTime || "11:00"} onChange={(e) => update({ reserveOpenTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Closes at</Label>
                <Input type="time" className="mt-1" value={p.reserveCloseTime || "22:00"} onChange={(e) => update({ reserveCloseTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Slot length (min)</Label>
                <Input type="number" min={15} step={15} className="mt-1" value={p.reserveSlotMinutes ?? 30} onChange={(e) => update({ reserveSlotMinutes: parseInt(e.target.value) || 30 })} />
              </div>
              <div>
                <Label className="text-xs">Max party size</Label>
                <Input type="number" min={1} className="mt-1" value={p.reserveMaxParty ?? 8} onChange={(e) => update({ reserveMaxParty: parseInt(e.target.value) || 8 })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Days bookable ahead</Label>
                <Input type="number" min={1} className="mt-1" value={p.reserveDateRangeDays ?? 30} onChange={(e) => update({ reserveDateRangeDays: parseInt(e.target.value) || 30 })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Confirmation message</Label>
              <Input className="mt-1" value={p.reserveSuccessMessage || ""} onChange={(e) => update({ reserveSuccessMessage: e.target.value })} placeholder="Reservation confirmed — see you soon!" />
            </div>
          </>
        )}

        {type === "schedule_consultation" && (
          <>
            <p className="text-[11px] text-muted-foreground">Visitors pick a topic + duration and book a consultation. Bookings appear in your dashboard.</p>
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.consultTitle || ""} onChange={(e) => update({ consultTitle: e.target.value })} placeholder="Schedule a consultation" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={2} value={p.consultDescription || ""} onChange={(e) => update({ consultDescription: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Topics (one per line, optional)</Label>
              <Textarea className="mt-1" rows={3} value={(p.consultTopics || []).join("\n")} onChange={(e) => update({ consultTopics: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} placeholder={"Initial consultation\nFollow-up\nStrategy session"} />
            </div>
            <div>
              <Label className="text-xs">Durations (minutes, comma separated)</Label>
              <Input className="mt-1" value={(p.consultDurations || [15, 30, 60]).join(", ")} onChange={(e) => {
                const arr = e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0);
                update({ consultDurations: arr });
              }} placeholder="15, 30, 60" />
            </div>
            <div>
              <Label className="text-xs">Days bookable ahead</Label>
              <Input type="number" min={1} className="mt-1" value={p.consultDateRangeDays ?? 30} onChange={(e) => update({ consultDateRangeDays: parseInt(e.target.value) || 30 })} />
            </div>
            <div>
              <Label className="text-xs">Confirmation message</Label>
              <Input className="mt-1" value={p.consultSuccessMessage || ""} onChange={(e) => update({ consultSuccessMessage: e.target.value })} placeholder="Consultation booked — confirmation on its way." />
            </div>
          </>
        )}

        {type === "show_menu" && <MenuSectionsEditor action={draft} update={update} />}

        {type === "join_challenge" && (
          <>
            <p className="text-[11px] text-muted-foreground">Visitors join your challenge with name + email. Participants appear in your dashboard.</p>
            <div>
              <Label className="text-xs">Challenge title</Label>
              <Input className="mt-1" value={p.challengeTitle || ""} onChange={(e) => update({ challengeTitle: e.target.value })} placeholder="30-day fitness challenge" />
            </div>
            <div>
              <Label className="text-xs">Description / goal</Label>
              <Textarea className="mt-1" rows={3} value={p.challengeDescription || ""} onChange={(e) => update({ challengeDescription: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Starts</Label>
                <Input type="datetime-local" className="mt-1" value={toLocalInputValue(p.challengeStartISO)} onChange={(e) => update({ challengeStartISO: fromLocalInputValue(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input type="datetime-local" className="mt-1" value={toLocalInputValue(p.challengeEndISO)} onChange={(e) => update({ challengeEndISO: fromLocalInputValue(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Rules (optional)</Label>
              <Textarea className="mt-1" rows={3} value={p.challengeRules || ""} onChange={(e) => update({ challengeRules: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Button label</Label>
              <Input className="mt-1" value={p.challengeCtaLabel || ""} onChange={(e) => update({ challengeCtaLabel: e.target.value })} placeholder="Join the challenge" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Collect phone number</Label>
              <Switch checked={!!p.challengeCollectPhone} onCheckedChange={(v) => update({ challengeCollectPhone: v })} />
            </div>
            <div>
              <Label className="text-xs">Success message</Label>
              <Input className="mt-1" value={p.challengeSuccessMessage || ""} onChange={(e) => update({ challengeSuccessMessage: e.target.value })} placeholder="You're in! Good luck." />
            </div>
          </>
        )}

        {type === "business_rating" && (
          <>
            <p className="text-[11px] text-muted-foreground">Tap-to-rate widget. Shows the average + lets a visitor rate (1–5 stars).</p>
            <div>
              <Label className="text-xs">Prompt</Label>
              <Input className="mt-1" value={p.ratingPrompt || ""} onChange={(e) => update({ ratingPrompt: e.target.value })} placeholder="How would you rate us?" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Allow optional comment</Label>
              <Switch checked={p.ratingAllowComment !== false} onCheckedChange={(v) => update({ ratingAllowComment: v })} />
            </div>
            <div>
              <Label className="text-xs">Thank-you message</Label>
              <Input className="mt-1" value={p.ratingThankYou || ""} onChange={(e) => update({ ratingThankYou: e.target.value })} placeholder="Thanks for your rating!" />
            </div>
          </>
        )}

        {draft && !embedded && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide">Auto-trigger on page load</Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Run this action automatically when the viewer opens the page (instead of waiting for a tap).</p>
              </div>
              <Switch
                checked={!!p.autoTrigger}
                onCheckedChange={(v) => update({ autoTrigger: v })}
              />
            </div>
          </div>
        )}

        {draft && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide">Tap highlight</Label>
              <Switch
                checked={(draft.highlight?.enabled ?? true) && (draft.highlight?.style ?? "pulse") !== "none"}
                onCheckedChange={(v) =>
                  updateHighlight({ enabled: v, style: draft.highlight?.style ?? "pulse" })
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Visual cue shown on the published flyer to indicate this layer is tappable.</p>

            <div>
              <Label className="text-xs">Style</Label>
              <Select
                value={draft.highlight?.style ?? "pulse"}
                onValueChange={(v) => updateHighlight({ style: v as any })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pulse">Pulse ring</SelectItem>
                  <SelectItem value="glow">Glow</SelectItem>
                  <SelectItem value="solid">Solid outline</SelectItem>
                  <SelectItem value="dashed">Dashed outline</SelectItem>
                  <SelectItem value="corners">Corner brackets</SelectItem>
                  <SelectItem value="circle">Circle ring</SelectItem>
                  <SelectItem value="none">None (hidden)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Color</Label>
                <Input
                  type="color"
                  className="mt-1 h-9 w-full"
                  value={draft.highlight?.color ?? "#7c3aed"}
                  onChange={(e) => updateHighlight({ color: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Opacity: {Math.round(((draft.highlight?.opacity ?? 0.85)) * 100)}%</Label>
                <div className="mt-2">
                  <Slider
                    min={10} max={100} step={5}
                    value={[Math.round((draft.highlight?.opacity ?? 0.85) * 100)]}
                    onValueChange={([v]) => updateHighlight({ opacity: v / 100 })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Thickness: {draft.highlight?.thickness ?? 3}px</Label>
              <div className="mt-2">
                <Slider
                  min={1} max={12} step={1}
                  value={[draft.highlight?.thickness ?? 3]}
                  onValueChange={([v]) => updateHighlight({ thickness: v })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {!embedded && (
        <div className="sticky bottom-0 mt-3 -mx-3 border-t border-border bg-card px-3 pt-3">
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            {dirty ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
              </span>
            ) : action ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" /> Action saved
              </span>
            ) : (
              <span className="text-muted-foreground">No action set</span>
            )}
            {dirty && !valid && <span className="text-destructive">Required fields missing</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={save} disabled={!dirty || !valid}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save action
            </Button>
            <Button size="sm" variant="ghost" onClick={discard} disabled={!dirty}>
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Menu sections editor (loads/saves rows in `menus` table) ----
function MenuSectionsEditor({ action, update }: { action: LayerAction | null; update: (p: any) => void }) {
  const p = action?.payload || {};
  const { flyerId } = useParams();
  const [sections, setSections] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const actionId = action?.id;

  useEffect(() => {
    if (!actionId || !flyerId) return;
    (async () => {
      const { data } = await supabase.from("menus").select("sections").eq("action_id", actionId).maybeSingle();
      setSections((data?.sections as any[]) || []);
      setLoaded(true);
    })();
  }, [actionId, flyerId]);

  async function saveMenu(next: any[]) {
    if (!actionId || !flyerId) return;
    setSaving(true);
    await supabase.from("menus").upsert({ flyer_id: flyerId, action_id: actionId, sections: next }, { onConflict: "action_id" });
    setSaving(false);
  }

  function updateSections(next: any[]) {
    setSections(next);
    saveMenu(next);
  }

  return (
    <>
      <p className="text-[11px] text-muted-foreground">Build your menu. Visitors see it as a tap-to-open page right inside the flyer.</p>
      <div>
        <Label className="text-xs">Menu title</Label>
        <Input className="mt-1" value={p.menuTitle || ""} onChange={(e) => update({ menuTitle: e.target.value })} placeholder="Our menu" />
      </div>
      <div>
        <Label className="text-xs">Open button label</Label>
        <Input className="mt-1" value={p.menuCtaLabel || ""} onChange={(e) => update({ menuCtaLabel: e.target.value })} placeholder="Show menu" />
      </div>
      {!loaded ? (
        <p className="text-[11px] text-muted-foreground">Loading menu…</p>
      ) : (
        <>
          <div className="space-y-3">
            {sections.map((sec, sIdx) => (
              <div key={sec.id} className="rounded border border-border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={sec.name} placeholder="Section name (e.g. Starters)" onChange={(e) => {
                    const next = [...sections]; next[sIdx] = { ...sec, name: e.target.value }; updateSections(next);
                  }} />
                  <Button size="icon" variant="ghost" onClick={() => {
                    const next = sections.filter((_, i) => i !== sIdx); updateSections(next);
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                {(sec.items || []).map((it: any, iIdx: number) => (
                  <div key={it.id} className="rounded border border-border/60 p-2 space-y-1 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input value={it.name} placeholder="Item name" onChange={(e) => {
                        const next = [...sections]; next[sIdx] = { ...sec, items: sec.items.map((x: any, j: number) => j === iIdx ? { ...x, name: e.target.value } : x) }; updateSections(next);
                      }} />
                      <Input className="w-20" value={it.price || ""} placeholder="$0" onChange={(e) => {
                        const next = [...sections]; next[sIdx] = { ...sec, items: sec.items.map((x: any, j: number) => j === iIdx ? { ...x, price: e.target.value } : x) }; updateSections(next);
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => {
                        const next = [...sections]; next[sIdx] = { ...sec, items: sec.items.filter((_: any, j: number) => j !== iIdx) }; updateSections(next);
                      }}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Textarea rows={1} value={it.description || ""} placeholder="Description (optional)" onChange={(e) => {
                      const next = [...sections]; next[sIdx] = { ...sec, items: sec.items.map((x: any, j: number) => j === iIdx ? { ...x, description: e.target.value } : x) }; updateSections(next);
                    }} />
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => {
                  const next = [...sections]; next[sIdx] = { ...sec, items: [...(sec.items || []), { id: crypto.randomUUID(), name: "", price: "" }] }; updateSections(next);
                }}><Plus className="mr-1 h-3.5 w-3.5" /> Add item</Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            updateSections([...sections, { id: crypto.randomUUID(), name: "", items: [] }]);
          }}><Plus className="mr-1 h-3.5 w-3.5" /> Add section</Button>
          {saving && <p className="text-[11px] text-muted-foreground">Saving…</p>}
        </>
      )}
    </>
  );
}
