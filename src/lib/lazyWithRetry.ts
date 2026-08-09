import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-at";

/**
 * React.lazy that survives stale deploys.
 *
 * After a redeploy the old hashed chunk URLs 404, so a dynamic import throws
 * "Failed to fetch dynamically imported module" and the route renders blank.
 * We retry once, then force a single hard reload to pick up the new manifest.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      // One quick retry handles transient network blips.
      try {
        return await factory();
      } catch {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Never resolves — the page is reloading.
          return await new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}
