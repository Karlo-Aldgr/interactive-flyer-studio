import { useParams } from "react-router-dom";
import { useFlyerData } from "@/hooks/useFlyerData";
import { TopBar } from "@/components/editor/TopBar";
import { Toolbar } from "@/components/editor/Toolbar";
import { Canvas } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PagesPanel } from "@/components/editor/PagesPanel";
import { Loader2 } from "lucide-react";

export default function Editor() {
  const { flyerId } = useParams();
  const { loading, saving } = useFlyerData(flyerId);

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
      <TopBar saving={saving} />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <aside className="flex w-60 flex-col border-r border-border bg-card overflow-y-auto">
          <PagesPanel />
          <LayersPanel />
        </aside>
        <main className="flex-1 overflow-hidden">
          <Canvas />
        </main>
        <aside className="w-72 border-l border-border bg-card">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
