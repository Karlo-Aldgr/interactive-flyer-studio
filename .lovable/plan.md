## Traffic source tracking in analytics

Add "where did this view come from?" to your analytics — Facebook, Instagram, TikTok, WhatsApp, iMessage, Google, Direct, etc.

### How sources are detected

For every flyer view we'll classify the source using two signals (in priority order):

1. **UTM parameters** in the URL (`?utm_source=facebook`) — set by share buttons and ad campaigns.
2. **`document.referrer`** — the page the visitor came from. Hostnames are mapped to friendly brand names (e.g. `l.facebook.com` → Facebook, `t.co` → X / Twitter, `m.me` → Messenger, `wa.me` → WhatsApp, `google.com` → Google).

Anything we can't classify falls back to **Direct** (typed URL, iMessage/SMS taps, QR code scans, in-app browsers that strip the referrer).

No database schema changes needed — the `analytics_events.metadata` column is already JSON and stores `referrer` and `device`; we'll just add `source` and `utm` fields alongside them.

### Where you'll see it

**1. Each flyer's portal (`/flyer/:id/portal` → Analytics tab)** — a new "Traffic sources" card with:
- Bar list of sources ranked by view count (Facebook 42 · 38%, Direct 30 · 27%, Instagram 18 · 16%…)
- Last-30-day filter matching the existing daily-views chart

**2. Site-wide super-admin analytics (`/admin/analytics`)** — same "Traffic sources" card, aggregated across all flyers.

**3. Per-flyer Analytics page (`/analytics/:id`)** — same card.

### Files changed

- `src/pages/PublicViewer.tsx` — add `getTrafficSource()` helper; include `source`, `referrer`, `utm` in the metadata of both view inserts (initial load + tab-close beacon) and click events.
- `src/components/portal/FlyerPortalView.tsx` — new "Traffic sources" card in the Analytics tab.
- `src/pages/AdminAnalytics.tsx` — new "Traffic sources" card next to "Devices".
- `src/pages/Analytics.tsx` — same card (if the page already shows breakdowns).

### Notes

- Historical events (before this change) will all show as "Direct" since they have no `source` field — only new views going forward will carry the brand.
- To make Facebook/Instagram/TikTok attribution airtight, append `?utm_source=facebook` (etc.) to the link when posting. The share dialog can be updated next if you want — say the word.