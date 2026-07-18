# Meta App Review package (TapThatFlyer)

Goal: move Facebook / Instagram posting from **dev/test mode** (only app roles & testers) to **Live** so real customers can Connect with Facebook and post.

This is mostly a **Meta Developer Console + business process** task. The product code for Post Now / Schedule / OAuth already exists.

## Where we are today

| Piece | Status |
|-------|--------|
| Facebook Login OAuth (per user → Page) | Works in **test mode** |
| Facebook Post Now + Schedule | Works for testers |
| Instagram Post Now + Schedule | Works with staff/global IG token (test) |
| Meta app **Live / published** | **Not yet** |
| Advanced Access for production customers | **Needs App Review** |

While the app is unpublished / permissions are Standard Access only, random customers **cannot** complete Login or publish.

## Permissions we use (request these)

From `meta-oauth-start` (Facebook Login):

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Instagram publishing (separate product / review often required):

- Content publishing via Instagram Graph / Instagram Login flow used by `meta-instagram-post-now`
- Today: staff token + Instagram User ID (see `docs/meta-instagram-post-now.md`)
- Later: per-customer Instagram Login OAuth (still deferred)

Also useful in review text:

- We only post content the user generated/approved in TapThatFlyer
- We store page tokens server-side (`meta_connection_secrets`), not in the browser

## App Review checklist (operator)

### A. Meta Developer Console prep

1. Open [developers.facebook.com](https://developers.facebook.com) → TapThatFlyer app  
2. **Settings → Basic**
   - App icon, privacy policy URL, terms URL, app category  
   - Business verification if Meta asks (Business Manager)  
3. **Facebook Login → Settings**
   - Valid OAuth Redirect URI (exact):
     ```text
     https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/meta-oauth-callback
     ```
4. **App Review → Permissions and Features**
   - Request **Advanced Access** for:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`
5. Prepare **Instagram** publishing permissions if you want public IG Post Now for all customers (separate review items — follow Meta’s current Instagram Content Publishing requirements)

### B. Required public pages (must be live URLs)

Create or confirm these on tapthatflyer.com (or a stable public site):

- Privacy Policy (data use, tokens, posting on behalf of Pages)
- Terms of Service
- Data deletion instructions (Meta often requires a callback or clear instructions)

Do **not** publish unrelated marketing site changes unless asked — only ensure these legal pages resolve publicly.

### C. Screencast (required)

Record a short video showing:

1. Log into TapThatFlyer  
2. Open a published flyer → Add automations → Facebook Post Now  
3. **Connect with Facebook** → pick Page → approve permissions  
4. Generate / use AI copy → **Post Now**  
5. Show the post on the Facebook Page  

Optional second clip: Schedule a post, then show it went out (or cron confirmation).

Tips:

- Use a Meta **test user** or role account if Live isn’t approved yet  
- Narrate: “User authorizes their Page; we only publish their approved flyer marketing copy.”

### D. Written use case (paste into App Review)

Suggested wording (edit names as needed):

> TapThatFlyer is an interactive flyer platform for businesses. After a user creates and publishes a flyer, they can generate marketing copy and post it to their own Facebook Page from our editor.  
> We request `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` so the user can connect their Page via Facebook Login and publish or schedule posts they explicitly approve.  
> We do not post without the user starting Post Now or Schedule. Tokens are stored securely server-side and used only for that user’s posting.

### E. Submit & wait

1. Submit each permission for App Review  
2. Answer Meta reviewer questions quickly  
3. When approved → switch permissions to Advanced Access  
4. Decide when to set the app **Live** (publish app)  
5. Keep `META_TEST_MODE_ENABLED` until you’re ready for production-only behavior  

## After approval (engineering)

- Confirm OAuth still works for a **non-tester** Facebook account  
- Confirm Post Now / Schedule with that account  
- Optionally reduce reliance on global `META_PAGE_ACCESS_TOKEN` fallback  
- Plan per-customer Instagram OAuth (separate from this Facebook Page review)  
- Update `docs/phase2-meta-status.md` when Live

## What Carlo / staff should do this week

1. Confirm privacy, terms, and data-deletion URLs resolve live (`/privacy`, `/terms`, `/data-deletion`) and match Meta app settings  
2. Record the Facebook Connect → Post Now screencast  
3. Submit App Review for the three `pages_*` permissions  
4. Tell Mr Biggs: FB/IG posting works today for testers; Live customers need this review  

## What we are NOT doing in this package

- Rewriting Meta edge functions (already working in test)  
- Publishing the TapThatFlyer marketing website unless asked  
- Twilio SMS (blocked on account verification)  
- TikTok / Google Ads live APIs  

## Related docs

- `docs/meta-customer-oauth.md` — OAuth setup  
- `docs/meta-instagram-post-now.md` — IG Post Now  
- `docs/phase2-meta-status.md` — roadmap honesty board  
