-- ============================================================================
-- HospitalFlow AI — Complete PostgreSQL / Supabase Schema & Initial Seeds
-- Intelligent Hospital Flow, Emergency Readiness & Care Continuity
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENUMS & DOMAIN TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'reception', 'blood_bank', 'patient');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE doctor_status AS ENUM ('Available', 'Consulting', 'Break', 'Unavailable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('Scheduled', 'Checked-In', 'In-Queue', 'Consulting', 'Completed', 'Cancelled', 'No-Show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE queue_status AS ENUM ('Waiting', 'Called', 'Consulting', 'Completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blood_status_type AS ENUM ('Adequate', 'Low', 'Critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE urgency_type AS ENUM ('Routine', 'Urgent', 'Emergency');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blood_request_status AS ENUM ('Created', 'Checking Internal', 'Searching Sources', 'Matched', 'Reserved', 'Issued', 'Escalated', 'Resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE donor_eligibility AS ENUM ('Eligible', 'Cooldown', 'Deferred');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reminder_status AS ENUM ('Scheduled', 'Delivered', 'Read', 'Acknowledged', 'Missed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- USERS & PROFILES
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  department TEXT,
  phone TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  blood_group blood_group_type,
  previous_no_shows INTEGER NOT NULL DEFAULT 0,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOCTORS
CREATE TABLE IF NOT EXISTS public.doctors (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  department TEXT NOT NULL,
  specialty TEXT NOT NULL,
  status doctor_status NOT NULL DEFAULT 'Available',
  account_status TEXT NOT NULL DEFAULT 'active',
  average_consultation_minutes INTEGER NOT NULL DEFAULT 10,
  current_patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  completed_today INTEGER NOT NULL DEFAULT 0,
  queue_load INTEGER NOT NULL DEFAULT 0
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  status appointment_status NOT NULL DEFAULT 'Scheduled',
  scheduled_time TIMESTAMPTZ NOT NULL,
  predicted_start TIMESTAMPTZ,
  predicted_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  no_show_risk TEXT NOT NULL DEFAULT 'Low',
  qr_data TEXT,
  symptom_original_text TEXT,
  symptom_detected_language TEXT,
  normalized_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  symptom_confidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUEUE ENTRIES
CREATE TABLE IF NOT EXISTS public.queue_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
  department TEXT NOT NULL,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 1,
  status queue_status NOT NULL DEFAULT 'Waiting',
  priority TEXT NOT NULL DEFAULT 'Normal',
  estimated_wait INTEGER DEFAULT 0,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  consulting_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- FACILITIES (Hospitals / Blood Banks)
CREATE TABLE IF NOT EXISTS public.facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- Hospital / Blood Bank
  city TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  operational_status TEXT NOT NULL DEFAULT 'Active',
  distance DOUBLE PRECISION DEFAULT 0
);

-- BLOOD INVENTORY
CREATE TABLE IF NOT EXISTS public.blood_inventory (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  blood_group blood_group_type NOT NULL,
  component TEXT NOT NULL DEFAULT 'Whole Blood',
  units INTEGER NOT NULL DEFAULT 0,
  reserved_units INTEGER NOT NULL DEFAULT 0,
  collection_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ NOT NULL,
  status blood_status_type NOT NULL DEFAULT 'Adequate',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOOD REQUESTS
CREATE TABLE IF NOT EXISTS public.blood_requests (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  blood_group blood_group_type NOT NULL,
  component TEXT NOT NULL DEFAULT 'Whole Blood',
  units INTEGER NOT NULL DEFAULT 1,
  urgency urgency_type NOT NULL DEFAULT 'Emergency',
  department TEXT,
  requesting_hospital TEXT NOT NULL DEFAULT 'HospitalFlow Central Hospital',
  status blood_request_status NOT NULL DEFAULT 'Created',
  matched_facility_id TEXT REFERENCES public.facilities(id) ON DELETE SET NULL,
  donor_wave INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- DONORS
CREATE TABLE IF NOT EXISTS public.donors (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  blood_group blood_group_type NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_donation TIMESTAMPTZ,
  eligibility donor_eligibility NOT NULL DEFAULT 'Eligible',
  locality TEXT,
  contact_preference TEXT DEFAULT 'SMS',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  phone TEXT,
  notified_for_request_id TEXT REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  notification_wave INTEGER,
  notification_status TEXT,
  otp_code TEXT,
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- DISCHARGE PLANS
CREATE TABLE IF NOT EXISTS public.discharge_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  approved_by TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
  discharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  diet_plan TEXT,
  follow_up JSONB,
  warning_signs JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  language TEXT NOT NULL DEFAULT 'English',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  caregiver_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REMINDERS
CREATE TABLE IF NOT EXISTS public.reminders (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- Medication / Follow-up
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status reminder_status NOT NULL DEFAULT 'Scheduled',
  acknowledged_at TIMESTAMPTZ
);

-- FOLLOW-UPS
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  doctor_id TEXT REFERENCES public.doctors(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL DEFAULT '10:00 AM',
  status TEXT NOT NULL DEFAULT 'Scheduled',
  discharge_plan_id TEXT REFERENCES public.discharge_plans(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES public.appointments(id) ON DELETE SET NULL
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  related_module TEXT,
  related_entity_id TEXT
);

-- AUDIT EVENTS
CREATE TABLE IF NOT EXISTS public.audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  user_id TEXT,
  entity_id TEXT
);

-- SIMULATION SCENARIOS
CREATE TABLE IF NOT EXISTS public.simulation_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  input_parameters JSONB NOT NULL,
  baseline_results JSONB NOT NULL,
  simulated_results JSONB NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. INDEXES FOR HIGH-THROUGHPUT OPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_appointments_dept_status ON public.appointments(department, status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_dept_status ON public.queue_entries(department, status);
CREATE INDEX IF NOT EXISTS idx_blood_inv_group ON public.blood_inventory(blood_group, status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_donors_group_elig ON public.donors(blood_group, eligibility, available);
CREATE INDEX IF NOT EXISTS idx_discharge_patient ON public.discharge_plans(patient_id, active);
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON public.reminders(patient_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_events(timestamp DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) & GRANTS
-- ============================================

-- Grant schema and table permissions to anon & authenticated roles for web client
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Enable RLS and add universal permissive policies for the frontend web app
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Users" ON public.users;
CREATE POLICY "Public Full Access Users" ON public.users FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Patients" ON public.patients;
CREATE POLICY "Public Full Access Patients" ON public.patients FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Doctors" ON public.doctors;
CREATE POLICY "Public Full Access Doctors" ON public.doctors FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Departments" ON public.departments;
CREATE POLICY "Public Full Access Departments" ON public.departments FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Appointments" ON public.appointments;
CREATE POLICY "Public Full Access Appointments" ON public.appointments FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Queue" ON public.queue_entries;
CREATE POLICY "Public Full Access Queue" ON public.queue_entries FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Facilities" ON public.facilities;
CREATE POLICY "Public Full Access Facilities" ON public.facilities FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.blood_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Blood Inv" ON public.blood_inventory;
CREATE POLICY "Public Full Access Blood Inv" ON public.blood_inventory FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Blood Requests" ON public.blood_requests;
CREATE POLICY "Public Full Access Blood Requests" ON public.blood_requests FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Donors" ON public.donors;
CREATE POLICY "Public Full Access Donors" ON public.donors FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.discharge_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Discharge" ON public.discharge_plans;
CREATE POLICY "Public Full Access Discharge" ON public.discharge_plans FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Reminders" ON public.reminders;
CREATE POLICY "Public Full Access Reminders" ON public.reminders FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access FollowUps" ON public.follow_ups;
CREATE POLICY "Public Full Access FollowUps" ON public.follow_ups FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Notifications" ON public.notifications;
CREATE POLICY "Public Full Access Notifications" ON public.notifications FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Audit" ON public.audit_events;
CREATE POLICY "Public Full Access Audit" ON public.audit_events FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.simulation_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Simulation" ON public.simulation_scenarios;
CREATE POLICY "Public Full Access Simulation" ON public.simulation_scenarios FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 5. INITIAL SEEDS (DEPARTMENTS & FACILITIES)
-- ============================================

INSERT INTO public.departments (id, name, active) VALUES
  ('DEP-GM', 'General Medicine', true),
  ('DEP-CARD', 'Cardiology', true),
  ('DEP-ORTHO', 'Orthopedics', true),
  ('DEP-NEURO', 'Neurology', true),
  ('DEP-DERM', 'Dermatology', true),
  ('DEP-PED', 'Pediatrics', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.facilities (id, name, type, city, latitude, longitude, operational_status, distance) VALUES
  ('FAC-001', 'HospitalFlow Central Hospital', 'Hospital', 'Mumbai', 19.0760, 72.8777, 'Active', 0.0),
  ('FAC-002', 'City Blood Bank', 'Blood Bank', 'Mumbai', 19.0820, 72.8900, 'Active', 4.7),
  ('FAC-003', 'Shree Hospital', 'Hospital', 'Mumbai', 19.0650, 72.8650, 'Active', 2.3),
  ('FAC-004', 'Metro General Hospital', 'Hospital', 'Mumbai', 19.0950, 72.9100, 'Active', 7.1),
  ('FAC-005', 'Regional Blood Centre', 'Blood Bank', 'Mumbai', 19.0550, 72.8400, 'Active', 5.9)
ON CONFLICT (id) DO NOTHING;

-- Initial users
INSERT INTO public.users (id, email, display_name, role, department, phone) VALUES
  ('u-admin', 'admin@hospitalflow.ai', 'Admin User', 'admin', NULL, '+91 9876543210'),
  ('u-doc-1', 'dr.sharma@hospitalflow.ai', 'Dr. Aarav Sharma', 'doctor', 'General Medicine', '+91 9876543211'),
  ('u-reception', 'reception@hospitalflow.ai', 'Priya Menon', 'reception', NULL, '+91 9876543212'),
  ('u-bloodbank', 'bloodbank@hospitalflow.ai', 'Rahul Deshmukh', 'blood_bank', NULL, '+91 9876543213'),
  ('u-pat-1', 'amit.kumar@email.com', 'Amit Kumar', 'patient', NULL, '+91 9876543214')
ON CONFLICT (id) DO NOTHING;
