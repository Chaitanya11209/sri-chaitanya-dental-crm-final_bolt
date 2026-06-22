-- Sri Chaitanya Dental Care — Add Reorder Level to Inventory
-- Incremental migration to add the 'reorder_level' column

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0;
