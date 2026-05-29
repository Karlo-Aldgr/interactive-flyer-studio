import { create } from "zustand";

export type MenuCartItem = {
  id?: string;
  name: string;
  price?: number;
  description?: string;
  category?: string;
  color?: string;
};
export type MenuCartLine = { item: MenuCartItem; qty: number };

type View = "menu" | "upsell" | "picker" | "checkout";

interface MenuCartState {
  cart: MenuCartLine[];
  open: boolean;
  view: View;
  add: (item: MenuCartItem) => void;
  removeAt: (idx: number) => void;
  setQty: (idx: number, qty: number) => void;
  clear: () => void;
  setOpen: (open: boolean, view?: View) => void;
  setView: (v: View) => void;
  count: () => number;
  total: () => number;
}

const keyOf = (i: MenuCartItem) => i.id || `${i.name}|${i.price ?? 0}`;

export const useMenuCart = create<MenuCartState>((set, get) => ({
  cart: [],
  open: false,
  view: "menu",
  add: (item) => set((s) => {
    const k = keyOf(item);
    const found = s.cart.find((l) => keyOf(l.item) === k);
    if (found) {
      return { cart: s.cart.map((l) => keyOf(l.item) === k ? { ...l, qty: l.qty + 1 } : l) };
    }
    return { cart: [...s.cart, { item, qty: 1 }] };
  }),
  removeAt: (idx) => set((s) => ({ cart: s.cart.filter((_, i) => i !== idx) })),
  setQty: (idx, qty) => set((s) => ({
    cart: qty <= 0 ? s.cart.filter((_, i) => i !== idx) : s.cart.map((l, i) => i === idx ? { ...l, qty } : l),
  })),
  clear: () => set({ cart: [], open: false, view: "menu" }),
  setOpen: (open, view) => set((s) => ({ open, view: view ?? s.view })),
  setView: (view) => set({ view }),
  count: () => get().cart.reduce((n, l) => n + l.qty, 0),
  total: () => get().cart.reduce((n, l) => n + (l.item.price || 0) * l.qty, 0),
}));
