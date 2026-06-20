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

const TRACK_KEY = (flyerId: string) => `order_track_${flyerId}`;

export type StoredOrderTrack = {
  orderId: string;
  kind: "cart" | "menu";
  email?: string;
  phone?: string;
  placedAt: string;
};

export function saveOrderTrack(flyerId: string, track: StoredOrderTrack) {
  try {
    sessionStorage.setItem(TRACK_KEY(flyerId), JSON.stringify(track));
  } catch {
    /* ignore */
  }
}

export function loadOrderTrack(flyerId: string): StoredOrderTrack | null {
  try {
    const raw = sessionStorage.getItem(TRACK_KEY(flyerId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredOrderTrack;
  } catch {
    return null;
  }
}

export function clearOrderTrack(flyerId: string) {
  try {
    sessionStorage.removeItem(TRACK_KEY(flyerId));
  } catch {
    /* ignore */
  }
}
