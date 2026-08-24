export type DetectionKind = "phone" | "url" | "email" | "address" | "date";

export interface RawDetection {
  kind: DetectionKind;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

const BBOX_LIMITS: Record<
  DetectionKind,
  { maxArea: number; maxWidth: number; maxHeight: number }
> = {
  phone: { maxArea: 0.08, maxWidth: 0.35, maxHeight: 0.12 },
  url: { maxArea: 0.06, maxWidth: 0.45, maxHeight: 0.1 },
  email: { maxArea: 0.06, maxWidth: 0.45, maxHeight: 0.1 },
  address: { maxArea: 0.18, maxWidth: 0.55, maxHeight: 0.22 },
  date: { maxArea: 0.08, maxWidth: 0.4, maxHeight: 0.12 },
};

function digitCount(text: string): number {
  return (text.match(/\d/g) || []).length;
}

export function looksLikePhone(text: string): boolean {
  const trimmed = text.trim();
  if (digitCount(trimmed) < 7) return false;
  if (!/^[\d\s().+\-/]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])+)+\/?/i.test(trimmed);
}

export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

export function looksLikeAddress(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false;
  if (looksLikePhone(trimmed) && !/\b(st|street|ave|avenue|rd|road|blvd|drive|dr|ln|lane|way|ct|court|suite|ste|#)\b/i.test(trimmed)) {
    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) return false;
  }
  return true;
}

export function looksLikeDateOrTime(text: string): boolean {
  const trimmed = text.trim();
  if (!/\d/.test(trimmed)) return false;
  const patterns = [
    /\b\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\b/,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,
    /\b(am|pm)\b/i,
    /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b20\d{2}\b/,
    /\b\d{1,2}(st|nd|rd|th)\b/i,
  ];
  return patterns.some((pattern) => pattern.test(trimmed));
}

export function validateDetectionText(kind: DetectionKind, text: string): boolean {
  switch (kind) {
    case "phone":
      return looksLikePhone(text);
    case "url":
      return looksLikeUrl(text);
    case "email":
      return looksLikeEmail(text);
    case "address":
      return looksLikeAddress(text);
    case "date":
      return looksLikeDateOrTime(text);
    default:
      return false;
  }
}

function bboxArea(bbox: RawDetection["bbox"]): number {
  return bbox.width * bbox.height;
}

export function isReasonableBbox(kind: DetectionKind, bbox: RawDetection["bbox"]): boolean {
  if (bbox.width <= 0 || bbox.height <= 0) return false;
  if (bbox.x < -0.01 || bbox.y < -0.01) return false;
  if (bbox.x + bbox.width > 1.05 || bbox.y + bbox.height > 1.05) return false;

  const limits = BBOX_LIMITS[kind];
  const area = bboxArea(bbox);
  if (area > limits.maxArea) return false;
  if (bbox.width > limits.maxWidth || bbox.height > limits.maxHeight) return false;

  // Large square regions are usually logos/graphics, not a single line of text.
  const aspect = bbox.width / Math.max(bbox.height, 0.001);
  if (area > 0.04 && aspect > 0.55 && aspect < 1.8) return false;

  return true;
}

export function filterSmartDetections<T extends RawDetection>(detections: T[]): T[] {
  const seen = new Set<string>();

  return detections.filter((detection) => {
    const text = detection.text.trim();
    if (!text || text.length > 200) return false;
    if (!validateDetectionText(detection.kind, text)) return false;
    if (!isReasonableBbox(detection.kind, detection.bbox)) return false;

    const key = `${detection.kind}:${text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
