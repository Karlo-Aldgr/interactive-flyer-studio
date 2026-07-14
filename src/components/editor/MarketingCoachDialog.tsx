import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { cn } from "@/lib/utils";

type ScoreKey = "headline" | "cta" | "readability" | "contrast" | "audience" | "conversion";

type CoachScore = { score: number; tip: string };

type CoachResult = {
  overall: number;
  summary: string;
  scores: Record<ScoreKey, CoachScore>;
  recommendations: string[];
  meta?: { text_layers?: number; actions?: number; status?: string };
};

const SCORE_LABELS: Record<ScoreKey, string> = {
  headline: "Headline strength",
  cta: "Call to action",
  readability: "Readability",
  contrast: "Color / contrast",
  audience: "Audience targeting",
  conversion: "Conversion likelihood",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyerId: string;
  flyerTitle: string;
}

function overallTone(score: number): "destructive" | "secondary" | "outline" | "default" {
  if (score >= 75) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
}

export function MarketingCoachDialog({ open, onOpenChange, flyerId, flyerTitle }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);

  async function runCoach() {
    setBusy(true);
    try {
      const data = await invokeEdgeFunction<CoachResult>("flyer-coach", { flyer_id: flyerId });
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Coach failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setResult(null);
    void runCoach();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per open
  }, [open, flyerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Marketing Coach
          </DialogTitle>
          <DialogDescription>
            Scores <span className="font-medium text-foreground">{flyerTitle}</span> on headline, CTA,
            readability, and conversion likelihood — then gives fixes before you promote it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {busy && !result ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing flyer…
            </div>
          ) : null}

          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={overallTone(result.overall)} className="text-sm">
                  Overall {result.overall}/100
                </Badge>
                {typeof result.meta?.actions === "number" ? (
                  <span className="text-xs text-muted-foreground">
                    {result.meta.actions} interactive action{result.meta.actions === 1 ? "" : "s"}
                    {typeof result.meta.text_layers === "number"
                      ? ` · ${result.meta.text_layers} text layer${result.meta.text_layers === 1 ? "" : "s"}`
                      : ""}
                  </span>
                ) : null}
              </div>

              {result.summary ? (
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              ) : null}

              <div className="space-y-2">
                {(Object.keys(SCORE_LABELS) as ScoreKey[]).map((key) => {
                  const row = result.scores?.[key];
                  if (!row) return null;
                  return (
                    <div key={key} className="rounded-md border border-border/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                        <span>{SCORE_LABELS[key]}</span>
                        <span
                          className={cn(
                            "tabular-nums",
                            row.score >= 7 ? "text-foreground" : row.score >= 4 ? "text-amber-600" : "text-destructive",
                          )}
                        >
                          {row.score}/10
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{row.tip}</p>
                    </div>
                  );
                })}
              </div>

              {result.recommendations?.length ? (
                <div>
                  <p className="mb-1 text-sm font-medium">Top fixes</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.recommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button type="button" onClick={() => void runCoach()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-run coach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
