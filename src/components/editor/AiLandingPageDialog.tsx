import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ActionType, LayerAction } from "@/types/flyer";
import { ensureUuid } from "@/lib/safeBrowser";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CTA_PRESETS = ["Shop now", "Pre-order", "Order now", "Book now"];

export function AiLandingPageDialog({ open, onOpenChange }: Props) {
  const flyer = useEditorStore((s) => s.flyer);
  const pages = useEditorStore((s) => s.pages);
  const addAiLandingPage = useEditorStore((s) => s.addAiLandingPage);
  const addPage = useEditorStore((s) => s.addPage);
  const selectPage = useEditorStore((s) => s.selectPage);

  const [ctaLabel, setCtaLabel] = useState("Shop now");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // A flyer counts as "designed" when at least one non-landing page has real content.
  const designPages = pages.filter((p) => !p.background?.linkPageId && p.name !== "Landing page");
  const hasContent = designPages.some((p) =>
    p.layers.some((l) => (l.type === "text" && !!l.content?.text?.trim()) || (l.type === "image" && !!l.content?.src))
  );

  /** Pick the built-in order/checkout action that best fits what the flyer already has. */
  function buildCtaAction(): { action: LayerAction; hint: string | null } {
    const settings = (flyer?.settings ?? {}) as Record<string, unknown>;
    const menuCatalog = settings.menuCatalog as { sections?: unknown[] } | undefined;
    const existing = pages.flatMap((p) => p.layers.map((l) => l.action)).filter(Boolean) as LayerAction[];

    let type: ActionType = "checkout";
    let payload: Record<string, unknown> = {};
    let hint: string | null = null;

    if (menuCatalog?.sections?.length) {
      type = "show_menu";
    } else {
      const shopLike = existing.find((a) => a.type === "product_grid" || a.type === "buy_product");
      if (shopLike) {
        type = shopLike.type;
        payload = { ...(shopLike.payload as Record<string, unknown>) };
      } else {
        hint = "No shop or menu is set up yet — open the button's action panel to finish payment setup.";
      }
    }

    return {
      action: { id: ensureUuid(), type, payload: payload as LayerAction["payload"] },
      hint,
    };
  }

  async function handleGenerate() {
    if (!flyer) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("landing-page-generate", {
        body: { flyer_id: flyer.id, cta_label: ctaLabel.trim(), notes: notes.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const spec = data?.spec as {
        headline: string;
        subheadline: string;
        bullets: string[];
        ctaLabel: string;
        footerLine: string;
        accentColor: string;
        heroImage: string | null;
      } | undefined;
      if (!spec) throw new Error("AI returned no landing page content");

      const { action, hint } = buildCtaAction();
      addAiLandingPage({
        headline: spec.headline,
        subheadline: spec.subheadline,
        bullets: Array.isArray(spec.bullets) ? spec.bullets : [],
        ctaLabel: ctaLabel.trim() || spec.ctaLabel,
        footerLine: spec.footerLine,
        accentColor: spec.accentColor,
        heroImage: spec.heroImage,
        ctaAction: action,
      });
      toast.success("Landing page created — edit any element on the canvas.");
      if (hint) toast.message(hint);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the landing page");
    } finally {
      setBusy(false);
    }
  }

  if (!hasContent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Design your flyer first</DialogTitle>
            <DialogDescription>
              The AI builds the landing page from your flyer's content. Add your artwork, text and offer to a flyer
              page, then come back to generate the landing page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (designPages[0]) selectPage(designPages[0].id);
                else addPage();
                onOpenChange(false);
              }}
            >
              Design a flyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI landing page
          </DialogTitle>
          <DialogDescription>
            Builds a landing page from this flyer's content and your business profile, with a built-in
            order/checkout button.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cta-label">Button text</Label>
            <Input
              id="cta-label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={22}
              placeholder="Shop now"
            />
            <div className="flex flex-wrap gap-1.5">
              {CTA_PRESETS.map((p) => (
                <Button key={p} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCtaLabel(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="landing-notes">Anything the AI should know? (optional)</Label>
            <Textarea
              id="landing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Launch date, audience, tone…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {busy ? "Generating…" : "Generate landing page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
