# digitalbizad MVP — Build Scope (when client approves)

This document scopes the first shippable version. **Do not start Meta/Facebook changes.** **Do not rebuild affiliate.**

---

## Goal

A mobile-only public page (`bizads`) that acts as a digital business card, created from the editor via a toggle and populated from customer onboarding data.

---

## MVP includes

### 1. Data model (Supabase migration)

New table `bizads` (or `flyer_bizads` if 1:1 with flyer):

- `flyer_id` (FK, unique)
- `enabled` boolean
- `slug` text (public URL)
- `business_name`, `owner_name`, `phone`, `email`
- `about_text`
- `flyer_image_url`, `owner_photo_url`, `logo_url`
- `address` (for GPS)
- `social_links` jsonb (facebook, instagram, tiktok, website, etc.)
- `button_color`, `background_color`
- `gallery_url` (optional — default to flyer public URL)
- `created_at`, `updated_at`

RLS: public read when enabled; owner edit via flyer ownership.

### 2. Public page

Route: `/bizads/:slug` (or `/f/:flyerSlug/card` — confirm with client; default `/bizads/:slug`)

Mobile-only vertical layout:

1. Business name
2. Hero flyer image
3. Owner photo / logo overlay or below
4. Save Contact (download `.vcf` with name, phone, email)
5. Hot buttons row/grid: Call (`tel:`), Text/SMS (`sms:`), Email (`mailto:`), Gallery (link), GPS (`maps` URL from address)
6. About Us section
7. Social buttons (use URLs from onboarding; MVP: icon buttons or text links; P2: DB-stored Photoshop assets)
8. QR code (encode public bizad URL)

Responsive: max-width ~430px centered; full viewport height scroll.

### 3. Editor toggle

In editor (e.g. TopBar or AutomationHub — **not** Meta/Facebook dialogs):

- Toggle: **“Add digital business card (bizad)”**
- On enable:
  - Create/update `bizads` row from user’s onboarding (`getMyOnboarding`) + flyer thumbnail
  - Show preview link + copy URL
- On disable: set `enabled = false` (keep data)
- Color pickers: button color, background color (simple hex inputs or color picker)

Files likely touched:

- `src/pages/Editor.tsx` or editor settings panel
- New `src/components/editor/BizadPanel.tsx`
- New `src/pages/PublicBizad.tsx`
- New `src/lib/bizad.ts`
- `src/App.tsx` route
- `supabase/migrations/YYYYMMDD_bizads.sql`

### 4. Onboarding auto-fill

On toggle ON or first publish with bizad enabled:

- Pull from `onboarding_submissions` / `getMyOnboarding`:
  - `business_name`, `full_name`, `phone`, `email`
  - `business_description` → about
  - `website_url`, `facebook_url`, `instagram_url`, `tiktok_url`
  - `business_address` → GPS
  - `logo_url` from onboarding upload
- Flyer thumbnail or first page export → `flyer_image_url`

No new onboarding fields required for MVP.

### 5. QR + share

- Reuse existing QR pattern from `JobBillingActivationPanel` / share utilities
- QR targets `https://tapthatflyer.com/bizads/{slug}`

---

## MVP excludes (P2+)

- NFC card provisioning (client handles hardware; we only provide URL)
- Custom Photoshop social icons in DB (use Lucide/default icons first)
- Editor “interactions” animations on bizad page
- Click-triggered AI chatbot
- Gospel Connection branding
- Affiliate changes
- Meta OAuth / Facebook posting changes

---

## Suggested build order

1. Migration + types
2. `PublicBizad` page (static layout with mock data)
3. `bizad.ts` CRUD + onboarding sync helper
4. Editor toggle + panel
5. Wire onboarding auto-fill on enable
6. Save Contact `.vcf` + hot links
7. QR on page
8. Color customization
9. Publish + smoke test (do **not** regression-test Meta in same PR unless untouched)

---

## Test checklist (before telling client “done”)

- [ ] Toggle ON creates bizad from onboarding
- [ ] Public `/bizads/{slug}` loads on mobile width
- [ ] Call / SMS / Email / GPS links work
- [ ] Save Contact downloads valid `.vcf`
- [ ] QR scans to correct URL
- [ ] Toggle OFF hides public page (404 or disabled message)
- [ ] Meta Connect/Post still works (smoke only)
- [ ] Affiliate pages still load (smoke only)
- [ ] Existing flyer `/f/{slug}` unchanged

---

## Default assumptions (if client doesn’t answer)

| Question | Default |
|----------|---------|
| URL | `/bizads/{slug}` where slug = flyer `public_slug` or generated |
| Save Contact | Download `.vcf` file |
| Gallery | Links to interactive flyer public URL |
| Social icons | Lucide/simple branded circles until Photoshop assets uploaded |
