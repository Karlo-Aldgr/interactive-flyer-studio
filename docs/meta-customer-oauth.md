# Customer Meta OAuth (v1)

Lets each TapThatFlyer user connect their own Facebook Page. Post Now + scheduled posts prefer the user’s OAuth page token; staff can still use the global `META_PAGE_ACCESS_TOKEN` test fallback.

## What was added

| Piece | Path |
|-------|------|
| Migration | `supabase/migrations/20260711233000_meta_customer_oauth.sql` |
| OAuth start | `meta-oauth-start` (JWT on) |
| OAuth callback | `meta-oauth-callback` (JWT off) |
| Token store | `meta_connection_secrets` (service-role only) |
| Resolver | `_shared/metaCredentials.ts` |
| UI | **Connect with Facebook** in `FacebookPostDialog` |

## What YOU must do

### 1. Meta Developer Console (TapThatFlyer Dev)
1. Keep the app **unpublished**
2. Add product **Facebook Login**
3. Valid OAuth Redirect URIs — exact:

```text
https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-oauth-callback
```

4. Permissions for testing: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
5. Add any non-admin testers under **App Roles → Roles / Testers**

### 2. Lovable secrets
Add / confirm:

| Secret | Value |
|--------|--------|
| `META_APP_ID` | already set |
| `META_APP_SECRET` | from Meta App → Settings → Basic |
| `META_OAUTH_REDIRECT_URI` | `https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-oauth-callback` |
| `META_OAUTH_SUCCESS_URL` | `https://tapthatflyer.com` (or your local origin while testing: `http://192.168.x.x:8080`) |
| `META_PAGE_ACCESS_TOKEN` | keep for staff fallback |
| `META_TEST_MODE_ENABLED` | `true` (keeps fallback) |

### 3. Run SQL
Paste/run full migration:

`supabase/migrations/20260711233000_meta_customer_oauth.sql`

### 4. Deploy edge functions
Ask Lovable:

```text
Please deploy/redeploy from main after merge:
1. meta-oauth-start (JWT ON)
2. meta-oauth-callback (JWT OFF)
3. meta-post-now
4. meta-post-scheduled
5. meta-instagram-post-now

Confirm META_APP_SECRET and META_OAUTH_REDIRECT_URI are present.
Do not publish the website.
```

### 5. Test
1. Local editor → Add automations → Facebook Post Now
2. Click **Connect with Facebook**
3. Approve → return to editor with page connected (`connection_mode=oauth`)
4. **Post now** once
5. Confirm staff **manual test** save still works as fallback

## Notes
- While the Meta app is unpublished, only app roles/testers can complete Login.
- v1 picks the first Page (or keeps a previously saved page id if still present).
- Instagram linking is still separate / later.
- Do not put page tokens in `meta_connections` — clients can SELECT that table.
