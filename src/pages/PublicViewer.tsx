import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Stage, Layer as KLayer, Rect, Circle, Ellipse, Line, Text, Image as KonvaImage, Group } from "react-konva";
import useImage from "use-image";
import * as LucideIcons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { Flyer, FlyerPage, Layer, LayerAction } from "@/types/flyer";
import { Loader2, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import { toast } from "sonner";

function ImageNode({ layer, props }: { layer: Layer; props: any }) {
  const [img] = useImage(layer.content.src ?? "", "anonymous");
  return <KonvaImage {...props} image={img} cornerRadius={layer.style.cornerRadius} />;
}

function IconNode({ layer, props }: { layer: Layer; props: any }) {
  const dataUrl = useMemo(() => {
    const name = layer.content.iconName || "Star";
    const Icon = (LucideIcons as any)[name] || LucideIcons.Star;
    const color = layer.style.color || "#000";
    const svg = renderToStaticMarkup(<Icon size={256} color={color} strokeWidth={2} />);
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }, [layer.content.iconName, layer.style.color]);
  const [img] = useImage(dataUrl);
  return <KonvaImage {...props} image={img} />;
}

function renderLayer(l: Layer, onClick: () => void, hidden: boolean) {
  if (hidden) return null;
  const hasAction = !!l.action;
  const common: any = {
    x: l.position.x,
    y: l.position.y,
    width: l.size.width,
    height: l.size.height,
    rotation: l.rotation,
    opacity: l.style.opacity ?? 1,
    onClick,
    onTap: onClick,
    onMouseEnter: (e: any) => {
      if (hasAction) {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }
    },
    onMouseLeave: (e: any) => {
      const stage = e.target.getStage();
      if (stage) stage.container().style.cursor = "default";
    },
  };

  switch (l.type) {
    case "text":
      return (
        <Text
          key={l.id}
          {...common}
          text={l.content.text || ""}
          fontFamily={l.style.fontFamily || "Plus Jakarta Sans"}
          fontSize={l.style.fontSize || 24}
          fontStyle={`${l.style.fontStyle === "italic" ? "italic " : ""}${l.style.fontWeight ?? "normal"}`}
          fill={l.style.color || "#000"}
          align={l.style.align || "left"}
        />
      );
    case "image":
      return <ImageNode key={l.id} layer={l} props={common} />;
    case "icon":
      return <IconNode key={l.id} layer={l} props={common} />;
    case "shape":
      if (l.content.shape === "circle") {
        return (
          <Circle
            key={l.id}
            {...common}
            radius={Math.min(l.size.width, l.size.height) / 2}
            offsetX={-l.size.width / 2}
            offsetY={-l.size.height / 2}
            fill={l.style.fill || "#8b5cf6"}
            stroke={l.style.stroke}
            strokeWidth={l.style.strokeWidth}
          />
        );
      }
      if (l.content.shape === "line") {
        return (
          <Line
            key={l.id}
            {...common}
            points={[0, l.size.height / 2, l.size.width, l.size.height / 2]}
            stroke={l.style.fill || "#0f172a"}
            strokeWidth={l.style.strokeWidth || 4}
          />
        );
      }
      return (
        <Rect
          key={l.id}
          {...common}
          fill={l.style.fill || "#8b5cf6"}
          stroke={l.style.stroke}
          strokeWidth={l.style.strokeWidth}
          cornerRadius={l.style.cornerRadius || 0}
        />
      );
    case "button":
      return (
        <Group key={l.id} {...common}>
          <Rect
            width={l.size.width}
            height={l.size.height}
            fill={l.style.fill || "#7c3aed"}
            cornerRadius={l.style.cornerRadius ?? 999}
          />
          <Text
            width={l.size.width}
            height={l.size.height}
            text={l.content.label || "Button"}
            fontFamily={l.style.fontFamily || "Plus Jakarta Sans"}
            fontSize={l.style.fontSize || 16}
            fontStyle={String(l.style.fontWeight ?? "600")}
            fill={l.style.color || "#fff"}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      );
    case "hotspot": {
      // Invisible to viewers — interactive only
      const isEllipse = l.content.hotspotShape === "ellipse";
      if (isEllipse) {
        return (
          <Ellipse
            key={l.id}
            {...common}
            radiusX={l.size.width / 2}
            radiusY={l.size.height / 2}
            offsetX={-l.size.width / 2}
            offsetY={-l.size.height / 2}
            fill="rgba(0,0,0,0.001)"
          />
        );
      }
      return (
        <Rect
          key={l.id}
          {...common}
          fill="rgba(0,0,0,0.001)"
        />
      );
    }
  }
}

interface PublicViewerProps {
  previewMode?: boolean;
}

export default function PublicViewer({ previewMode = false }: PublicViewerProps) {
  const params = useParams();
  const slug = params.slug;
  const flyerId = params.flyerId;
  const [loading, setLoading] = useState(true);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [pages, setPages] = useState<FlyerPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [popup, setPopup] = useState<LayerAction | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [formAction, setFormAction] = useState<LayerAction | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [coupon, setCoupon] = useState<LayerAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<LayerAction | null>(null);

  useEffect(() => {
    if (!slug && !flyerId) return;
    (async () => {
      setLoading(true);
      const query = supabase.from("flyers").select("*");
      const { data: f } = previewMode && flyerId
        ? await query.eq("id", flyerId).maybeSingle()
        : await query.eq("public_slug", slug!).eq("status", "published").maybeSingle();
      if (!f) {
        setLoading(false);
        return;
      }
      const { data: pgs } = await supabase
        .from("pages")
        .select("*, layers(*, actions(*))")
        .eq("flyer_id", f.id)
        .order("index", { ascending: true });

      const mapped: FlyerPage[] = (pgs ?? []).map((p: any) => ({
        id: p.id,
        flyer_id: p.flyer_id,
        index: p.index,
        name: p.name,
        background: p.background ?? { color: "#ffffff" },
        layers: (p.layers ?? [])
          .sort((a: any, b: any) => a.z_index - b.z_index)
          .map((l: any) => ({
            id: l.id,
            page_id: l.page_id,
            type: l.type,
            position: l.position,
            size: l.size,
            rotation: Number(l.rotation) || 0,
            z_index: l.z_index,
            style: l.style ?? {},
            content: l.content ?? {},
            action: l.actions?.[0]
              ? { id: l.actions[0].id, type: l.actions[0].type, payload: l.actions[0].payload }
              : null,
          })),
      }));
      setFlyer(f as unknown as Flyer);
      setPages(mapped);
      setLoading(false);

      // analytics: view (skip in preview mode)
      if (!previewMode) {
        supabase.from("analytics_events").insert([{ flyer_id: f.id, event_type: "view", metadata: {} } as any]);
      }
    })();
  }, [slug, flyerId, previewMode]);

  function logClick(layer: Layer | null, type: string) {
    if (!flyer || previewMode) return;
    supabase.from("analytics_events").insert([{
      flyer_id: flyer.id,
      page_id: layer?.page_id ?? null,
      layer_id: layer?.id ?? null,
      event_type: "click",
      metadata: { action_type: type } as any,
    } as any]);
  }

  function runAction(layer: Layer) {
    if (!layer.action) return;
    logClick(layer, layer.action.type);
    executeAction(layer.action, layer);
  }

  function executeAction(a: LayerAction, layer: Layer | null) {
    switch (a.type) {
      case "open_url":
        if (a.payload.url) window.open(a.payload.url, a.payload.newTab !== false ? "_blank" : "_self", "noopener,noreferrer");
        break;
      case "popup":
        setPopup(a);
        break;
      case "video":
        if (a.payload.videoUrl) setVideo(a.payload.videoUrl);
        break;
      case "call":
        if (a.payload.phone) window.location.href = `tel:${a.payload.phone}`;
        break;
      case "sms":
        if (a.payload.phone) {
          const body = a.payload.message ? `?body=${encodeURIComponent(a.payload.message)}` : "";
          window.location.href = `sms:${a.payload.phone}${body}`;
        }
        break;
      case "form":
        setFormAction(a);
        setFormData({});
        break;
      case "navigate": {
        const idx = pages.findIndex((p) => p.id === a.payload.pageId);
        if (idx >= 0) setPageIndex(idx);
        break;
      }
      case "reveal": {
        const next = new Set(revealed);
        (a.payload.targetLayerIds || []).forEach((id) => next.add(id));
        setRevealed(next);
        break;
      }
      case "add_to_calendar":
        runAddToCalendar(a.payload);
        break;
      case "buy_ticket":
        // Show as popup with ticket image + buy button
        setPopup(a);
        break;
      case "rsvp":
        setFormAction(a);
        setFormData({});
        break;
      case "checkout":
        if (a.payload.title) setConfirmAction(a);
        else if (a.payload.checkoutUrl) window.open(a.payload.checkoutUrl, "_blank", "noopener,noreferrer");
        break;
      case "coupon":
        setCoupon(a);
        break;
    }
  }

  function runPopupButton(a: LayerAction) {
    logClick(null, "popup_button:" + a.type);
    setPopup(null);
    // small delay so the dialog closes before next opens
    setTimeout(() => executeAction(a, null), 50);
  }

  async function submitForm() {
    if (!formAction || !flyer) return;
    const isRsvp = formAction.type === "rsvp";
    const fieldList = (isRsvp ? formAction.payload.rsvpFields : formAction.payload.fields) || [];
    // basic required check
    for (const f of fieldList) {
      if (!formData[f]) {
        toast.error(`Please enter your ${f}`);
        return;
      }
    }
    const { error } = await supabase.from("form_submissions").insert([{
      flyer_id: flyer.id,
      layer_id: null,
      data: { ...formData, _preset: isRsvp ? "rsvp" : "form" } as any,
    }]);
    if (error) {
      toast.error("Could not submit");
      return;
    }
    toast.success(formAction.payload.successMessage || (isRsvp ? "Thanks for your RSVP!" : "Thanks!"));
    const offerCalendar = isRsvp && formAction.payload.rsvpAddToCalendar && formAction.payload.eventTitle && formAction.payload.startISO;
    const calPayload = formAction.payload;
    setFormAction(null);
    if (offerCalendar) {
      setTimeout(() => runAddToCalendar(calPayload), 100);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!flyer || pages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="font-display text-2xl font-bold">Flyer not found</div>
          <p className="mt-2 text-muted-foreground">This flyer may have been unpublished.</p>
        </div>
      </div>
    );
  }

  const page = pages[pageIndex];
  const W = flyer.settings.width;
  const H = flyer.settings.height;
  // Hide layers initially that are referenced by any reveal action and not yet revealed
  const hiddenIds = new Set<string>();
  pages.forEach((p) =>
    p.layers.forEach((l) => {
      if (l.action?.type === "reveal") {
        (l.action.payload.targetLayerIds || []).forEach((id) => {
          if (!revealed.has(id)) hiddenIds.add(id);
        });
      }
    })
  );

  // Fit-to-screen scale
  const maxW = typeof window !== "undefined" ? Math.min(window.innerWidth - 32, W) : W;
  const scale = maxW / W;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {previewMode && (
        <div className="fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-medium shadow-elegant backdrop-blur">
          <span>Preview mode</span>
          <span className="text-muted-foreground">·</span>
          <button
            className={`rounded-full px-2 py-0.5 text-[11px] ${showHitboxes ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setShowHitboxes((v) => !v)}
          >
            {showHitboxes ? "Hide hotspots" : "Show hotspots"}
          </button>
        </div>
      )}
      <div style={{ width: W * scale, height: H * scale, background: page.background.color || "#fff" }} className="shadow-elegant">
        <Stage width={W * scale} height={H * scale} scaleX={scale} scaleY={scale}>
          <KLayer>
            <Rect x={0} y={0} width={W} height={H} fill={page.background.color || "#fff"} listening={false} />
            {[...page.layers]
              .sort((a, b) => a.z_index - b.z_index)
              .map((l) => renderLayer(l, () => runAction(l), hiddenIds.has(l.id)))}
          </KLayer>
          {previewMode && showHitboxes && (
            <KLayer listening={false}>
              {page.layers
                .filter((l) => (l.action || l.type === "hotspot") && !hiddenIds.has(l.id))
                .map((l) => {
                  const isEllipse = l.type === "hotspot" && l.content.hotspotShape === "ellipse";
                  return isEllipse ? (
                    <Ellipse
                      key={"hb-" + l.id}
                      x={l.position.x + l.size.width / 2}
                      y={l.position.y + l.size.height / 2}
                      radiusX={l.size.width / 2}
                      radiusY={l.size.height / 2}
                      stroke="#7c3aed" strokeWidth={2} dash={[8, 5]}
                      fill="rgba(124,58,237,0.15)"
                    />
                  ) : (
                    <Rect
                      key={"hb-" + l.id}
                      x={l.position.x} y={l.position.y}
                      width={l.size.width} height={l.size.height}
                      stroke="#7c3aed" strokeWidth={2} dash={[8, 5]}
                      fill="rgba(124,58,237,0.15)"
                    />
                  );
                })}
            </KLayer>
          )}
        </Stage>
      </div>

      {/* Pagination */}
      {pages.length > 1 && (
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-elegant backdrop-blur">
          <Button variant="ghost" size="sm" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => i - 1)}>Prev</Button>
          <span className="text-xs">{pageIndex + 1} / {pages.length}</span>
          <Button variant="ghost" size="sm" disabled={pageIndex === pages.length - 1} onClick={() => setPageIndex((i) => i + 1)}>Next</Button>
        </div>
      )}

      {/* Popup */}
      <Dialog open={!!popup} onOpenChange={(v) => !v && setPopup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{popup?.payload.title || "Info"}</DialogTitle>
            {popup?.payload.body && <DialogDescription>{popup.payload.body}</DialogDescription>}
          </DialogHeader>
          {popup?.payload.mediaUrl && (
            <img src={popup.payload.mediaUrl} alt="" className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Video */}
      <Dialog open={!!video} onOpenChange={(v) => !v && setVideo(null)}>
        <DialogContent className="max-w-3xl">
          {video && (
            <div className="aspect-video w-full">
              {/youtube\.com|youtu\.be|vimeo\.com/.test(video) ? (
                <iframe
                  src={video.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="h-full w-full rounded"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <video src={video} controls autoPlay className="h-full w-full rounded" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form */}
      <Dialog open={!!formAction} onOpenChange={(v) => !v && setFormAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get in touch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(formAction?.payload.fields || []).map((f) => (
              <div key={f}>
                <Label className="text-xs capitalize">{f}</Label>
                <Input
                  type={f === "email" ? "email" : "text"}
                  value={formData[f] || ""}
                  onChange={(e) => setFormData((d) => ({ ...d, [f]: e.target.value }))}
                />
              </div>
            ))}
            <Button onClick={submitForm} className="w-full">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
