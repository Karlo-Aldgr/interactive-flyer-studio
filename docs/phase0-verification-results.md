# Phase 0 — Live verification results

Date: 2026-08-30

## Summary

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Clients portal | **Code OK — live needs login test** | `customer_link` handler exists in `portal-access/index.ts`. Mr Biggs may have redeployed. Sign in → Clients portal → Open portal on a paid/completed project. |
| 2 | Email auth | **Code OK** | `Auth.tsx` has email signup + verification screen. Manual signup test recommended. |
| 3 | Homepage | **FAIL (before fix)** | Live site still shows "See what we're building" CTA. Phase 1 addresses this. |
| 4 | Copy button style | **Partial** | Editor has QuickLinkField + button fill/font controls (`Inspector.tsx`). Confirm meaning with Mr Biggs. |
| 5 | Choose for me | **FAIL (before fix)** | Not in SubmitJob until Phase 2. |
| 6 | Onboarding options | **FAIL (before fix)** | No service-interest checkboxes until Phase 3. |
| 7 | Marketing page | **Route exists** | `/marketing` on `main` — requires auth to fully test. |
| 8 | Bizad | **Route exists** | `/bizads/demo` and editor BizadDialog on `main`. |
| 9 | Flyer AI | **Code OK** | `FlyerChatbot` on `PublicViewer.tsx`. Test on any published `/f/{slug}`. |
| 10 | Bizad AI | **Pending Phase 4** | Mounting `FlyerChatbot` on bizad pages. |
| 11 | Facebook posting | **Blocked** | Needs Page access — coordinate with Eugene. |
| 12 | GitHub collaborator | **Pending Phase 5** | Need Dr's GitHub username. |

## Clients portal — if still broken

Lovable → Cloud → Edge Functions → **portal-access** → Deploy.

CLI deploy fails with 403 for Carlo (no Supabase dashboard access).
