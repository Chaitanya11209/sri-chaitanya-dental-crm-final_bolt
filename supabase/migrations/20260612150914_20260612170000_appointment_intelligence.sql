-- =============================================================================
-- PHASE 5: APPOINTMENT INTELLIGENCE (Fixed version)
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Insert default chairs
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
  doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
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

-- Insert default schedules for existing doctors (Mon-Sat)
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 1, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 2, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 3, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 4, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 5, '09:00:00'::TIME, '18:00:00'::TIME, '13:00:00'::TIME, '14:00:00'::TIME, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, break_start, break_end, is_available)
SELECT id, 6, '09:00:00'::TIME, '14:00:00'::TIME, NULL, NULL, true FROM doctors WHERE status = 'Active'
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. DOCTOR TIME-OFF / LEAVE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_time_off (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT,
  leave_type TEXT DEFAULT 'Leave' CHECK (leave_type IN ('Leave', 'Training', 'Conference', 'Emergency', 'Other')),
  approved_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'Approved' CHECK (status IN ('Pending', 'Approved', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. APPOINTMENT SLOTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_slots (
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  chair_id BIGINT REFERENCES dental_chairs(id) ON DELETE SET NULL,
  slot_date DATE NOT NULL,
  slot_start TIME NOT NULL,
  slot_end TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 30,
  is_available BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_date_doctor ON appointment_slots(slot_date, doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date_chair ON appointment_slots(slot_date, chair_id);

-- -----------------------------------------------------------------------------
-- 5. WALK-IN QUEUE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS walk_in_queue (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  treatment TEXT,
  preferred_doctor_id BIGINT REFERENCES doctors(id) ON DELETE SET NULL,
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
-- 6. Add columns to appointments
-- -----------------------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS chair_id BIGINT REFERENCES dental_chairs(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'Scheduled' CHECK (appointment_type IN ('Scheduled', 'Walk-in', 'Emergency', 'Follow-up'));

-- -----------------------------------------------------------------------------
-- 7. CONFLICT DETECTION FUNCTION (Simplified)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appointment_conflict(
  p_doctor_id BIGINT,
  p_chair_id BIGINT,
  p_appointment_date DATE,
  p_start_time TIME,
  p_duration_minutes INTEGER DEFAULT 30,
  p_exclude_appointment_id BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_end_time TIME;
  v_day_of_week SMALLINT;
  v_result JSONB := '{"has_conflict": false, "conflict_type": null, "conflict_details": {}}'::JSONB;
  v_schedule RECORD;
  v_doctor_available BOOLEAN;
BEGIN
  v_end_time := p_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
  v_day_of_week := EXTRACT(DOW FROM p_appointment_date);

  -- Check 1: Doctor availability schedule
  SELECT is_available INTO v_doctor_available
  FROM doctor_schedules ds
  WHERE ds.doctor_id = p_doctor_id AND ds.day_of_week = v_day_of_week;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflict_type', 'doctor_no_schedule',
      'conflict_details', jsonb_build_object('day_of_week', v_day_of_week)
    );
  END IF;

  IF NOT v_doctor_available THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflict_type', 'doctor_unavailable',
      'conflict_details', jsonb_build_object('reason', 'Doctor marked unavailable')
    );
  END IF;

  -- Get schedule bounds
  SELECT * INTO v_schedule
  FROM doctor_schedules
  WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week;

  IF v_schedule.start_time > p_start_time OR v_schedule.end_time < v_end_time THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflict_type', 'outside_schedule_hours',
      'conflict_details', jsonb_build_object(
        'doctor_start', v_schedule.start_time,
        'doctor_end', v_schedule.end_time
      )
    );
  END IF;

  -- Check break time
  IF v_schedule.break_start IS NOT NULL AND v_schedule.break_end IS NOT NULL THEN
    IF p_start_time < v_schedule.break_end AND v_end_time > v_schedule.break_start THEN
      RETURN jsonb_build_object(
        'has_conflict', true,
        'conflict_type', 'break_time',
        'conflict_details', jsonb_build_object(
          'break_start', v_schedule.break_start,
          'break_end', v_schedule.break_end
        )
      );
    END IF;
  END IF;

  -- Check 2: Doctor time-off
  IF EXISTS (
    SELECT 1 FROM doctor_time_off
    WHERE doctor_id = p_doctor_id
      AND status = 'Approved'
      AND start_datetime <= (p_appointment_date || ' ' || p_start_time)::TIMESTAMPTZ
      AND end_datetime >= (p_appointment_date || ' ' || v_end_time)::TIMESTAMPTZ
  ) THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflict_type', 'doctor_on_leave',
      'conflict_details', jsonb_build_object('reason', 'Doctor has approved leave')
    );
  END IF;

  -- Check 3: Doctor double booking
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE doctor_id = p_doctor_id
      AND next_visit = p_appointment_date
      AND status NOT IN ('Cancelled', 'Deleted', 'No Show')
      AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
      AND appointment_time::TIME < v_end_time
      AND (appointment_time::TIME + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL) > p_start_time
  ) THEN
    RETURN jsonb_build_object(
      'has_conflict', true,
      'conflict_type', 'doctor_double_booked',
      'conflict_details', jsonb_build_object('reason', 'Doctor already booked')
    );
  END IF;

  -- Check 4: Chair conflict
  IF p_chair_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM appointments
      WHERE chair_id = p_chair_id
        AND next_visit = p_appointment_date
        AND status NOT IN ('Cancelled', 'Deleted', 'No Show')
        AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
        AND appointment_time::TIME < v_end_time
        AND (appointment_time::TIME + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL) > p_start_time
    ) THEN
      RETURN jsonb_build_object(
        'has_conflict', true,
        'conflict_type', 'chair_double_booked',
        'conflict_details', jsonb_build_object('chair_id', p_chair_id)
      );
    END IF;
  END IF;

  RETURN '{"has_conflict": false, "conflict_type": null, "conflict_details": {}}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 8. TRIGGER: Validate appointment before insert
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_appointment_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict JSONB;
BEGIN
  IF NEW.doctor_id IS NOT NULL AND NEW.next_visit IS NOT NULL AND NEW.appointment_time IS NOT NULL THEN
    v_conflict := check_appointment_conflict(
      NEW.doctor_id,
      NEW.chair_id,
      NEW.next_visit,
      NEW.appointment_time::TIME,
      COALESCE(NEW.duration_minutes, 30),
      NULL
    );

    IF (v_conflict->>'has_conflict')::BOOLEAN THEN
      IF NEW.notes IS NULL OR NEW.notes = '' THEN
        NEW.notes := '[CONFLICT: ' || (v_conflict->>'conflict_type') || ']';
      ELSE
        NEW.notes := NEW.notes || ' [CONFLICT: ' || (v_conflict->>'conflict_type') || ']';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_appointment_trigger ON appointments;
CREATE TRIGGER validate_appointment_trigger
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION validate_appointment_before_insert();

-- -----------------------------------------------------------------------------
-- 9. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE dental_chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_in_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_dental_chairs" ON dental_chairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_dental_chairs" ON dental_chairs FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "view_doctor_schedules" ON doctor_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_doctor_schedules" ON doctor_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "view_doctor_time_off" ON doctor_time_off FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_doctor_time_off" ON doctor_time_off FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "view_appointment_slots" ON appointment_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_appointment_slots" ON appointment_slots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist', 'doctor')));

CREATE POLICY "view_walk_in_queue" ON walk_in_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage_walk_in_queue" ON walk_in_queue FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist', 'doctor')));
