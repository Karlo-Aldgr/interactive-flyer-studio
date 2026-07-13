import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { LayerAction, PollOption } from "@/types/flyer";

interface PollMeta {
  actionId: string;
  pageName: string;
  question: string;
  options: PollOption[];
  multiple: boolean;
}

interface VoteRow {
  action_id: string;
  option_id: string;
  session_id: string;
  created_at: string;
}

export default function Analytics() {
  const { flyerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [flyerTitle, setFlyerTitle] = useState("");
  const [polls, setPolls] = useState<PollMeta[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);

  const isValidId = !!flyerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flyerId);

  useEffect(() => {
    if (!flyerId) return;
    if (!isValidId) {
      toast.error("Invalid flyer link");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: flyer, error: fErr } = await supabase
        .from("flyers")
        .select("id, title, pages:pages(id, name, layers:layers(id, actions:actions(id, type, payload)))")
        .eq("id", flyerId)
        .maybeSingle();
      if (cancelled) return;
      if (fErr || !flyer) {
        toast.error(fErr?.message || "Flyer not found");
        setLoading(false);
        return;
      }
      setFlyerTitle(flyer.title);


      const found: PollMeta[] = [];
      for (const page of (flyer as any).pages || []) {
        for (const layer of page.layers || []) {
          for (const a of layer.actions || []) {
            if (a.type === "poll") {
              const p = (a.payload || {}) as LayerAction["payload"];
              found.push({
                actionId: a.id,
                pageName: page.name,
                question: p.pollQuestion || "Untitled poll",
                options: p.pollOptions || [],
                multiple: !!p.pollMultiple,
              });
            }
          }
        }
      }
      setPolls(found);

      if (found.length) {
        const { data: voteRows } = await supabase
          .from("poll_votes")
          .select("action_id, option_id, session_id, created_at")
          .in("action_id", found.map((p) => p.actionId));
        if (!cancelled) setVotes((voteRows as VoteRow[]) || []);
      } else {
        setVotes([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [flyerId]);

  // Realtime: append any new votes for this flyer
  useEffect(() => {
    if (!flyerId) return;
    const channel = supabase
      .channel(`flyer-votes-${flyerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes", filter: `flyer_id=eq.${flyerId}` },
        (payload: any) => {
          const row = payload.new as VoteRow;
          setVotes((v) => [...v, row]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [flyerId]);

  const votesByAction = useMemo(() => {
    const m = new Map<string, VoteRow[]>();
    for (const v of votes) {
      const arr = m.get(v.action_id) || [];
      arr.push(v);
      m.set(v.action_id, arr);
    }
    return m;
  }, [votes]);

  function exportCsv(poll: PollMeta) {
    const rows = votesByAction.get(poll.actionId) || [];
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.option_id] = (counts[r.option_id] || 0) + 1; });
    const total = rows.length;
    const lines = ["option,votes,percentage"];
    poll.options.forEach((o) => {
      const c = counts[o.id] || 0;
      const pct = total ? ((c / total) * 100).toFixed(1) : "0.0";
      const safe = `"${(o.label || "Unnamed").replace(/"/g, '""')}"`;
      lines.push(`${safe},${c},${pct}%`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poll-${poll.question.slice(0, 30).replace(/[^a-z0-9]+/gi, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/editor/${flyerId}`}><ChevronLeft className="mr-1 h-4 w-4" />Back to editor</Link>
        </Button>
        <div className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" />
          Poll results
        </div>
        {flyerTitle && <span className="text-sm text-muted-foreground">— {flyerTitle}</span>}
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {isValidId && (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Full performance & suggestions</p>
            <p className="mt-1">
              Views, clicks, traffic sources, and improvement suggestions live in the flyer portal.
            </p>
            <Button asChild size="sm" className="mt-3" variant="secondary">
              <Link to={`/flyer/${flyerId}/portal`}>Open flyer portal</Link>
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : polls.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="font-display text-lg font-semibold">No polls yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a Poll action to a layer in the editor and results will appear here in real time.
            </p>
          </div>
        ) : (
          polls.map((poll) => {
            const rows = votesByAction.get(poll.actionId) || [];
            const counts: Record<string, number> = {};
            rows.forEach((r) => { counts[r.option_id] = (counts[r.option_id] || 0) + 1; });
            const total = rows.length;
            const uniqueVoters = new Set(rows.map((r) => r.session_id)).size;
            const sortedOptions = [...poll.options].sort(
              (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0),
            );
            return (
              <section key={poll.actionId} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{poll.pageName}</div>
                    <h2 className="mt-1 font-display text-xl font-semibold leading-tight">{poll.question}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{total} {total === 1 ? "vote" : "votes"}</span>
                      <span>•</span>
                      <span>{uniqueVoters} {uniqueVoters === 1 ? "voter" : "voters"}</span>
                      {poll.multiple && <Badge variant="secondary" className="ml-1">Multiple choice</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportCsv(poll)} disabled={!total}>
                    <Download className="mr-1 h-3.5 w-3.5" /> CSV
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {sortedOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground">This poll has no options.</p>
                  )}
                  {sortedOptions.map((o) => {
                    const c = counts[o.id] || 0;
                    const pct = total ? (c / total) * 100 : 0;
                    return (
                      <div key={o.id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{o.label || "Unnamed option"}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {c} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {total === 0 && (
                    <p className="pt-2 text-xs text-muted-foreground">
                      No votes yet — share your published flyer to start collecting responses.
                    </p>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
