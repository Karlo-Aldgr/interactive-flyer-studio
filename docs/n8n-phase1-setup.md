# Phase 1: n8n marketing automation setup

When a flyer is **published**, TapThatFlyer creates a row in `marketing_drafts` and calls the `marketing-trigger` edge function, which POSTs to your n8n webhook. n8n uses AI to write a **Facebook post** and **Instagram caption**, then calls back to `marketing-draft-complete`.

## 1. Run the database migration

In Supabase SQL editor (or via Lovable), run:

`supabase/migrations/20260707120000_marketing_drafts.sql`

## 2. Supabase secrets

Add these in **Supabase → Project Settings → Edge Functions → Secrets** (or via Lovable):

| Secret | Example | Purpose |
|--------|---------|---------|
| `N8N_MARKETING_WEBHOOK_URL` | `https://your-n8n.com/webhook/tapthatflyer-marketing` | n8n Webhook trigger URL |
| `MARKETING_WEBHOOK_SECRET` | long random string | Shared secret for the callback |

Generate a secret, e.g. `openssl rand -hex 32`.

## 3. Deploy edge functions

Deploy via **Lovable** (git push + publish, then ask Lovable to deploy):

- `marketing-trigger` — requires JWT (called from the app)
- `marketing-draft-complete` — public; validates `x-marketing-secret` header

## 4. n8n workflow (manual build)

Import `n8n/workflows/phase1-marketing.json` or build:

### Node 1 — Webhook (POST)

- Path: `tapthatflyer-marketing` (or your choice)
- Response: immediately `200` with `{ "ok": true }` (respond before slow AI work)

**Incoming JSON from TapThatFlyer:**

```json
{
  "draft_id": "uuid",
  "flyer_id": "uuid",
  "flyer_title": "Summer Sale Flyer",
  "flyer_url": "https://tapthatflyer.com/f/summer-sale",
  "thumbnail_url": "https://...",
  "callback_url": "https://iwmykqilqywbzxpcgaop.supabase.co/functions/v1/marketing-draft-complete",
  "callback_secret": "your-secret"
}
```

### Node 2 — OpenAI (or AI Agent)

**System prompt (suggested):**

> You write short, engaging social posts for small businesses promoting an interactive digital flyer. Always include the flyer link. Use a friendly, professional tone. Do not invent prices or offers not in the title.

**User prompt:**

```
Flyer title: {{ $json.flyer_title }}
Public link: {{ $json.flyer_url }}

Write:
1) A Facebook post (2-4 short paragraphs, emoji ok, end with the link)
2) An Instagram caption (shorter, hashtags ok, end with the link)

Return ONLY valid JSON:
{"facebook_post":"...","instagram_caption":"..."}
```

Parse the model output as JSON in a **Code** node if needed.

### Node 3 — HTTP Request (callback)

- Method: `POST`
- URL: `{{ $json.callback_url }}` (from webhook payload)
- Headers: `x-marketing-secret: {{ $json.callback_secret }}`
- Body (JSON):

```json
{
  "draft_id": "{{ $('Webhook').item.json.draft_id }}",
  "facebook_post": "...",
  "instagram_caption": "..."
}
```

On failure, POST the same URL with:

```json
{
  "draft_id": "...",
  "status": "failed",
  "error_message": "OpenAI timeout"
}
```

## 5. Test end-to-end

1. Set `N8N_MARKETING_WEBHOOK_URL` to your webhook production URL.
2. In the editor, publish a flyer with a real title and slug.
3. Open **AI Posts** in the top bar (published flyers only).
4. Within ~30s you should see Facebook + Instagram drafts with status **Ready**.

If n8n is not configured, publish still works — the app shows a toast that marketing AI is not set up yet.

## 6. Security notes

- `marketing-draft-complete` rejects requests without the correct `x-marketing-secret`.
- Drafts are RLS-scoped to the flyer owner (admins can read all).
- Phase 1 does **not** post to Meta automatically — copy/paste only.
