/**
 * Centralized client-side logger for FlyerFlow.
 * - Tagged, timestamped output
 * - Surfaces unhandled errors and promise rejections
 * - Safe to import once (idempotent install)
 */

type Level = "debug" | "info" | "warn" | "error";

const styles: Record<Level, string> = {
  debug: "color:#9ca3af",
  info: "color:#7c3aed;font-weight:bold",
  warn: "color:#d97706;font-weight:bold",
  error: "color:#dc2626;font-weight:bold",
};

function emit(level: Level, tag: string, ...args: unknown[]) {
  const ts = new Date().toISOString().split("T")[1]?.replace("Z", "");
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](
    `%c[${ts}] ${tag}`,
    styles[level],
    ...args,
  );
}

export const log = {
  debug: (tag: string, ...args: unknown[]) => emit("debug", tag, ...args),
  info: (tag: string, ...args: unknown[]) => emit("info", tag, ...args),
  warn: (tag: string, ...args: unknown[]) => emit("warn", tag, ...args),
  error: (tag: string, ...args: unknown[]) => emit("error", tag, ...args),
};

let installed = false;
export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    log.error(
      "[window.error]",
      e.message,
      e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "",
      e.error,
    );
  });

  window.addEventListener("unhandledrejection", (e) => {
    log.error("[unhandledrejection]", e.reason);
  });

  log.info("[boot]", "Global error logging installed");
}
