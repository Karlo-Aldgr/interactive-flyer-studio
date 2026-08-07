# External posting API for Make.com and n8n

Give outside automation tools (Make.com, n8n, Zapier, custom scripts) a secure HTTP endpoint that can publish to a customer's connected Facebook Page and Instagram account, using the Meta credentials already stored in TapThatFlyer.

## What gets built

### 1. API keys
A new `api_keys` table so each customer/admin can mint keys for their automations:
- Key shown once at creation (`ttf_live_...`), only a SHA-256 hash is stored.
- Fields: owner, label, hashed key, prefix, scopes (`post:facebook`, `post:instagram`, `read:drafts`), last used, revoked flag.
- RLS: owners see only their own keys; admins see all. Grants for `authenticated` + `service_role`.

### 2. Public webhook endpoint
New edge function `external-post` (no JWT; authenticates by `X-API-Key` header), CORS-enabled:

`POST /functions/v1/external-post`
```json
{
  "platform": "facebook" | "instagram" | "both",
  "message": "Post copy here...",
  "image_url": "https://.../flyer.jpg",
  "link": "https://tapthatflyer.com/f/slug",
  "draft_id": "optional-marketing-draft-uuid",
  "flyer_id": "optional-flyer-uuid"
}
```
Behaviour:
- Validate body with Zod; reject bad input with 400 and clear field errors.
- Resolve the key's owner, then reuse the existing shared helpers (`resolveMetaPageCredentials`, `postFacebookToPage`, `resolveInstagramAccess`, `postInstagramImage`) — same code path as the in-app "Post now" buttons.
- If `draft_id` is supplied, pull copy/thumbnail from `marketing_drafts` (owner-checked) and write back status/`provider_post_id`/error the same way the in-app functions do.
- Instagram requires a public image URL; return a clear 400 if missing.
- Return `{ ok, results: { facebook: {...}, instagram: {...} } }` with per-platform status so Make/n8n can branch on it.
- Relay Meta's real error message and status instead of a generic 500.

Companion read endpoint `GET /functions/v1/external-post?action=drafts&flyer_id=...` so n8n can list ready drafts before posting.

### 3. Logging + safety
- `api_request_logs` table: key id, endpoint, platform, status, error, timestamp — visible in the admin portal.
- Simple per-key throttle (max N calls/minute) enforced from the log table.
- Key never logged; only the prefix.

### 4. UI
- New "API & Webhooks" card in the automation hub (and a section in Admin → Automation): create key, copy once, revoke, view recent calls.
- Copy-ready snippet block showing the endpoint URL, headers, and a sample JSON body for Make.com HTTP module and n8n HTTP Request node.

### 5. Docs
`docs/external-posting-api.md` with the full request/response contract plus step-by-step Make.com and n8n node setup.

## Technical notes
- Function registered in `supabase/config.toml` with `verify_jwt = false`; auth is the API key check inside the handler.
- Uses the service-role client after key validation, scoping every query to the key owner's id — external callers can never target another account's flyer or draft.
- No new Meta credentials required; posting reuses each user's existing OAuth page/Instagram tokens.
