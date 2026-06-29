## Fix

Grant Sherman Bowen (the admin) a dual `realtor` role so `/r/sherman-bowen` resolves and loads his public listings page.

### Step

Insert one row into `user_roles`:
- `user_id`: `26bc7e4b-0251-4063-8e70-10c653dc8e9b` (Sherman Bowen)
- `role`: `realtor`
- `ON CONFLICT (user_id, role) DO NOTHING` (idempotent)

His existing `admin` role is preserved — he keeps full admin access and gains realtor access. The public profile RPC will now find him.

No code or schema changes needed.
