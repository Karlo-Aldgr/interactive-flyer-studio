## Why the shared link asks for login

The public viewer route `/f/:slug` is correctly **not** behind auth, and the database is correctly configured so anonymous visitors can read published flyers. The login screen is being triggered because the link being shared is not actually the public `/f/:slug` URL on the published domain. Two real-world causes:

1. **Share URL is built off the current browser origin.** When you open the editor on the Lovable **preview** sandbox (a `*.lovableproject.com` / `id-preview--*.lovable.app` URL) and open Share, the social URL falls back to the same preview origin. The preview sandbox requires a Lovable session, so anyone you send that link to gets the login screen. The existing `getShareOrigin()` helper already rewrites preview hosts to the published `interactive-flyer-studio.lovable.app` host, but the `socialUrl` (the one shown in the dialog, QR code, copy button, and social-share buttons) doesn't go through it consistently.
2. **The "Preview" button URL gets shared by mistake.** The editor's Preview button points at `/preview/:flyerId`, which **is** behind `<ProtectedRoute>`. If you copy that URL from the address bar after clicking Preview and send it to someone, they hit the login wall. Today nothing in the UI warns against this.

## What we'll change

### 1. Make every shared URL use the public published origin
- In `src/components/editor/TopBar.tsx`, route both `viewerUrl` and the `socialUrl` fallback through `getShareOrigin()` so they always resolve to `https://interactive-flyer-studio.lovable.app/f/<slug>` (or a configured custom share origin / Cloudflare Worker), never the preview sandbox origin.
- In `src/components/editor/ShareDialog.tsx`, defensively normalize any URL that contains `lovableproject.com`, `id-preview--`, or `lovable.app/preview/` before display/copy/QR — replace the host with the published origin, and refuse to copy `/preview/...` links.

### 2. Block the wrong URL pattern from ever being shared
- Don't render social/copy/QR controls in `ShareDialog` until `flyer.public_slug` exists and `flyer.status === "published"`. Show a clear inline message: "Publish the flyer first — then anyone with the link can view it without logging in."
- In `TopBar.tsx`, change the **Preview** button so it opens `/preview/:flyerId` in a new tab as today, but visually label it "Preview (private)" and add a tooltip: "Only you can see this. Use Share to send it to others." This makes it obvious the address-bar URL is not for sharing.

### 3. Make the public viewer resilient when a flyer isn't published
- `PublicViewer` currently silently shows a blank loader if the slug query returns nothing. Add a friendly "This flyer isn't available" screen with a link back to the homepage, so a stale or unpublished link never looks like an auth problem.

### 4. Sanity-check the publish state of the flyer the user just tested
- After the changes ship, confirm in the editor that the Publish toggle is on (status = "published") and that the Share dialog link starts with `https://interactive-flyer-studio.lovable.app/f/`. If it doesn't, the user is still on the preview sandbox and we'll know to guide them to use the published share link.

## Files to edit

- `src/components/editor/TopBar.tsx` — normalize `viewerUrl` / `socialUrl`, relabel Preview button, gate Share button on published state.
- `src/components/editor/ShareDialog.tsx` — defensive URL normalization, "publish first" empty state, fix the existing `DialogHeader` ref warning while we're in there.
- `src/pages/PublicViewer.tsx` — friendly "not available" state when the slug lookup returns nothing.

No database, RLS, or routing changes are needed — those are already correct.

## Out of scope

- Setting up the Cloudflare Worker for rich social previews (already documented in `worker/README.md`; unrelated to the login issue).
- Changing the auth flow itself.
