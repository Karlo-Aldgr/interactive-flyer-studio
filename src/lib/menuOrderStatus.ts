/** Food preparation workflow — separate from payment_status. */
export type FoodOrderStatus =
  | "pending"
  | "in_production"
  | "on_hold"
  | "served"
  | "completed";

export const FOOD_ORDER_STATUSES: {
  value: FoodOrderStatus;
  label: string;
  cls: string;
  ring: string;
}[] = [
  { value: "pending", label: "Pending", cls: "bg-slate-500 text-white", ring: "border-slate-500/50 bg-slate-500/5" },
  { value: "in_production", label: "In Production", cls: "bg-blue-600 text-white", ring: "border-blue-600/50 bg-blue-600/5" },
  { value: "on_hold", label: "On Hold", cls: "bg-amber-500 text-white", ring: "border-amber-500/50 bg-amber-500/5" },
  { value: "served", label: "Served", cls: "bg-violet-600 text-white", ring: "border-violet-600/50 bg-violet-500/5" },
  { value: "completed", label: "Complete", cls: "bg-emerald-600 text-white", ring: "border-emerald-600/40 bg-emerald-600/5" },
];

export function foodStatusMeta(status: FoodOrderStatus | string | null | undefined) {
  return FOOD_ORDER_STATUSES.find((x) => x.value === status) || FOOD_ORDER_STATUSES[0];
}

/** Map `menu_orders.status` → portal food status. */
export function menuStatusToFoodStatus(menuStatus: string | null | undefined): FoodOrderStatus {
  const s = (menuStatus || "new").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "served") return "served";
  if (s === "preparing" || s === "in_production") return "in_production";
  if (s === "on_hold") return "on_hold";
  if (s === "cancelled" || s === "rejected") return "completed";
  return "pending";
}

/** Map portal food status → `menu_orders.status`. */
export function foodStatusToMenuStatus(food: FoodOrderStatus): string {
  switch (food) {
    case "in_production": return "preparing";
    case "on_hold": return "on_hold";
    case "served": return "served";
    case "completed": return "completed";
    default: return "new";
  }
}

/** Mirror into `form_submissions.status` for legacy cart tab compatibility. */
export function foodStatusToMirrorFormStatus(food: FoodOrderStatus): string {
  switch (food) {
    case "in_production": return "in_production";
    case "on_hold": return "on_hold";
    case "served": return "in_production";
    case "completed": return "completed";
    default: return "new";
  }
}

export function mirrorFormStatusToFoodStatus(formStatus: string | null | undefined): FoodOrderStatus {
  const s = (formStatus || "new").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "in_production") return "in_production";
  if (s === "on_hold") return "on_hold";
  return "pending";
}

export type PaymentMethod = "pay_now" | "pay_later";

export function paymentStatusLabel(status: string | null | undefined): "Paid" | "Unpaid" {
  return (status || "unpaid").toLowerCase() === "paid" ? "Paid" : "Unpaid";
}

export function paymentMethodLabel(method: string | null | undefined): string {
  return (method || "pay_later") === "pay_now" ? "Pay Now" : "Pay Later";
}

export function paymentBadgeCls(status: string | null | undefined): string {
  return paymentStatusLabel(status) === "Paid"
    ? "bg-emerald-600 text-white"
    : "bg-red-600 text-white";
}
