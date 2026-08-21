# Verify Bizad MVP in Preview

The digital business card (bizad) code from PR #56 is already present on main in this project. No import or merge is needed. This plan is verification only — no source files change, nothing is published.

## What already exists

- `src/pages/PublicBizad.tsx` — public card page
- `src/components/editor/BizadDialog.tsx` — editor dialog
- `src/lib/bizad.ts` — helpers
- `/bizads/:slug` route in `src/App.tsx` (lazy loaded)
- Entry points in `src/components/editor/TopBar.tsx` and `TopBarActionMenus.tsx`
- Migration `supabase/migrations/20260820120000_bizads.sql` and `bizads` in generated types

## Verification steps

1. Query the `bizads` table read-only to find an existing enabled card slug (or confirm the table is empty).
2. Drive the running preview with a headless browser:
   - Load `/bizads/:slug` for a real slug; capture a screenshot and any console/network errors.
   - Load `/bizads/does-not-exist` to confirm the not-found state behaves.
   - Open the editor and the Bizad dialog from the TopBar menu; screenshot its render state.
3. Report findings: what renders, what errors appear, and whether the public card is reachable without auth.

## Out of scope

- No changes to Meta or affiliate code.
- No code edits, migrations, or edge function deploys.
- No publishing — preview only.
