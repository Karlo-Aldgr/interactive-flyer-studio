# Maintenance constraints — digitalbizad work

When building digitalbizad (or any new feature from Mr Biggs’s Aug 2026 ideas), **do not modify** these areas unless explicitly approved after Meta App Review completes.

---

## Meta / Facebook (frozen)

**Do not edit:**

- `supabase/functions/meta-oauth-start/`
- `supabase/functions/meta-oauth-callback/`
- `supabase/functions/_shared/metaCredentials.ts`
- `supabase/functions/_shared/publishing/adapters/facebook.ts`
- `src/components/editor/FacebookPostDialog.tsx`
- `src/components/editor/InstagramPostDialog.tsx`
- `src/components/editor/AutomationHubDialog.tsx` (Meta-related copy/scopes only)
- `src/lib/marketingAutomation.ts` (Meta post paths)

**Reason:** Meta App Review is in progress. Connect/Post flow must match submitted screencast.

**Smoke test after any publish:** Flyer → Automations → Facebook → Connect/Post UI normal.

---

## Affiliate (frozen — core complete)

**Avoid rebuilding:**

- Affiliate attribution RPCs / migrations
- Admin affiliate tabs logic
- Referral capture in `AuthContext` / `ReferralCapture`

**Allowed:** Bug fixes only if client reports a regression.

**Deferred (client said later):** leaderboard, email notifications, commission tiers, final legal terms.

---

## Existing live flows (regression smoke)

After bizad publish, verify:

- `/f/{slug}` public flyers load
- `/affiliate`, `/affiliate/dashboard`, `/admin/affiliates` load
- Onboarding `/onboarding` submits
- Realtor `/r/{slug}` loads
- Share + QR on flyers still work

---

## Safe zones for new work

- New routes: `/bizads/:slug`
- New components under `src/components/bizad/` or `src/pages/PublicBizad.tsx`
- New migration `*_bizads.sql`
- Editor panel that does **not** replace Meta automation UI
- Onboarding **read** (auto-fill) without changing onboarding form fields for MVP
