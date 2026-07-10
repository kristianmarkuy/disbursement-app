-- Ensure there is always an approved admin account.
-- This repairs databases where the first/admin user profile is still pending.

INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  approval_status,
  approved_at
)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'name', '')), '')
  ),
  'admin',
  'approved',
  now()
FROM auth.users u
WHERE u.id = (
  SELECT id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM user_profiles
  WHERE role = 'admin'
    AND approval_status = 'approved'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
  role = 'admin',
  approval_status = 'approved',
  approved_at = COALESCE(user_profiles.approved_at, now()),
  updated_at = now();
