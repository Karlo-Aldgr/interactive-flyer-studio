# Facebook scheduled auto-post (test mode)

When a marketing draft has `facebook_status = scheduled` and `facebook_scheduled_for` is due, a cron job calls `meta-post-scheduled`, which posts with the same Graph logic as **Post Now** (photo + caption when a public thumbnail exists).

Instagram scheduled auto-post is still out of scope until Instagram linking works.

## What was added

| Area | Change |
|------|--------|
| Shared helper | `supabase/functions/_shared/metaFacebookPost.ts` |
| Edge function | `meta-post-scheduled` (secret-gated, JWT off) |
| Refactor | `meta-post-now` uses the shared helper |
| Migration | `supabase/migrations/20260711023000_facebook_scheduled_autopost_cron.sql` |
| UI copy | AI Social Copy schedule panel notes Facebook auto-posts |

## What YOU must do

### 1. Add secret in Lovable
Cloud → Secrets → **Add secret**:

- Name: `META_CRON_SECRET`
- Value: any long random string (example: generate with a password manager)

Keep it private. You will paste the same value into SQL below.

### 2. Run SQL in Lovable
Cloud → SQL editor:

**A. Run the migration file** (full contents):

`supabase/migrations/20260711023000_facebook_scheduled_autopost_cron.sql`

**B. Store the same secret for cron** (must match `META_CRON_SECRET`):

```sql
insert into public.meta_cron_config (id, cron_secret)
values (1, 'PASTE_SAME_META_CRON_SECRET_HERE')
on conflict (id) do update
set cron_secret = excluded.cron_secret,
    updated_at = now();
```

### 3. Deploy edge functions
Ask Lovable:

```text
Please deploy/redeploy from main (after merge):

1. meta-post-now
2. meta-post-scheduled

JWT OFF for meta-post-scheduled.
JWT ON for meta-post-now.
Confirm META_CRON_SECRET is present.
Do not publish the website.
```

### 4. Local test
1. Ensure Facebook Post Now still works (page connected + token valid)
2. AI Social Copy → schedule Facebook for **2 minutes from now**
3. Wait up to ~2 minutes (cron runs every minute)
4. Confirm:
   - Facebook Page shows the post
   - Draft `facebook_status` becomes `posted`
   - `facebook_provider_post_id` is set

### Manual trigger (optional)
```bash
curl -X POST "https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-post-scheduled" \
  -H "Content-Type: application/json" \
  -H "x-meta-cron-secret: YOUR_SECRET" \
  -d "{}"
```

## Safety
- Still Meta **test mode** / unpublished app
- Uses global `META_PAGE_ACCESS_TOKEN`
- No live website Publish required for the function itself
