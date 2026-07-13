# Phase 4 MVP: Email draft (copy-only)

Shipped: AI generates an email subject + body alongside Facebook/Instagram copy. Operators copy/paste into their mail tool. **No auto-send** in v1.

## What shipped

| Piece | Location |
|-------|----------|
| DB columns | `marketing_drafts.email_subject`, `email_body` |
| AI generation | `marketing-trigger` OpenAI JSON keys |
| n8n callback | `marketing-draft-complete` accepts email fields |
| UI | AI Social Copy dialog — Email subject/body + Copy/Save |

## How to verify

1. Run SQL migration `20260713223000_marketing_email_draft.sql` in Lovable/Supabase
2. Redeploy `marketing-trigger` (and `marketing-draft-complete` if using n8n)
3. Open a published flyer → Automation Hub → **Open AI posts** → **Regenerate**
4. Confirm Email subject + body appear; Copy and Save work
5. Confirm there is **no** Send button

## Out of scope (later)

- Actual email send / MassEmail prefill
- TikTok, SMS, and other channels
- Phase 5 AutoPilot dashboard
