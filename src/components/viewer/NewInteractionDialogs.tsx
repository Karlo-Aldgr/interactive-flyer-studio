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

// ---- Menu viewer ----
function MenuDialog({ action, flyerId, onClose }: { action: LayerAction; flyerId: string; onClose: () => void }) {
  const p = action.payload;
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("menus").select("sections").eq("action_id", action.id).maybeSingle();
      setSections((data?.sections as any[]) || []);
      setLoading(false);
    })();
  }, [action.id]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.menuTitle || "Menu"}</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
          <div className="space-y-5">
            {sections.length === 0 && <p className="text-sm text-muted-foreground">Menu coming soon.</p>}
            {sections.map((sec) => (
              <div key={sec.id}>
                <h3 className="mb-2 font-semibold text-base border-b border-border pb-1">{sec.name}</h3>
                <div className="space-y-2">
                  {(sec.items || []).map((it: any) => (
                    <div key={it.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{it.name}</div>
                        {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                      </div>
                      {it.price && <div className="text-sm font-medium whitespace-nowrap">{it.price}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
