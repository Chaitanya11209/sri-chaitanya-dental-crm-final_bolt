-- Sri Chaitanya Dental Care — Update Inventory Schema & RLS Policies
-- Incremental migration to add safety_min_limit and ensure RLS access

-- 1. Add 'safety_min_limit' column to inventory table to track critical reorder threshold
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS safety_min_limit INTEGER NOT NULL DEFAULT 0;

-- 2. Add 'current_stock' column to inventory table to track current quantity on hand
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS current_stock INTEGER NOT NULL DEFAULT 0;

-- 3. Synchronize initial values from existing 'min_stock' and 'stock' if any exist
UPDATE public.inventory 
SET safety_min_limit = min_stock 
WHERE safety_min_limit = 0 AND min_stock > 0;

UPDATE public.inventory 
SET current_stock = stock 
WHERE current_stock = 0 AND stock > 0;

-- 4. Enable Row Level Security (RLS) on the inventory table
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 5. Drop any conflicting or restrictive existing policies
DROP POLICY IF EXISTS "anon full access - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated full access - inventory" ON public.inventory;
DROP POLICY IF EXISTS "service_role full access - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated select - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated insert - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated update - inventory" ON public.inventory;
DROP POLICY IF EXISTS "authenticated delete - inventory" ON public.inventory;

-- 6. Re-create robust policies granting full CRUD permissions for anonymous, authenticated, and service roles
CREATE POLICY "anon full access - inventory" 
  ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access - inventory" 
  ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access - inventory" 
  ON public.inventory FOR ALL TO service_role USING (true) WITH CHECK (true);
