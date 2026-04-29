import { ActionPayload } from "@/types/flyer";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// Format as YYYYMMDDTHHMMSSZ (UTC) for ICS / Google
function toCompactUtc(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// All-day uses YYYYMMDD
function toCompactDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(payload: ActionPayload): string {
  const title = payload.eventTitle || "Event";
  const description = payload.eventDescription || "";
  const location = payload.eventLocation || "";
  const start = payload.startISO ? new Date(payload.startISO) : new Date();
  const end = payload.endISO
    ? new Date(payload.endISO)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const dtStart = payload.allDay
    ? `DTSTART;VALUE=DATE:${toCompactDate(start.toISOString())}`
    : `DTSTART:${toCompactUtc(start.toISOString())}`;
  const dtEnd = payload.allDay
    ? `DTEND;VALUE=DATE:${toCompactDate(end.toISOString())}`
    : `DTEND:${toCompactUtc(end.toISOString())}`;

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@flyerflow`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FlyerFlow//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toCompactUtc(new Date().toISOString())}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : "",
    location ? `LOCATION:${escapeIcs(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function buildGoogleCalendarUrl(payload: ActionPayload): string {
  const title = payload.eventTitle || "Event";
  const start = payload.startISO ? new Date(payload.startISO) : new Date();
  const end = payload.endISO
    ? new Date(payload.endISO)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const dates = payload.allDay
    ? `${toCompactDate(start.toISOString())}/${toCompactDate(end.toISOString())}`
    : `${toCompactUtc(start.toISOString())}/${toCompactUtc(end.toISOString())}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
  });
  if (payload.eventDescription) params.set("details", payload.eventDescription);
  if (payload.eventLocation) params.set("location", payload.eventLocation);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function triggerDownload(filename: string, content: string, mime = "text/calendar") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function runAddToCalendar(payload: ActionPayload) {
  const mode = payload.calendarMode || "ics";
  if (mode === "ics" || mode === "both") {
    const ics = buildIcs(payload);
    const safe = (payload.eventTitle || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    triggerDownload(`${safe}.ics`, ics);
  }
  if (mode === "google" || mode === "both") {
    window.open(buildGoogleCalendarUrl(payload), "_blank", "noopener,noreferrer");
  }
}
