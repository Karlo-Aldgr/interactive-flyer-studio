# Deadline slice: Public marketing URLs + Instagram Post Now

This extends Phase 2B after Facebook Post Now worked in test mode.

## What changed

### 1. Public flyer URLs for marketing
- Marketing drafts now use `buildMarketingFlyerUrl()` from `src/lib/utils.ts`
- Always uses `VITE_APP_ORIGIN` (example: `https://tapthatflyer.com`)
- Local LAN URLs are no longer stored into `marketing_drafts.flyer_url`
- This lets Facebook/Instagram crawl a public link for previews

### 2. Instagram Post Now
- Migration: `supabase/migrations/20260710224500_instagram_post_now_foundation.sql`
- Edge function: `meta-instagram-post-now`
- `meta-connect-start` now also tries to resolve the Instagram Business/Creator account linked to the Facebook Page
- UI: `InstagramPostDialog` + enabled Automation Hub card

## Important safety rules
- Do **not** merge/publish the live website until you approve
- Keep Meta app unpublished
- Test only with your own page/account

## What YOU must do

### A. Run SQL in Lovable
Lovable -> Cloud -> SQL editor

Paste full contents of:

`supabase/migrations/20260710224500_instagram_post_now_foundation.sql`

Run it.

### B. Redeploy edge functions
Ask Lovable:

```text
Please deploy/redeploy these edge functions from main (or the branch that contains them):

1. meta-connect-start
2. meta-instagram-post-now

JWT verification ON for both.
Confirm when finished.
```

Also redeploy `meta-connect-start` so Instagram account lookup is included when saving the Facebook page.

### C. Confirm Instagram is linked
Your Facebook Page must have an Instagram Business/Creator account linked in Meta Business Suite.

### D. Local test: public URL fix
1. `npm run dev`
2. Open a published flyer
3. Regenerate AI posts
4. Confirm the generated Facebook/Instagram copy uses `https://tapthatflyer.com/f/...` (or your `VITE_APP_ORIGIN`), not `192.168.x.x`
5. Optional: Facebook Post Now again and check whether the link preview appears once the public flyer is crawlable

### E. Local test: Instagram Post Now
1. Add automations -> Open Facebook post
2. Save Facebook page (this also refreshes Instagram link detection)
3. Add automations -> Open Instagram post
4. Confirm Instagram account is detected
5. Confirm AI Instagram caption exists
6. Confirm thumbnail URL is public (not LAN)
7. Click Post now (test mode)
8. Confirm Instagram shows the post

## Expected failure messages
- `No Instagram Business/Creator account is linked...`
  - link IG account to the Facebook Page in Meta Business Suite
- `Instagram needs a public flyer thumbnail URL...`
  - regenerate/publish so `thumbnail_url` is a public HTTPS URL
- permission / OAuth errors
  - regenerate page token with Instagram-related page permissions if Meta requests them

## Out of scope
- Customer Meta OAuth
- Auto-post at scheduled time
- Analytics / Phase 3
