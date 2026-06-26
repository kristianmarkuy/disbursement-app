
-- Fix RLS policies for schools table
DROP POLICY IF EXISTS "select_schools" ON schools;
DROP POLICY IF EXISTS "insert_schools" ON schools;
DROP POLICY IF EXISTS "update_schools" ON schools;
DROP POLICY IF EXISTS "delete_schools" ON schools;

CREATE POLICY "select_schools" ON schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_schools" ON schools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_schools" ON schools FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_schools" ON schools FOR DELETE TO authenticated USING (true);

-- Fix RLS policies for transactions table
DROP POLICY IF EXISTS "select_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;
DROP POLICY IF EXISTS "update_transactions" ON transactions;
DROP POLICY IF EXISTS "delete_transactions" ON transactions;

CREATE POLICY "select_transactions" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_transactions" ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_transactions" ON transactions FOR DELETE TO authenticated USING (true);

-- Fix RLS policies for uacs_codes table
DROP POLICY IF EXISTS "select_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "insert_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "update_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "delete_uacs" ON uacs_codes;

CREATE POLICY "select_uacs" ON uacs_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_uacs" ON uacs_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_uacs" ON uacs_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_uacs" ON uacs_codes FOR DELETE TO authenticated USING (true);

-- Grant necessary permissions to authenticated role
GRANT ALL ON schools TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON uacs_codes TO authenticated;

-- Revoke anon access completely
REVOKE ALL ON schools FROM anon;
REVOKE ALL ON transactions FROM anon;
REVOKE ALL ON uacs_codes FROM anon;
