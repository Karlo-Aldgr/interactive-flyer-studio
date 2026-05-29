import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LayerAction } from "@/types/flyer";

interface Props {
  action: LayerAction | null;
  flyerId: string | null;
  sessionId: string;
  onClose: () => void;
}

function StarRow({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="transition-transform hover:scale-110">
          <Star
            style={{ width: size, height: size }}
            className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
}

export default function NewInteractionDialogs({ action, flyerId, sessionId, onClose }: Props) {
  if (!action || !flyerId) return null;
  const type = action.type;

  if (type === "survey") return <SurveyDialog action={action} flyerId={flyerId} sessionId={sessionId} onClose={onClose} />;
  if (type === "testimonial") return <TestimonialDialog action={action} flyerId={flyerId} onClose={onClose} />;
  if (type === "reserve_table") return <ReserveDialog action={action} flyerId={flyerId} onClose={onClose} />;
  if (type === "schedule_consultation") return <ConsultDialog action={action} flyerId={flyerId} onClose={onClose} />;
  if (type === "show_menu") return <MenuDialog action={action} flyerId={flyerId} onClose={onClose} />;
  if (type === "join_challenge") return <ChallengeDialog action={action} flyerId={flyerId} onClose={onClose} />;
  if (type === "business_rating") return <RatingDialog action={action} flyerId={flyerId} sessionId={sessionId} onClose={onClose} />;
  return null;
}

// ---- Survey ----
function SurveyDialog({ action, flyerId, sessionId, onClose }: { action: LayerAction; flyerId: string; sessionId: string; onClose: () => void }) {
  const p = action.payload;
  const questions = p.surveyQuestions || [];
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    for (const q of questions) {
      if (q.required && !answers[q.id]) return toast.error(`Please answer: ${q.label}`);
    }
    setSubmitting(true);
    const { error } = await supabase.from("survey_responses").insert([{ flyer_id: flyerId, action_id: action.id, session_id: sessionId, answers }]);
    setSubmitting(false);
    if (error) return toast.error("Could not submit");
    toast.success(p.surveySuccessMessage || "Thanks for your feedback!");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.surveyTitle || "Survey"}</DialogTitle></DialogHeader>
        {p.surveyDescription && <p className="text-sm text-muted-foreground">{p.surveyDescription}</p>}
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm">{q.label}{q.required && <span className="text-destructive"> *</span>}</Label>
              {q.type === "text" && (
                <Textarea rows={2} value={answers[q.id] || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
              {q.type === "choice" && (
                <Select value={answers[q.id] || ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {(q.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {q.type === "rating" && (
                <StarRow value={answers[q.id] || 0} onChange={(n) => setAnswers({ ...answers, [q.id]: n })} />
              )}
            </div>
          ))}
        </div>
        <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
      </DialogContent>
    </Dialog>
  );
}

// ---- Testimonials ----
function TestimonialDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const [items, setItems] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "form">("list");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("testimonials").select("*").eq("flyer_id", flyerId).eq("status", "approved").order("created_at", { ascending: false }).limit(20);
      setItems(data || []);
    })();
  }, [flyerId]);

  async function submit() {
    if (!name.trim()) return toast.error("Please enter your name");
    if (!body.trim()) return toast.error("Please enter a review");
    setSubmitting(true);
    const status = p.testimonialAutoApprove ? "approved" : "pending";
    // RLS only allows status='pending' on insert from anon. For auto-approve, insert pending; owner approves separately.
    const { error } = await supabase.from("testimonials").insert([{ flyer_id: flyerId, action_id: action.id, name: name.trim(), rating, body: body.trim(), status: "pending" }]);
    setSubmitting(false);
    if (error) return toast.error("Could not submit");
    toast.success(p.testimonialSuccessMessage || "Thanks! Your review will appear after approval.");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.testimonialTitle || "Reviews"}</DialogTitle></DialogHeader>
        {view === "list" ? (
          <>
            <div className="space-y-3">
              {items.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet — be the first!</p>}
              {items.map((t) => (
                <div key={t.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{t.name || "Anonymous"}</div>
                    <div className="flex">{Array.from({ length: t.rating || 0 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}</div>
                  </div>
                  {t.body && <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>}
                </div>
              ))}
            </div>
            <Button onClick={() => setView("form")}>{p.testimonialCtaLabel || "Leave a review"}</Button>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Your name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label className="text-xs">Rating</Label>
              <div className="mt-1"><StarRow value={rating} onChange={setRating} /></div>
            </div>
            <div>
              <Label className="text-xs">Review</Label>
              <Textarea className="mt-1" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
            </div>
            <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Reserve table ----
function ReserveDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [party, setParty] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => {
    const open = p.reserveOpenTime || "11:00";
    const close = p.reserveCloseTime || "22:00";
    const step = p.reserveSlotMinutes || 30;
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    const startMin = oh * 60 + om;
    const endMin = ch * 60 + cm;
    const out: string[] = [];
    for (let m = startMin; m <= endMin - step; m += step) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return out;
  }, [p.reserveOpenTime, p.reserveCloseTime, p.reserveSlotMinutes]);

  async function submit() {
    if (!name.trim()) return toast.error("Please enter your name");
    if (!email.trim() && !phone.trim()) return toast.error("Please provide email or phone");
    if (!time) return toast.error("Please pick a time");
    setSubmitting(true);
    const reserveAt = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("table_reservations").insert([{
      flyer_id: flyerId, action_id: action.id, reserve_at: reserveAt,
      party_size: party, name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null,
    }]);
    setSubmitting(false);
    if (error) return toast.error("Could not submit reservation");
    toast.success(p.reserveSuccessMessage || "Reservation confirmed — see you soon!");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.reserveTitle || "Reserve a table"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" className="mt-1" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Party size</Label>
              <Input type="number" min={1} max={p.reserveMaxParty || 20} className="mt-1" value={party} onChange={(e) => setParty(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Time</Label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {slots.map((s) => (
                <button key={s} type="button" onClick={() => setTime(s)} className={`rounded px-2 py-1 text-xs border ${time === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input type="tel" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Special requests (optional)</Label>
            <Textarea rows={2} className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reserve"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Consultation ----
function ConsultDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState((p.consultDurations || [30])[0]);
  const [topic, setTopic] = useState((p.consultTopics || [])[0] || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (p.consultDateRangeDays || 30));
    return d.toISOString().slice(0, 10);
  }, [p.consultDateRangeDays]);

  async function submit() {
    if (!name.trim() || !email.trim()) return toast.error("Name and email are required");
    setSubmitting(true);
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + duration * 60000);
    const { error } = await supabase.from("appointments").insert([{
      flyer_id: flyerId, action_id: action.id,
      start_at: startAt.toISOString(), end_at: endAt.toISOString(),
      name: name.trim(), email: email.trim(), phone: phone.trim() || null, note: note.trim() || null,
      metadata: { kind: "consultation", topic, duration_min: duration },
    }]);
    setSubmitting(false);
    if (error) return toast.error("Could not book");
    toast.success(p.consultSuccessMessage || "Consultation booked!");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.consultTitle || "Schedule consultation"}</DialogTitle></DialogHeader>
        {p.consultDescription && <p className="text-sm text-muted-foreground">{p.consultDescription}</p>}
        <div className="space-y-3">
          {(p.consultTopics && p.consultTopics.length > 0) && (
            <div>
              <Label className="text-xs">Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{p.consultTopics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Duration</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{(p.consultDurations || [30]).map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" className="mt-1" min={today} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input type="time" className="mt-1" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input type="tel" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book consultation"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Menu viewer with ordering + upsell (uses shared cart store) ----
type MenuItem = { id: string; name: string; description?: string; price: number; category?: string; color?: string; upsell?: boolean };

import { useMenuCart } from "@/store/menuCartStore";

export function MenuCartUI({
  flyerId,
  actionId,
  sections,
  currency = "$",
  title = "Menu",
  checkoutMode = "order_only",
  paymentLink,
  loading = false,
}: {
  flyerId: string;
  actionId?: string | null;
  sections: any[];
  currency?: string;
  title?: string;
  checkoutMode?: "order_only" | "payment";
  paymentLink?: string;
  loading?: boolean;
}) {
  const { cart, open, view, add, removeAt, clear, setOpen, setView } = useMenuCart();
  const [pickerCategory, setPickerCategory] = useState<"side" | "drink">("side");
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [notes, setNotes] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "order_ahead">("dine_in");
  const [pickupAt, setPickupAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waiterName, setWaiterName] = useState<string | null>(null);

  useEffect(() => {
    if (!tableNumber.trim()) { setWaiterName(null); return; }
    let cancelled = false;
    (async () => {
      const { data: assign } = await supabase
        .from("table_assignments").select("waiter_id")
        .eq("flyer_id", flyerId).eq("table_number", tableNumber.trim()).maybeSingle();
      if (cancelled || !assign?.waiter_id) { setWaiterName(null); return; }
      const { data: w } = await (supabase as any).from("waiters_public").select("name").eq("id", assign.waiter_id).maybeSingle();
      if (!cancelled) setWaiterName(w?.name || null);
    })();
    return () => { cancelled = true; };
  }, [tableNumber, flyerId]);

  const allItems: MenuItem[] = useMemo(() => sections.flatMap((s: any) => (s.items || []) as MenuItem[]), [sections]);
  const upsells = (cat: "side" | "drink") => allItems.filter((i) => i.category === cat && (i.upsell ?? true));

  const total = cart.reduce((sum, l) => sum + (l.item.price || 0) * l.qty, 0);
  const itemCount = cart.reduce((n, l) => n + l.qty, 0);

  function handleItemTap(item: MenuItem) {
    add(item);
    toast.success(`${item.name} added`, { duration: 1200 });
  }

  async function submitOrder() {
    if (!name.trim()) return toast.error("Please enter your name");
    if (!tableNumber.trim()) return toast.error("Table number is required");
    if (orderType === "order_ahead" && !pickupAt) return toast.error("Pickup time required for order ahead");
    if (cart.length === 0) return toast.error("Cart is empty");
    setSubmitting(true);
    const items = cart.map((l) => ({ id: l.item.id, name: l.item.name, price: l.item.price, qty: l.qty, category: l.item.category }));
    const subtotal_cents = Math.round(total * 100);
    const initialStatus = orderType === "order_ahead" ? "pending_approval" : "new";
    const { data: orderRow, error } = await supabase.from("menu_orders").insert([{
      flyer_id: flyerId, action_id: actionId || null,
      customer_name: name.trim(), customer_phone: phone.trim() || null,
      items, subtotal_cents, notes: notes.trim() || null,
      table_number: tableNumber.trim(),
      order_type: orderType,
      pickup_at: orderType === "order_ahead" ? new Date(pickupAt).toISOString() : null,
      status: initialStatus,
    } as any]).select("id").single();
    const { error: subErr } = await supabase.from("form_submissions").insert([{
      flyer_id: flyerId,
      data: {
        kind: "cart_order", source: "menu_scan",
        customer: { name: name.trim(), phone: phone.trim() || null },
        items, currency, total: Number(total.toFixed(2)),
        notes: notes.trim() || null, menu_order_id: orderRow?.id,
        table_number: tableNumber.trim(), order_type: orderType,
        pickup_at: orderType === "order_ahead" ? pickupAt : null,
        waiter_name: waiterName,
      } as any,
      status: initialStatus,
    }]);
    setSubmitting(false);
    if (error) { console.error("[submitOrder]", error); return toast.error("Could not place order"); }
    if (subErr) console.error("[submitOrder] mirror failed", subErr);
    if (orderType === "order_ahead") toast.success("Order submitted — awaiting manager approval.");
    else if (checkoutMode === "payment" && paymentLink) { toast.success("Order placed — redirecting to payment."); window.open(paymentLink, "_blank"); }
    else toast.success(`Order sent to table ${tableNumber.trim()}!`);
    clear();
  }

  const fmt = (n: number) => `${currency}${(n || 0).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        {/* Top banner: table waiter greeting (or prompt) */}
        {tableNumber.trim() ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            {waiterName
              ? <>👋 Your server tonight is <strong>{waiterName}</strong>. Table <strong>{tableNumber}</strong>.</>
              : <>Table <strong>{tableNumber}</strong> — a server will be with you shortly.</>}
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
            Enter your table number at checkout to see your server.
          </div>
        )}


        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
          <>
            {view === "menu" && (
              <div className="space-y-5">
                {sections.length === 0 && <p className="text-sm text-muted-foreground">Menu coming soon.</p>}
                {sections.map((sec: any) => (
                  <div key={sec.id}>
                    <h3 className="mb-2 font-semibold text-base border-b border-border pb-1">{sec.name}</h3>
                    <div className="space-y-2">
                      {(sec.items || []).map((it: MenuItem) => (
                        <button key={it.id} onClick={() => handleItemTap(it)}
                          className="flex w-full items-start justify-between gap-3 rounded p-2 text-left hover:bg-accent transition"
                          style={it.color ? { borderLeft: `4px solid ${it.color}` } : undefined}>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{it.name}</div>
                            {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                          </div>
                          <div className="text-sm font-medium whitespace-nowrap">{fmt(it.price)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {view === "upsell" && (
              <div className="space-y-3">
                <p className="text-sm">Added to your order. Anything else?</p>
                <div className="grid gap-2">
                  <Button variant="outline" onClick={() => setView("menu")}>+ Add item to cart</Button>
                  <Button variant="outline" disabled={upsells("side").length === 0} onClick={() => { setPickerCategory("side"); setView("picker"); }}>
                    + Add a side {upsells("side").length === 0 && "(none available)"}
                  </Button>
                  <Button variant="outline" disabled={upsells("drink").length === 0} onClick={() => { setPickerCategory("drink"); setView("picker"); }}>
                    + Add a drink {upsells("drink").length === 0 && "(none available)"}
                  </Button>
                  <Button onClick={() => setView("checkout")}>Go to checkout · {fmt(total)}</Button>
                </div>
              </div>
            )}

            {view === "picker" && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Pick a {pickerCategory}</h3>
                {upsells(pickerCategory).map((it) => (
                  <button key={it.id} onClick={() => { add(it); setView("upsell"); }}
                    className="flex w-full items-start justify-between gap-3 rounded border border-border p-2 text-left hover:bg-accent">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{it.name}</div>
                      {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                    </div>
                    <div className="text-sm font-medium">{fmt(it.price)}</div>
                  </button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setView("upsell")}>← Back</Button>
              </div>
            )}

            {view === "checkout" && (
              <div className="space-y-3">
                <div className="rounded border border-border p-2 space-y-1">
                  {cart.map((l, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{l.qty}× {l.item.name}</span>
                      <span className="flex items-center gap-2">
                        {fmt((l.item.price || 0) * l.qty)}
                        <button onClick={() => removeAt(idx)} className="text-muted-foreground hover:text-destructive text-xs">remove</button>
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-1 font-semibold text-sm">
                    <span>Total</span><span>{fmt(total)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOrderType("dine_in")}
                    className={`rounded border px-3 py-2 text-xs font-medium ${orderType === "dine_in" ? "border-primary bg-primary/10" : "border-border"}`}>
                    🍽 Dine in now
                  </button>
                  <button type="button" onClick={() => setOrderType("order_ahead")}
                    className={`rounded border px-3 py-2 text-xs font-medium ${orderType === "order_ahead" ? "border-red-500 bg-red-500/10" : "border-border"}`}>
                    ⏱ Order ahead (manager approval)
                  </button>
                </div>
                <div>
                  <Label className="text-xs">Table number *</Label>
                  <Input className="mt-1" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g. 12" />
                  {waiterName && <div className="mt-1 text-xs text-emerald-600">Server: {waiterName}</div>}
                </div>
                {orderType === "order_ahead" && (
                  <div>
                    <Label className="text-xs">Pickup time *</Label>
                    <Input type="datetime-local" className="mt-1" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Your name *</Label>
                  <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, requests…" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setView(sections.length ? "menu" : "upsell")} className="flex-1">Add more</Button>
                  <Button disabled={submitting} onClick={submitOrder} className="flex-1">
                    {submitting ? "Sending…" : orderType === "order_ahead" ? "Submit for approval" : checkoutMode === "payment" ? "Order & pay" : "Place order"}
                  </Button>
                </div>

              </div>
            )}

            {itemCount > 0 && view !== "checkout" && (
              <button onClick={() => setView("checkout")}
                className="sticky bottom-0 mt-3 w-full rounded bg-primary text-primary-foreground py-2 text-sm font-medium shadow">
                Cart · {itemCount} item{itemCount > 1 ? "s" : ""} · {fmt(total)}
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const setOpen = useMenuCart((s) => s.setOpen);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("menus").select("sections").eq("action_id", action.id).maybeSingle();
      setSections((data?.sections as any[]) || []);
      setLoading(false);
    })();
    setOpen(true, "menu");
  }, [action.id, setOpen]);

  // Close handler bridges shared store ↔ parent
  const open = useMenuCart((s) => s.open);
  useEffect(() => { if (!open) onClose(); }, [open, onClose]);

  return (
    <MenuCartUI
      flyerId={flyerId}
      actionId={action.id}
      sections={sections}
      currency={p.menuCurrency || "$"}
      title={p.menuTitle || "Menu"}
      checkoutMode={p.menuCheckoutMode || "order_only"}
      paymentLink={p.menuPaymentLink}
      loading={loading}
    />
  );
}



// ---- Challenge ----
function ChallengeDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const [view, setView] = useState<"info" | "form">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Please enter your name");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid email");
    if (p.challengeCollectPhone && !phone.trim()) return toast.error("Please enter your phone");
    setSubmitting(true);
    const { error } = await supabase.from("challenge_participants").insert([{
      flyer_id: flyerId, action_id: action.id, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null,
    }]);
    setSubmitting(false);
    if (error) return toast.error("Could not join");
    toast.success(p.challengeSuccessMessage || "You're in! Good luck.");
    onClose();
  }

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.challengeTitle || "Join challenge"}</DialogTitle></DialogHeader>
        {view === "info" ? (
          <div className="space-y-3">
            {p.challengeDescription && <p className="text-sm">{p.challengeDescription}</p>}
            {(p.challengeStartISO || p.challengeEndISO) && (
              <p className="text-xs text-muted-foreground">
                {fmt(p.challengeStartISO)}{p.challengeEndISO ? ` → ${fmt(p.challengeEndISO)}` : ""}
              </p>
            )}
            {p.challengeRules && (
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap">{p.challengeRules}</div>
            )}
            <Button onClick={() => setView("form")}>{p.challengeCtaLabel || "Join the challenge"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            </div>
            {p.challengeCollectPhone && (
              <div>
                <Label className="text-xs">Phone</Label>
                <Input type="tel" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
              </div>
            )}
            <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (p.challengeCtaLabel || "Join")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Business rating ----
function RatingDialog({ action, flyerId, sessionId, onClose }: { action: LayerAction; flyerId: string; sessionId: string; onClose: () => void }) {
  const p = action.payload;
  const [all, setAll] = useState<any[]>([]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("business_ratings").select("*").eq("flyer_id", flyerId).eq("action_id", action.id);
      setAll(data || []);
      const mine = (data || []).find((r) => r.session_id === sessionId);
      if (mine) { setStars(mine.stars); setComment(mine.comment || ""); setExistingId(mine.id); }
    })();
  }, [flyerId, action.id, sessionId]);

  const avg = all.length ? (all.reduce((s, r) => s + (r.stars || 0), 0) / all.length) : 0;

  async function submit() {
    if (!stars) return toast.error("Please pick a star rating");
    setSubmitting(true);
    if (existingId) {
      const { error } = await supabase.from("business_ratings").update({ stars, comment: comment.trim() || null }).eq("id", existingId);
      if (error) { setSubmitting(false); return toast.error("Could not update"); }
    } else {
      const { error } = await supabase.from("business_ratings").insert([{ flyer_id: flyerId, action_id: action.id, session_id: sessionId, stars, comment: comment.trim() || null }]);
      if (error) { setSubmitting(false); return toast.error("Could not submit"); }
    }
    setSubmitting(false);
    toast.success(p.ratingThankYou || "Thanks for your rating!");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{p.ratingPrompt || "Rate us"}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-center">
          <div>
            <div className="text-3xl font-bold">{avg.toFixed(1)}</div>
            <div className="flex justify-center mt-1">
              {[1,2,3,4,5].map((n) => <Star key={n} className={`h-5 w-5 ${n <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{all.length} rating{all.length === 1 ? "" : "s"}</div>
          </div>
          <div className="flex justify-center"><StarRow value={stars} onChange={setStars} size={36} /></div>
          {p.ratingAllowComment !== false && (
            <Textarea placeholder="Add a comment (optional)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          )}
          <Button className="w-full" onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (existingId ? "Update rating" : "Submit rating")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
