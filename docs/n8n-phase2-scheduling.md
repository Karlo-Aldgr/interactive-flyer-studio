# Phase 2: In-app Facebook / Instagram scheduling

Phase 1 generates AI copy. Phase 2 lets users **schedule** and **mark posted** per channel inside TapThatFlyer.

**No Meta posting from the schedule buttons themselves.** Scheduling is stored in the database; a cron job (`meta-post-scheduled`) posts due Facebook drafts in Meta test mode. See `docs/meta-facebook-scheduled-autopost.md`.

## What was added

| Area | Change |
|------|--------|
| Migration | `supabase/migrations/20260708220000_marketing_drafts_channel_status.sql` |
| Helpers | `schedule` / `unschedule` / `mark posted` in `src/lib/marketingAutomation.ts` |
| UI | Per-channel status + datetime picker in `MarketingDraftsDialog` |

New columns on `marketing_drafts`:
- `facebook_status` / `instagram_status` → `draft` \| `scheduled` \| `posted` \| `failed`
- `facebook_scheduled_for` / `instagram_scheduled_for`
- `facebook_posted_at` / `instagram_posted_at`
- `facebook_error_message` / `instagram_error_message`

Also adds an **UPDATE** RLS policy so owners/admins/editors can change statuses.

## What YOU must do (local-first — not live yet)

### 1. Run the SQL migration (shared DB)

Lovable → **Cloud** → **SQL editor** → paste the full contents of:

`supabase/migrations/20260708220000_marketing_drafts_channel_status.sql`

→ **Run**

(This updates the shared cloud database. It does **not** change the live website UI until you Publish.)

### 2. Test locally only

```powershell
cd C:\Users\Sausage-\ohmyzsh\interactive-flyer-studio
npm run dev
```

1. Open a **published** flyer in the editor.
2. Open **AI posts**.
3. Confirm AI status is **Ready** (Regenerate if needed).
4. Under Facebook:
   - pick a **future** datetime → **Schedule**
   - badge should say **Scheduled**
   - **Unschedule** → back to **Draft**
   - **Mark posted** → **Posted**
5. Repeat for Instagram independently.

### 3. Do NOT do these until Phase 2 is approved

- Do **not** merge to `main` (unless you choose to)
- Do **not** click **Publish** in Lovable

## Optional SQL checks

```sql
SELECT facebook_status, facebook_scheduled_for,
       instagram_status, instagram_scheduled_for,
       facebook_posted_at, instagram_posted_at
FROM public.marketing_drafts
ORDER BY created_at DESC
LIMIT 3;
```

## Out of scope (later)

- Instagram API auto-post at scheduled time
- Email drafts
