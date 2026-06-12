-- =============================================================================
-- PHASE 7: BILLING & FINANCIALS UPGRADE
-- Proper invoices, payment tracking, taxes, discounts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. INVOICES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_email TEXT,
  patient_address TEXT,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  treatment_id BIGINT REFERENCES treatments(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  doctor_name TEXT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'Fixed' CHECK (discount_type IN ('Fixed', 'Percentage')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_type TEXT DEFAULT 'GST' CHECK (tax_type IN ('GST', 'VAT', 'None')),
  tax_percentage NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Draft', 'Pending', 'Partial', 'Paid', 'Overdue', 'Cancelled', 'Refunded')),
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- -----------------------------------------------------------------------------
-- 2. INVOICE ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  treatment_type TEXT,
  tooth_number TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- -----------------------------------------------------------------------------
-- 3. PAYMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque', 'Credit Card', 'Debit Card', 'Other')),
  payment_reference TEXT,
  card_last4 TEXT,
  bank_name TEXT,
  cheque_number TEXT,
  upi_id TEXT,
  payment_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  status TEXT DEFAULT 'Completed' CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded', 'Cancelled')),
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- -----------------------------------------------------------------------------
-- 4. PAYMENT PLANS / INSTALMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_plans (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  total_instalments INTEGER NOT NULL,
  paid_instalments INTEGER DEFAULT 0,
  instalment_amount NUMERIC(12,2),
  start_date DATE NOT NULL,
  frequency TEXT DEFAULT 'Monthly' CHECK (frequency IN ('Weekly', 'Bi-Weekly', 'Monthly', 'Custom')),
  next_due_date DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled', 'Defaulted')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_plan_instalments (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  instalment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_date TIMESTAMPTZ,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Waived')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice ON payment_plans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_plan_instalments_plan ON payment_plan_instalments(plan_id);

-- -----------------------------------------------------------------------------
-- 5. EXPENSE TRACKING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  expense_number TEXT UNIQUE,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'UPI', 'Cheque', 'Other')),
  payment_reference TEXT,
  vendor_name TEXT,
  vendor_phone TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('Daily', 'Weekly', 'Monthly', 'Yearly')),
  recurring_end_date DATE,
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'Approved' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- -----------------------------------------------------------------------------
-- 6. INSURANCE CLAIMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insurance_claims (
  id BIGSERIAL PRIMARY KEY,
  claim_number TEXT NOT NULL UNIQUE,
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  insurance_provider TEXT NOT NULL,
  policy_number TEXT,
  claim_amount NUMERIC(12,2) NOT NULL,
  approved_amount NUMERIC(12,2),
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  settlement_date DATE,
  status TEXT DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Partially Approved', 'Rejected', 'Settled')),
  rejection_reason TEXT,
  notes TEXT,
  documents JSONB DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);

-- -----------------------------------------------------------------------------
-- 7. TAX RATES / CONFIGURATION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tax_rates (name, code, rate, description, is_default) VALUES
  ('GST 0%', 'GST0', 0, 'Exempt/Nil-rated', false),
  ('GST 5%', 'GST5', 5, 'Healthcare services at 5%', false),
  ('GST 12%', 'GST12', 12, 'Standard rate for medical devices', false),
  ('GST 18%', 'GST18', 18, 'Standard healthcare services', true),
  ('No Tax', 'NONE', 0, 'No tax applied', false)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. TRIGGER: Generate invoice number
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(NEW.invoice_date, 'YY');
  v_month := TO_CHAR(NEW.invoice_date, 'MM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9 FOR 5) AS INTEGER)), 0) + 1 INTO v_seq
  FROM invoices
  WHERE invoice_date >= DATE_TRUNC('month', NEW.invoice_date)
    AND invoice_date < DATE_TRUNC('month', NEW.invoice_date) + INTERVAL '1 month';
  
  NEW.invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- -----------------------------------------------------------------------------
-- 9. TRIGGER: Update invoice totals
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_discount_amount NUMERIC(12,2);
  v_tax_amount NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_subtotal FROM invoice_items WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE invoices SET
    subtotal = v_subtotal,
    discount_amount = CASE
      WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100)
      ELSE discount_value
    END,
    total_amount = v_subtotal - CASE
      WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100)
      ELSE discount_value
    END + (v_subtotal - CASE
      WHEN discount_type = 'Percentage' THEN v_subtotal * (discount_value / 100)
      ELSE discount_value
    END) * (tax_percentage / 100),
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_totals_trigger ON invoice_items;
CREATE TRIGGER update_invoice_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();

-- -----------------------------------------------------------------------------
-- 10. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_instalments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

-- Invoices
DROP POLICY IF EXISTS "view_invoices" ON invoices;
CREATE POLICY "view_invoices" ON invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_invoices" ON invoices;
CREATE POLICY "manage_invoices" ON invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));

-- Invoice items
DROP POLICY IF EXISTS "view_invoice_items" ON invoice_items;
CREATE POLICY "view_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_invoice_items" ON invoice_items;
CREATE POLICY "manage_invoice_items" ON invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));

-- Payments
DROP POLICY IF EXISTS "view_payments" ON payments;
CREATE POLICY "view_payments" ON payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_payments" ON payments;
CREATE POLICY "manage_payments" ON payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));

-- Expenses (admin only)
DROP POLICY IF EXISTS "view_expenses" ON expenses;
CREATE POLICY "view_expenses" ON expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_expenses" ON expenses;
CREATE POLICY "manage_expenses" ON expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Insurance claims
DROP POLICY IF EXISTS "view_insurance_claims" ON insurance_claims;
CREATE POLICY "view_insurance_claims" ON insurance_claims FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_insurance_claims" ON insurance_claims;
CREATE POLICY "manage_insurance_claims" ON insurance_claims FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist')));

-- Tax rates - all can view
DROP POLICY IF EXISTS "view_tax_rates" ON tax_rates;
CREATE POLICY "view_tax_rates" ON tax_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_tax_rates" ON tax_rates;
CREATE POLICY "manage_tax_rates" ON tax_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));
