# Real subscriber email send (Resend)

MVP: send AI/manual email to flyer subscribers from **Subscribers → Compose mass email → Send now**.

## What shipped

| Piece | Location |
|-------|----------|
| Edge function | `supabase/functions/send-subscriber-email` (`verify_jwt = true`) |
| UI | `MassEmailDialog` — **Send now** (Gmail / Mail app still available) |

## Secrets (Lovable / Supabase)

- `RESEND_API_KEY` — required
- `RESEND_FROM_EMAIL` — optional, default `TapThatFlyer <onboarding@resend.dev>`  
  For production, use a verified domain sender in Resend (e.g. `TapThatFlyer <hello@yourdomain.com>`).

## Limits

- Max **100** recipients per Send now
- Only active subscribers (not unsubscribed)
- Selected emails must belong to this flyer’s subscriber list
- Plain text body only (MVP)

## Deploy

1. Merge PR
2. Add `RESEND_API_KEY` (+ optional `RESEND_FROM_EMAIL`) in Lovable secrets
3. Redeploy **`send-subscriber-email`**
4. No SQL
5. Do **not** publish website unless asked

## Verify

1. Flyer with ≥1 subscriber (or Ask AI lead)
2. Portal / Subscribers → select → Compose mass email
3. Subject + body → **Send now**
4. Check inbox (and Resend dashboard)

## Out of scope (later)

- HTML templates / branding
- Scheduled blasts
- Open/click tracking
- Unsubscribe link automation
