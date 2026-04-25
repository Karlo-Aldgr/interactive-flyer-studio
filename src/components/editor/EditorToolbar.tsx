import { ArrowLeft, Grid3x3, Magnet, Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";

interface Props {
  onSave: () => void;
  saving?: boolean;
  flyerId: string;
}

export function EditorToolbar({ onSave, saving, flyerId }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const history = useEditorStore((s) => s.history);
  const future = useEditorStore((s) => s.future);
  const navigate = useNavigate();

  return (
    <div className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="font-display font-semibold">{flyer?.title ?? "Untitled"}</div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={undo} disabled={history.length === 0}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={future.length === 0}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <Toggle pressed={showGrid} onPressedChange={toggleGrid} aria-label="Toggle grid">
          <Grid3x3 className="h-4 w-4" />
        </Toggle>
        <Toggle pressed={snapToGrid} onPressedChange={toggleSnap} aria-label="Snap to grid">
          <Magnet className="h-4 w-4" />
        </Toggle>
        <div className="mx-2 h-6 w-px bg-border" />
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom - 0.1)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom + 0.1)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Link to={`/analytics/${flyerId}`} className="text-sm text-muted-foreground hover:text-foreground">
          Analytics
        </Link>
        <Button onClick={onSave} disabled={saving} className="gradient-hero text-white">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
