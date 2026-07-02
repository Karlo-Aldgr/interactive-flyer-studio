## Goal

Let admins invite a realtor two ways:
1. **Email invite** — enter name + email, system emails a branded invite with a one-click accept link.
2. **Shareable link** — generate a tokenized URL to copy/paste anywhere (SMS, WhatsApp, DM). First person to open + sign up claims it.

Both paths auto-grant the `realtor` role on sign-up / sign-in and mark the invite consumed. Existing `/realtor/apply` flow stays as-is for realtors who find the site on their own.

## Backend

Create `public.realtor_invites`:
- `id`, `token` (uuid, unique, indexed), `email` (nullable — null = open shareable link), `invited_name` (nullable)
- `invited_by` (admin uid), `note` (optional)
- `status`: `pending` | `accepted` | `revoked` | `expired`
- `accepted_by` (uid, nullable), `accepted_at`, `expires_at` (default now + 30 days)
- standard timestamps
- RLS: admins full access; anon can `SELECT` a single row only via RPC by token (no direct table read)
- GRANTs to `authenticated` + `service_role` per project rules

RPCs (SECURITY DEFINER):
- `admin_create_realtor_invite(_email text, _name text, _note text, _expires_days int)` → returns `{ id, token, accept_url }`. Admin-only.
- `admin_list_realtor_invites()` → admin-only list.
- `admin_revoke_realtor_invite(_id uuid)` → sets `status='revoked'`. Admin-only.
- `resolve_realtor_invite(_token uuid)` → public; returns `{ ok, email, invited_name, status }` for the invite page to render (no PII beyond invited email/name).
- `accept_realtor_invite(_token uuid)` → requires `auth.uid()`; verifies token pending + not expired + (if email set, matches user's email); grants `realtor` role via `user_roles`; marks accepted. Returns `{ ok }`.

Extend `handle_new_user()` trigger: if a matching pending invite exists for this new user (open token stored in signup metadata OR email match), grant `realtor` role and mark accepted. This covers the "sign up first, then land on `/realtor/accept`" case cleanly via a fallback call from the accept page.

## Email

Uses Lovable's built-in app email (`send-transactional-email`). Add one new template `realtor-invite.tsx` in `supabase/functions/_shared/transactional-email-templates/` with:
- Personalized greeting
- Note from admin (if provided)
- Big "Accept invite" CTA linking to `https://<site>/realtor/accept?token=…`
- Fallback plain URL

Prerequisite: email domain + `setup_email_infra` + `scaffold_transactional_email` must be in place. If not, run those first as part of implementation.

Registered in `registry.ts`. `admin_create_realtor_invite` (or a thin edge wrapper) invokes `send-transactional-email` with `idempotencyKey = invite-<id>`.

## Frontend

**Admin — new panel in `AdminUsers.tsx`** (or new `RealtorInvitesPanel.tsx` beside `RealtorAccessApplicationsPanel`):
- "Invite realtor by email" form (name, email, optional note) → creates invite + sends email → toast confirms
- "Generate shareable link" button → creates open invite (no email) → shows the URL with Copy button
- Table of outstanding invites: recipient, type (Email / Link), status, expires, actions (Copy link, Resend email, Revoke)

**Public — `/realtor/accept?token=…`** (`src/pages/RealtorAcceptInvite.tsx`):
- Calls `resolve_realtor_invite` → shows invited name/email and branded "You're invited to the Realtor Portal" card
- If not signed in: shows Sign-up (email prefilled + locked if invite was email-targeted) and Sign-in tabs; on success, calls `accept_realtor_invite` and redirects to `/realtor`
- If signed in: single "Accept & enter portal" button
- Error states: expired, revoked, already accepted, email mismatch

Route added in `src/App.tsx`. Link from `ForRealtors.tsx` unchanged (still points to `/realtor/apply`).

## Out of scope

- Bulk CSV invite upload
- Public "nominate your realtor" page (Option C from the question)
- Editing invite after creation (only revoke + create-new)

## Notes for the user (non-technical)

- You'll get a new "Invite realtors" section in Admin → Users.
- Two buttons: **Invite by email** sends a branded email with an accept link; **Generate share link** gives you a URL you can text, DM, or paste anywhere.
- The moment they accept (and sign up if needed), they're granted realtor access — no manual approval step.
- Existing `/realtor/apply` public form stays for realtors who find you on their own.
- Invites expire after 30 days by default and can be revoked at any time.
