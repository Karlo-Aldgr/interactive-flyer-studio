import type { JsonValue } from "./types";

const SECRET_KEY = /(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role|credential|payment|card|cvv)/i;
const MAX_DEPTH = 8;
const MAX_TEXT = 1000;

export function sanitizeAutomationHistory(value: unknown, depth = 0): JsonValue | null {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeAutomationHistory(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[REDACTED]" : sanitizeAutomationHistory(item, depth + 1),
    ]));
  }
  return null;
}

export function safeAutomationError(code: unknown, message: unknown): { code: string | null; message: string | null } {
  const safeCode = typeof code === "string" && /^[a-z0-9_:-]{1,100}$/i.test(code) ? code : null;
  if (!safeCode) return { code: null, message: null };
  const safeMessage = typeof message === "string" ? message.replace(/https?:\/\/\S+/gi, "[URL REDACTED]").slice(0, 500) : null;
  return { code: safeCode, message: safeMessage };
}
