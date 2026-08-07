# External Publishing API (Make.com / n8n / Zapier)

A single secure endpoint that lets external automation tools publish to a customer's already-connected Facebook, Instagram, and TikTok accounts. No re-authentication in Make/n8n — the API reuses the OAuth credentials already stored in TapThatFlyer.

## What gets built

### 1. API keys
- New `api_keys` table: owner, label, key prefix, SHA-256 hash of the full key, scopes, created/last-used/revoked timestamps.
- Keys look like `ttf_live_xxxxxxxxxxxxxxxxxxxx`. The full value is shown exactly once at creation and never stored in plaintext.
- Access rules: an owner can create, list, and revoke their own keys; admins can manage all keys. Nobody can read a stored hash from the browser.
- New "API access" dialog in the Automation hub for creating, copying (once), and revoking keys, plus a recent-calls view.

### 2. Request logging
- New `api_request_logs` table: request id, owner, key id, endpoint, platforms, media type, status, duration, error message, created at.
- Only the key prefix is ever recorded — never the key itself.

### 3. Rate limiting
Per-key limits (default 60 requests/minute, 1000/day) enforced by counting recent rows in `api_request_logs`, returning HTTP 429 with a `Retry-After` header. Note: the backend has no built-in rate-limiting primitive, so this is an ad-hoc counter — it is accurate enough for abuse prevention but not a hard guarantee under heavy concurrency.

### 4. The endpoint
`POST /api/v1/post` — served by a new public edge function reachable at both a clean `/api/v1/post` path (via the existing Cloudflare worker route on tapthatflyer.com) and its direct function URL for testing.

Authentication is the `X-API-Key` header only. No JWT, no OAuth for callers.

Manual mode:
```json
{
  "mode": "manual",
  "platforms": ["facebook", "instagram", "tiktok"],
  "caption": "Our latest flyer is now available!",
  "media": [{ "type": "image", "url": "https://example.com/flyer.jpg" }],
  "link": "https://tapthatflyer.com/f/123"
}
```
`media` is an array of `{ type, url }` objects (image or video), so multi-item posts can be added later without breaking the contract. A single object is also accepted and normalized.

Draft mode:
```json
{ "mode": "draft", "platforms": ["facebook", "instagram"], "draft_id": "..." }
```
The server loads the draft's copy and media itself. Mixing `mode: "draft"` with manual `caption`/`media` is rejected with a validation error.

### 5. Validation
Zod schemas validate platforms, caption length per platform, HTTPS-only media URLs, media reachability and content type, draft and flyer ownership against the key's owner, payload size, and required fields. Errors come back per field.

### 6. One shared publishing service
A single `publishService` module decides which platforms to target, detects image vs. video, dispatches to the right adapter, and returns a standardized per-platform result. The endpoint contains no platform logic. The existing in-app "Post now" buttons for Facebook and Instagram are refactored to call this same service, so there is exactly one publishing code path.

### 7. Platform adapters
- `facebook.ts` — wraps the existing page photo/feed posting logic, adds video (`/videos`) support.
- `instagram.ts` — wraps the existing container-create/poll/publish logic, adds Reels for video.
- `tiktok.ts` — new. TikTok has no credentials stored today, so this ships with a TikTok connection (per-customer OAuth stored alongside the Meta connections) plus a Content Posting API adapter. If a customer has no TikTok connection, that platform returns a clear `not_connected` result instead of failing the whole request.

### 8. Response
Always HTTP 200 for a processed request, with per-platform outcomes:
```json
{
  "request_id": "...",
  "status": "partial_success",
  "results": [
    { "platform": "facebook", "status": "success", "post_id": "123_456" },
    { "platform": "instagram", "status": "success", "post_id": "178..." },
    { "platform": "tiktok", "status": "failed", "error": "not_connected" }
  ]
}
```
Auth, validation, and rate-limit failures return 401 / 400 / 429 with structured error bodies.

## Technical notes

- Database: `api_keys` and `api_request_logs` with RLS and explicit grants; hashing and verification happen server-side in the edge function using the service role.
- New shared code under `supabase/functions/_shared/publishing/`: `service.ts`, `types.ts`, `adapters/{facebook,instagram,tiktok}.ts`, `apiKeys.ts`, `rateLimit.ts`, `schema.ts`.
- New edge functions: `external-post` (public, `verify_jwt = false`, API-key auth), `tiktok-oauth-start` / `tiktok-oauth-callback` for the TikTok connection.
- `meta-post-now` and `meta-instagram-post-now` are rewritten as thin wrappers over the shared service so behaviour and draft status updates stay identical.
- Secrets required: `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` (requested during the build). Meta secrets already exist.
- Docs page `docs/external-publishing-api.md` with ready-to-paste Make.com and n8n HTTP request configurations.
