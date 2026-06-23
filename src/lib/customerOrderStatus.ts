/** Customer-facing order phases (simplified workflow). */
export type CustomerOrderPhase = "pending" | "in_production" | "served" | "complete";

export const CUSTOMER_ORDER_PHASES: {
  id: CustomerOrderPhase;
  label: string;
  description: string;
}[] = [
  { id: "pending", label: "Pending", description: "We received your order and will start soon." },
  { id: "in_production", label: "Preparing", description: "Your order is being prepared." },
  { id: "served", label: "Served", description: "Your food has been served." },
  { id: "complete", label: "Complete", description: "Your order is finished." },
];

/** Product cart orders use the legacy 3-step tracker. */
export const CART_CUSTOMER_PHASES = CUSTOMER_ORDER_PHASES.filter((p) => p.id !== "served");

/** Cart / product checkout orders (`form_submissions`). */
export function cartStatusToCustomerPhase(status: string | null | undefined): CustomerOrderPhase {
  const s = (status || "new").toLowerCase();
  if (s === "completed") return "complete";
  if (s === "in_production") return "in_production";
  return "pending";
}

/** Restaurant menu orders (`menu_orders`). */
export function menuStatusToCustomerPhase(status: string | null | undefined): CustomerOrderPhase {
  const s = (status || "new").toLowerCase();
  if (s === "completed") return "complete";
  if (s === "served") return "served";
  if (s === "preparing" || s === "in_production") return "in_production";
  if (s === "cancelled" || s === "rejected") return "complete";
  return "pending";
}

export const MENU_CUSTOMER_PHASES = CUSTOMER_ORDER_PHASES;

export function customerPhaseIndex(phase: CustomerOrderPhase): number {
  return CUSTOMER_ORDER_PHASES.findIndex((p) => p.id === phase);
}

const TRACK_KEY = (flyerId: string) => `order_track_v2_${flyerId}`;
const LEGACY_KEY = (flyerId: string) => `order_track_${flyerId}`;

export type StoredOrderTrack = {
  orderId: string;
  kind: "cart" | "menu";
  email?: string;
  phone?: string;
  tableNumber?: string;
  customerName?: string;
  placedAt: string;
  itemCount?: number;
  /** User closed tracker without completing — suppress auto-reopen this session. */
  dismissedUntilReturn?: boolean;
};

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveOrderTrack(flyerId: string, track: StoredOrderTrack) {
  try {
    localStorage.setItem(TRACK_KEY(flyerId), JSON.stringify(track));
    // Clean up legacy sessionStorage key if present.
    try { sessionStorage.removeItem(LEGACY_KEY(flyerId)); } catch { /* ignore */ }
  } catch {
    /* ignore */
  }
}

export function loadOrderTrack(flyerId: string): StoredOrderTrack | null {
  try {
    let raw = readRaw(TRACK_KEY(flyerId));
    if (!raw) {
      // Migrate from legacy sessionStorage key.
      raw = readRaw(LEGACY_KEY(flyerId));
      if (raw) {
        try { localStorage.setItem(TRACK_KEY(flyerId), raw); } catch { /* ignore */ }
        try { sessionStorage.removeItem(LEGACY_KEY(flyerId)); } catch { /* ignore */ }
      }
    }
    if (!raw) return null;
    return JSON.parse(raw) as StoredOrderTrack;
  } catch {
    return null;
  }
}

export function clearOrderTrack(flyerId: string) {
  try { localStorage.removeItem(TRACK_KEY(flyerId)); } catch { /* ignore */ }
  try { sessionStorage.removeItem(LEGACY_KEY(flyerId)); } catch { /* ignore */ }
}

/** Mark current track as dismissed so the floating prompt doesn't auto-open again. */
export function markOrderTrackDismissed(flyerId: string) {
  const t = loadOrderTrack(flyerId);
  if (!t) return;
  saveOrderTrack(flyerId, { ...t, dismissedUntilReturn: true });
}
