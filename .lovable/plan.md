Grant the `admin` role to the account `showoffgrafixs@gmail.com` so it can access `/admin/jobs` and other admin-only views.

## Steps

1. Look up the user id for `showoffgrafixs@gmail.com` in `auth.users`.
2. Insert a row into `public.user_roles` with that `user_id` and `role = 'admin'` (no-op if it already exists thanks to the unique constraint).
3. Have you sign out and back in (or just refresh `/dashboard`) so the **Admin** button appears in the header.

## Notes

- This is a one-row data change only — no code or schema is modified.
- If the email isn't found, that account hasn't signed up yet. Sign up first at `/auth`, then re-run this.
