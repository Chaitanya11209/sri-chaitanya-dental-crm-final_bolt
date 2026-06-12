-- =============================================================================
-- PHASE 5 FIX: Create missing dental infrastructure tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DENTAL CHAIRS / OPERATORY ROOMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dental_chairs (
  id BIGSERIAL PRIMARY KEY,
  chair_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  floor TEXT,
  equipment_notes TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO dental_chairs (chair_number, name, floor, status) VALUES
  ('C1', 'Chair 1 - Main Operatory', 'Ground', 'Active'),
  ('C2', 'Chair 2 - Surgical Suite', 'Ground', 'Active'),
  ('C3', 'Chair 3 - Pediatric', 'First', 'Active')
ON CONFLICT (chair_number) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. DOCTOR AVAILABILITY SCHEDULES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id BIGSERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (doctor_id, day_of_week)
);

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, d, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true
FROM doctors, generate_series(1, 5) AS d
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT id, 6, '09:00:00'::TIME, '14:00:00'::TIME, true
FROM doctors
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. DOCTOR TIME-OFF / LEAVE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_time_off (
  id BIGSERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT,
  leave_type TEXT DEFAULT 'Leave' CHECK (leave_type IN ('Leave', 'Training', 'Conference', 'Emergency', 'Other')),
  approved_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'Approved' CHECK (status IN ('Pending', 'Approved', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. WALK-IN QUEUE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS walk_in_queue (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  treatment TEXT,
  preferred_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'In Progress', 'Completed', 'Left', 'Converted')),
  check_in_time TIMESTAMPTZ DEFAULT now(),
  estimated_wait_minutes INTEGER,
  notes TEXT,
  converted_appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_walk_in_queue_status ON walk_in_queue(status, check_in_time);

-- -----------------------------------------------------------------------------
-- 5. Add missing columns to appointments
-- -----------------------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chair_id BIGINT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'Scheduled' CHECK (appointment_type IN ('Scheduled', 'Walk-in', 'Emergency', 'Follow-up'));

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointments_chair_id_fkey') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_chair_id_fkey FOREIGN KEY (chair_id) REFERENCES dental_chairs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. CONFLICT DETECTION FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_doctor_id UUID,
  p_chair_id BIGINT,
  p_appointment_date DATE,
  p_start_time TEXT,
  p_duration_minutes INTEGER DEFAULT 30,
  p_exclude_appointment_id BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_end_time TIME;
  v_day_of_week SMALLINT;
  v_schedule RECORD;
  v_doctor_available BOOLEAN;
BEGIN
  v_end_time := (p_start_time || ':00')::TIME + (p_duration_minutes || ' minutes')::INTERVAL;
  v_day_of_week := EXTRACT(DOW FROM p_appointment_date);

  SELECT is_available INTO v_doctor_available FROM doctor_schedules ds WHERE ds.doctor_id = p_doctor_id AND ds.day_of_week = v_day_of_week;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_no_schedule', 'conflict_details', jsonb_build_object('day_of_week', v_day_of_week));
  END IF;

  IF NOT v_doctor_available THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_unavailable', 'conflict_details', jsonb_build_object('reason', 'Doctor marked unavailable'));
  END IF;

  SELECT * INTO v_schedule FROM doctor_schedules WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week;

  IF v_schedule.start_time > (p_start_time || ':00')::TIME OR v_schedule.end_time < v_end_time THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'outside_schedule_hours', 'conflict_details', jsonb_build_object('doctor_start', v_schedule.start_time, 'doctor_end', v_schedule.end_time));
  END IF;

  IF v_schedule.break_start IS NOT NULL AND v_schedule.break_end IS NOT NULL THEN
    IF (p_start_time || ':00')::TIME < v_schedule.break_end AND v_end_time > v_schedule.break_start THEN
      RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'break_time', 'conflict_details', jsonb_build_object('break_start', v_schedule.break_start, 'break_end', v_schedule.break_end));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM doctor_time_off WHERE doctor_id = p_doctor_id AND status = 'Approved' AND start_datetime <= (p_appointment_date || ' ' || p_start_time || ':00')::TIMESTAMPTZ AND end_datetime >= (p_appointment_date || ' ' || v_end_time)::TIMESTAMPTZ) THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_on_leave', 'conflict_details', jsonb_build_object('reason', 'Doctor has approved leave'));
  END IF;

  IF EXISTS (SELECT 1 FROM appointments WHERE doctor_id = p_doctor_id AND next_visit::text = p_appointment_date::text AND status NOT IN ('Cancelled', 'Deleted', 'No Show') AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id) AND appointment_time IS NOT NULL AND (appointment_time::TIME < v_end_time AND (appointment_time::TIME + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL) > (p_start_time || ':00')::TIME)) THEN
    RETURN jsonb_build_object('has_conflict', true, 'conflict_type', 'doctor_double_booked', 'conflict_details', jsonb_build_object('reason', 'Doctor already booked'));
  END IF;

  RETURN '{"has_conflict": false, "conflict_type": null, "conflict_details": {}}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE dental_chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_in_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_dental_chairs" ON dental_chairs;
CREATE POLICY "view_dental_chairs" ON dental_chairs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_dental_chairs" ON dental_chairs;
CREATE POLICY "manage_dental_chairs" ON dental_chairs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "view_doctor_schedules" ON doctor_schedules;
CREATE POLICY "view_doctor_schedules" ON doctor_schedules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_doctor_schedules" ON doctor_schedules;
CREATE POLICY "manage_doctor_schedules" ON doctor_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "view_doctor_time_off" ON doctor_time_off;
CREATE POLICY "view_doctor_time_off" ON doctor_time_off FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_doctor_time_off" ON doctor_time_off;
CREATE POLICY "manage_doctor_time_off" ON doctor_time_off FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "view_walk_in_queue" ON walk_in_queue;
CREATE POLICY "view_walk_in_queue" ON walk_in_queue FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage_walk_in_queue" ON walk_in_queue;
CREATE POLICY "manage_walk_in_queue" ON walk_in_queue FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist', 'doctor')));
