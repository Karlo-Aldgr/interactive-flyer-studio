# Share Worker — Cloudflare deployment

This Worker serves social-media link previews (Facebook Messenger, WhatsApp, iMessage, Slack, etc.) for published flyers. It exists because:

- Lovable's static hosting can't render per-flyer OG tags (no SSR).
- Supabase Edge Functions inject a `Content-Security-Policy: sandbox` header that makes Facebook ignore their OG tags.

A Cloudflare Worker is a real HTTP server with clean headers, free for our scale (100k requests/day on the free plan).

## Deploy in 5 minutes

1. Sign up for a free Cloudflare account at <https://dash.cloudflare.com>.
2. In the dashboard sidebar, go to **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name (e.g. `flyerflow-share`). Click **Deploy** to create the placeholder.
4. Click **Edit code**. Delete the example, paste the entire contents of `share-worker.js` from this folder, click **Deploy**.
5. Click **← Back to Worker** → **Settings** → **Variables and Secrets** → **Add variable**. Add these three (all as plain "Text", NOT secrets — the anon key is publishable):

   | Name                | Value                                                       |
   | ------------------- | ----------------------------------------------------------- |
   | `SUPABASE_URL`      | `https://iwmykqilqywbzxpcgaop.supabase.co`                  |
   | `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (your project's anon key)         |
   | `APP_ORIGIN`        | `https://interactive-flyer-studio.lovable.app`              |

   Click **Deploy** again so the variables take effect.

6. Note the Worker URL Cloudflare assigned (e.g. `https://flyerflow-share.<your-subdomain>.workers.dev`).
7. Test it: open `https://<worker-url>/f/<some-published-slug>` in a browser — you should be redirected to the live viewer. Then test in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — paste the same URL, click "Scrape Again", and confirm the flyer's title and image appear.

## Wire the Worker URL into the app

Open the app, go to any flyer's editor, and the **Share dialog** will let you paste your Worker base URL. The app stores it in `localStorage` (`flyerflow.shareOrigin`) and uses it for all share links going forward.

If you'd rather hard-code it, set `VITE_SHARE_ORIGIN` in your environment (e.g. `https://flyerflow-share.your-subdomain.workers.dev`) and republish the app.

## Optional: custom subdomain

If you own a domain you can attach a subdomain like `share.yourdomain.com`:

1. In the Worker's **Settings** → **Triggers** → **Custom Domains** → **Add Custom Domain**.
2. Enter `share.yourdomain.com`. Cloudflare walks you through the DNS step.
3. Update the share origin in the app to use the new domain.
