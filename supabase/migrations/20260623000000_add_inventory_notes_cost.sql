-- Add notes and cost columns to inventory table to support rich tracking and audit reconciliation.
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
