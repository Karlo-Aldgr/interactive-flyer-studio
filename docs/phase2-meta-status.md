# Phase 2 Meta status (source of truth)

Last updated: 2026-07-13

Use this to keep the roadmap board honest. Do **not** start Phase 3 until this cleanup checklist is done.

## Roadmap vs reality

| ID | Plan label | Reality |
|----|------------|---------|
| 2B | Deploy + test Facebook Post Now | **Done** — OAuth + Post Now on True Animal Chronicles |
| 2C | Real Meta OAuth (users connect their own accounts) | **Partial** — Facebook Login OAuth works per user. Instagram still uses staff Instagram Login token (`META_INSTAGRAM_USER_ACCESS_TOKEN` / DB long-lived), not full per-customer Instagram Login OAuth |
| 2D | Auto-post at scheduled time | **Done** — Facebook + Instagram via `meta-post-scheduled` cron |
| 2E | Instagram Post Now | **Done** — Post Now + container wait + Extend token (~60 days) |
| 3 | Track clicks/engagement, suggest improvements | **Done (MVP)** — portal Suggestions card + view beacon dedupe; see `docs/phase3-insights.md` |
| 4 | More channels (TikTok, email, SMS, etc.) | **Not started** |
| 5 | Full AutoPilot dashboard, subscriptions, agency tools | **Not started** |

## What works in test mode (today)

- AI Social Copy (OpenAI direct in `marketing-trigger`; n8n optional fallback)
- Manual Save copy if AI is stuck
- Facebook Connect with Facebook → Post Now → Schedule auto-post
- Instagram User ID save → Post Now → Schedule auto-post
- Instagram **Extend Instagram token (60 days)** + auto-refresh near expiry
- Public marketing flyer URLs (`tapthatflyer.com`)

## Not production-ready yet

- Meta app is **unpublished** (testers/roles only)
- Instagram Content Publishing needs **App Review** for live customers
- Instagram token is **staff/global**, not each customer’s own IG OAuth
- No analytics / Phase 3 engagement tracking

## Operator checklist (keep green)

| Check | Where |
|-------|--------|
| `OPENAI_API_KEY` | Lovable Secrets |
| `META_APP_ID` / `META_APP_SECRET` | Lovable Secrets |
| `META_INSTAGRAM_USER_ACCESS_TOKEN` | Lovable Secrets (seed) |
| `META_INSTAGRAM_APP_SECRET` | Lovable Secrets (Instagram app secret) |
| `META_CRON_SECRET` + `meta_cron_config` | Secrets + SQL |
| Extend Instagram token | Instagram Post Now button |
| Cron jobs | `meta-post-scheduled` JWT OFF |

## Docs map

| Topic | Doc |
|-------|-----|
| Facebook OAuth | `docs/meta-customer-oauth.md` |
| Facebook schedule | `docs/meta-facebook-scheduled-autopost.md` |
| Instagram Post Now | `docs/meta-instagram-post-now.md` |
| Instagram schedule | `docs/meta-instagram-scheduled-autopost.md` |
| Instagram 60-day token | `docs/meta-instagram-long-lived-token.md` |
| OpenAI direct AI | `docs/fix-marketing-openai-direct.md` |

## Recommended next (after cleanup)

1. Client demo of FB + IG Post Now + one scheduled post each  
2. Decide: per-customer Instagram Login OAuth **or** Phase 3 analytics  
3. Only then Meta App Review for live mode
