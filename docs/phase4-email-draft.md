# Phase 4: Email draft + MassEmail prefill

Shipped: AI generates email subject + body; **Subscribers → Compose mass email** prefills that draft into Gmail / Mail app (BCC). Still no server-side email API send.

## What shipped

| Piece | Location |
|-------|----------|
| DB columns | `marketing_drafts.email_subject`, `email_body` |
| AI generation | `marketing-trigger` OpenAI JSON keys |
| n8n callback | `marketing-draft-complete` accepts email fields |
| UI draft | AI Social Copy dialog — Email subject/body + Copy/Save |
| MassEmail prefill | `MassEmailDialog` loads latest marketing draft on open |

## How to verify

1. AI Social Copy has Email subject + body (Regenerate if needed)
2. Flyer has ≥1 subscriber
3. **Subscribers → Compose mass email**
4. Subject/body should show AI text (banner: “Prefilled from AI Social Copy”)
5. **Gmail** / **Mail app** opens with BCC + draft
6. Do **not** publish the live website for this change alone unless asked

## Out of scope (later)

- Server send via Resend / Mailchimp / etc.
- TikTok, SMS, Google Ads
- Unattended AutoPilot email send
