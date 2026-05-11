import { ActionPayload, AppointmentDayAvailability } from "@/types/flyer";

export const DEFAULT_WEEKLY: AppointmentDayAvailability[] = Array.from({ length: 7 }, (_, i) => ({
  enabled: i >= 1 && i <= 5,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

/** YYYY-MM-DD for a date, in the user's local time. */
export function toIsoDateLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export interface SlotOption {
  startMinute: number; // minutes since midnight in flyer/local tz
  startISO: string;    // ISO timestamp for that local moment
  endISO: string;
  taken: boolean;
}

/** Generate slots for a given local date. Booked slots are marked `taken`. */
export function generateSlotsForDate(
  payload: ActionPayload,
  date: Date,
  bookedStartISOs: string[]
): SlotOption[] {
  const weekly = payload.apptWeeklyAvailability || DEFAULT_WEEKLY;
  const dow = date.getDay();
  const day = weekly[dow];
  if (!day || !day.enabled) return [];

  const duration = payload.apptDurationMin || 30;
  const buffer = payload.apptBufferMin || 0;
  const step = duration + buffer;

  const blackout = new Set(payload.apptBlackoutDates || []);
  if (blackout.has(toIsoDateLocal(date))) return [];

  const taken = new Set(bookedStartISOs);
  const slots: SlotOption[] = [];

  for (let m = day.startMinute; m + duration <= day.endMinute; m += step) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(m);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const startISO = start.toISOString();
    slots.push({
      startMinute: m,
      startISO,
      endISO: end.toISOString(),
      taken: taken.has(startISO),
    });
  }
  return slots;
}

/** Is a calendar date selectable based on availability + blackout + range? */
export function isDateAvailable(payload: ActionPayload, date: Date): boolean {
  const weekly = payload.apptWeeklyAvailability || DEFAULT_WEEKLY;
  const dow = date.getDay();
  const day = weekly[dow];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target < today) return false;

  const range = payload.apptDateRangeDays ?? 30;
  const max = new Date(today);
  max.setDate(max.getDate() + range);
  if (target > max) return false;

  if ((payload.apptMode || "slots") === "slots" && (!day || !day.enabled)) return false;

  const blackout = new Set(payload.apptBlackoutDates || []);
  if (blackout.has(toIsoDateLocal(target))) return false;

  return true;
}
