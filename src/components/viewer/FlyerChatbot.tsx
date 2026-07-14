import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { cn } from "@/lib/utils";

type ChatTurn = { role: "user" | "assistant"; content: string };

interface Props {
  flyerId: string;
  flyerTitle: string;
}

export function FlyerChatbot({ flyerId, flyerTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: `Hi! Ask me anything about “${flyerTitle || "this flyer"}”.`,
    },
  ]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open, busy]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setError(null);
    const history = turns.filter((t) => t.role === "user" || t.role === "assistant").slice(-6);
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setBusy(true);
    try {
      const data = await invokeEdgeFunction<{ reply: string }>("flyer-chat", {
        flyer_id: flyerId,
        message,
        history,
      });
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      setError(msg);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — I couldn’t answer right now. Try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-24 left-4 z-50">
      {open ? (
        <div className="flex h-[min(420px,70vh)] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-primary" />
              Flyer assistant
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {turns.map((t, i) => (
              <div
                key={`${t.role}-${i}`}
                className={cn(
                  "max-w-[90%] rounded-lg px-2.5 py-1.5",
                  t.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {t.content}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div ref={bottomRef} />
          </div>
          <form
            className="flex gap-2 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              maxLength={500}
              disabled={busy}
              className="h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          className="h-11 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Ask AI
        </Button>
      )}
    </div>
  );
}
