import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LayerAction } from "@/types/flyer";
import { supabase } from "@/integrations/supabase/client";
import {
  generateSlotsForDate,
  isDateAvailable,
  toIsoDateLocal,
  formatMinutes,
  SlotOption,
} from "@/lib/appointmentSlots";
import { toast } from "sonner";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import { CalendarPlus, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  flyerId: string;
  layerId?: string | null;
  action: LayerAction;
  open: boolean;
  onClose: () => void;
}

type Step = "pick" | "form" | "done";

export default function AppointmentBookingDialog({
  flyerId,
  layerId,
  action,
  open,
  onClose,
}: Props) {
  const p = action.payload;
  const mode = p.apptMode || "slots";
  const duration = p.apptDurationMin || 30;

  const [step, setStep] = useState<Step>("pick");
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [freeTime, setFreeTime] = useState<string>("09:00");
  const [bookedISOs, setBookedISOs] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ startISO: string; endISO: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("pick");
      setDate(undefined);
      setSlot(null);
      setName("");
      setEmail("");
      setPhone("");
      setNote("");
      setConfirmation(null);
    }
  }, [open]);

  // Load existing bookings for the chosen date (slot mode only)
  useEffect(() => {
    if (!date || mode !== "slots" || !open) {
      setBookedISOs([]);
      return;
    }
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    setLoadingSlots(true);
    supabase
      .from("appointments")
      .select("start_at")
      .eq("flyer_id", flyerId)
      .eq("status", "confirmed")
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .then(({ data }) => {
        setBookedISOs((data || []).map((r: any) => new Date(r.start_at).toISOString()));
        setLoadingSlots(false);
      });
  }, [date, mode, open, flyerId]);

  const slots = useMemo(() => {
    if (!date || mode !== "slots") return [];
    return generateSlotsForDate(p, date, bookedISOs);
  }, [date, p, bookedISOs, mode]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + (p.apptDateRangeDays ?? 30));

  function pickFreeMoment(): { startISO: string; endISO: string } | null {
    if (!date) return null;
    const [h, m] = freeTime.split(":").map(Number);
    const start = new Date(date);
    start.setHours(h || 0, m || 0, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  async function handleSubmit() {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    if (p.apptPhoneRequired && !phone) {
      toast.error("Phone is required");
      return;
    }
    let when: { startISO: string; endISO: string } | null = null;
    if (mode === "slots") {
      if (!slot) return toast.error("Pick a time slot");
      when = { startISO: slot.startISO, endISO: slot.endISO };
    } else {
      when = pickFreeMoment();
      if (!when) return toast.error("Pick a date and time");
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("book-appointment", {
      body: {
        flyerId,
        layerId: layerId || null,
        actionId: action.id,
        name: name || null,
        email,
        phone: phone || null,
        note: note || null,
        startISO: when.startISO,
        endISO: when.endISO,
        timezone: p.apptTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        title: p.apptTitle,
        location: p.apptLocation,
        description: p.apptDescription,
        confirmSubject: p.apptConfirmSubject,
        confirmIntro: p.apptConfirmIntro,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not book your appointment");
      return;
    }
    setConfirmation(when);
    setStep("done");
  }

  function downloadIcs() {
    if (!confirmation) return;
    runAddToCalendar({
      eventTitle: p.apptTitle || "Appointment",
      eventDescription: p.apptDescription,
      eventLocation: p.apptLocation,
      startISO: confirmation.startISO,
      endISO: confirmation.endISO,
      calendarMode: "ics",
    });
  }

  function openGoogle() {
    if (!confirmation) return;
    runAddToCalendar({
      eventTitle: p.apptTitle || "Appointment",
      eventDescription: p.apptDescription,
      eventLocation: p.apptLocation,
      startISO: confirmation.startISO,
      endISO: confirmation.endISO,
      calendarMode: "google",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p.apptTitle || "Book an appointment"}</DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => !isDateAvailable(p, d)}
                fromDate={today}
                toDate={maxDate}
                className="rounded border border-border"
              />
            </div>
            <div className="space-y-3">
              {p.apptDescription && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.apptDescription}</p>
              )}
              {p.apptLocation && (
                <p className="text-xs text-muted-foreground">📍 {p.apptLocation}</p>
              )}
              <p className="text-xs text-muted-foreground">⏱ {duration} min</p>

              {!date && (
                <p className="text-sm text-muted-foreground">Pick a date to see available times.</p>
              )}

              {date && mode === "slots" && (
                <>
                  <Label className="text-xs">Available times</Label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No times available this day.</p>
                  ) : (
                    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                      {slots.map((s) => (
                        <Button
                          key={s.startISO}
                          variant={slot?.startISO === s.startISO ? "default" : "outline"}
                          size="sm"
                          disabled={s.taken}
                          onClick={() => setSlot(s)}
                        >
                          {formatMinutes(s.startMinute)}
                          {s.taken && <span className="ml-1 text-[10px]">·booked</span>}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {date && mode === "free" && (
                <div>
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={freeTime}
                    onChange={(e) => setFreeTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <Button
                className="w-full"
                disabled={!date || (mode === "slots" && !slot)}
                onClick={() => setStep("form")}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            {p.apptCollectPhone && (
              <div>
                <Label className="text-xs">
                  Phone {p.apptPhoneRequired ? "*" : "(optional)"}
                </Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
              </div>
            )}
            {p.apptCollectNote && (
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("pick")}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm booking"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && confirmation && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">
              {p.apptSuccessMessage || "You're booked!"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {new Date(confirmation.startISO).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">A confirmation has been sent to {email}.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadIcs}>
                <CalendarPlus className="mr-1 h-4 w-4" /> Download .ics
              </Button>
              <Button variant="outline" size="sm" onClick={openGoogle}>
                <CalendarPlus className="mr-1 h-4 w-4" /> Google Calendar
              </Button>
            </div>
            <Button className="mt-2" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
