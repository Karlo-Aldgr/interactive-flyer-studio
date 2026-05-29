## AI Menu Scan + Upsell Ordering

Add AI-powered menu extraction from an image and a 3-button upsell flow when a customer taps an item.

### 1. Editor — Menu builder (in `ActionEditor.tsx`'s `show_menu` panel)

- Add an **"Scan menu image with AI"** uploader: owner uploads photo → calls new edge function `menu-scan` → returns `{ sections: [{ name, items: [{ name, description, price, category }] }] }`.
- AI auto-classifies each item with `category: "main" | "side" | "drink" | "dessert" | "other"` and groups into sections based on the photo's layout/headings.
- After scan, items appear in an editable list. Owner can:
  - Edit name/desc/price
  - Change category (pill selector)
  - **Color-code** each item (color swatch picker, stored as `color: "#hex"`)
  - Reorder, delete, add manual items
  - Toggle item as "available as upsell" (defaults: sides/drinks = true)
- Add a per-action setting: `checkoutMode: "order_only" | "payment"` and `currency`.

### 2. New edge function — `supabase/functions/menu-scan/index.ts`

- POST `{ imageUrl }` → calls Lovable AI Gateway with `google/gemini-2.5-pro` (vision) using tool-calling for structured output.
- Returns sections + items with name, description, price (number), category. CORS + 402/429 handling like `smart-detect`.

### 3. Viewer — `MenuDialog` (new) in `NewInteractionDialogs.tsx`

- Loads `menus` row for the action, renders sections with color-coded item cards.
- Tap item → **upsell modal** with 3 buttons:
  - "Add another item" → back to menu
  - "Add a side" → quick-pick sheet of side-category items
  - "Add a drink" → quick-pick sheet of drink-category items
  - Plus a "Go to checkout" button
- Running cart shown as floating pill (item count + total).
- **Checkout**:
  - If `checkoutMode = "order_only"`: form (name, phone, optional notes) → insert into new `menu_orders` table.
  - If `checkoutMode = "payment"`: same form, then redirect to existing payment flow (Stripe checkout link, mirroring `buy_ticket`).

### 4. Database migration

```sql
-- Extend menus.sections jsonb to support {name, description, price, category, color, upsell}
-- (no schema change; jsonb already flexible)

-- New table for orders
CREATE TABLE public.menu_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL,
  action_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal_cents int NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'new',
  payment_status text NOT NULL DEFAULT 'unpaid',
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_orders TO authenticated;
GRANT INSERT ON public.menu_orders TO anon;
GRANT ALL ON public.menu_orders TO service_role;
ALTER TABLE public.menu_orders ENABLE ROW LEVEL SECURITY;
-- Policies: anon/auth INSERT on published flyer; owner SELECT/UPDATE/DELETE; admin SELECT.
```

### 5. Owner dashboard

- New tab in `InteractionsModerationPanel` or `SubscribersPanel` for **Orders** listing menu_orders for the flyer (name, items, total, status, mark fulfilled).

### Technical notes

- Item shape stored in `menus.sections[i].items[j]`:
  ```ts
  { id, name, description?, price: number, category: "main"|"side"|"drink"|"dessert"|"other", color?: string, upsell?: boolean }
  ```
- `menu-scan` edge function is owner-only (verify JWT in code) to avoid public AI billing abuse.
- Stripe path reuses existing `checkout`/payment infrastructure; if not configured for the flyer, fall back to order_only with a toast.
- Color swatches use existing design tokens for default palette.

### Out of scope

- Item images (can be added later; AI scan won't extract them)
- Modifiers/options (size, add-ons beyond sides/drinks)
- Tax/tip calculations
