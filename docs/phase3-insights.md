# Phase 3: Engagement insights MVP

Shipped: rules-based improvement suggestions on top of existing `analytics_events` tracking.

## What shipped

| Piece | Location |
|-------|----------|
| Insight rules | `src/lib/flyerInsights.ts` |
| Suggestions UI | Flyer portal → **Suggestions** card (above Analytics charts) |
| View dedupe | `PublicViewer` — `pagehide` beacon only if initial view insert failed |
| Page views | `PublicViewer` — logs `view` with `page_id` on page change |
| Poll results page | `/analytics/:id` links to the flyer portal for full performance |

## Rules (when views ≥ 10)

- Low CTR
- Hotspots with zero clicks
- Low lead conversion (when lead-capture actions exist)
- Unattributed / single-source traffic tips
- Healthy engagement fallback

Below 10 views: **Not enough data yet**.

## How to verify

1. Open a published flyer’s portal: `/flyer/:id/portal` (Analytics role)
2. Confirm **Suggestions** appears under the KPI cards
3. Low-traffic flyer → “Not enough data yet”
4. Navigate multi-page flyer → page-change views appear in `analytics_events` with `metadata.page_change`
5. Normal visit should **not** double-count views on close

## Out of scope (later)

- Meta post engagement pull
- Heatmaps / AI rewrite suggestions
- Phase 4 channels / Phase 5 AutoPilot
