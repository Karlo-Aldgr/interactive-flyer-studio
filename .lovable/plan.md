
# Novel / Story Interaction

A new action type that turns a flyer button into an interactive book reader. The author pastes their manuscript, AI splits it on `# Chapter` markers, readers preview the first 3 chapters free, then unlock the rest via PayPal (bundle or per-chapter). The Flyer Portal gets a Novels section for content management, analytics, payments, and author subscribers.

## 1. New Action Type: `novel`

Added to `ActionType` in `src/types/flyer.ts`. Editable in `ActionEditor.tsx` with a new "Novel / Story" panel containing:

- **Book title, author name, cover image**
- **Manuscript editor** — large textarea + "Import .txt" button
- **Split chapters with AI** button — calls a `split-novel` edge function (Lovable AI, `google/gemini-3-flash-preview`). The AI scans the text for `# Chapter ...` markers and returns an ordered array `[{ number, title, body }]`. If no markers exist it returns one chapter and surfaces a warning. Result is stored on the action payload.
- **Chapter list** with per-chapter: title (editable), free/locked toggle, individual price. Defaults: first 3 chapters free, rest locked.
- **Pricing**
  - Bundle price (unlocks whole book)
  - Per-chapter default price (used for any chapter without a custom price)
  - Currency (USD default)
- **PayPal** — PayPal.me handle OR PayPal business email, pulled from `flyer.settings` (new `payPaypal` field, set in `FlyerPaymentSettingsDialog`)
- **Author subscribe block** — toggle to show "Follow author (free)" and "Subscribe to author (paid monthly)" with monthly price

## 2. Reader Experience (Viewer)

New `NovelReaderDialog` component opened from `NewInteractionDialogs.tsx`:

- Cover + title + author + "Follow / Subscribe" buttons
- Vertical chapter list. Free chapters open inline in a scrollable reader. Locked chapters show a lock icon, price, and two buttons:
  - **Unlock this chapter** → opens PayPal payment URL for chapter price
  - **Unlock entire book** → opens PayPal payment URL for bundle price
- After successful payment the reader enters the email used at PayPal; we verify against `novel_purchases` and unlock matching chapters. Unlock state is also cached in `localStorage` keyed by flyer+action+email so a returning reader stays unlocked.
- "Follow author" collects email into existing `subscribers` table with `list_name = 'novel:<bookTitle>'`.
- "Subscribe (paid)" opens PayPal subscription link configured by author.

All chapter opens, unlock clicks, and completed payments emit `analytics_events` with `action_type: 'novel_*'` (open, chapter_view, unlock_click, purchase_complete, subscribe).

## 3. Database (migrations)

```text
novel_purchases
  flyer_id, action_id, book_id, buyer_email, buyer_name,
  purchase_type ('bundle' | 'chapter'), chapter_numbers int[],
  amount, currency, paypal_txn_id, status, created_at

novel_subscriptions
  flyer_id, action_id, subscriber_email, subscriber_name,
  tier ('free' | 'paid'), paypal_subscription_id, status,
  started_at, ended_at
```

Both tables: `GRANT` for `anon` insert (viewer flow) + `authenticated` read for owner, `service_role` ALL. RLS: anyone can insert; only flyer owner + admin can select/update via `auth.uid() = flyers.owner_id`.

## 4. Flyer Portal — Novels Section

New tab in `FlyerPortalView.tsx`: **Novels**. Lists every `novel` action found in this flyer's pages. For each book:

- **Overview** — cover, title, total chapters, free vs locked counts, revenue total
- **Content** — same chapter list as the editor; portal owner can flip free/locked, edit titles, adjust per-chapter price, re-run AI split, replace manuscript. Writes back to the `actions` row.
- **Pricing** — edit bundle price, per-chapter default, PayPal handle, currency
- **Analytics** — opens, chapter-by-chapter view counts, unlock-click rate, conversion rate, top chapters (from `analytics_events`)
- **Payments** — table of `novel_purchases` (date, email, type, chapters, amount, PayPal txn), CSV export
- **Subscribers** — table of `novel_subscriptions` split into Free followers and Paid subscribers, CSV export, mass-email button reusing existing `MassEmailDialog`

## 5. AI Chapter Splitter (edge function)

`supabase/functions/split-novel/index.ts`:
- Input: `{ text }`
- Uses AI SDK + Lovable AI Gateway with `Output.object` schema `{ chapters: [{ number, title, body }] }`
- Prompt instructs: split on lines matching `^#\s*Chapter` (case-insensitive, allow `Ch.`, roman numerals, numbers); preserve original prose verbatim inside each chapter; title is the heading text after `Chapter N`
- For very long manuscripts, splits client-side on the markers first and only sends ambiguous segments to AI for title cleanup, keeping token use bounded
- CORS enabled, no auth required (called from editor)

## 6. PayPal Integration

No PayPal API keys needed. Payment links use:
- **One-off**: `https://www.paypal.com/paypalme/<handle>/<amount><currency>` (or business-email `cmd=_xclick` link as fallback)
- **Subscription**: author pastes their own PayPal subscription button URL in the editor
- After redirect back, reader self-reports email + PayPal transaction ID on a small confirmation form; row inserted into `novel_purchases` with `status='pending'`. Portal owner approves in Payments tab (sets `status='completed'`), which triggers unlock for that email on next load. (Mirrors the existing pay-later flow used elsewhere in the app.)

## Technical Notes

- Files touched/created:
  - `src/types/flyer.ts` — add `novel` to `ActionType`, extend `ActionPayload` with `novelBookTitle`, `novelAuthor`, `novelCoverUrl`, `novelManuscript`, `novelChapters`, `novelBundlePrice`, `novelChapterPrice`, `novelCurrency`, `novelFreeCount`, `novelPaypalHandle`, `novelSubscribePrice`, `novelSubscribeUrl`, `novelFollowEnabled`
  - `src/components/editor/ActionEditor.tsx` — Novel panel + "Split with AI" call
  - `src/components/viewer/NewInteractionDialogs.tsx` + new `NovelReaderDialog.tsx`
  - `src/components/portal/FlyerPortalView.tsx` + new `NovelsPanel.tsx`
  - `src/lib/interactionsCatalog.ts` — register Novel interaction with icon + description
  - `supabase/functions/split-novel/index.ts`
  - Two migrations for `novel_purchases` and `novel_subscriptions` (with GRANTs + RLS + updated_at trigger)
- Reuses existing patterns: analytics_events for tracking, subscribers table for free follows, MassEmailDialog for outreach, FlyerPaymentSettingsDialog for PayPal handle storage.
