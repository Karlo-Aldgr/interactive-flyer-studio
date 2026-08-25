# Website Publishing + Client Subdomains — Inspection Report & Plan

## A. Current flyer publishing flow
`TopBar.togglePublish()` flips `flyers.status` between `draft` / `published`, generates `public_slug` from the title when missing/stale, then captures and uploads a social thumbnail. Public flyer lives at `/f/:slug`; share/QR links are built by `getPublicAppOrigin()` in `src/lib/utils.ts` (`VITE_APP_ORIGIN = https://tapthatflyer.com`). A Cloudflare Worker (`worker/share-worker.js`) serves OG unfurls for `/f/:slug`. None of this will be touched.

## B. Current Website publishing flow
`TopBar.toggleWebsitePublish()` (already present, separate from the flyer) sets `flyers.website_status` = `draft|published` and fills `flyers.website_slug` from the title. Loader `src/lib/websiteLoader.ts` reads the draft by flyer id (`loadWebsiteByFlyerId`) and the published version by slug (`loadPublishedWebsite`). The website page is a normal `pages` row flagged `background.websitePage`.

## C. Current public routes
`/f/:slug` (flyer), `/site/:slug` (published website), `/website-preview/:flyerId` (owner draft preview), plus `/p/:token`, `/w/:token`, `/bizads/:slug`, `/r/:slug`. Everything else is dashboard/editor/admin behind `ProtectedRoute`.

## D. Existing domain configuration
`tapthatflyer.com` and `www.tapthatflyer.com` are connected to this project and active (Lovable hosting, A record `185.158.133.1`). The zone is on Cloudflare (the share Worker already handles `/f/*`). No wildcard record exists.

## E. Relevant database
`flyers` already has everything needed: `owner_id`, `status`, `public_slug` (unique), `website_status` (not null), `website_slug` with a partial unique index. RLS already exposes published-website `pages`, `layers`, `actions` to anon.
**No new tables or columns are required.**

One real gap: the `flyers` SELECT policy for anon is `status = 'published'` only, so a project whose *flyer* is still a draft cannot have its website row read publicly — `/site/:slug` returns "not published". This needs one added policy (website-published rows, read-only).

## F. Wildcard subdomains — NOT supported today
Lovable hosting connects domains one at a time; there is no `*.tapthatflyer.com` support and no wildcard certificate from Lovable. So `businessname.tapthatflyer.com` will **not** work from app routing alone. Two ways forward:

1. **Cloudflare Worker fan-in (recommended).** Add a proxied wildcard DNS record `*.tapthatflyer.com`, put a Worker on route `*.tapthatflyer.com/*` that reads the Host header, extracts the subdomain, and proxies to `https://tapthatflyer.com/site/<sub>` (origin fetch, response streamed back, URL stays on the subdomain). Cloudflare Universal SSL already covers one level of wildcard. Requires DNS + Worker deploy by you — I will not touch DNS.
2. **Path URLs now** (`tapthatflyer.com/site/business-name`) with the subdomain layered on later. Zero infra work.

The app-side work below is identical for both, so subdomains become a DNS/Worker switch-on.

## G. Plan

### 1. Database (one migration)
- Add RLS policy on `flyers`: anon/authenticated may SELECT rows where `website_status = 'published'` (columns already limited by what the client requests; no owner-only data added).
- Add a `SECURITY DEFINER` function `public.website_slug_available(_slug text, _flyer_id uuid)` used for slug uniqueness checks without exposing other users' rows.

### 2. Slug generation (`src/lib/websiteSlug.ts`, new)
`slugifyBusinessName()` → lowercase, spaces → hyphens, strip specials, collapse hyphens, trim, max 40 chars, reject reserved words (`www`, `app`, `api`, `admin`, `preview`, `share`, `mail`, …). Uniqueness loop appends `-2`, `-3`, … until free. Source name: onboarding/business name → project title → "site". No UUIDs in the URL.

### 3. Publish flow (`TopBar.tsx`)
When the active page is a Website page:
- button label `Publish Website` / `Website Published` state, `Unpublish` in the adjacent menu;
- on click: flush the pending editor save first, verify a website page exists, generate/keep the slug, set `website_status = 'published'`;
- on unpublish: set `website_status = 'draft'` only — slug, page, layers and actions are preserved;
- flyer pages keep the exact current publish behaviour.

### 4. Public URL helper (`src/lib/utils.ts`)
`buildPublicWebsiteUrl(slug)` returns `https://<slug>.tapthatflyer.com` when `VITE_WEBSITE_SUBDOMAINS=1`, otherwise `https://tapthatflyer.com/site/<slug>`. One flag flips every surface once DNS is live.

### 5. Host-based routing (`src/App.tsx`)
On boot, if `hostname` is `<sub>.tapthatflyer.com` (and not `www`/`preview`), render `PublicWebsitePage` for that slug at `/` and keep other paths working — so the Worker proxy or a direct wildcard both resolve. Visitors see only the published website: no dashboard, editor, preview badge or project IDs.

### 6. Client dashboard card
A "Website" card in the project view (`MyJobs` / `JobDetailView`) showing Status, the public URL with a copy button, and Open / Edit / Unpublish actions. Read-only for non-owners; all writes stay under the existing owner/admin RLS.

### 7. Draft vs published
The public route keeps reading only `website_status = 'published'`. Editing after publishing changes the draft the editor loads; the public page changes only on the next Publish. (Note: layers are shared storage, so "published snapshot" here means "publicly readable only while published" — a true frozen snapshot would need a new table, which I'd only add if you want edits to be invisible until republish.)

### 8. What you must do for real subdomains
- Cloudflare DNS: add proxied `*` A/CNAME record for `tapthatflyer.com`.
- Deploy `worker/site-worker.js` (I will write it) on route `*.tapthatflyer.com/*`.
- Confirm Universal SSL covers the wildcard.
No DNS change will be made by me without your go-ahead.

## Not changing
Website design, section structure, save architecture, responsive behaviour, flyer publishing, existing published flyers, auth, dashboard.

## Open question
Do you want option 1 (real subdomains, needs the Cloudflare Worker + DNS) or option 2 (ship `/site/<slug>` now, subdomains later)? I'll build the app side either way.
