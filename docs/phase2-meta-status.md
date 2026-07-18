# Phase 2 Meta status (source of truth)

Last updated: 2026-07-18

Use this to keep the roadmap board honest.

## Roadmap vs reality

| ID | Plan label | Reality |
|----|------------|---------|
| 2B | Deploy + test Facebook Post Now | **Done** — OAuth + Post Now on True Animal Chronicles |
| 2C | Real Meta OAuth (users connect their own accounts) | **Partial** — Facebook Login OAuth works per user. Instagram still uses staff Instagram Login token (`META_INSTAGRAM_USER_ACCESS_TOKEN` / DB long-lived), not full per-customer Instagram Login OAuth |
| 2D | Auto-post at scheduled time | **Done** — Facebook + Instagram via `meta-post-scheduled` cron |
| 2E | Instagram Post Now | **Done** — Post Now + container wait + Extend token (~60 days) |
| 2F | Meta App Review → Live | **In progress** — checklist in `docs/meta-app-review.md` (permissions + screencast + legal URLs) |
| 3 | Track clicks/engagement, suggest improvements | **Done (MVP)** — portal Suggestions card + view beacon dedupe; see `docs/phase3-insights.md` |
| 4 | More channels (TikTok, email, SMS, etc.) | **Partial** — AI drafts + **Resend email send** + SMS code (Twilio account blocked for PH verify). TikTok/Ads still copy-only |
| 5 | Full AutoPilot dashboard, subscriptions, agency tools | **Partial** — AutoPilot + chatbot lead gate + coach; subscriptions / agency deferred; see `docs/phase5-autopilot.md` |

## What works in test mode (today)

- AI Social Copy (OpenAI direct in `marketing-trigger`; n8n optional fallback)
- Manual Save copy if AI is stuck
- Facebook Connect with Facebook → Post Now → Schedule auto-post
- Instagram User ID save → Post Now → Schedule auto-post
- Instagram **Extend Instagram token (60 days)** + auto-refresh near expiry
- Public marketing flyer URLs (`tapthatflyer.com`)
- Portal **Suggestions** (Phase 3)
- **AutoPilot** shell (Phase 5)
- Ask AI chatbot + lead gate + portal knowledge
- Subscriber **email Send now** (Resend)

## Not production-ready yet

- Meta app is **unpublished** / permissions not Advanced Access for all customers — see `docs/meta-app-review.md`
- Instagram Content Publishing for arbitrary customers needs **App Review** + later per-user IG OAuth
- Instagram token is still largely **staff/global**
- SMS send code merged; Twilio signup blocked on phone verification (`0x07`)
- TikTok / Google Ads real send APIs not started
- Do **not** publish the live website until explicitly asked

## Operator checklist (keep green)

| Check | Where |
|-------|--------|
| `OPENAI_API_KEY` | Lovable Secrets |
| `META_APP_ID` / `META_APP_SECRET` | Lovable Secrets |
| `META_INSTAGRAM_USER_ACCESS_TOKEN` | Lovable Secrets (seed) |
| `META_INSTAGRAM_APP_SECRET` | Lovable Secrets (Instagram app secret) |
| `META_CRON_SECRET` + `meta_cron_config` | Secrets + SQL |
| `RESEND_API_KEY` | Lovable Secrets |
| Email draft columns | Run email draft migrations if needed |
| Extend Instagram token | Instagram Post Now button |
| Cron jobs | `meta-post-scheduled` JWT OFF |
| App Review package | `docs/meta-app-review.md` |

## Docs map

| Topic | Doc |
|-------|-----|
| **Meta App Review** | `docs/meta-app-review.md` |
| Facebook OAuth | `docs/meta-customer-oauth.md` |
| Facebook schedule | `docs/meta-facebook-scheduled-autopost.md` |
| Instagram Post Now | `docs/meta-instagram-post-now.md` |
| Instagram schedule | `docs/meta-instagram-scheduled-autopost.md` |
| Instagram 60-day token | `docs/meta-instagram-long-lived-token.md` |
| OpenAI direct AI | `docs/fix-marketing-openai-direct.md` |
| Phase 3 insights | `docs/phase3-insights.md` |
| Phase 4 email draft | `docs/phase4-email-draft.md` |
| Phase 4 email send | `docs/phase4-email-send.md` |
| Phase 4 SMS send | `docs/phase4-sms-send.md` |
| Phase 5 AutoPilot | `docs/phase5-autopilot.md` |

## Recommended next

1. Complete Meta App Review for `pages_*` permissions (screencast + privacy/terms)
2. Retry Twilio when a usable number is available
3. Phase 5+: subscriptions, agency white-label; per-customer Instagram OAuth after FB Live
