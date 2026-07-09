# Phase 2B: Meta foundation (test mode)

This phase adds the first real `Facebook Post Now` path while keeping everything local-first.

## What changed

### Database
- New migration: `supabase/migrations/20260709211000_meta_phase2b_foundation.sql`
- Adds `meta_connections` for per-user Meta/Facebook connection metadata
- Extends `marketing_drafts` with Facebook provider delivery fields:
  - `facebook_provider_status`
  - `facebook_provider_post_id`
  - `facebook_last_attempt_at`
  - `facebook_last_error`

### Edge functions
- `meta-connect-start`
  - saves the current user's test Facebook Page metadata
  - marks the connection `ready` when the required Meta secrets exist
- `meta-post-now`
  - posts the latest Facebook copy to the connected Page in Meta test mode
  - writes the provider result back to `marketing_drafts`

### UI
- `Add automations` now opens a working `Facebook Post Now` card
- New `FacebookPostDialog`:
  - saves Facebook Page ID / Page name
  - shows latest AI-generated Facebook copy
  - posts in test mode

## Important safety rules
- Do **not** merge to `main` yet
- Do **not** click Lovable `Publish`
- Do **not** publish the Meta app
- Only use your own test Facebook Page

## What YOU must do

### 1. Run the SQL migration in Lovable
Lovable -> `Cloud` -> `SQL editor`

Paste the full contents of:

`supabase/migrations/20260709211000_meta_phase2b_foundation.sql`

Then click `Run`.

### 2. Add these Supabase secrets in Lovable
Lovable -> Supabase project -> Edge function secrets

Add:

- `META_TEST_MODE_ENABLED=true`
- `META_APP_ID=<your Meta app id>`
- `META_PAGE_ACCESS_TOKEN=<your test Facebook Page access token>`

Optional:

- `META_GRAPH_API_VERSION=v23.0`

Notes:
- keep the Meta app unpublished
- use a Page access token for your own test page only

### 3. Deploy these edge functions from Lovable
- `meta-connect-start`
- `meta-post-now`

Also make sure `supabase/config.toml` includes JWT verification for both.

## Local test flow

### A. Start local app
```powershell
cd C:\Users\Sausage-\ohmyzsh\interactive-flyer-studio
npm run dev
```

### B. Prepare AI copy
1. Open a published flyer in the editor
2. Click `Add automations`
3. Click `Open AI posts`
4. Confirm a Facebook draft exists

### C. Test Facebook Post Now
1. Go back to `Add automations`
2. Click `Open Facebook post`
3. Enter your Facebook Page ID
4. Enter your Facebook Page name
5. Click `Save Facebook page`
6. Confirm the badge becomes `Connected` or `Ready to post`
7. Confirm the generated Facebook copy appears
8. Click `Post now (test mode)`

### D. Confirm result
- In the dialog:
  - provider status should update
  - post id should appear after success
- In Facebook:
  - confirm the post appears on your test page

## Expected failure messages
- `Meta test mode is not enabled yet`
  - add `META_TEST_MODE_ENABLED=true`
- `Missing META_PAGE_ACCESS_TOKEN secret`
  - add the page token secret
- `No Facebook copy is ready yet`
  - generate AI copy first
- `Facebook page is not connected yet`
  - save page id/name first

## Out of scope for this phase
- full Meta OAuth flow
- user-facing account linking
- Instagram posting
- automatic scheduled posting to Meta
- Meta app review / production permissions
