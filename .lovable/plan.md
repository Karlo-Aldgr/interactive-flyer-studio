# AI Landing Page for each flyer

Add a "Landing page" option in the editor's **Pages** panel that generates a complete, on-brand landing page for the current flyer using AI, with a built-in Shop now / Pre-order button.

## Behavior

1. **New button in Pages panel**: "AI landing page" (next to the existing Add page / Landing / Scan menu actions).
2. **Guard — no flyer content yet**: if the flyer has no design pages with real content (no text/image layers on any non-landing page), show a prompt dialog:
   > "Create or design your flyer first — the AI builds the landing page from your flyer's content." with buttons *Design a flyer* (closes dialog, selects/creates page 1) and *Cancel*.
3. **With flyer content**: show a short dialog (CTA label choice: *Shop now* / *Pre-order* / custom, plus optional extra notes), then generate.
4. **Generation**: AI reads the flyer's text layers, image URLs, title/category, and the business's onboarding record (name, slogan, description, logo, address, phone, email, website, socials) and returns a structured landing layout.
5. **Result**: a new page named "Landing page" is appended, at the **same canvas size as the flyer's pages**, containing:
   - hero image (reused from the flyer's main image),
   - headline + subheadline,
   - 3 short benefit/feature lines,
   - a CTA button wired to the flyer's **built-in order/checkout** action,
   - business contact footer line.
   Everything is normal editable layers, so the user can tweak, move, restyle, or delete them.
6. The page is added through the existing store history (undo works) and saves with the normal flyer save flow.

## CTA wiring

The generated button gets a real action, picked in this order from what the flyer already has:
- `show_menu` if the flyer has a menu catalog configured,
- else `product_grid` / `buy_product` if products exist,
- else `checkout`.
If none of those exist, the button is created with a `checkout` action plus an inline hint in the inspector telling the user to finish payment setup (existing payment settings dialog).

## Technical notes

- **New edge function** `landing-page-generate` (Supabase, authenticated), same shape as `flyer-coach`: verifies the caller owns the flyer, collects flyer facts from `pages` + the matching `onboarding_submissions` row, calls Lovable AI (`openai/gpt-5.6-sol`) with a strict JSON schema (`headline`, `subheadline`, `bullets[3]`, `ctaLabel`, `footerLine`, `accentColor`), returns it. Handles 429/402 with clear messages.
- **Store**: add `addAiLandingPage(spec)` in `src/store/editorStore.ts` that builds the page + layers (image, text, button with action) at flyer width/height, using existing `defaultLayer` helpers and history snapshot.
- **UI**: new `AiLandingPageDialog.tsx` under `src/components/editor/`, invoked from `PagesPanel.tsx`; handles the "no flyer yet" prompt, CTA choice, loading state, and errors.
- No schema changes — the landing page is a regular `pages` row.
- Styling uses existing design tokens; the AI-supplied accent color is applied to the CTA only.
