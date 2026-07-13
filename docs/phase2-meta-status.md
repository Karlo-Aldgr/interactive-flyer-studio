# Phase 2 Meta status (source of truth)

Last updated: 2026-07-13

Use this to keep the roadmap board honest.

## Roadmap vs reality

| ID | Plan label | Reality |
|----|------------|---------|
| 2B | Deploy + test Facebook Post Now | **Done** — OAuth + Post Now on True Animal Chronicles |
| 2C | Real Meta OAuth (users connect their own accounts) | **Partial** — Facebook Login OAuth works per user. Instagram still uses staff Instagram Login token (`META_INSTAGRAM_USER_ACCESS_TOKEN` / DB long-lived), not full per-customer Instagram Login OAuth |
| 2D | Auto-post at scheduled time | **Done** — Facebook + Instagram via `meta-post-scheduled` cron |
| 2E | Instagram Post Now | **Done** — Post Now + container wait + Extend token (~60 days) |
| 3 | Track clicks/engagement, suggest improvements | **Done (MVP)** — portal Suggestions card + view beacon dedupe; see `docs/phase3-insights.md` |
| 4 | More channels (TikTok, email, SMS, etc.) | **Partial** — email draft MVP (copy-only); see `docs/phase4-email-draft.md`. TikTok/SMS not started |
| 5 | Full AutoPilot dashboard, subscriptions, agency tools | **Partial (shell MVP)** — checkboxes + START for FB/IG/email/analytics; see `docs/phase5-autopilot.md`. Subscriptions / agency / chatbot deferred |

## What works in test mode (today)

- AI Social Copy (OpenAI direct in `marketing-trigger`; n8n optional fallback) — Facebook, Instagram, **email draft**
- Manual Save copy if AI is stuck
- Facebook Connect with Facebook → Post Now → Schedule auto-post
- Instagram User ID save → Post Now → Schedule auto-post
- Instagram **Extend Instagram token (60 days)** + auto-refresh near expiry
- Public marketing flyer URLs (`tapthatflyer.com`)
- Portal **Suggestions** (Phase 3)
- **AutoPilot** shell (Phase 5) — checkboxes + START for live channels

## Not production-ready yet

- Meta app is **unpublished** (testers/roles only)
- Instagram Content Publishing needs **App Review** for live customers
- Instagram token is **staff/global**, not each customer’s own IG OAuth
- Email is **copy/paste only** (no send)
- AutoPilot does **not** run TikTok/SMS/chatbot/agency yet
- Do **not** publish the live website until explicitly asked

## Operator checklist (keep green)

| Check | Where |
|-------|--------|
| `OPENAI_API_KEY` | Lovable Secrets |
| `META_APP_ID` / `META_APP_SECRET` | Lovable Secrets |
| `META_INSTAGRAM_USER_ACCESS_TOKEN` | Lovable Secrets (seed) |
| `META_INSTAGRAM_APP_SECRET` | Lovable Secrets (Instagram app secret) |
| `META_CRON_SECRET` + `meta_cron_config` | Secrets + SQL |
| Email draft columns | Run `20260713223000_marketing_email_draft.sql` |
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
| Phase 3 insights | `docs/phase3-insights.md` |
| Phase 4 email draft | `docs/phase4-email-draft.md` |
| Phase 5 AutoPilot | `docs/phase5-autopilot.md` |

## Recommended next

1. Finish Phase 4 channel expansion (MassEmail prefill, TikTok/SMS stubs)
2. Phase 5+: subscriptions, agency white-label, chatbot, unattended AutoPilot
3. Defer per-customer Instagram Login OAuth + Meta App Review until after roadmap polish
