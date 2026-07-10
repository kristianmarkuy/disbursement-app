-- Mock data seed for LedgerOne / Cash Disbursement Register
--
-- Local reset:
--   supabase db reset
--   If no auth user exists yet, this creates:
--     email: demo@ledgerone.test
--     password: password123
--
-- SQL editor:
--   Existing projects are seeded for the first auth.users row by created_at.
--
-- The app scopes schools and transactions by schools.user_id, so all mock schools
-- are assigned to one auth user.

DO $$
DECLARE
  target_user_id uuid;
  demo_user_id uuid := '00000000-0000-4000-8000-000000000001';
  demo_email text := 'demo@ledgerone.test';
  central_high_id uuid := '10000000-0000-4000-8000-000000000001';
  lincoln_middle_id uuid := '10000000-0000-4000-8000-000000000002';
  washington_elem_id uuid := '10000000-0000-4000-8000-000000000003';
  northview_senior_id uuid := '10000000-0000-4000-8000-000000000004';
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    target_user_id := demo_user_id;

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      demo_email,
      crypt('password123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      demo_user_id,
      demo_user_id,
      demo_user_id::text,
      jsonb_build_object('sub', demo_user_id::text, 'email', demo_email),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END IF;

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
  WHERE u.id = target_user_id
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
    role = 'admin',
    approval_status = 'approved',
    approved_at = COALESCE(user_profiles.approved_at, now()),
    updated_at = now();

  INSERT INTO uacs_codes (code, title, description, status) VALUES
    ('501-000', 'Salaries and Wages', 'Regular payroll, honoraria, and employee compensation', 'active'),
    ('502-100', 'Instructional Materials', 'Textbooks, learning modules, laboratory kits, and classroom supplies', 'active'),
    ('502-200', 'Office Supplies', 'Administrative supplies, forms, printing, and stationery', 'active'),
    ('503-100', 'Utilities Expense', 'Electricity, water, internet, and communication services', 'active'),
    ('503-200', 'Facilities Maintenance', 'Repair and maintenance of school buildings and equipment', 'active'),
    ('504-050', 'Technology Upgrades', 'ICT equipment, software licenses, and network improvements', 'active'),
    ('505-300', 'Transportation and Fuel', 'School vehicle fuel, maintenance, and transport services', 'active'),
    ('506-010', 'Training and Seminars', 'Professional development, workshops, and conference expenses', 'active'),
    ('507-400', 'Capital Outlay - Infrastructure', 'Construction, major repairs, and building improvements', 'active'),
    ('508-900', 'Other Operating Expenses', 'Miscellaneous operating costs not otherwise classified', 'active')
  ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO schools (id, name, code, address, division, region, user_id) VALUES
    (central_high_id, 'Central High School', 'SCH-10024', '1042 Education Blvd, District 4', 'Springfield City Schools Division', 'Region IV-A', target_user_id),
    (lincoln_middle_id, 'Lincoln Middle School', 'SCH-10025', '88 Oak Avenue, Springfield', 'Springfield City Schools Division', 'Region IV-A', target_user_id),
    (washington_elem_id, 'Washington Elementary', 'SCH-10026', '400 Elm Street, Springfield', 'Springfield City Schools Division', 'Region IV-A', target_user_id),
    (northview_senior_id, 'Northview Senior High', 'SCH-10027', '17 Ridge Road, North District', 'North District Schools Division', 'NCR', target_user_id)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    division = EXCLUDED.division,
    region = EXCLUDED.region,
    user_id = EXCLUDED.user_id,
    updated_at = now();

  DELETE FROM transactions
  WHERE school_id IN (
    central_high_id,
    lincoln_middle_id,
    washington_elem_id,
    northview_senior_id
  );

  INSERT INTO transactions (
    school_id,
    date,
    dv_number,
    check_number,
    payee,
    particulars,
    amount,
    fund_source,
    uacs_code,
    category
  ) VALUES
    -- Central High School: dashboard and table-rich data across all quarters
    (central_high_id, '2026-01-08', 'DV-24-01-001', 'CK-990101', 'EduSupplies Co.', 'Science laboratory materials - Q1 replenishment', 12450.00, 'General Fund', '502-100', 'Maintenance'),
    (central_high_id, '2026-01-15', 'DV-24-01-002', 'CK-990102', 'City Maintenance Dept.', 'Roofing repair - North Wing', 8200.50, 'General Fund', '503-200', 'Maintenance'),
    (central_high_id, '2026-02-03', 'DV-24-02-003', 'CK-990103', 'Meralco', 'Electricity bill for January 2026', 28340.75, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2026-02-18', 'DV-24-02-004', 'CK-990104', 'TechVision Systems', 'Annual software license renewal', 45000.00, 'Special Fund', '504-050', 'Capital Outlay'),
    (central_high_id, '2026-03-05', 'DV-24-03-005', 'CK-990105', 'Global Books Ltd.', 'Library restocking - first semester', 3120.75, 'General Fund', '502-100', 'Maintenance'),
    (central_high_id, '2026-03-22', 'DV-24-03-006', 'CK-990106', 'Transport Services Inc.', 'Monthly fleet fuel allocation', 15800.00, 'General Fund', '505-300', 'Travel'),
    (central_high_id, '2026-04-09', 'DV-24-04-007', 'CK-990201', 'Springfield Utilities', 'Electricity and water bill for March 2026', 12350.25, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2026-04-21', 'DV-24-04-008', 'CK-990202', 'ABC Supplies Corp.', 'Procurement of office supplies for Q2', 8200.00, 'General Fund', '502-200', 'Maintenance'),
    (central_high_id, '2026-05-06', 'DV-24-05-009', 'ADA-0012', 'Department of Education', 'Remittance of unexpended balances', 1050.00, 'Trust Fund', '508-900', 'Others'),
    (central_high_id, '2026-05-17', 'DV-24-05-010', 'CK-990203', 'Global Builders LLC', 'Progress billing - roof repair building A', 45000.00, 'Special Fund', '507-400', 'Capital Outlay'),
    (central_high_id, '2026-06-04', 'DV-24-06-011', 'CK-990204', 'Payroll Office', 'Teaching personnel payroll allocation', 448500.00, 'General Fund', '501-000', 'Personal Services'),
    (central_high_id, '2026-06-19', 'DV-24-06-012', 'CK-990205', 'Northstar Training Center', 'School heads financial management seminar', 18500.00, 'Special Fund', '506-010', 'Training'),
    (central_high_id, '2026-07-03', 'DV-24-07-013', 'CK-990301', 'EduSupplies Co.', 'Instructional materials - Q3 order', 12450.00, 'General Fund', '502-100', 'Maintenance'),
    (central_high_id, '2026-07-16', 'DV-24-07-014', 'CK-990302', 'City Maintenance Dept.', 'Roofing repair - North Wing', 8200.50, 'General Fund', '503-200', 'Maintenance'),
    (central_high_id, '2026-08-02', 'DV-24-08-001', 'CK-990214', 'TechServe Solutions Inc.', 'Payment for IT equipment maintenance', 4500.00, 'General Fund', '504-050', 'Maintenance'),
    (central_high_id, '2026-08-14', 'DV-24-08-002', 'CK-990215', 'Springfield Utilities', 'Electricity bill for July 2026', 12350.25, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2026-08-22', 'DV-24-08-003', 'CK-990216', 'ABC Supplies Corp.', 'Procurement of office supplies for Q3', 8200.00, 'General Fund', '502-200', 'Maintenance'),
    (central_high_id, '2026-09-04', 'DV-24-09-004', 'ADA-0013', 'Department of Education', 'Remittance of unexpended balances', 1050.00, 'Trust Fund', '508-900', 'Others'),
    (central_high_id, '2026-09-18', 'DV-24-09-005', 'CK-990217', 'Global Builders LLC', 'Progress billing - roof repair building A', 45000.00, 'Special Fund', '507-400', 'Capital Outlay'),
    (central_high_id, '2026-10-11', 'DV-24-10-001', 'CK-990281', 'Ace Hardware Supply', 'Maintenance materials for classrooms', 15450.00, 'General Fund', '503-200', 'Maintenance'),
    (central_high_id, '2026-10-24', 'DV-24-10-002', 'CK-990282', 'PLDT Inc.', 'Internet connectivity October 2026', 4500.00, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2026-10-28', 'DV-24-10-003', 'CK-990283', 'Meralco', 'Electricity bill September 2026', 28900.50, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2026-11-09', 'DV-24-11-004', 'CK-990284', 'National Book Store', 'Office supplies Q4', 12300.00, 'General Fund', '502-200', 'Maintenance'),

    -- Prior-year data for year navigation
    (central_high_id, '2025-02-12', 'DV-23-02-001', 'CK-980101', 'EduSupplies Co.', 'Instructional materials carryover purchase', 18200.00, 'General Fund', '502-100', 'Maintenance'),
    (central_high_id, '2025-03-20', 'DV-23-03-002', 'CK-980102', 'Payroll Office', 'Teaching personnel payroll allocation', 421000.00, 'General Fund', '501-000', 'Personal Services'),
    (central_high_id, '2025-05-08', 'DV-23-05-001', 'CK-980201', 'Springfield Utilities', 'Q2 utilities settlement', 27150.00, 'General Fund', '503-100', 'Maintenance'),
    (central_high_id, '2025-06-21', 'DV-23-06-002', 'CK-980202', 'TechVision Systems', 'Network equipment refresh', 62300.00, 'Special Fund', '504-050', 'Capital Outlay'),
    (central_high_id, '2025-08-14', 'DV-23-08-001', 'CK-980301', 'Northstar Training Center', 'Midyear finance and procurement training', 22400.00, 'Special Fund', '506-010', 'Training'),
    (central_high_id, '2025-09-18', 'DV-23-09-002', 'CK-980302', 'City Maintenance Dept.', 'Classroom repainting and minor repairs', 38600.00, 'General Fund', '503-200', 'Maintenance'),
    (central_high_id, '2025-10-10', 'DV-23-10-001', 'CK-980401', 'Global Books Ltd.', 'Library materials year-end order', 31500.00, 'General Fund', '502-100', 'Maintenance'),
    (central_high_id, '2025-11-26', 'DV-23-11-002', 'CK-980402', 'Transport Services Inc.', 'School activity transport support', 19600.00, 'Trust Fund', '505-300', 'Travel'),

    -- Lincoln Middle School
    (lincoln_middle_id, '2026-01-12', 'DV-LMS-001', 'LM-22001', 'Lincoln Payroll Office', 'Administrative personnel payroll', 185000.00, 'General Fund', '501-000', 'Personal Services'),
    (lincoln_middle_id, '2026-02-08', 'DV-LMS-002', 'LM-22002', 'BrightBooks Publishing', 'Textbook procurement for Grade 8', 52300.00, 'General Fund', '502-100', 'Maintenance'),
    (lincoln_middle_id, '2026-03-19', 'DV-LMS-003', 'LM-22003', 'City Waterworks', 'Water service for Q1', 7800.00, 'General Fund', '503-100', 'Maintenance'),
    (lincoln_middle_id, '2026-05-02', 'DV-LMS-004', 'LM-22004', 'MetroTech Computers', 'Computer laboratory upgrades', 68500.00, 'Special Fund', '504-050', 'Capital Outlay'),
    (lincoln_middle_id, '2026-08-10', 'DV-LMS-005', 'LM-22005', 'SafeRide Transport', 'Student activity transport allocation', 21400.00, 'Trust Fund', '505-300', 'Travel'),
    (lincoln_middle_id, '2026-10-16', 'DV-LMS-006', 'LM-22006', 'FacilityPro Services', 'Preventive maintenance contract', 36500.00, 'General Fund', '503-200', 'Maintenance'),

    -- Washington Elementary
    (washington_elem_id, '2026-01-18', 'DV-WES-001', 'WE-33001', 'Washington Payroll Office', 'Teaching personnel payroll', 210000.00, 'General Fund', '501-000', 'Personal Services'),
    (washington_elem_id, '2026-02-14', 'DV-WES-002', 'WE-33002', 'KidsLearn Supplies', 'Primary classroom learning kits', 34800.00, 'General Fund', '502-100', 'Maintenance'),
    (washington_elem_id, '2026-04-12', 'DV-WES-003', 'WE-33003', 'GreenField Maintenance', 'Playground repair and safety works', 42500.00, 'Special Fund', '503-200', 'Maintenance'),
    (washington_elem_id, '2026-06-23', 'DV-WES-004', 'WE-33004', 'Springfield Utilities', 'Q2 utility settlement', 18950.00, 'General Fund', '503-100', 'Maintenance'),
    (washington_elem_id, '2026-08-08', 'DV-WES-005', 'WE-33005', 'TeachWell Institute', 'Early literacy training workshop', 16800.00, 'Special Fund', '506-010', 'Training'),
    (washington_elem_id, '2026-10-04', 'DV-WES-006', 'WE-33006', 'PaperTrail Office Mart', 'Printer ink, bond paper, and forms', 11200.00, 'General Fund', '502-200', 'Maintenance'),

    -- Northview Senior High
    (northview_senior_id, '2026-02-05', 'DV-NSH-001', 'NS-44001', 'Northview Payroll Office', 'Senior high faculty payroll', 256000.00, 'General Fund', '501-000', 'Personal Services'),
    (northview_senior_id, '2026-03-07', 'DV-NSH-002', 'NS-44002', 'STEM Lab Partners', 'Robotics lab consumables', 58800.00, 'Special Fund', '502-100', 'Maintenance'),
    (northview_senior_id, '2026-05-28', 'DV-NSH-003', 'NS-44003', 'CloudLink Telecom', 'Campus network subscription', 22400.00, 'General Fund', '503-100', 'Maintenance'),
    (northview_senior_id, '2026-07-15', 'DV-NSH-004', 'NS-44004', 'BuildRight Contractors', 'Workshop building electrical repairs', 73500.00, 'Special Fund', '507-400', 'Capital Outlay'),
    (northview_senior_id, '2026-09-06', 'DV-NSH-005', 'NS-44005', 'ProCert Academy', 'TVL certification assessment support', 31200.00, 'Trust Fund', '506-010', 'Training'),
    (northview_senior_id, '2026-11-18', 'DV-NSH-006', 'NS-44006', 'North District Fuel Depot', 'School service fuel allocation', 18400.00, 'General Fund', '505-300', 'Travel');
END $$;
