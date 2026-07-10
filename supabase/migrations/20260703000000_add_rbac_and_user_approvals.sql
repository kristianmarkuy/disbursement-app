-- Add role-based access control and admin approval workflow.

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'officer', 'viewer')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status ON user_profiles(approval_status);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS user_profiles_touch_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_touch_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT := 'viewer';
  assigned_status TEXT := 'pending';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE role = 'admin'
      AND approval_status = 'approved'
  ) THEN
    assigned_role := 'admin';
    assigned_status := 'approved';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        role = COALESCE(public.user_profiles.role, assigned_role),
        approval_status = COALESCE(public.user_profiles.approval_status, assigned_status),
        approved_at = CASE
          WHEN COALESCE(public.user_profiles.approval_status, assigned_status) = 'approved'
          THEN COALESCE(public.user_profiles.approved_at, now())
          ELSE public.user_profiles.approved_at
        END;

  UPDATE public.user_profiles
  SET role = assigned_role,
      approval_status = assigned_status,
      approved_at = CASE WHEN assigned_status = 'approved' THEN COALESCE(approved_at, now()) ELSE approved_at END
  WHERE id = NEW.id
    AND role = 'viewer'
    AND approval_status = 'pending'
    AND assigned_role = 'admin';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS auth_users_create_profile ON auth.users;
CREATE TRIGGER auth_users_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

INSERT INTO user_profiles (id, email, full_name)
SELECT
  u.id,
  COALESCE(u.email, ''),
  NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', '')), '')
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name);

UPDATE user_profiles
SET role = 'admin',
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE id = (
  SELECT id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE role = 'admin' AND approval_status = 'approved'
);

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_profiles
  WHERE id = auth.uid()
    AND approval_status = 'approved';
$$;

CREATE OR REPLACE FUNCTION current_user_is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user_role() = 'admin';
$$;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uacs_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "update_user_profiles" ON user_profiles;

CREATE POLICY "select_user_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR current_user_is_admin());

CREATE POLICY "update_user_profiles" ON user_profiles
  FOR UPDATE TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

DROP POLICY IF EXISTS "select_schools" ON schools;
DROP POLICY IF EXISTS "insert_schools" ON schools;
DROP POLICY IF EXISTS "update_schools" ON schools;
DROP POLICY IF EXISTS "delete_schools" ON schools;

CREATE POLICY "select_schools" ON schools
  FOR SELECT TO authenticated
  USING (current_user_is_approved());

CREATE POLICY "insert_schools" ON schools
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'officer'));

CREATE POLICY "update_schools" ON schools
  FOR UPDATE TO authenticated
  USING (current_user_role() IN ('admin', 'officer'))
  WITH CHECK (current_user_role() IN ('admin', 'officer'));

CREATE POLICY "delete_schools" ON schools
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "select_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;
DROP POLICY IF EXISTS "update_transactions" ON transactions;
DROP POLICY IF EXISTS "delete_transactions" ON transactions;

CREATE POLICY "select_transactions" ON transactions
  FOR SELECT TO authenticated
  USING (current_user_is_approved());

CREATE POLICY "insert_transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'officer'));

CREATE POLICY "update_transactions" ON transactions
  FOR UPDATE TO authenticated
  USING (current_user_role() IN ('admin', 'officer'))
  WITH CHECK (current_user_role() IN ('admin', 'officer'));

CREATE POLICY "delete_transactions" ON transactions
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "select_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "insert_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "update_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "delete_uacs" ON uacs_codes;

CREATE POLICY "select_uacs" ON uacs_codes
  FOR SELECT TO authenticated
  USING (current_user_is_approved());

CREATE POLICY "insert_uacs" ON uacs_codes
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "update_uacs" ON uacs_codes
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "delete_uacs" ON uacs_codes
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION set_school_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_school_transaction_stats()
RETURNS TABLE (
  school_id uuid,
  txn_count bigint,
  total_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.school_id,
    COUNT(*)::bigint,
    COALESCE(SUM(t.amount), 0)::numeric
  FROM transactions t
  INNER JOIN schools s ON s.id = t.school_id
  WHERE current_user_is_approved()
  GROUP BY t.school_id;
$$;

CREATE OR REPLACE FUNCTION get_school_transaction_totals(p_school_id uuid)
RETURNS TABLE (
  total_amount numeric,
  txn_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(t.amount), 0)::numeric,
    COUNT(*)::bigint
  FROM transactions t
  INNER JOIN schools s ON s.id = t.school_id
  WHERE t.school_id = p_school_id
    AND current_user_is_approved();
$$;

GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON schools TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON uacs_codes TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_transaction_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_transaction_totals(uuid) TO authenticated;

REVOKE ALL ON user_profiles FROM anon;
