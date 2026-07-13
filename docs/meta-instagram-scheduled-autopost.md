# Instagram scheduled auto-post (test mode)

When a marketing draft has `instagram_status = scheduled` and `instagram_scheduled_for` is due, the existing cron job calls `meta-post-scheduled`, which now also posts Instagram using the same Instagram Login flow as **Instagram Post Now**.

## Requirements already in place

| Piece | Notes |
|-------|--------|
| Cron | Same `pg_cron` job that hits `meta-post-scheduled` every minute |
| Secret | `META_CRON_SECRET` + `meta_cron_config.cron_secret` |
| IG token | `META_INSTAGRAM_USER_ACCESS_TOKEN` (from Meta → Generate token) |
| IG account | Numeric Instagram User ID saved in Instagram Post Now |

## Deploy

```text
Please redeploy from main:
1. meta-post-scheduled (JWT OFF)
2. meta-instagram-post-now (JWT ON)

Confirm META_INSTAGRAM_USER_ACCESS_TOKEN and META_CRON_SECRET exist.
Do NOT publish the website.
```

## Test

1. Instagram Post Now still works once
2. AI Social Copy → Instagram → Schedule for **2–3 minutes from now**
3. Wait for cron (~1 minute after due time)
4. Confirm Instagram shows the post and draft status becomes **posted**

## Manual trigger (optional)

```bash
curl -X POST "https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-post-scheduled" \
  -H "Content-Type: application/json" \
  -H "x-meta-cron-secret: YOUR_SECRET" \
  -d "{}"
```
