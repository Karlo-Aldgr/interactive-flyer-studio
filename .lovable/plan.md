## Goal

Make Facebook Messenger (and other social platforms) show the **actual flyer thumbnail and title** in link previews — not a generic image, not raw HTML.

## Why the current setup fails

Two architectural blockers, confirmed by inspecting live responses:

1. **Supabase Edge Functions inject `Content-Security-Policy: default-src 'none'; sandbox`** on every response. Facebook's crawler treats sandboxed pages as untrusted and discards their OG tags. This header cannot be removed.
2. **Lovable's static hosting has no SSR**, so `/f/:slug` always returns the same `index.html` with the default OG image. Per-flyer dynamic tags are impossible from the app itself.

You can't fix this inside Lovable or Supabase alone. You need a real server in front that returns clean HTML with proper OG tags.

## Recommended solution: Cloudflare Worker

A Cloudflare Worker is the simplest "real server" option:

- Free tier covers far more than you'll need (100k requests/day).
- No server to maintain — single JavaScript file.
- Sits on a subdomain you control (e.g. `share.yourdomain.com` or a free `*.workers.dev` URL).
- Returns clean HTML with no sandbox CSP, so social crawlers parse OG tags correctly.

This replaces the broken `og-meta` Supabase function entirely.

## What the Worker does

For a request like `https://share.yourdomain.com/f/my-flyer-slug`:

1. Fetches the flyer row from Supabase using the slug (read-only, public published flyers only).
2. If the User-Agent is a social crawler (Facebook, WhatsApp, iMessage, Twitter, LinkedIn, Slack, Discord, Telegram, etc.), returns HTML containing real OG/Twitter meta tags pointing to the flyer's thumbnail and title.
3. If the User-Agent is a normal browser, 302-redirects to `https://interactive-flyer-studio.lovable.app/f/my-flyer-slug` so the user lands in the interactive viewer.

```text
  Messenger crawler ──► Worker ──► HTML with og:image of THIS flyer
  Real user click   ──► Worker ──► 302 redirect to live app viewer
```

## Implementation steps

### 1. App-side changes (I'll do these)

- Update `src/components/editor/TopBar.tsx` so `socialUrl` points to the Worker URL (e.g. `https://share.<your-domain>/f/<slug>`) instead of the Lovable app URL.
- Keep `viewerUrl` (the friendly URL shown in the dialog) pointing to the Lovable app.
- Delete/retire the `og-meta` Supabase edge function — it's no longer used.
- Clean up the static OG tags in `index.html` so the homepage still has a sensible default.

### 2. Worker code (I'll write the file; you deploy it)

I'll create `worker/share-worker.js` in the repo containing the full Worker code. You then:

1. Create a free Cloudflare account (if you don't have one).
2. Create a new Worker, paste in the code, deploy.
3. Set two Worker environment variables: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (anon key only — no service role needed since published flyers are publicly readable via RLS).
4. Either use the free `*.workers.dev` URL Cloudflare gives you, or bind a subdomain you own.
5. Tell me the final Worker URL and I'll wire it into the app.

### 3. Verify

After deployment, test the share link in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/). It should show the flyer's actual thumbnail and title.

## Alternatives if you don't want a Worker

- **Vercel/Netlify Functions** — same idea, slightly more setup. I can write that code instead if you prefer.
- **Move the entire app off Lovable hosting to Next.js on Vercel** — overkill just for social previews.
- **Accept generic previews** — keep the static `og:image` we just set up; every shared link shows the same FlyerFlow image.

## What you need to decide

- Are you okay deploying a Cloudflare Worker (free, ~5 min setup)?
- Do you want to use a subdomain of a domain you own, or the free `*.workers.dev` URL?

Once you confirm, I'll write the Worker code and update the app to point at it.
