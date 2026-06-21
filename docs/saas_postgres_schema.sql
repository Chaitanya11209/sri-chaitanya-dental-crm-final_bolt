-- ========================================================
-- Indian Multi-Clinic SaaS Clinic Management Schema (PostgreSQL 16)
-- Supports GST Calculation, live Token queues, UPI tracking, and SMS audit logs
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLINIC LOCATIONS / FRANCHISES (Multi-Clinic Context Partitioning)
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    branch_code VARCHAR(50) UNIQUE NOT NULL, -- e.g. VJA-HQ, GNT-BR, HYD-CL
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL, -- Determines GST State tax rules (CGST/SGST vs IGST)
    address TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    gstin VARCHAR(15), -- Clinic GST registration number
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. STAFF ROLES & PRACTITIONERS
CREATE TYPE staff_role AS ENUM ('admin', 'dentist_specialist', 'receptionist', 'clinical_assistant');

CREATE TABLE staff_practitioners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role staff_role NOT NULL DEFAULT 'dentist_specialist',
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    specialization VARCHAR(150), -- e.g. Orthodontist, Endodontist
    registration_number VARCHAR(100), -- Dental Council registration code
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PATIENTS MASTER DEMOGRAPHICS
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) NOT NULL, -- Linked with OTP authenticators
    email VARCHAR(255),
    age INT,
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    aadhar_number VARCHAR(12),
    medical_history JSONB DEFAULT '[]'::jsonb, -- Array of clinical chronic ailments
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CLINICAL APPOINTMENT SCHEDULER
CREATE TYPE appointment_status AS ENUM ('Scheduled', 'Arrived', 'In Consultation', 'Completed', 'Cancelled');

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES staff_practitioners(id) ON DELETE SET NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason_for_visit VARCHAR(255) DEFAULT 'General Consultation',
    status appointment_status NOT NULL DEFAULT 'Scheduled',
    symptoms TEXT,
    vitals_bp VARCHAR(20),
    vitals_weight VARCHAR(15),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. LOBBY QUEUING TOKENS
CREATE TABLE token_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    token_number VARCHAR(10) NOT NULL, -- e.g. T03, T04
    serving_cabin VARCHAR(50) NOT NULL, -- e.g. Surgical Cabin 1, Room 2
    is_active BOOLEAN DEFAULT TRUE,
    called_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TREATMENTS & ELECTRONIC MEDICAL RECORDS (EMR)
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES staff_practitioners(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    tooth_number VARCHAR(20), -- Dental charting specificity
    procedure_name VARCHAR(150) NOT NULL, -- e.g. Root Canal, Crown Veneer
    doctor_notes TEXT,
    prescription JSONB DEFAULT '[]'::jsonb, -- List of medications (e.g. [{"name": "Amoxicillin", "dosage": "500mg"}])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. BILLINGS & GST INVOICES
CREATE TYPE billing_status AS ENUM ('Draft', 'Unpaid', 'Partially Paid', 'Fully Paid', 'Refunded');

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL, -- e.g. INV-2026-0041
    sub_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cgst_rate DECIMAL(5,2) DEFAULT 9.00, -- Central GST (e.g. 9%)
    cgst_amount DECIMAL(12,2) DEFAULT 0.00,
    sgst_rate DECIMAL(5,2) DEFAULT 9.00, -- State GST (e.g. 9%)
    sgst_amount DECIMAL(12,2) DEFAULT 0.00,
    igst_rate DECIMAL(5,2) DEFAULT 0.00, -- Integrated GST (for interstate patients)
    igst_amount DECIMAL(12,2) DEFAULT 0.00,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    outstanding_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status billing_status NOT NULL DEFAULT 'Unpaid',
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CLINIC TRANSACTION PAYMENTS (With GST & UPI Tracking)
CREATE TYPE payment_mode AS ENUM ('Cash', 'Card', 'UPI PhonePe', 'UPI GPay', 'UPI Paytm', 'Bank Transfer');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12,2) NOT NULL,
    pay_mode payment_mode NOT NULL DEFAULT 'UPI PhonePe',
    transaction_ref VARCHAR(100), -- UPI reference UTR or Bank receipt sequence number
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. COMMUNICATION DISPATCH ENGINE LOGS (SMS / WHATSAPP Audit trail)
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    medium VARCHAR(20) NOT NULL, -- 'SMS' or 'WhatsApp'
    trigger_event VARCHAR(100) NOT NULL, -- e.g. 'Appointment Reminder', 'Payment Receipt'
    recipient_phone VARCHAR(15) NOT NULL,
    message_content TEXT NOT NULL,
    delivery_status VARCHAR(50) DEFAULT 'Sent',
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INFORMATIVE INDEXING FOR LIVE TERMINAL SPEEDS
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_appointments_status ON appointments(status, scheduled_time);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_token_queue_active ON token_queue(is_active);
