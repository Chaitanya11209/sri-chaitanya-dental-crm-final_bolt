-- Migration: Add extra columns for complete dental clinic operations (Priority 2 + 3)

-- 1. Treatments additions
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS tooth_no text;
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS doctor_name text;
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS estimated_cost numeric default 0;
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS paid_amount numeric default 0;
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS balance_amount numeric default 0;
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS next_visit date;

-- 2. Appointments add billing indicators
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS invoice_no text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_fee numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS treatment_fee numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS lab_charges numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS x_ray_charges numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS discount_amount numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS gst_amount numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS advance_payment numeric default 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS final_balance numeric default 0;
