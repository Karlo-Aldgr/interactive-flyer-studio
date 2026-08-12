# Force a clean Facebook reconnect

Your account (carlo.printbiz@gmail.com) currently shows an `oauth` connection to Page `999313326598579` with status `ready` and a stored page token ending in `CO5T`, plus a stored user token. Meta has invalidated that session, so posting fails while the UI keeps claiming "Connected with …CO5T". The fix is to make dead tokens self-clear and to force Meta to hand out fresh ones.

## 1. OAuth start asks Meta for fresh consent

In `meta-oauth-start`, add `auth_type=rerequest` to the Facebook dialog URL so Meta re-prompts for the page scopes instead of silently reusing a stale grant.

## 2. Dead tokens clear themselves

In `_shared/metaCredentials.ts`, add a `clearMetaConnection(supabase, userId, reason)` helper that:
- deletes the row in `meta_connection_secrets` for that user
- sets `meta_connections.status = 'error'`, `page_access_token_last4 = null`, `last_error = <reason>`, `updated_at = now()`

Call it whenever credentials resolve to a dead state:
- user token present but `/me/accounts` rejects it (expired session, page no longer available)
- OAuth mode with no usable page token and no user token

Then return the existing "Click Connect with Facebook again" error. The UI reads `status` / `page_access_token_last4`, so it will stop showing "Connected with …CO5T".

## 3. Post-time invalidation also clears

In the Facebook post path (`_shared/metaFacebookPost.ts` / publish service), inspect Graph error responses. When the error is a session/token invalidation (Graph `code` 190, subcodes 458/460/463/467, or a message containing "session has been invalidated" / "Session has expired"), call `clearMetaConnection` before returning the error so the next page load shows "Not connected".

## 4. One-time SQL cleanup

Run the two statements you provided against your account: delete the stale `meta_connection_secrets` row and mark `meta_connections` as `error` with `last_error = 'Reconnect required'`.

## 5. Redeploy

Redeploy `meta-oauth-start` and `meta-post-now` with JWT ON. Since the shared credential file changes, also redeploy the other consumers so they don't run older copies: `meta-instagram-post-now` (JWT ON), `external-post` (JWT ON), `meta-post-scheduled` (JWT OFF, cron secret).

## After this

You'll see "Not connected" in the Facebook dialog, click **Connect with Facebook**, approve the re-request prompt, and posting will use the freshly issued page token.
