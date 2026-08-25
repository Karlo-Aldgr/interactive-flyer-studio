import { Link, Navigate, useParams } from "react-router-dom";
import { useFlyerData } from "@/hooks/useFlyerData";
import { TopBar } from "@/components/editor/TopBar";
import { Toolbar } from "@/components/editor/Toolbar";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PagesPanel } from "@/components/editor/PagesPanel";
import { Loader2 } from "lucide-react";
import { useCanEdit } from "@/hooks/useCanEdit";
import { Button } from "@/components/ui/button";

export default function Editor() {
  const { flyerId } = useParams();
  const { canEdit, loading: accessLoading } = useCanEdit();
  const { loading, loadError, saving, saveNow, flyer } = useFlyerData(flyerId);

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

  if (loadError || !flyer) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="font-display text-lg font-semibold text-foreground">Could not open this flyer</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {loadError || "The editor did not receive flyer data. Try again or return to your dashboard."}
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
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
