## Multi-Product Action (Product Grid Popup)

Add a new interaction type `product_grid` that opens a popup showing up to 12 products in a 3-column grid. Tap a product → detail view with image, description, size selector (S–6XL, optional), quantity stepper, and "Add to cart". Uses the existing shared cart + P2P checkout (Venmo / Cash App / Apple Pay) you already configured per flyer.

### What the owner configures (in Inspector)
- Action title (e.g. "Shop")
- Up to 12 product slots, each with:
  - Name
  - Price
  - Image
  - Short description / message
  - Sizes enabled? (toggle). When on, owner picks which sizes are available from S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL
  - Default quantity = 1, buyer can change in detail view

No inventory/sold-out in v1 (can add later).

### What the visitor sees
1. Tap element → popup with grid of product cards (image, name, price).
2. Tap a card → detail panel with image, description, size buttons (if enabled), qty stepper, "Add to cart".
3. Cart badge appears using the existing menu cart store; checkout flow reuses what `buy_product` cart already uses (Venmo/CashApp/Apple Pay handles from flyer settings).

### Technical notes
- New `ActionType`: `"product_grid"` in `src/types/flyer.ts`.
- New payload fields: `productGridTitle`, `products: ProductGridItem[]` where each item has `{ id, name, price, imageUrl, description, sizesEnabled, sizes: string[] }`.
- Catalog entry in `src/lib/interactionsCatalog.ts` ("Multi-product shop").
- Inspector editor in `src/components/editor/ActionEditor.tsx`: repeatable list capped at 12, with image upload (reuse existing flyer-assets bucket helper used by `buy_product`).
- Viewer rendering in `src/pages/PublicViewer.tsx`: new modal component for grid + detail. Selected size + qty pushed into existing `useMenuCart` store (extend `MenuCartItem` with optional `size`); cart key includes size so different sizes are separate lines.
- Checkout: reuse the existing cart checkout view already wired for P2P payments — no new backend.
- No database/schema changes required (products live inside the action payload, same as `buy_product`).

### Out of scope (ask later if you want it)
- Inventory / sold-out
- Color variants
- Stripe checkout for the grid (P2P only for now)
