# Long-lived Meta page token (test mode)

Short-lived Graph Explorer page tokens expire in hours and break Post Now + scheduled auto-post.

## Goal
Store a **Page** access token that shows **Expires: Never** in the Access Token Debugger.

## Steps

### 1. Get a short-lived **User** token
1. Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Meta App: **TapThatFlyer Dev**
3. User or Page: **User Token**
4. Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
5. **Generate Access Token** → approve

### 2. Extend it to a long-lived **User** token
1. Open [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
2. Paste the **User** token → **Debug**
3. Click **Extend Access Token** (bottom)
4. Copy the new long-lived user token

### 3. Get the never-expiring **Page** token
Back in Graph API Explorer:
1. Paste the **long-lived user token** into the Access Token field (do not Generate a new short one)
2. Query: `me/accounts`
3. **Submit**
4. Copy `access_token` for **True Animal Chronicles** (`999313326598579`)

### 4. Verify it never expires
1. Access Token Debugger → paste that **page** token → **Debug**
2. Confirm **Type** is Page and **Expires** is **Never**

### 5. Save in Lovable
1. Cloud → Secrets → update `META_PAGE_ACCESS_TOKEN`
2. Redeploy `meta-post-now` and `meta-post-scheduled`

## Notes
- App secret is only needed for server-side exchange; the Debugger **Extend** button avoids pasting the secret into chat.
- Token can still die if you change Facebook password, remove the app, or lose Page role.
- Instagram remains parked until later.
