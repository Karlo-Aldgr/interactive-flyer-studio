# Phase 4: Multi-channel drafts (email, TikTok, SMS)

AI generates marketing copy for several channels from one flyer. Facebook/Instagram can auto-post (Meta test mode). Email / TikTok / SMS are **copy-only** (no send APIs yet). Mass email prefills AI email into Gmail / Mail app.

## What shipped

| Piece | Location |
|-------|----------|
| DB columns | `email_subject`, `email_body`, `tiktok_caption`, `sms_body` |
| AI generation | `marketing-trigger` OpenAI JSON keys |
| n8n callback | `marketing-draft-complete` |
| UI drafts | AI Social Copy dialog |
| MassEmail prefill | Subscribers → Compose mass email |
| AutoPilot | TikTok + SMS checkboxes enabled (copy draft) |

## Migrations

- `20260713223000_marketing_email_draft.sql`
- `20260714203000_marketing_tiktok_sms_draft.sql`

## How to verify

1. Run both SQL migrations in Lovable
2. Redeploy `marketing-trigger` (+ `marketing-draft-complete` if using n8n)
3. Regenerate AI copy → Facebook, Instagram, Email, TikTok, SMS appear
4. AutoPilot: TikTok + SMS are selectable (not Coming soon)
5. Mass email still prefills email fields
6. Do **not** publish the live website unless asked

## Out of scope (later)

- TikTok / SMS / Google Ads real APIs
- Server email send (Resend etc.)
- Unattended full AutoPilot
