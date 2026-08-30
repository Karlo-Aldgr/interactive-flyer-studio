# Go live — your next steps (after push)

**Done automatically:** Commit `0b1db13` pushed to `main` on GitHub.

**Lovable deploy:** Usually 5–15 minutes after push. Until then, tapthatflyer.com may still show the old homepage ("See what we're building").

---

## Step 1 — Confirm deploy (do this first)

1. Wait ~10 minutes after the push.
2. Open https://tapthatflyer.com
3. Hard refresh: **Ctrl+Shift+R**
4. You should see:
   - Hero: **"TapThatFlyer is your small business marketing command station"**
   - Button: **"Explore your marketing command station"** (not "See what we're building")
   - Dark section titled **"Everything in one place"** with **6 cards**

If still old after 20 minutes: open Lovable → confirm it synced from GitHub `main` → trigger a publish/redeploy if needed.

---

## Step 2 — Run SQL in Lovable (required for onboarding checkboxes)

**Not in GitHub.** The database is in Supabase, managed through Lovable.

1. Open your **Lovable** TapThatFlyer project
2. Go to **Cloud** → **Database** or **SQL**
3. Paste and run:

```sql
ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS service_interests text[] NOT NULL DEFAULT '{}';
```

4. Success = no error message

**Skip this only if** onboarding service checkboxes are not needed yet — saving onboarding without it may error.

---

## Step 3 — Quick live tests (~15 min)

| Test | How | Pass? |
|------|-----|-------|
| Homepage | Step 1 checks | |
| Choose for me | Submit job → only **"I'd rather you choose for me"** → submit | Shows in Admin → Jobs |
| Onboarding | Onboarding → check services → Save | Admin job → **Services requested** |
| Clients portal | Clients portal → Open portal | Opens portal (not `Missing token or code`) |
| Bizad AI | Any `/bizads/{slug}` | **Ask AI** bottom-left |

**If Clients portal still errors:** Lovable → Cloud → Edge Functions → `portal-access` → **Deploy**

---

## Step 4 — Discord message to Mr Biggs (copy/paste)

```
Sir — pushed the pending list to live.

Shipped:
• Homepage — TapThatFlyer as your marketing command station, with all offerings (flyers, bizad, marketing, websites, portal, AI)
• Submit job — "I'd rather you choose for me" option
• Onboarding — checkboxes for AI automation/marketing, digital business card, and website
• Ask AI on digital business card pages too

SMS auth skipped per your note. Dr already has GitHub collaborator access.

Please test Clients portal on your account and confirm the error is gone.

Quick question on "copy button style" — is the editor button styling + link field what you meant, or something else?
```

---

## GitHub — already done

You invited Dr as collaborator. No further GitHub action today.

**Later (Eugene):** transfer repo to Dr's account + reconnect Lovable.

## Still blocked (not on you)

- Facebook posting — needs Page access
- Hosted website AI — deferred
