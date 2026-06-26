-- Fresh database bootstrap for Cash Disbursement Register
-- Run in Supabase Dashboard → SQL Editor on a NEW empty project

-- =============================================================================
-- 1. Tables
-- =============================================================================

CREATE TABLE uacs_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  division TEXT,
  region TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  dv_number TEXT NOT NULL,
  check_number TEXT,
  payee TEXT NOT NULL,
  particulars TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  fund_source TEXT NOT NULL DEFAULT 'General Fund',
  uacs_code TEXT REFERENCES uacs_codes(code),
  category TEXT NOT NULL DEFAULT 'Others',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_school_id ON transactions(school_id);
CREATE INDEX idx_transactions_date ON transactions(date);

-- =============================================================================
-- 2. Auto-set school owner on insert
-- =============================================================================

CREATE OR REPLACE FUNCTION set_school_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER schools_set_user_id
  BEFORE INSERT ON schools
  FOR EACH ROW
  WHEN (NEW.user_id IS NULL)
  EXECUTE FUNCTION set_school_user_id();

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

ALTER TABLE uacs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Schools: each user sees only their own
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

-- Transactions: access via owned schools
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

-- UACS: shared reference data for authenticated users
CREATE POLICY "select_uacs" ON uacs_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_uacs" ON uacs_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_uacs" ON uacs_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_uacs" ON uacs_codes FOR DELETE TO authenticated USING (true);

GRANT ALL ON schools TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON uacs_codes TO authenticated;

REVOKE ALL ON schools FROM anon;
REVOKE ALL ON transactions FROM anon;
REVOKE ALL ON uacs_codes FROM anon;

-- =============================================================================
-- 4. Stats functions (performance)
-- =============================================================================

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

GRANT EXECUTE ON FUNCTION get_school_transaction_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_transaction_totals(uuid) TO authenticated;

-- =============================================================================
-- 5. Seed UACS codes
-- =============================================================================

INSERT INTO uacs_codes (code, title, description, status) VALUES
  ('5020301000', 'Personal Services - Salaries', 'Salaries and wages of regular employees', 'active'),
  ('5020302000', 'Personal Services - Other Compensation', 'Overtime pay, hazard pay, and other compensation', 'active'),
  ('5020303000', 'Personal Services - Benefits', 'Employer contribution to SSS, GSIS, PhilHealth, Pag-IBIG', 'active'),
  ('5020401000', 'Maintenance - Travel', 'Local and foreign travel expenses', 'active'),
  ('5020402000', 'Maintenance - Supplies', 'Office supplies and materials', 'active'),
  ('5020403000', 'Maintenance - Utilities', 'Water, electricity, and other utilities', 'active'),
  ('5020405000', 'Maintenance - Repairs', 'Repair and maintenance of office equipment and facilities', 'active'),
  ('5020408000', 'Maintenance - Training', 'Training and scholarship expenses', 'active'),
  ('5020501000', 'Capital Outlay - Equipment', 'Purchase of office equipment and furniture', 'active'),
  ('5020502000', 'Capital Outlay - Infrastructure', 'Construction and improvement of infrastructure', 'active'),
  ('5020901000', 'Other Operating Expenses', 'Other operating expenses not elsewhere classified', 'active'),
  ('5020101000', 'Subsidy to LGUs', 'Subsidy to local government units', 'active'),
  ('5020801000', 'Interest Payments', 'Interest payments on loans and borrowings', 'active');
