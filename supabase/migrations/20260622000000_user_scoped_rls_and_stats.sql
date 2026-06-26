
-- Scope schools to the creating user
ALTER TABLE schools ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION set_school_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS schools_set_user_id ON schools;
CREATE TRIGGER schools_set_user_id
  BEFORE INSERT ON schools
  FOR EACH ROW
  WHEN (NEW.user_id IS NULL)
  EXECUTE FUNCTION set_school_user_id();

-- Schools: user-scoped access
DROP POLICY IF EXISTS "select_schools" ON schools;
DROP POLICY IF EXISTS "insert_schools" ON schools;
DROP POLICY IF EXISTS "update_schools" ON schools;
DROP POLICY IF EXISTS "delete_schools" ON schools;

CREATE POLICY "select_schools" ON schools
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "insert_schools" ON schools
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_schools" ON schools
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_schools" ON schools
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Transactions: access only via owned schools
DROP POLICY IF EXISTS "select_transactions" ON transactions;
DROP POLICY IF EXISTS "insert_transactions" ON transactions;
DROP POLICY IF EXISTS "update_transactions" ON transactions;
DROP POLICY IF EXISTS "delete_transactions" ON transactions;

CREATE POLICY "select_transactions" ON transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = transactions.school_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = transactions.school_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "update_transactions" ON transactions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = transactions.school_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = transactions.school_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_transactions" ON transactions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schools s
      WHERE s.id = transactions.school_id AND s.user_id = auth.uid()
    )
  );

-- UACS codes: shared reference data for authenticated users
DROP POLICY IF EXISTS "select_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "insert_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "update_uacs" ON uacs_codes;
DROP POLICY IF EXISTS "delete_uacs" ON uacs_codes;

CREATE POLICY "select_uacs" ON uacs_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_uacs" ON uacs_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_uacs" ON uacs_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_uacs" ON uacs_codes FOR DELETE TO authenticated USING (true);

-- Aggregated stats per school (replaces loading all transactions on the schools list)
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
  INNER JOIN schools s ON s.id = t.school_id AND s.user_id = auth.uid()
  GROUP BY t.school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_transaction_stats() TO authenticated;

-- Dashboard totals without loading every row
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
  INNER JOIN schools s ON s.id = t.school_id AND s.user_id = auth.uid()
  WHERE t.school_id = p_school_id;
$$;

GRANT EXECUTE ON FUNCTION get_school_transaction_totals(uuid) TO authenticated;
