import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ChatTurn = { role: "user" | "assistant"; content: string };
type Lead = { name: string; email: string; phone?: string };

interface Props {
  flyerId: string;
  flyerTitle: string;
}

function leadStorageKey(flyerId: string) {
  return `flyer_chat_lead_${flyerId}`;
}

function loadLead(flyerId: string): Lead | null {
  try {
    const raw = localStorage.getItem(leadStorageKey(flyerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Lead;
    if (parsed?.name?.trim() && parsed?.email?.trim()) {
      return {
        name: parsed.name.trim(),
        email: parsed.email.trim().toLowerCase(),
        phone: parsed.phone?.trim() || undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveLead(flyerId: string, lead: Lead) {
  try {
    localStorage.setItem(leadStorageKey(flyerId), JSON.stringify(lead));
  } catch {
    /* ignore */
  }
}

const INTRO =
  "Hi — I’m your information assistant for this flyer. Before I answer questions, please share your name and email (phone optional).";

export function FlyerChatbot({ flyerId, flyerTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(() => loadLead(flyerId));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: "assistant", content: INTRO },
  ]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLead(loadLead(flyerId));
  }, [flyerId]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open, busy, lead]);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim().toLowerCase();
    const ph = phone.trim().slice(0, 40);
    if (!n) {
      setError("Please enter your name");
      return;
    }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("Please enter a valid email");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: insertErr } = await supabase.from("subscribers").insert([{
        flyer_id: flyerId,
        name: n.slice(0, 200),
        email: em.slice(0, 320),
        phone: ph || null,
        list_name: "AI Chatbot",
        source: "chatbot",
      }]);
      if (insertErr && (insertErr as { code?: string }).code !== "23505") {
        console.error("[chatbot lead]", insertErr);
        // Still allow chat if duplicate or soft failure — edge also records lead
      }
      const next = { name: n, email: em, phone: ph || undefined };
      saveLead(flyerId, next);
      setLead(next);
      setTurns([
        { role: "assistant", content: INTRO },
        {
          role: "assistant",
          content: `Thanks, ${n}! Ask me anything about “${flyerTitle || "this flyer"}”.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const message = input.trim();
    if (!message || busy || !lead) return;
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
        visitor_name: lead.name,
        visitor_email: lead.email,
      });
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Chat failed";
      const msg =
        /failed to fetch|networkerror|load failed/i.test(raw)
          ? "Chat service unreachable — redeploy the flyer-chat edge function in Lovable/Supabase."
          : raw;
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
              Information assistant
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!lead ? (
            <form className="flex flex-1 flex-col gap-3 overflow-y-auto p-3" onSubmit={(e) => void submitLead(e)}>
              <p className="text-sm text-muted-foreground">{INTRO}</p>
              <div className="space-y-1">
                <Label htmlFor="chat-lead-name" className="text-xs">Name</Label>
                <Input
                  id="chat-lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={200}
                  disabled={busy}
                  className="h-9"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chat-lead-email" className="text-xs">Email</Label>
                <Input
                  id="chat-lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  maxLength={320}
                  disabled={busy}
                  className="h-9"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chat-lead-phone" className="text-xs">Phone (optional)</Label>
                <Input
                  id="chat-lead-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63…"
                  maxLength={40}
                  disabled={busy}
                  className="h-9"
                  autoComplete="tel"
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button type="submit" className="mt-auto" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
            </form>
          ) : (
            <>
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
            </>
          )}
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
