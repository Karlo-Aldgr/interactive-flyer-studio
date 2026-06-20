/** Collect every action type on a flyer (top-level + nested popup buttons/hotspots). */
export function collectFlyerActionTypes(
  actions: Array<{ type?: string; payload?: Record<string, unknown> }>,
): Set<string> {
  const types = new Set<string>();
  const add = (t?: string) => {
    if (t) types.add(t);
  };
  for (const a of actions) {
    add(a.type);
    const p = a.payload || {};
    for (const b of (p.buttons as Array<{ action?: { type?: string } }>) || []) {
      add(b?.action?.type);
    }
    for (const h of (p.hotspots as Array<{ action?: { type?: string } }>) || []) {
      add(h?.action?.type);
    }
  }
  return types;
}

/**
 * Food / live-ordering portal: menu scan + table ordering (show_menu, menu_add_item).
 * Derived from attached flyer actions — not hardcoded per project type.
 */
export function flyerHasFoodOrdering(
  actions: Array<{ type?: string; payload?: Record<string, unknown> }>,
): boolean {
  const types = collectFlyerActionTypes(actions);
  return types.has("show_menu") || types.has("menu_add_item");
}

export interface FlyerCapabilities {
  hasFoodOrdering: boolean;
  hasCartCheckout: boolean;
  hasAppointments: boolean;
  hasPolls: boolean;
  hasSubscribe: boolean;
  hasForms: boolean;
  actionTypes: string[];
}

export function detectFlyerCapabilities(
  actions: Array<{ type?: string; payload?: Record<string, unknown> }>,
): FlyerCapabilities {
  const types = collectFlyerActionTypes(actions);
  return {
    hasFoodOrdering: types.has("show_menu") || types.has("menu_add_item"),
    hasCartCheckout:
      types.has("checkout") ||
      types.has("buy_product") ||
      types.has("buy_ticket") ||
      types.has("product_grid"),
    hasAppointments: types.has("book_appointment") || types.has("schedule_consultation"),
    hasPolls: types.has("poll"),
    hasSubscribe: types.has("subscribe"),
    hasForms: types.has("form") || types.has("rsvp"),
    actionTypes: Array.from(types),
  };
}
