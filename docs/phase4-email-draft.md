# Phase 4: Multi-channel drafts

AI generates marketing copy for several channels from one flyer.

| Channel | Behavior |
|---------|----------|
| Facebook / Instagram | Draft + Meta schedule / Post Now (test mode) |
| Email | Draft + MassEmail prefill + **Send now** (Resend) — see `phase4-email-send.md` |
| TikTok / SMS / Google Ads | Draft copy/paste only |

## DB columns

`email_subject`, `email_body`, `tiktok_caption`, `sms_body`, `google_ads_headline`, `google_ads_description`

## Migrations

- `20260713223000_marketing_email_draft.sql`
- `20260714203000_marketing_tiktok_sms_draft.sql`
- `20260714210000_marketing_google_ads_draft.sql`

## Verify Google Ads

1. Run `20260714210000_marketing_google_ads_draft.sql`
2. Redeploy `marketing-trigger` (+ `marketing-draft-complete` if n8n)
3. Regenerate AI copy → headline + description appear
4. AutoPilot: Google Ads enabled
5. Do **not** publish website unless asked

## Out of scope

Real Ads / TikTok / SMS APIs. Server email send: see `phase4-email-send.md`.
