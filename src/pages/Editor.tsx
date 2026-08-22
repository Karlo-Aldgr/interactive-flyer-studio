import { Navigate, useParams } from "react-router-dom";
import { useFlyerData } from "@/hooks/useFlyerData";
import { TopBar } from "@/components/editor/TopBar";
import { Toolbar } from "@/components/editor/Toolbar";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PagesPanel } from "@/components/editor/PagesPanel";
import { Loader2 } from "lucide-react";
import { useCanEdit } from "@/hooks/useCanEdit";

export default function Editor() {
  const { flyerId } = useParams();
  const { canEdit, loading: accessLoading } = useCanEdit();
  const { loading, saving, saveNow } = useFlyerData(flyerId);

  if (accessLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!canEdit) return <Navigate to="/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="font-display text-lg font-semibold text-foreground animate-pulse">
          We Are Loading Your Experience
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopBar saving={saving} onSave={saveNow} />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card overflow-y-auto">
          <PagesPanel />
          <LayersPanel />
        </aside>
        <main className="flex-1 overflow-hidden min-w-0">
          <Canvas />
        </main>
        <aside className="hidden md:block w-72 border-l border-border bg-card">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
