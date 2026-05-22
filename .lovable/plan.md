## New interactions to add

1. **Survey** — multi-question form (text / multiple choice / rating per question). Submissions stored per response.
2. **Testimonials** — visitors submit name + star rating + text + optional photo. Owner moderates; approved ones display in a swipeable carousel on the flyer.
3. **Reserve table** — restaurant reservation: date, time slot, party size, name, phone, email, special requests.
4. **Schedule consultation** — variant of book appointment tuned for consultations (topic, duration choice, optional video-call link auto-generated).
5. **Show menu** — opens a built-in Menu page (sections → items with name, description, price, optional image). Acts like a sub-page overlay inside the flyer.
6. **Join challenge** — challenge sign-up (challenge title, dates, goal, rules); visitor joins with name + email; owner sees participant list.
7. **Business rating (5 stars)** — quick tap-a-star rating with optional comment. Aggregated average + count displayed.

Also: add all 7 to the **Landing page** interactions catalog so they show on the website.

## Implementation

### 1. Database (one migration)

Extend the enum and add tables. All tables get RLS mirroring existing patterns (anyone can insert on published flyers; owner reads/updates; admin reads all).

```sql
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'survey';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'testimonial';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'reserve_table';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'schedule_consultation';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'show_menu';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'join_challenge';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'business_rating';
```

New tables:
- `survey_responses` (flyer_id, action_id, session_id, answers jsonb)
- `testimonials` (flyer_id, action_id, name, rating int 1-5, body, photo_url, status: pending/approved/rejected)
- `table_reservations` (flyer_id, action_id, reserve_at, party_size, name, phone, email, notes, status)
- `consultations` reuses `appointments` table with a `metadata.kind = 'consultation'` flag (no new table needed)
- `menus` (flyer_id, action_id, sections jsonb) — single row per action
- `challenge_participants` (flyer_id, action_id, name, email, joined_at)
- `business_ratings` (flyer_id, action_id, session_id UNIQUE per session, stars 1-5, comment)

### 2. Editor — `src/components/editor/ActionEditor.tsx`
- Add labels + preset entries for the 7 new types in `ACTION_LABELS` and `PRESET_TYPES`.
- Add a config UI panel per new type:
  - Survey: question builder (add/remove, type: text / choice / 1-5)
  - Testimonial: toggle requires-approval, allow-photo, headline text
  - Reserve table: available days + time slots, max party size
  - Schedule consultation: duration options, business hours, topic field
  - Show menu: section + item editor (name, desc, price, image upload to `flyer-assets`)
  - Join challenge: title, start/end date, description, rules
  - Business rating: prompt text, allow comment toggle

### 3. Viewer — `src/pages/PublicViewer.tsx`
- Add new cases to the action dispatch switch alongside `"rsvp"` / `"book_appointment"`.
- Build dialogs/sheets that submit to the new tables via the supabase client.
- `show_menu` renders an in-flyer overlay page with the menu sections (no real route change).
- `testimonial` action: tapping shows a carousel of approved testimonials + a "Leave a testimonial" CTA at the bottom.
- `business_rating` shows current average + 5 tap-able stars; persists per `session_id` so a user can update but not double-count.

### 4. Owner dashboards
- Add a tab to each flyer's `SubscribersPanel`/portal area for: Survey responses, Testimonials moderation (approve/reject), Reservations, Challenge participants, Ratings summary. Reuse existing list/export patterns.

### 5. Landing page + jobs catalog — `src/lib/interactionsCatalog.ts`
- Append 7 new `InteractionDef` entries (icon, label, short, details). The landing page already maps over `INTERACTIONS`, so they appear automatically. `SubmitJob.tsx` and admin pages also pick them up.

### 6. Types
- `src/types/flyer.ts` (and any `ActionType` union) gets the 7 new strings. The Supabase `types.ts` regenerates after migration.

## Technical notes
- All new tables use the same RLS shape as `subscribers`/`appointments` — public insert when parent flyer is published; owner-scoped read/update; admin read-all.
- `show_menu` stores menu data in its own `menus` table (rather than `actions.payload`) so menu images and many items don't bloat the action row.
- `business_rating` uses a unique `(flyer_id, action_id, session_id)` index so a viewer can revise their star rating; aggregation done client-side with a single select.
- No new edge functions needed — all direct supabase client writes, identical to existing `rsvp`/`subscribe` flows.

## Out of scope
- Email notifications on new submissions (can be added later with the existing transactional email setup).
- Payment-gated reservations / paid challenges (existing `checkout`/`buy_ticket` cover that).

If approved I'll start with the migration, then types, editor panels, viewer dialogs, and finally the landing-page catalog entries.
