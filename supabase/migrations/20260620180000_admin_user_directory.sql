-- Admin user directory: profiles table + list_users_with_roles RPC.
-- Extends handle_new_user() to mirror email into profiles (existing signup flow unchanged).

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Backfill existing auth users (safe: ON CONFLICT DO UPDATE).
INSERT INTO public.profiles (id, email, created_at)
SELECT u.id, u.email, u.created_at
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  roles text[],
  job_count bigint,
  flyer_count bigint,
  signed_up_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email,
    COALESCE(
      (
        SELECT array_agg(DISTINCT ur.role::text ORDER BY ur.role::text)
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
      ),
      ARRAY['user']::text[]
    ) AS roles,
    (SELECT count(*)::bigint FROM public.jobs j WHERE j.user_id = p.id) AS job_count,
    (SELECT count(*)::bigint FROM public.flyers f WHERE f.owner_id = p.id) AS flyer_count,
    p.created_at AS signed_up_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
