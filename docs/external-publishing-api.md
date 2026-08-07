# TapThatFlyer External Publishing API

Publish to a customer's connected Facebook Page, Instagram Business account and
TikTok account from Make.com, n8n, Zapier, Pabbly or any HTTP client.

## Endpoint

```
POST https://<project>.supabase.co/functions/v1/external-post
```

Get the exact URL and create keys in the app: **Automation hub → External publishing API**.

## Authentication

Send the API key in a header. No JWT is used.

```
X-API-Key: ttf_live_xxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Keys are stored as SHA-256 hashes — the plaintext value is shown once at creation.
Revoked keys return `401`.

## Rate limits

- 60 requests per minute
- 1000 requests per day

Exceeding either returns `429` with a `Retry-After` header (seconds).

## Idempotency

Send an optional header to make retries safe:

```
Idempotency-Key: 9f1c2b7e-any-unique-string
```

- The key is stored per API key together with the result for **24 hours**.
- A repeat request with the same API key + `Idempotency-Key` returns the **original
  response** (same body and status) with `Idempotent-Replay: true`, without publishing again.
- Reusing a key with a *different* request body returns `422`.
- If the original request is still running, the retry returns `409` with `Retry-After: 5`.
- After 24 hours the key expires and can be reused.

This prevents duplicate Facebook, Instagram or TikTok posts from network retries in
Make.com, n8n, Zapier or custom clients.


## Request body

### Manual mode

```json
{
  "mode": "manual",
  "platforms": ["facebook", "instagram", "tiktok"],
  "caption": "New listing just dropped!",
  "media": [{ "type": "image", "url": "https://example.com/flyer.jpg" }],
  "link": "https://tapthatflyer.com/f/my-flyer"
}
```

- `platforms` — one or more of `facebook`, `instagram`, `tiktok`.
- `caption` — required unless a Facebook-only link post.
- `media` — array of `{ "type": "image" | "video", "url": "https://…" }`.
  Instagram and TikTok require at least one public media item. TikTok requires a video.
- `link` — optional; used by Facebook link posts.

### Draft mode

```json
{
  "mode": "draft",
  "draft_id": "8f2c…",
  "platforms": ["facebook", "instagram"]
}
```

Uses the copy and thumbnail already generated in TapThatFlyer's marketing drafts.
Per-platform captions come from the draft (`facebook_post`, `instagram_caption`,
`tiktok_caption`). Omit `platforms` to publish to every platform the draft has copy for.

## Response

Always `200` when the request itself is valid, with per-platform results:

```json
{
  "request_id": "1f0a…",
  "results": [
    { "platform": "facebook", "status": "success", "post_id": "1234_5678" },
    { "platform": "instagram", "status": "failed", "error": "Instagram needs a public media URL" },
    { "platform": "tiktok", "status": "not_connected", "error": "TikTok is not connected" }
  ]
}
```

`status` is `success`, `failed` or `not_connected`. A platform that is not connected never
fails the whole request.

## Error responses

| Status | Meaning |
| --- | --- |
| 400 | Validation error — see `error` / `details` |
| 401 | Missing, unknown or revoked API key |
| 405 | Method not allowed (use POST) |
| 429 | Rate limited — retry after `Retry-After` seconds |
| 500 | Unexpected server error |

## Notes

- Facebook and Instagram reuse the Meta connection already made in TapThatFlyer.
- TikTok uses its own OAuth connection and the Content Posting API (`PULL_FROM_URL`),
  so media URLs must be publicly reachable over HTTPS.
- Every call is logged (key prefix only) and visible in the API dialog.

## Asynchronous processing (forward compatibility)

The publishing service is split into a **contract** (`PublishRequest` in,
`PublishOutcome` out) and an **executor** that decides *when* the work runs:

- `executePublishRequest()` — the unit of work (provider calls + draft status
  patches). An inline executor calls it during the HTTP request; a queue worker
  would call the exact same function when it picks a job up.
- `inlineExecutor` — today's default, runs during the request.
- `registerExecutor()` + `PUBLISH_EXECUTOR` env var — swap in a queue-backed
  executor without touching any caller.
- `resolveDraftRequests()` — turns a draft into plain, serialisable
  `PublishRequest` objects, so a worker can persist and replay them.

`PublishRequest` already carries `request_id`, `idempotency_key` and
`scheduled_at` fields reserved for the queued executor.

Clients must therefore treat a response as possibly non-terminal:

```json
{ "request_id": "…", "status": "queued", "job_id": "…",
  "results": [{ "platform": "facebook", "status": "queued" }] }
```

`queued` means accepted, not finished — the terminal result is read back via
`job_id`. Existing fields, status values and HTTP codes are unchanged, so
integrations built against the synchronous behaviour keep working.
