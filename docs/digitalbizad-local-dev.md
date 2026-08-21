# digitalbizad — local dev (Lovable workflow)

You **do not need** the Supabase CLI. Lovable owns the database — you run SQL from Lovable, not `supabase.com` directly.

Build on **`feature/digitalbizad-mvp`**. Do **not** merge to `main` or publish the site until Mr Biggs approves.

---

## How your stack works

| Layer | Who controls it |
|-------|-----------------|
| Frontend code | Cursor (this repo) + GitHub |
| Live site | Lovable publish |
| Database | Lovable built-in Supabase (no direct dashboard access for you) |
| Localhost | `npm run dev` — still talks to the **same** remote DB via `.env` |

So: localhost uses the real database credentials in `.env`. Anything you save locally hits the same Supabase Lovable uses.

---

## Safe order (recommended)

### Step 1 — Today: UI + code only (no DB change yet)

```bash
npm run dev
```

- Preview the mobile layout at **`/bizads/demo`** (mock data, no migration needed)
- Build/polish editor toggle UI on the branch
- **Do not** run the bizads SQL in Lovable yet — keeps live DB unchanged

### Step 2 — When ready to demo (Friday or after client replies)

1. Push `feature/digitalbizad-mvp` to GitHub
2. In **Lovable**, open the project → **Database / SQL** (or ask Lovable chat):
   - Paste the full contents of `supabase/migrations/20260820120000_bizads.sql`
   - Run it once
3. Sync/deploy the branch in Lovable (preview URL, **do not publish** main site unless you want it public)
4. Test end-to-end:
   - Editor → Portal → **Digital business card** → toggle ON
   - Open `/bizads/{slug}` on the preview URL

### Step 3 — After client approves

1. Merge branch → `main`
2. SQL already applied? Skip. If not, run migration in Lovable
3. **Publish** site in Lovable
4. Send client the live `/bizads/{slug}` link

---

## What NOT to do

- Don't install Supabase CLI unless you want a separate dev project later
- Don't merge to `main` before approval
- Don't run `20260820120000_bizads.sql` in Lovable until you're ready for real data (demo day)

---

## Lovable prompt (when running migration)

Copy this into Lovable when it's time:

```text
Please run this SQL migration on the database (do not change anything else):

[paste full contents of supabase/migrations/20260820120000_bizads.sql]

Then confirm the bizads table exists.
```

---

## Friday demo checklist

- [ ] `/bizads/demo` looks good on phone width (localhost, no DB)
- [ ] Migration run in Lovable (preview only)
- [ ] Editor toggle creates bizad from onboarding
- [ ] Save Contact `.vcf` works
- [ ] QR points to correct URL
- [ ] Meta + affiliate still work (smoke test)
