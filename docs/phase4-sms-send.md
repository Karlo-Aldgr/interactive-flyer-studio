# Real subscriber SMS send (Twilio)

MVP: send AI/manual SMS to flyer subscribers who have a **phone** number.

## What shipped

| Piece | Location |
|-------|----------|
| Edge function | `supabase/functions/send-subscriber-sms` |
| UI | Subscribers → **Compose SMS** (`MassSmsDialog`) |
| Chatbot | Optional phone on lead gate (helps fill phone column) |

## Secrets (Lovable / Supabase)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (E.164, e.g. `+1234567890`)

## Limits

- Max **50** recipients per send
- Only active subscribers with non-empty phone
- Message max 320 characters
- Prefer phones with country code (`+63…`)

## Deploy

1. Merge PR
2. Add Twilio secrets in Lovable
3. Redeploy **`send-subscriber-sms`**
4. No SQL
5. Do **not** publish website

## Verify

1. Subscriber with phone (Ask AI optional phone, or Subscribe action with phone)
2. Subscribers → Compose SMS → Send SMS now
3. Check phone inbox

## Note

Chatbot leads that only entered email cannot receive SMS until a phone is collected.
