# Instagram long-lived token (60 days) + refresh

Instagram Post Now / schedule use an Instagram Login user token.
Short-lived “Generate token” values expire quickly. This flow:

1. Exchanges or refreshes to a **~60-day** token  
2. Stores it in `meta_connection_secrets.instagram_user_access_token`  
3. Auto-refreshes when expiry is within 7 days (on Post Now / cron)

## One-time Meta + Lovable setup

### 1. Instagram App Secret
Meta → TapThatFlyer Dev → Use cases → **Manage messaging & content on Instagram**  
→ **API setup with Instagram login** → **Show** next to Instagram app secret  

Copy that value (this is **not** the Facebook `META_APP_SECRET`).

### 2. Lovable secrets
| Secret | Value |
|--------|--------|
| `META_INSTAGRAM_APP_SECRET` | Instagram app secret from step 1 |
| `META_INSTAGRAM_USER_ACCESS_TOKEN` | current Generate-token value (seed; can stay) |

### 3. SQL
Run migration:

`supabase/migrations/20260713214500_meta_instagram_long_lived_token.sql`

### 4. Deploy
```text
Please deploy/redeploy from main:
1. meta-instagram-token-extend (JWT ON)
2. meta-instagram-post-now (JWT ON)
3. meta-post-scheduled (JWT OFF)

Confirm META_INSTAGRAM_APP_SECRET and META_INSTAGRAM_USER_ACCESS_TOKEN exist.
Run SQL migration 20260713214500_meta_instagram_long_lived_token.sql if not applied.
Do NOT publish the website.
```

### 5. Extend once in the app
1. Hard refresh editor  
2. Instagram Post Now → **Extend Instagram token (60 days)**  
3. Toast should say token saved (~60 days)

After that, posting uses the DB token and refreshes automatically near expiry.
