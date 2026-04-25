# FlyerFlow — Build Plan

A Canva-like interactive flyer builder where every element on the canvas can be turned into a tappable action (open URL, popup, video, call, SMS, lead form, page nav, reveal). Flyers are published to a public URL + QR code, and creators see engagement analytics.

## Tech foundation
- **Frontend:** React + Vite + Tailwind, shadcn UI, light Canva-style theme (white surfaces, violet accent, rounded corners, soft shadows, friendly typography).
- **Canvas:** `react-konva` (Konva.js) for drag/resize/rotate, snap-to-grid, alignment guides, layer ordering.
- **State:** Zustand store for the editor (layers, selection, history) with undo/redo.
- **Backend:** Lovable Cloud (Postgres + Auth + Storage + Edge Functions) — replaces the Node/Express + Postgres pieces in the original spec with the same capabilities.
- **Auth:** Email + password (no profile data needed beyond user id/email).

## Data model (Lovable Cloud / Postgres)
- `flyers` — id, owner_id, title, status (draft/published), public_slug, settings (canvas size, bg), created_at, updated_at.
- `pages` — id, flyer_id, index, name, background.
- `layers` — id, page_id, type (text/image/icon/shape/button), position {x,y}, size {w,h}, rotation, z_index, style JSON, content JSON.
- `actions` — id, layer_id, type (open_url, popup, video, call, sms, form, navigate, reveal), payload JSON.
- `form_submissions` — id, flyer_id, layer_id, data JSON, created_at.
- `analytics_events` — id, flyer_id, page_id, layer_id, event_type (view/click/submit/reveal), metadata JSON, session_id, created_at.
- `user_roles` table + `has_role()` function (standard pattern, future-proofing for admin).
- **RLS:** owners can CRUD their own flyers/pages/layers/actions; published flyers are publicly readable by slug; analytics inserts allowed from anyone (for the public viewer); analytics reads restricted to owner.
- **Storage bucket:** `flyer-assets` (public) for uploaded images and popup media.

## App structure & routes
- `/` — Marketing landing (hero, sample flyer preview, CTA to sign up).
- `/auth` — Sign in / sign up (email + password, Google sign-in).
- `/dashboard` — User's flyers grid: create new, duplicate, delete, open editor, view analytics, copy public link.
- `/editor/:flyerId` — Full builder.
- `/analytics/:flyerId` — Analytics dashboard for one flyer.
- `/f/:slug` — Public viewer (mobile-first, no auth).
- `/f/:slug/qr` — Printable QR + share page.

## Editor UI (the core experience)
Three-pane layout:
- **Left sidebar — Elements & Pages**
  - Tabs: Elements (Text, Image upload, Icons via lucide, Shapes: rect/circle/line, Button), Pages (reorderable list, add/delete/rename), Uploads, Templates (one starter sample template).
- **Center — Canvas**
  - Konva stage with rulers, snap-to-grid toggle, alignment guides on drag, multi-select, marquee select.
  - Top toolbar: undo/redo, zoom, page selector, design/interaction mode toggle, save indicator, Publish button.
  - Drag, resize (corner + edge handles), rotate handle, delete, duplicate, arrow-key nudge, copy/paste.
- **Right sidebar — Inspector** (context-sensitive to selection)
  - **Style tab:** position, size, rotation, fill, stroke, opacity, font/size/weight/align (text), border radius, shadow, z-index controls (forward/back/front/back).
  - **Action tab:** "Add interaction" → choose action type → form for that action's payload:
    - Open URL: url, open in new tab.
    - Popup: title, body text, optional image/video URL.
    - Play video: video URL (YouTube/Vimeo/mp4).
    - Tap-to-call: phone number.
    - Send SMS: phone + prefilled message.
    - Lead form: choose fields (name/email/phone), success message.
    - Navigate to page: dropdown of flyer's pages.
    - Reveal: target layer(s) to toggle visibility.
  - Visual badge on canvas layers that have an action attached.

**Modes:**
- **Design mode** — full editing.
- **Interaction mode** — preview inside the editor; clicking a layer fires its action exactly like the public viewer.

## Public viewer (`/f/:slug`)
- Mobile-first responsive scaling (canvas fits viewport width, maintains aspect).
- Tappable layers with subtle hover/tap feedback.
- Smooth animated popups, video lightboxes, slide transitions between pages.
- Lead form modal with validation; submissions saved + analytics event.
- Fires a `view` event on load (deduped by session) and `click`/`submit`/`reveal` events per interaction via an edge function.

## Publishing flow
- "Publish" generates a unique slug, marks flyer published, snapshots state.
- Share dialog shows: public URL (copy), QR code (rendered client-side with `qrcode` lib, downloadable PNG), social share buttons.
- Re-publishing updates the live version.

## Analytics dashboard (`/analytics/:flyerId`)
- KPI cards: total views, unique sessions, total clicks, click-through rate, form submissions.
- Time-series chart (views & clicks over last 30 days) using Recharts.
- Per-element table: layer name/type, clicks, % of total — sorted by most interacted.
- Heatmap-style overlay: render the flyer thumbnail with click counts dotted on each interactive layer.
- Form submissions table with export to CSV.

## Sample content
- Seed one starter flyer template ("Event Invite") so new users see a working example with a few interactive elements pre-wired (Open URL, Popup, Lead form).

## Build order (so each step is testable)
1. Auth, dashboard shell, flyer CRUD, DB schema + RLS + storage bucket.
2. Editor canvas with Konva: add/select/move/resize/rotate/delete text, shapes, images, icons, buttons; layer panel; undo/redo; snap-to-grid; multi-page support; autosave.
3. Inspector — style editing for all element types.
4. Action system — all 8 action types with their payload editors; interaction-mode preview.
5. Publishing — slug, public viewer route, mobile-responsive rendering, QR + share dialog.
6. Analytics — event capture edge function, dashboard with charts, per-element stats, submissions export.
7. Polish — animations, sample template, empty states, loading skeletons, marketing landing page.

## Out of scope (future, structured for later)
Templates marketplace, AI flyer generator, animation triggers, team collaboration, white-labeling, payments. Schema and component boundaries will leave room for these without rework.
