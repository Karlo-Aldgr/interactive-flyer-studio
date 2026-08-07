# Add posting permission to the onboarding form

The posting-permission consent exists today only inside the editor's "Add Automations" hub (a separate dialog). The onboarding page at `/onboarding` — the "Web & social" section you're looking at — never asks for it, which is why you don't see it there.

## What to add

In the "Web & social" section of onboarding, below the existing Website / Facebook / Instagram / TikTok / Other fields:

- **Facebook Page name** and **Instagram handle** (optional) — the exact identifiers needed to connect and post to their accounts.
- **Posting permission** checkbox: "I authorize TapThatFlyer to create and publish posts on my behalf to the social accounts listed above."
- When checked, a required **Type your full name** signature field, plus a small note that the date and name are recorded as consent.
- Submit is blocked with a clear message if the box is checked but no name is typed.

## Behavior

- Values save to the existing onboarding record fields already in the database (`posting_permission`, `posting_permission_name`, `posting_permission_at`, `facebook_page_name`, `instagram_handle`), so nothing new is needed in the database.
- Returning users see their previously saved permission state pre-filled, and can revoke by unchecking.
- The same consent stays visible/editable from the Add Automations hub, so both places read and write the same record.

## Technical notes

- Edit `src/pages/Onboarding.tsx`: extend the zod schema and default form state with `facebook_page_name`, `instagram_handle`, `posting_permission`, `posting_permission_name`; render the new block in the Web & social card; include the fields in the existing upsert payload, setting `posting_permission_at` to now when granted and null when revoked.
- No changes to `SocialPermissionsDialog.tsx` logic other than confirming it reads the same columns (it already does).
