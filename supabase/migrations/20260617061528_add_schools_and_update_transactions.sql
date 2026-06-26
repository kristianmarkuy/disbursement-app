
-- Add schools table
CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  division TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_schools" ON schools FOR SELECT TO anon USING (true);
CREATE POLICY "insert_schools" ON schools FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_schools" ON schools FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_schools" ON schools FOR DELETE TO anon USING (true);

-- Seed sample schools first (needed for FK default)
INSERT INTO schools (id, name, code, address, division, region) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'San Jose Elementary School', 'SJES-001', 'San Jose, Metro Manila', 'Division of Metro Manila', 'NCR'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Rizal National High School', 'RNHS-002', 'Rizal, Metro Manila', 'Division of Metro Manila', 'NCR'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Cebu Central Academy', 'CCA-003', 'Cebu City, Cebu', 'Division of Cebu City', 'Region VII');

-- Add school_id to transactions (with valid default)
ALTER TABLE transactions ADD COLUMN school_id UUID NOT NULL DEFAULT 'a1b2c3d4-0001-4000-8000-000000000001' REFERENCES schools(id) ON DELETE CASCADE;

-- Assign some transactions to other schools
UPDATE transactions SET school_id = 'a1b2c3d4-0002-4000-8000-000000000002' WHERE dv_number IN ('DV-2025-013', 'DV-2025-014', 'DV-2025-015', 'DV-2025-016', 'DV-2025-017');
UPDATE transactions SET school_id = 'a1b2c3d4-0003-4000-8000-000000000003' WHERE dv_number IN ('DV-2025-018', 'DV-2025-019', 'DV-2025-020');

-- Create index for performance
CREATE INDEX idx_transactions_school_id ON transactions(school_id);
CREATE INDEX idx_transactions_date ON transactions(date);
