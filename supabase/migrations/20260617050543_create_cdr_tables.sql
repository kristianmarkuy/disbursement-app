
-- UACS Codes table
CREATE TABLE uacs_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Enable RLS
ALTER TABLE uacs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- UACS policies (public read for now since no auth yet)
CREATE POLICY "select_uacs" ON uacs_codes FOR SELECT TO anon USING (true);
CREATE POLICY "insert_uacs" ON uacs_codes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_uacs" ON uacs_codes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_uacs" ON uacs_codes FOR DELETE TO anon USING (true);

-- Transactions policies (public for now since no auth yet)
CREATE POLICY "select_transactions" ON transactions FOR SELECT TO anon USING (true);
CREATE POLICY "insert_transactions" ON transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_transactions" ON transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_transactions" ON transactions FOR DELETE TO anon USING (true);

-- Seed common UACS codes
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

-- Seed sample transactions
INSERT INTO transactions (date, dv_number, check_number, payee, particulars, amount, fund_source, uacs_code, category) VALUES
  ('2025-01-05', 'DV-2025-001', 'CHK-001001', 'Juan Dela Cruz', 'Salary for January 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-01-10', 'DV-2025-002', 'CHK-001002', 'Office Depot Philippines', 'Office supplies procurement', 12500.50, 'General Fund', '5020402000', 'Maintenance'),
  ('2025-01-15', 'DV-2025-003', 'CHK-001003', 'Meralco', 'Electric bill for January 2025', 8750.00, 'General Fund', '5020403000', 'Maintenance'),
  ('2025-01-20', 'DV-2025-004', 'CHK-001004', 'Maria Santos', 'Cash advance for training', 15000.00, 'Special Fund', '5020408000', 'Training'),
  ('2025-02-03', 'DV-2025-005', 'CHK-001005', 'Juan Dela Cruz', 'Salary for February 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-02-12', 'DV-2025-006', 'CHK-001006', 'Maynilad', 'Water bill for February 2025', 3200.00, 'General Fund', '5020403000', 'Maintenance'),
  ('2025-02-18', 'DV-2025-007', NULL, 'PLDT', 'Internet subscription Q1 2025', 4500.00, 'General Fund', '5020403000', 'Maintenance'),
  ('2025-02-25', 'DV-2025-008', 'CHK-001008', 'ABC Construction', 'Office renovation partial payment', 75000.00, 'General Fund', '5020502000', 'Capital Outlay'),
  ('2025-03-05', 'DV-2025-009', 'CHK-001009', 'Juan Dela Cruz', 'Salary for March 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-03-10', 'DV-2025-010', 'CHK-001010', 'GSIS', 'Employer contribution Q1 2025', 21000.00, 'General Fund', '5020303000', 'Personal Services'),
  ('2025-03-15', 'DV-2025-011', 'CHK-001011', 'City Hardware', 'Repair of air conditioning units', 8500.00, 'General Fund', '5020405000', 'Maintenance'),
  ('2025-03-20', 'DV-2025-012', 'CHK-001012', 'Pedro Reyes', 'Travel expense - Cebu conference', 12500.00, 'General Fund', '5020401000', 'Travel'),
  ('2025-04-05', 'DV-2025-013', 'CHK-001013', 'Juan Dela Cruz', 'Salary for April 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-04-15', 'DV-2025-014', 'CHK-001014', 'Dell Philippines', 'Purchase of laptop computers', 45000.00, 'General Fund', '5020501000', 'Capital Outlay'),
  ('2025-04-22', 'DV-2025-015', 'CHK-001015', 'Municipal LGU', 'Subsidy to local government unit', 100000.00, 'Special Fund', '5020101000', 'Subsidy'),
  ('2025-05-03', 'DV-2025-016', 'CHK-001016', 'Juan Dela Cruz', 'Salary for May 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-05-10', 'DV-2025-017', 'CHK-001017', 'Office Depot Philippines', 'Office supplies restocking', 8750.00, 'General Fund', '5020402000', 'Maintenance'),
  ('2025-06-01', 'DV-2025-018', 'CHK-001018', 'Juan Dela Cruz', 'Salary for June 2025', 35000.00, 'General Fund', '5020301000', 'Personal Services'),
  ('2025-06-10', 'DV-2025-019', 'CHK-001019', 'PhilHealth', 'Employer contribution Q2 2025', 10500.00, 'General Fund', '5020303000', 'Personal Services'),
  ('2025-06-15', 'DV-2025-020', 'CHK-001020', 'DepEd Region VII', 'Training seminar facilitation', 25000.00, 'Special Fund', '5020408000', 'Training');
