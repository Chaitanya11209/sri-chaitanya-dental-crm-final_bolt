import { useEffect, useState, useCallback, useMemo } from 'react';
import DentalChart, { type ToothStatus } from '../../components/DentalChart';
import TimelineView from '../../components/TimelineView';
import { useLocation } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, canWriteClinical, canWriteScheduling, canWriteBilling, getRole } from '../../lib/auth';
import { useNotification } from '../../components/NotificationProvider';
import QRScannerModal from '../../components/QRScannerModal';
import { sendSMS, getSMSTemplates } from '../../lib/sms';
import { usePatientsRealtime, useAppointmentsRealtime } from '../../hooks/useRealtimeHooks';
import {
  openWhatsApp,
  followupMessage,
  appointmentConfirmationMessage,
  paymentReminderMessage,
  thankYouMessage,
  CLINIC_SIGNATURE,
  patientFeedbackRequestMessage,
  googleReviewRequestMessage
} from '../../utils/whatsapp';
import { logWhatsAppDelivery } from '../../lib/whatsapp';
import { clinicConfig } from '../../config/clinicConfig';
import { isSupabaseConfigured } from '../../lib/supabase';
import DoctorSelect from '../../components/DoctorSelect';
import {
  Search, Plus, Phone, MapPin, X, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, UserCheck, Clock, Stethoscope, AlertCircle, DollarSign,
  FileText, Users, UserPlus, Bell, RotateCcw, ArrowRight, Mail,
  Activity, Eye, MessageCircle, MessageSquare, CheckSquare, ClipboardList, CreditCard, Wallet,
  Printer, Download, Trash2, Camera, Send, RefreshCw
} from 'lucide-react';

type PatientStatus = 'Registered' | 'Waiting' | 'In Treatment' | 'Follow-up Required' | 'Completed';
type TabType = 'demographics' | 'timeline' | 'dental_chart' | 'appointments' | 'treatments' | 'prescriptions' | 'followups' | 'billing';

interface Patient {
  id: number;
  patient_code: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  age: string;
  gender: string;
  notes: string;
  patient_status: PatientStatus;
  last_visit_date: string | null;
  next_visit_date: string | null;
  treatment_summary: string | null;
  created_at: string;
}

interface PatientAppointment {
  id: number;
  treatment: string;
  next_visit: string;
  appointment_time: string;
  status: string;
  amount_paid: number;
  balance_amount: number;
  payment_mode: string;
  created_at: string;
  notes?: string;
  payment_notes?: string;
}

interface Treatment {
  id: number;
  treatment_type: string;
  stage: string;
  start_date: string;
  expected_end_date: string;
  total_sessions: number;
  sessions_done: number;
  treatment_notes: string;
  status: string;
  created_at?: string;
  tooth_no?: string | number;
  notes?: string;
  cost?: number;
  doctor_name?: string;
  estimated_cost?: number;
  paid_amount?: number;
  balance_amount?: number;
  next_visit?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const cleanPhone = (ph: string | null | undefined): string => {
  if (!ph) return '';
  const cleaned = ph.trim().replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};
const STATUS_OPTIONS: PatientStatus[] = ['Registered', 'Waiting', 'In Treatment', 'Follow-up Required', 'Completed'];
const TREATMENTS_LIST = ['Dental Implants', 'Root Canal', 'Teeth Whitening', 'Braces & Aligners', 'Scaling & Polishing', 'Tooth Extraction', 'Fillings', 'Crowns & Bridges', 'Pediatric Dentistry', 'Emergency Care', 'Consultation', 'Other'];
const STAGES_LIST = ['Assessment', 'Treatment Started', 'In Progress', 'Review', 'Completed'];

const STATUS_STYLE: Record<PatientStatus, { bg: string; text: string; border: string; icon: typeof UserCheck }> = {
  Registered:          { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   icon: UserCheck },
  Waiting:             { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Clock },
  'In Treatment':      { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',   icon: Stethoscope },
  'Follow-up Required':{ bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200', icon: AlertCircle },
  Completed:           { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
};

export const RX_TEMPLATES: Record<string, { label: string; medicines: { name: string; dosage: string; frequency: string; duration: string }[] }> = {
  RCT: {
    label: 'Root Canal Treatment (RCT)',
    medicines: [
      { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Three times daily (after meals)', duration: '5 days' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'When pain occurs (sos)', duration: '3 days' },
      { name: 'Chlorhexidine Mouthwash', dosage: '10 ml', frequency: 'Twice daily after meals', duration: '7 days' },
    ]
  },
  Extraction: {
    label: 'Tooth Extraction',
    medicines: [
      { name: 'Ketorolac DT 10mg', dosage: '1 tablet', frequency: 'Twice daily dissolved in water', duration: '3 days' },
      { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Three times daily', duration: '5 days' },
      { name: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: 'Once daily before breakfast', duration: '5 days' }
    ]
  },
  Implant: {
    label: 'Dental Implant Surgery',
    medicines: [
      { name: 'Amoxicillin + Clavulanic Acid 625mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '5 days' },
      { name: 'Ibuprofen 400mg + Paracetamol 325mg', dosage: '1 tablet', frequency: 'Three times daily', duration: '3 days' },
      { name: 'Povidone-Iodine Mouthwash', dosage: '10 ml', frequency: 'Twice daily gargle', duration: '7 days' }
    ]
  },
  Scaling: {
    label: 'Scaling & Polishing',
    medicines: [
      { name: 'Hexidine Mouthwash', dosage: '10 ml', frequency: 'Twice daily gargle', duration: '14 days' },
      { name: 'Thermodent Sensitive Toothpaste', dosage: 'Pea-sized amount', frequency: 'Massage gently twice daily', duration: 'Ongoing' }
    ]
  },
};

const PATIENTS_FALLBACK_DOCTORS = [
  { id: 1, name: 'Dr. Sri Chaitanya', phone: '918317575165', qualification: 'BDS, MDS', specialization: 'Chief Implantologist' },
  { id: 2, name: 'Dr. K. Verma', phone: '919988776655', qualification: 'BDS', specialization: 'Consultant Oral Surgeon' }
];

export default function Patients() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [duplicateFoundPatient, setDuplicateFoundPatient] = useState<any | null>(null);
  const [bypassNamePhoneDuplicate, setBypassNamePhoneDuplicate] = useState(false);
  const [inlineAction, setInlineAction] = useState<'none' | 'book_appointment' | 'add_follow_up'>('none');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [apptForm, setApptForm] = useState({
    treatment: 'Consultation',
    date: '',
    time: '10:00',
    doctorId: '1',
    doctorName: '',
    notes: '',
    isHistorical: false
  });
  const [followUpForm, setFollowUpForm] = useState({
    date: '',
    time: '11:00',
    doctorId: '1',
    doctorName: '',
    notes: ''
  });

  const handleInlineBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!apptForm.date || !apptForm.time || !apptForm.treatment) {
      notify('warning', 'Missing Fields', 'Please select a valid date, time and treatment for this appointment.');
      return;
    }

    let isPastDate = false;
    if (apptForm.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(apptForm.date);
      apptDate.setHours(0, 0, 0, 0);
      isPastDate = apptDate < today;
    }
    const isActuallyHistorical = apptForm.isHistorical || isPastDate;

    setBookingLoading(true);
    try {
      const selectedDoc = doctors.find(d => d.id.toString() === apptForm.doctorId.toString()) || doctors[0] || PATIENTS_FALLBACK_DOCTORS[0];
      
      const payload = {
        patient_id: selected.id,
        name: selected.name,
        phone: selected.phone,
        email: selected.email || '',
        treatment: apptForm.treatment,
        next_visit: apptForm.date,
        appointment_time: apptForm.time,
        notes: apptForm.notes.trim() || 'Booked via Clinical Quick Actions Menu',
        status: isActuallyHistorical ? 'Completed' : 'Pending',
        doctor_id: selectedDoc.id,
        doctor_name: selectedDoc.name,
        amount_paid: 0,
        balance_amount: 0,
        payment_mode: 'Cash',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('appointments')
        .insert([payload]);

      if (error) throw error;

      notify('success', 'Appointment Scheduled', `Successfully booked appointment with ${selectedDoc.name} for ${selected.name} for ${apptForm.treatment}.`);
      setInlineAction('none');
      
      // Update local state lists of treatment history summaries or appt records on the spot
      const apptRes = await supabase.from('appointments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
      setPatientAppointments(apptRes.data || []);
      
      // Reload Patient grid with latest stats
      fetchPatients();
    } catch (err: any) {
      console.error('[Patients Quick Actions] Error booking appointment:', err);
      notify('error', 'Booking Failed', err.message || 'Could not save appointment in database.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleInlineAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!followUpForm.date || !followUpForm.time) {
      notify('warning', 'Missing Fields', 'Please select a scheduled date and time for the follow-up review.');
      return;
    }

    let isPastDate = false;
    if (followUpForm.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(followUpForm.date);
      apptDate.setHours(0, 0, 0, 0);
      isPastDate = apptDate < today;
    }

    setBookingLoading(true);
    try {
      const selectedDoc = doctors.find(d => d.id.toString() === followUpForm.doctorId.toString()) || doctors[0] || PATIENTS_FALLBACK_DOCTORS[0];
      
      const payload = {
        patient_id: selected.id,
        name: selected.name,
        phone: selected.phone,
        email: selected.email || '',
        treatment: 'Follow-up Review',
        next_visit: followUpForm.date,
        appointment_time: followUpForm.time,
        notes: followUpForm.notes.trim() || 'Follow-up registered via Clinical Quick Actions Menu',
        status: isPastDate ? 'Completed' : 'Pending',
        doctor_id: selectedDoc.id,
        doctor_name: selectedDoc.name,
        amount_paid: 0,
        balance_amount: 0,
        payment_mode: 'Cash',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('appointments')
        .insert([payload]);

      if (error) throw error;

      // Update patient status to 'Follow-up Required' to reflect real professional guidance
      const { error: patientStatusError } = await supabase
        .from('patients')
        .update({ patient_status: 'Follow-up Required' })
        .eq('id', selected.id);

      if (!patientStatusError) {
        setSelected({ ...selected, patient_status: 'Follow-up Required' });
      }

      notify('success', 'Follow-up Registered', `Routine clinical follow-up scheduled on ${followUpForm.date} with ${selectedDoc.name}.`);
      setInlineAction('none');
      
      // Update local state lists
      const apptRes = await supabase.from('appointments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
      setPatientAppointments(apptRes.data || []);
      
      // Reload Patient grid
      fetchPatients();
    } catch (err: any) {
      console.error('[Patients Quick Actions] Error scheduling follow-up:', err);
      notify('error', 'Scheduling Failed', err.message || 'Could not register follow-up review.');
    } finally {
      setBookingLoading(false);
    }
  };

  const getPatientMetadata = (p: Patient | null) => {
    if (!p) return {
      notes: '',
      blood_group: '',
      occupation: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      medical_history: [] as string[],
      allergies: [] as string[],
      current_medications: '',
      habits: [] as string[],
      insurance_provider: '',
      insurance_policy_num: '',
      insurance_expiry: '',
      avatar: 'avatar1',
      dental_chart: {} as Record<string, string>,
      prescriptions: [] as any[],
      dob: '',
      gender: ''
    };
    try {
      if (p.notes && p.notes.startsWith('{') && p.notes.endsWith('}')) {
        const parsedObject = JSON.parse(p.notes);
        return {
          notes: '',
          blood_group: '',
          occupation: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          medical_history: [] as string[],
          allergies: [] as string[],
          current_medications: '',
          habits: [] as string[],
          insurance_provider: '',
          insurance_policy_num: '',
          insurance_expiry: '',
          avatar: 'avatar1',
          dental_chart: {} as Record<string, string>,
          prescriptions: [] as any[],
          dob: '',
          gender: '',
          ...parsedObject
        };
      }
    } catch (e) {
      // Ignore
    }

    let parsedDob = '';
    let parsedNotes = p.notes || '';
    if (parsedNotes.startsWith('DOB:')) {
      const splitIdx = parsedNotes.indexOf('|');
      if (splitIdx !== -1) {
        parsedDob = parsedNotes.substring(4, splitIdx).trim();
        parsedNotes = parsedNotes.substring(splitIdx + 1).trim();
      } else {
        parsedDob = parsedNotes.substring(4).trim();
        parsedNotes = '';
      }
    }

    return {
      notes: parsedNotes,
      blood_group: '',
      occupation: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      medical_history: [] as string[],
      allergies: [] as string[],
      current_medications: '',
      habits: [] as string[],
      insurance_provider: '',
      insurance_policy_num: '',
      insurance_expiry: '',
      avatar: 'avatar1',
      dental_chart: {} as Record<string, string>,
      prescriptions: [] as any[],
      dob: parsedDob,
      gender: p.gender || ''
    };
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    gender: '',
    age: '',
    notes: '',
    blood_group: '',
    occupation: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: [] as string[],
    allergies: [] as string[],
    current_medications: '',
    habits: [] as string[],
    insurance_provider: '',
    insurance_policy_num: '',
    insurance_expiry: '',
    avatar: 'avatar1',
    dob: ''
  });

  const [rxForm, setRxForm] = useState({
    p_type: 'RCT',
    notes: '',
    medicines: RX_TEMPLATES.RCT.medicines
  });

  const saveProfileDetails = async () => {
    if (!selected) return;
    setIsSavingProfile(true);
    const currentMeta = getPatientMetadata(selected);
    const updatedAge = profileForm.dob ? calculateAge(profileForm.dob).toString() : profileForm.age || selected.age;
    const updatedMeta = {
      ...currentMeta,
      notes: profileForm.notes,
      blood_group: profileForm.blood_group,
      occupation: profileForm.occupation,
      emergency_contact_name: profileForm.emergency_contact_name,
      emergency_contact_phone: profileForm.emergency_contact_phone,
      medical_history: profileForm.medical_history,
      allergies: profileForm.allergies,
      current_medications: profileForm.current_medications,
      habits: profileForm.habits,
      insurance_provider: profileForm.insurance_provider,
      insurance_policy_num: profileForm.insurance_policy_num,
      insurance_expiry: profileForm.insurance_expiry,
      avatar: profileForm.avatar,
      dob: profileForm.dob,
      gender: profileForm.gender,
      age: updatedAge
    };

    const notesStr = JSON.stringify(updatedMeta);
    
    const payload = {
      name: profileForm.name,
      phone: profileForm.phone,
      email: profileForm.email,
      location: profileForm.location,
      gender: profileForm.gender,
      age: updatedAge,
      notes: notesStr
    };
    
    // Add temporary debugging console logs requested by the user
    console.log("Loaded selected patient data before save:", selected);
    console.log("Form state before save:", profileForm);
    console.log("Patient Save Payload:", payload);

    try {
      const isStandardId = selected.id && 
                           typeof selected.id === 'number' && 
                           selected.id < 10000000 && 
                           !(selected.patient_code && selected.patient_code.startsWith('SDC-F-'));
      
      if (!isStandardId) {
        // Warn if duplicate patient entries (both phone and name match, or email and name match)
        if (profileForm.phone && profileForm.name) {
          const { data: existingPatients, error: checkError } = await supabase
            .from('patients')
            .select('id, name')
            .eq('phone', profileForm.phone.trim());
          
          if (!checkError && existingPatients && existingPatients.length > 0) {
            const matchNamePhone = existingPatients.find(
              p => p.name.trim().toLowerCase() === profileForm.name.trim().toLowerCase() && p.id !== selected.id
            );
            if (matchNamePhone) {
              if (!confirm(`Warning: A patient named "${matchNamePhone.name}" already exists with phone number ${profileForm.phone}. Are you sure you want to save this as a separate patient profile?`)) {
                setIsSavingProfile(false);
                return;
              }
            }
          }
        }
        if (profileForm.email && profileForm.email.trim() && profileForm.name) {
          const { data: existingByEmail, error: checkEmailError } = await supabase
            .from('patients')
            .select('id, name')
            .eq('email', profileForm.email.trim());
          
          if (!checkEmailError && existingByEmail && existingByEmail.length > 0) {
            const matchNameEmail = existingByEmail.find(
              p => p.name.trim().toLowerCase() === profileForm.name.trim().toLowerCase() && p.id !== selected.id
            );
            if (matchNameEmail) {
              if (!confirm(`Warning: A patient named "${matchNameEmail.name}" already exists with email address ${profileForm.email}. Are you sure you want to save this as a separate patient profile?`)) {
                setIsSavingProfile(false);
                return;
              }
            }
          }
        }

        // Create new patient record
        const code = `SDC-${Date.now()}`;
        const { data, error } = await supabase.from('patients').insert([{
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email,
          location: profileForm.location,
          gender: profileForm.gender,
          age: updatedAge,
          notes: notesStr,
          patient_code: code,
          patient_status: selected.patient_status || 'Registered'
        }]).select();

        console.log("Patient Insert Result (Supabase response):", data);
        if (error) {
          console.error("Patient Save Error (Insert):", error);
          if (error.message?.toLowerCase().includes("notes") || error.message?.toLowerCase().includes("schema cache")) {
            notify('error', 'Database Schema Mismatch', 'Your Supabase "patients" table is missing the "notes" column. Please run: "ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes text;" in Supabase SQL Editor.');
          } else {
            notify('error', 'Profile Sync Blocked', error.message || 'Could not insert new patient record.');
          }
          setIsSavingProfile(false);
          return;
        }

        if (data && data.length > 0) {
          const newPatient = data[0];
          const phoneClean = cleanPhone(profileForm.phone);
          if (phoneClean) {
            // Find all appointments and treatments matching this phone pattern
            const [apptToSync, treatToSync] = await Promise.all([
              supabase.from('appointments').select('id, phone').or(`phone.eq.${profileForm.phone},phone.ilike.%${phoneClean}%`),
              supabase.from('treatments').select('id, phone').or(`phone.eq.${profileForm.phone},phone.ilike.%${phoneClean}%`)
            ]);

            const apptIds = (apptToSync.data || []).map(a => a.id);
            const treatIds = (treatToSync.data || []).map(t => t.id);

            // Cascade update utilizing matching primary IDs
            await Promise.all([
              apptIds.length > 0 ? supabase.from('appointments').update({ patient_id: newPatient.id }).in('id', apptIds) : Promise.resolve(),
              treatIds.length > 0 ? supabase.from('treatments').update({ patient_id: newPatient.id }).in('id', treatIds) : Promise.resolve()
            ]);
          }
          
          setSelected({
            ...newPatient,
            last_visit_date: selected.last_visit_date,
            next_visit_date: selected.next_visit_date,
            treatment_summary: selected.treatment_summary
          });
          notify('success', 'Profile Saved & Registered', `Successfully created patient record for "${profileForm.name}" and linked clinical files.`);
        }
      } else {
        const { data, error } = await supabase.from('patients').update({
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email,
          location: profileForm.location,
          gender: profileForm.gender,
          age: updatedAge,
          notes: notesStr
        }).eq('id', selected.id).select();

        console.log("Patient Update Result (Supabase response):", data);
        if (error) {
          console.error("Patient Save Error (Update):", error);
          if (error.message?.toLowerCase().includes("notes") || error.message?.toLowerCase().includes("schema cache")) {
            notify('error', 'Database Schema Mismatch', 'Your Supabase "patients" table is missing the "notes" column. Please run: "ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes text;" in Supabase SQL Editor.');
          } else {
            notify('error', 'Profile Save Failed', error.message || 'Could not update patient profile.');
          }
          setIsSavingProfile(false);
          return;
        }

        setSelected({
          ...selected,
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email,
          location: profileForm.location,
          gender: profileForm.gender,
          age: updatedAge,
          notes: notesStr
        });
        notify('success', 'Profile Updated', `Successfully updated practice files for "${profileForm.name}".`);
      }
      setIsEditingProfile(false);
      fetchPatients();
    } catch (err: any) {
      console.error("Patient Save Exception:", err);
      notify('error', 'Critical Error', err.message || 'An unexpected failure occurred while saving information.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveDentalChart = async (tooth: string, status: ToothStatus) => {
    if (!selected) return;
    if (!canWriteClinical()) {
      alert("Access Denied: You do not have permission to modify clinical records. Only Doctors and Admins can update clinical data.");
      return;
    }
    const currentMeta = getPatientMetadata(selected);
    const updatedChart = {
      ...(currentMeta.dental_chart || {}),
      [tooth]: status
    };
    const updatedMeta = {
      ...currentMeta,
      dental_chart: updatedChart
    };
    const notesStr = JSON.stringify(updatedMeta);
    const { error } = await supabase.from('patients').update({ notes: notesStr }).eq('id', selected.id);
    if (!error) {
      setSelected({ ...selected, notes: notesStr });
      fetchPatients();
    }
  };

  const updatePatientMetadata = async (updatedFields: Partial<any>) => {
    if (!selected) return;
    try {
      const currentMeta = getPatientMetadata(selected);
      const updatedMeta = {
        ...currentMeta,
        ...updatedFields
      };
      const notesStr = JSON.stringify(updatedMeta);
      const { error } = await supabase.from('patients').update({ notes: notesStr }).eq('id', selected.id);
      if (error) throw error;
      setSelected({ ...selected, notes: notesStr });
      fetchPatients();
    } catch (err: any) {
      console.error('[Patients] Error updating patient metadata:', err);
      notify('error', 'Update Failed', err.message || 'Could not update records.');
    }
  };

  const savePrescription = async (pType: string, meds: any[], rxNotes: string) => {
    if (!selected) return;
    if (!canWriteClinical()) {
      alert("Access Denied: Custom prescriptions can only be committed by Doctors and Admins.");
      return;
    }
    const currentMeta = getPatientMetadata(selected);
    const newRx = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      p_type: pType,
      medicines: meds,
      notes: rxNotes
    };
    const updatedMeta = {
      ...currentMeta,
      prescriptions: [newRx, ...(currentMeta.prescriptions || [])]
    };
    const notesStr = JSON.stringify(updatedMeta);
    const { error } = await supabase.from('patients').update({ notes: notesStr }).eq('id', selected.id);
    if (!error) {
      setSelected({ ...selected, notes: notesStr });
      fetchPatients();
    }
  };

  const printPrescription = (rx: any) => {
    if (!selected) return;
    const actualAge = getPatientMetadata(selected).dob ? calculateAge(getPatientMetadata(selected).dob) : (selected.age || '-');
    const signatureImage = localStorage.getItem('doctor_signature_image');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Prescription - ${selected.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', sans-serif; padding: 40px; color: #334155; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-area { color: #0f766e; }
            .clinic-name { font-size: 24px; font-weight: bold; margin: 0; }
            .clinic-sub { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 5px 0 0 0; }
            .clinic-details { text-align: right; font-size: 11px; color: #64748b; line-height: 1.5; }
            .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; display: grid; grid-template-cols: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 30px; }
            .rx-title { font-size: 28px; font-weight: bold; color: #0f766e; margin-bottom: 20px; font-family: Georgia, serif; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 12px; text-transform: uppercase; color: #475569; }
            td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .footer { margin-top: 80px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .sig-line { border-top: 1px dashed #cbd5e1; width: 180px; text-align: center; padding-top: 8px; font-size: 12px; color: #475569; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-area">
              <h1 class="clinic-name">Sri Chaitanya Dental Care</h1>
              <p class="clinic-sub">Premium Clinical Excellence</p>
            </div>
            <div class="clinic-details">
              <strong>Address:</strong> Flat 102, Sree Towers, Near Metro Pillar 12, Hyderabad<br/>
              <strong>Contact:</strong> +91 98765 43210 · contact@srichaitanyadental.com<br/>
              <strong>Consultants:</strong> ${doctors && doctors.length > 0 ? doctors.map(d => d.name).join(', ') : 'Dr. Sri Chaitanya, Dr. K. Verma'}
            </div>
          </div>

          <div class="patient-box">
            <div><strong>Patient Code:</strong> ${selected.patient_code}</div>
            <div><strong>Date:</strong> ${rx.date || new Date().toLocaleDateString('en-IN')}</div>
            <div><strong>Patient Name:</strong> ${selected.name}</div>
            <div><strong>Age / Gender:</strong> ${actualAge} / ${selected.gender || '-'}</div>
            <div><strong>Phone Contact:</strong> ${selected.phone}</div>
            <div><strong>Treatment Scope:</strong> ${rx.p_type}</div>
          </div>

          <div class="rx-title">R<sub>x</sub></div>

          <table>
            <thead>
              <tr>
                <th style="width: 40%">Medicine Name</th>
                <th style="width: 15%">Dosage</th>
                <th style="width: 25%">Frequency</th>
                <th style="width: 20%">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${rx.medicines.map((m: any) => `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.dosage}</td>
                  <td>${m.frequency}</td>
                  <td>${m.duration}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${rx.notes ? `<div style="margin-top: 20px; font-size: 13px; background: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 8px;"><strong>Doctor Instructions:</strong><p style="margin: 5px 0 0 0; color: #b45309;">${rx.notes}</p></div>` : ''}

          <div class="footer">
            <div>Sri Chaitanya Dental Practice · Electronic Medical Records</div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
              ${signatureImage ? `<img src="${signatureImage}" style="max-height: 52px; margin-bottom: -12px; display: block;" />` : ''}
              <div class="sig-line" style="${signatureImage ? 'margin-top: 5px;' : ''}">Authorized Signatory / Doctor</div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [patients, setPatients] = useState<Patient[]>([]);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regSort, setRegSort] = useState<'newest' | 'oldest' | 'default'>('default');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { notify } = useNotification();
  const [showQRScanner, setShowQRScanner] = useState(false);

  // ── PHASE 8: AUTOMATED WHATSAPP BROADCAST ENGINE STATES ────────────────────
  const [selectedPatientIds, setSelectedPatientIds] = useState<number[]>([]);
  const [showBulkSMSModal, setShowBulkSMSModal] = useState(false);
  const [campaignTab, setCampaignTab] = useState<'compose' | 'history'>('compose');
  const [bulkSMSMessage, setBulkSMSMessage] = useState('');
  const [isSendingBulkSMS, setIsSendingBulkSMS] = useState(false);
  const [bulkSMSSemaphore, setBulkSMSSemaphore] = useState({ current: 0, total: 0 });
  
  // Custom Campaign Templates
  const [selectedTemplate, setSelectedTemplate] = useState<string>('general');
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [previewRecipIndex, setPreviewRecipIndex] = useState(0);

  // Broadcast campaign log schema conforming exactly to specifications
  interface CampaignLog {
    id: string;
    patient_id: number;
    patient_name: string;
    phone: string;
    message: string;
    status: 'Sent' | 'Failed' | 'Scheduled';
    scheduled_at?: string;
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
    error_message?: string;
    timestamp: string;
  }

  const getCampaignLogs = (): CampaignLog[] => {
    try {
      const raw = localStorage.getItem('whatsapp_messages_logs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveCampaignLog = (log: CampaignLog) => {
    try {
      const logs = getCampaignLogs();
      logs.unshift(log);
      localStorage.setItem('whatsapp_messages_logs', JSON.stringify(logs.slice(0, 500)));
    } catch (e) {
      console.error('Error saving campaign log:', e);
    }
  };

  const WHATSAPP_TEMPLATES: Record<string, { label: string; text: string }> = {
    general: {
      label: 'General Updates',
      text: 'Hi [Name], Sri Chaitanya Dental Care wishes you a healthy smile! Please note: [Message]'
    },
    appointment_reminder: {
      label: 'Appointment Reminder',
      text: 'Hi [Name], this is a reminder for your upcoming clinical slot with [Doctor] on [Date] at [Time] for [Treatment]. Sri Chaitanya Dental Care.'
    },
    appointment_confirmation: {
      label: 'Appointment Confirmation',
      text: 'Hi [Name], your appointment with [Doctor] for [Treatment] on [Date] at [Time] is confirmed. Sri Chaitanya Dental Care.'
    },
    tomorrow_reminder: {
      label: 'Tomorrow Reminder',
      text: 'Hi [Name], quick reminder that you have a dental check-up tomorrow at [Time] for [Treatment]. - Sri Chaitanya Dental Care.'
    },
    outstanding_due: {
      label: 'Outstanding Due',
      text: 'Hi [Name], this is an administrative reminder of your outstanding balance of ₹[Balance] for [Treatment] at Sri Chaitanya Dental Care. Please call us to settle.'
    },
    treatment_continuation: {
      label: 'Treatment Continuation',
      text: 'Hi [Name], we hope your treatment for [Treatment] is going beautifully. Please arrange your next continuation slot soon. - Sri Chaitanya Dental Care.'
    },
    recall_6m: {
      label: '6-Month Recall',
      text: 'Hi [Name], it has been 6 months since your last dental evaluation. Professional cleaning preserves your enamel. Book with Sri Chaitanya Dental Care.'
    },
    review_request: {
      label: 'Review Request',
      text: 'Hi [Name], thank you for choosing Sri Chaitanya Dental Care! Could you spend 30 seconds to support our practitioners with a Google feedback review?'
    },
    birthday: {
      label: 'Birthday Wishes',
      text: 'Hi [Name], Sri Chaitanya Dental Care wishes you an incredible Happy Birthday! May your day be filled with warm smiles! 🎉'
    }
  };

  const getReplacedTokenMessage = (text: string, p: Patient): string => {
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const replaced = text
      .replace(/\[Name\]/g, p.name || 'Patient')
      .replace(/\[Doctor\]/g, 'Dr. Sri Chaitanya MDS')
      .replace(/\[Treatment\]/g, p.treatment_summary || 'General Assessment')
      .replace(/\[Date\]/g, p.next_visit_date || p.last_visit_date || todayStr)
      .replace(/\[Time\]/g, '11:30 AM')
      .replace(/\[Balance\]/g, '0')
      .replace(/\[Message\]/g, 'Please contact front desk');

    if (replaced.includes("8317575165")) {
      return replaced;
    }
    return `${replaced.trim()}\n\n${CLINIC_SIGNATURE}`;
  };

  const handleBulkSMSSend = async () => {
    setIsSendingBulkSMS(true);
    setBulkSMSSemaphore({ current: 0, total: selectedPatientIds.length });

    const selectedPatients = patients.filter(p => selectedPatientIds.includes(p.id));
    let successCount = 0;
    let failCount = 0;
    let scheduledCount = 0;

    const logs = getCampaignLogs();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < selectedPatients.length; i++) {
      const p = selectedPatients[i];
      setBulkSMSSemaphore({ current: i + 1, total: selectedPatients.length });

      // Build personalized text body
      const finalMessage = getReplacedTokenMessage(bulkSMSMessage, p);

      // 1. Prevent duplicate delivery warning
      const isDuplicate = logs.some(
        l => l.phone === p.phone && l.timestamp > oneDayAgo && l.status === 'Sent'
      );

      if (isDuplicate) {
        console.warn(`[BROADCAST-PREVENTION] Duplicate notification to ${p.name} (${p.phone}) within 24 hours was bypassed.`);
        failCount++;
        
        saveCampaignLog({
          id: 'WMC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          patient_id: p.id,
          patient_name: p.name,
          phone: p.phone,
          message: finalMessage,
          status: 'Failed',
          error_message: 'Skipped: Duplicate notification blocked within 24 hours',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      if (scheduleLater) {
        // Log scheduled for later
        scheduledCount++;
        saveCampaignLog({
          id: 'WMC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          patient_id: p.id,
          patient_name: p.name,
          phone: p.phone,
          message: finalMessage,
          status: 'Scheduled',
          scheduled_at: scheduleTime || new Date(Date.now() + 3600000).toISOString(),
          timestamp: new Date().toISOString()
        });
        
        // Also push to supabase table write if available
        try {
          await supabase.from('whatsapp_messages').insert({
            patient_id: p.id ? Number(p.id) : null,
            phone: p.phone,
            message: finalMessage,
            status: 'Scheduled',
            scheduled_at: scheduleTime || new Date(Date.now() + 3600000).toISOString()
          });
        } catch {}
        continue;
      }

      try {
        // Send WhatsApp using twilio fallback or direct click open
        const res = await sendSMS({
          name: p.name || 'Patient',
          phone: p.phone,
          message: finalMessage
        });

        const newLog: CampaignLog = {
          id: 'WMC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          patient_id: p.id,
          patient_name: p.name,
          phone: p.phone,
          message: finalMessage,
          status: res.success ? 'Sent' : 'Failed',
          sent_at: res.success ? new Date().toISOString() : undefined,
          delivered_at: res.success ? new Date().toISOString() : undefined,
          error_message: res.error || undefined,
          timestamp: new Date().toISOString()
        };

        saveCampaignLog(newLog);

        // Record in the database
        try {
          await supabase.from('whatsapp_messages').insert({
            patient_id: p.id ? Number(p.id) : null,
            phone: p.phone,
            message: finalMessage,
            status: res.success ? 'Sent' : 'Failed',
            sent_at: res.success ? new Date().toISOString() : null,
            delivered_at: res.success ? new Date().toISOString() : null,
            error_message: res.error || null
          });
        } catch {}

        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err: any) {
        failCount++;
        saveCampaignLog({
          id: 'WMC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          patient_id: p.id,
          patient_name: p.name,
          phone: p.phone,
          message: finalMessage,
          status: 'Failed',
          error_message: err.message || 'Transmission timeout',
          timestamp: new Date().toISOString()
        });
      }
    }

    setIsSendingBulkSMS(false);
    setSelectedPatientIds([]);

    if (scheduledCount > 0) {
      notify('success', 'Campaign Pre-Scheduled', `Successfully queued ${scheduledCount} dental messages to run on the selected time threshold.`);
    } else if (successCount > 0) {
      notify('success', 'Mass Campaign Dispatched', `Successfully delivered bulk clinical broadcasts to ${successCount} patients. ${failCount > 0 ? `${failCount} skipped/failed.` : ''}`);
    } else if (failCount > 0) {
      notify('error', 'Broadcast Bypassed', `Selected patients were protected from duplicate updates. ${failCount} triggers bypassed.`);
    }
    
    // Close composer but keep state for logging
    setShowBulkSMSModal(false);
  };

  const [selected, setSelected] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('demographics');
  const [patientAppointments, setPatientAppointments] = useState<PatientAppointment[]>([]);
  const [patientTreatments, setPatientTreatments] = useState<Treatment[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showWhatsAppMenu, setShowWhatsAppMenu] = useState(false);

  // ── PATIENT SUMMARY DIALOG STATES & WORKFLOWS ──────────────────
  const [summaryPatient, setSummaryPatient] = useState<Patient | null>(null);
  const [summaryAppointments, setSummaryAppointments] = useState<any[]>([]);
  const [summaryTreatments, setSummaryTreatments] = useState<any[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const openPatientSummaryModal = async (p: Patient) => {
    setSummaryPatient(p);
    setShowSummaryModal(true);
    setLoadingSummary(true);
    
    try {
      let apptQuery;
      let treatQuery;
      const isStandardId = p.id && typeof p.id === 'number' && p.id < 10000000;
      
      if (isStandardId) {
        apptQuery = supabase.from('appointments').select('*').or(`patient_id.eq.${p.id},phone.eq.${p.phone}`).order('created_at', { ascending: false });
        treatQuery = supabase.from('treatments').select('*').or(`patient_id.eq.${p.id},phone.eq.${p.phone}`).order('created_at', { ascending: false });
      } else {
        apptQuery = supabase.from('appointments').select('*').eq('phone', p.phone).order('created_at', { ascending: false });
        treatQuery = supabase.from('treatments').select('*').eq('phone', p.phone).order('created_at', { ascending: false });
      }
      
      const [apptRes, treatRes] = await Promise.all([apptQuery, treatQuery]);
      setSummaryAppointments(apptRes.data || []);
      setSummaryTreatments(treatRes.data || []);
    } catch (err) {
      console.error("Error loading patient summary logs:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // ── BILLING & RECEIPT GENERATION STATES & HELPERS ──────────────────
  const [showGenerateBill, setShowGenerateBill] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  interface BillFormState {
    items: Array<{ treatment_type: string; notes: string; qty: number; rate: number; discount: number }>;
    amount_paid: string;
    general_discount: string;
    payment_mode: string;
    doctor_notes: string;
    follow_up_date: string;
    instructions: string;
    doctor_name: string;
    invoice_no?: string;
    consultation_fee?: string;
    treatment_fee?: string;
    lab_charges?: string;
    x_ray_charges?: string;
    discount_amount?: string;
    gst_percent?: string;
    advance_payment?: string;
  }

  const [billForm, setBillForm] = useState<BillFormState>({
    items: [
      { treatment_type: 'Clinical Consultation', notes: 'Initial Oral Examination', qty: 1, rate: 250, discount: 0 }
    ],
    amount_paid: '250',
    general_discount: '0',
    payment_mode: 'Cash',
    doctor_notes: 'Initial check-up completed. Recommended scaling.',
    follow_up_date: '',
    instructions: 'Avoid eating hard foods for 2 hours.',
    doctor_name: PATIENTS_FALLBACK_DOCTORS[0].name,
    // Dental billing parameters (Priority 3)
    invoice_no: '',
    consultation_fee: '250',
    treatment_fee: '0',
    lab_charges: '0',
    x_ray_charges: '0',
    discount_amount: '0',
    gst_percent: '18',
    advance_payment: '0'
  });

  const generateNextInvoiceNumber = async (): Promise<string> => {
    const currentYear = new Date().getFullYear();
    const prefix = `SCDC-${currentYear}-`;
    try {
      const { count, error } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;
      
      const countVal = count || 0;
      const nextSequence = String(countVal + 1).padStart(6, '0');
      return `${prefix}${nextSequence}`;
    } catch (e) {
      console.error("Error generating sequential invoice code", e);
      // Fallback
      return `${prefix}${String(Math.floor(100000 + Math.random() * 900000)).slice(-6)}`;
    }
  };

  useEffect(() => {
    if (showGenerateBill) {
      generateNextInvoiceNumber().then(invNo => {
        setBillForm(f => ({ ...f, invoice_no: invNo }));
      });
    }
  }, [showGenerateBill]);

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert3 = (n: number): string => {
      let word = '';
      const h = Math.floor(n / 100);
      const t = n % 100;
      if (h > 0) {
        word += a[h] + ' Hundred ';
      }
      if (t > 0) {
        if (word !== '') word += 'and ';
        if (t < 20) {
          word += a[t];
        } else {
          word += b[Math.floor(t / 10)];
          if (t % 10 > 0) {
            word += '-' + a[t % 10];
          }
        }
      }
      return word.trim();
    };

    let temp = Math.floor(num);
    const parts = [];

    if (temp >= 10000000) {
      const cr = Math.floor(temp / 10000000);
      parts.push(convert3(cr) + ' Crore');
      temp %= 10000000;
    }
    if (temp >= 100000) {
      const lk = Math.floor(temp / 100000);
      parts.push(convert3(lk) + ' Lakh');
      temp %= 100000;
    }
    if (temp >= 1000) {
      const th = Math.floor(temp / 1000);
      parts.push(convert3(th) + ' Thousand');
      temp %= 1000;
    }
    if (temp > 0) {
      parts.push(convert3(temp));
    }

    return (parts.filter(Boolean).join(', ') + ' Rupees Only').replace(/\s+/g, ' ');
  };

  const parseBilling = (appt: any) => {
    try {
      if (appt.payment_notes && appt.payment_notes.startsWith('{') && appt.payment_notes.endsWith('}')) {
        return JSON.parse(appt.payment_notes);
      }
      if (appt.notes && (appt.notes.includes('[Payment Notes / Breakup: ') || appt.notes.includes('[Payment Notes: '))) {
        const marker = appt.notes.includes('[Payment Notes / Breakup: ') ? '[Payment Notes / Breakup: ' : '[Payment Notes: ';
        const startIdx = appt.notes.indexOf(marker) + marker.length;
        const endIdx = appt.notes.lastIndexOf(']');
        const jsonStr = appt.notes.slice(startIdx, endIdx).trim();
        if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
          return JSON.parse(jsonStr);
        }
      }
    } catch (e) {
      console.error('Error parsing billing from notes fallback:', e);
    }
    const conFee = appt.consultation_fee !== undefined && appt.consultation_fee !== null ? Number(appt.consultation_fee) : 250;
    const treatFee = appt.treatment_fee !== undefined && appt.treatment_fee !== null ? Number(appt.treatment_fee) : Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0) - conFee;
    const labChg = appt.lab_charges !== undefined && appt.lab_charges !== null ? Number(appt.lab_charges) : 0;
    const xrayChg = appt.x_ray_charges !== undefined && appt.x_ray_charges !== null ? Number(appt.x_ray_charges) : 0;
    const disc = appt.discount_amount !== undefined && appt.discount_amount !== null ? Number(appt.discount_amount) : 0;
    const finalBal = appt.final_balance !== undefined && appt.final_balance !== null ? Number(appt.final_balance) : Number(appt.balance_amount || 0);
    const invoiceNo = appt.invoice_no || `SCDC-BILL-${appt.id}-${new Date(appt.created_at || Date.now()).getTime().toString().slice(-4)}`;

    const cost = conFee + treatFee + labChg + xrayChg;
    return {
      items: [{
        treatment_type: appt.treatment || 'Dental Service',
        notes: appt.notes || 'Dental Care Treatment',
        qty: 1,
        rate: treatFee,
        discount: disc,
        net_amt: treatFee - disc
      }],
      invoice_no: invoiceNo,
      consultation_fee: conFee,
      treatment_fee: treatFee,
      lab_charges: labChg,
      x_ray_charges: xrayChg,
      discount: disc,
      gst_percent: 18,
      gst_amount: Math.round((conFee + treatFee + labChg + xrayChg - disc) * 0.18),
      total_gross: cost,
      net_amount: cost - disc,
      amount_paid: Number(appt.amount_paid || 0),
      balance_due: finalBal,
      doctor_notes: appt.notes || '',
      follow_up_date: '',
      instructions: '',
      doctor_name: appt.doctor_name || doctors.find((d: any) => d.id?.toString() === appt.doctor_id?.toString())?.name || doctors[0]?.name || 'Dr. Sri Chaitanya'
    };
  };

  const printBill = (appt: any) => {
    if (!selected) return;
    const actualAge = getPatientMetadata(selected).dob ? calculateAge(getPatientMetadata(selected).dob) : (selected.age || '-');
    const bill = parseBilling(appt);
    const billNumber = `SDC-BILL-${appt.id}-${new Date(appt.created_at || Date.now()).getTime().toString().slice(-6)}`;
    const billDate = appt.created_at ? new Date(appt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const billTime = appt.created_at ? new Date(appt.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const amountWords = numberToWords(bill.amount_paid);

    const docContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill Cum Receipt - ${selected.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            color: #000;
            background: #fff;
            padding: 12mm;
            max-width: 210mm;
            margin: 0 auto;
            line-height: 1.4;
          }
          
          /* Clinic Logo and Header Frame */
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .header-table td {
            border: none;
            padding: 0;
            vertical-align: top;
          }
          .clinic-title {
            font-size: 20px;
            font-weight: 800;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .clinic-tagline {
            font-size: 10px;
            font-weight: 600;
            color: #444;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .clinic-meta {
            font-size: 9px;
            color: #333;
            line-height: 1.5;
          }
          .clinic-meta strong {
            color: #000;
          }
          .header-right {
            text-align: right;
            font-size: 9px;
            color: #333;
            line-height: 1.5;
          }

          /* Document Title Ribbon */
          .document-title-container {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 6px 0;
            text-align: center;
            margin-bottom: 20px;
          }
          .document-title {
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
          }

          /* Patient Metadata Grid */
          .patient-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .patient-grid td {
            padding: 5px 4px;
            vertical-align: top;
            font-size: 10.5px;
            border: none;
          }
          .patient-grid td.lbl {
            width: 15%;
            font-weight: 700;
            color: #222;
          }
          .patient-grid td.val {
            width: 35%;
            color: #000;
          }

          /* Table Styling */
          table.items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          table.items-table th {
            border: 1px solid #000;
            padding: 8px 10px;
            font-weight: 700;
            font-size: 9.5px;
            text-transform: uppercase;
            background-color: #f8f9fa;
            text-align: left;
          }
          table.items-table td {
            border: 1px solid #ddd;
            padding: 8px 10px;
            font-size: 10.5px;
            color: #111;
          }
          table.items-table th, table.items-table td {
            border-left: 1px solid #000;
            border-right: 1px solid #000;
          }
          table.items-table thead tr {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }
          table.items-table tbody tr:last-child {
            border-bottom: 1px solid #000;
          }

          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }

          /* Summary Layout matching image */
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .summary-table td {
            padding: 6px 8px;
            vertical-align: middle;
            border: 1px solid #000;
            font-size: 10.5px;
          }
          .summary-left {
            width: 60%;
            border-right: none !important;
          }
          .summary-right-label {
            width: 22%;
            font-weight: 700;
            text-align: right;
            background-color: #f8f9fa;
          }
          .summary-right-val {
            width: 18%;
            font-weight: 700;
            text-align: right;
          }

          /* Doctor Notes & Remarks Section */
          .remarks-box {
            border: 1px dashed #000;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 30px;
            background-color: #fff;
          }
          .remarks-title {
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            margin-bottom: 5px;
            text-decoration: underline;
          }

          /* Signatures section at bottom */
          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 40px;
          }
          .signature-table td {
            border: none;
            width: 50%;
            padding: 0;
            font-size: 11px;
            vertical-align: bottom;
          }
          .signature-line {
            width: 180px;
            border-bottom: 1px solid #000;
            margin-bottom: 5px;
          }
          .signature-receptionist {
            text-align: right;
          }
          .signature-receptionist .signature-line {
            margin-left: auto;
          }

          @media print {
            body {
              padding: 0;
            }
            @page {
              size: A4 portrait;
              margin: 15mm 12mm 15mm 12mm;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td>
              <div class="clinic-title">SRI CHAITANYA MULTISPECIALITY DENTAL CARE</div>
              <div class="clinic-tagline">Advanced Dental & Implant Centre</div>
              <div class="clinic-meta">
                Ph: <strong>+91 83175 75165</strong> &nbsp;|&nbsp; Email: <strong>srichaitanyadentalcare9@gmail.com</strong><br>
                Reg No: <strong>HYD/DENT/2026/0894</strong> &nbsp;|&nbsp; GSTIN: <strong>36AAQCS4501D1Z2</strong>
              </div>
            </td>
            <td class="header-right">
              G4, Lakeview Apartments,<br>
              Bandam Kommu, Ameenpur,<br>
              Hyderabad, Telangana - 502032
            </td>
          </tr>
        </table>

        <!-- Document Title -->
        <div class="document-title-container">
          <h2 class="document-title">Bill Cum Receipt</h2>
        </div>

        <!-- Patient Info Grid -->
        <table class="patient-grid">
          <tr>
            <td class="lbl">Patient Name</td>
            <td class="val">: <strong>${selected.name}</strong></td>
            <td class="lbl">Bill Number</td>
            <td class="val">: <strong>${billNumber}</strong></td>
          </tr>
          <tr>
            <td class="lbl">MR. No (ID)</td>
            <td class="val">: ${selected.patient_code}</td>
            <td class="lbl">Bill Date</td>
            <td class="val">: ${billDate} &nbsp; ${billTime}</td>
          </tr>
          <tr>
            <td class="lbl">Age & Sex</td>
            <td class="val">: ${actualAge} / ${selected.gender || '-'}</td>
            <td class="lbl">Billing Type</td>
            <td class="val">: ${appt.payment_mode || 'Cash'}</td>
          </tr>
          <tr>
            <td class="lbl">Mobile</td>
            <td class="val">: ${selected.phone}</td>
            <td class="lbl">Consultant</td>
            <td class="val">: ${bill.doctor_name || (doctors && doctors[0]?.name) || 'Dr. Sri Chaitanya'}</td>
          </tr>
          <tr>
            <td class="lbl">Address</td>
            <td class="val" colspan="3">: ${selected.location || 'Hyderabad, Telangana'}</td>
          </tr>
        </table>

        <!-- Treatment Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">S.No</th>
              <th style="width: 30%;">Procedure / Treatment</th>
              <th style="width: 25%;">Particulars / Notes</th>
              <th style="width: 10%;" class="text-right">Cost (INR)</th>
              <th style="width: 6%;" class="text-center">Qty</th>
              <th style="width: 10%;" class="text-right">Dis (INR)</th>
              <th style="width: 14%;" class="text-right">Net Amt (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items.map((item: any, index: number) => {
              const grossVal = item.rate * item.qty;
              const netVal = grossVal - (item.discount || 0);
              return `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td><strong>${item.treatment_type}</strong></td>
                  <td>${item.notes || '-'}</td>
                  <td class="text-right">${Number(item.rate).toLocaleString('en-IN')}.00</td>
                  <td class="text-center">${item.qty}</td>
                  <td class="text-right">${Number(item.discount || 0).toLocaleString('en-IN')}.00</td>
                  <td class="text-right" style="font-weight: 700;">${Number(netVal).toLocaleString('en-IN')}.00</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Summary section -->
        <table class="summary-table">
          <tr>
            <td rowspan="4" class="summary-left" style="vertical-align: top;">
              <p style="font-weight: bold; margin-bottom: 5px;">Payment Details:</p>
              <p>Mode of Payment: <strong>${appt.payment_mode || 'Cash'}</strong> ${appt.payment_notes && !appt.payment_notes.startsWith('{') ? `(${appt.payment_notes})` : ''}</p>
              <p style="margin-top: 10px;">Amount in Words:</p>
              <p style="font-weight: 700; font-style: italic; font-size: 11px; margin-top: 2px;">${amountWords}</p>
            </td>
            <td class="summary-right-label">Total Gross Amt:</td>
            <td class="summary-right-val">₹${Number(bill.total_gross).toLocaleString('en-IN')}.00</td>
          </tr>
          <tr>
            <td class="summary-right-label" style="color: #444;">Total Disc Amt:</td>
            <td class="summary-right-val" style="color: #444;">₹${Number(bill.discount).toLocaleString('en-IN')}.00</td>
          </tr>
          <tr>
            <td class="summary-right-label" style="background-color: #e9ecef; font-size: 11px;">Net Amount Due:</td>
            <td class="summary-right-val" style="background-color: #e9ecef; font-size: 11px; font-weight: 800;">₹${Number(bill.net_amount).toLocaleString('en-IN')}.00</td>
          </tr>
          <tr>
            <td class="summary-right-label" style="color: #0b4e3f; background-color: #e6fcf5;">Amount Received:</td>
            <td class="summary-right-val" style="color: #0b4e3f; background-color: #e6fcf5; font-weight: 800;">₹${Number(bill.amount_paid).toLocaleString('en-IN')}.00</td>
          </tr>
        </table>

        <!-- Balance Due row highlighted if any remains -->
        ${bill.balance_due > 0 ? `
          <div style="display: flex; justify-content: flex-end; margin-top: -15px; margin-bottom: 20px;">
            <div style="border: 2px solid #e03131; background-color: #fff5f5; color: #c92a2a; padding: 6px 15px; border-radius: 6px; font-weight: 800; font-size: 11.5px; text-align: right;">
              Balance Due: ₹${Number(bill.balance_due).toLocaleString('en-IN')}.00
            </div>
          </div>
        ` : `
          <div style="display: flex; justify-content: flex-end; margin-top: -15px; margin-bottom: 20px;">
            <div style="border: 2px solid #0b7285; background-color: #e0f7fa; color: #006064; padding: 6px 15px; border-radius: 6px; font-weight: 800; font-size: 11px; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
              ● Bill Fully Settled
            </div>
          </div>
        `}

        <!-- Remarks box -->
        ${(bill.doctor_notes || bill.instructions || bill.follow_up_date) ? `
          <div class="remarks-box">
            <h3 class="remarks-title">Clinical Notes & Remarks</h3>
            ${bill.doctor_notes ? `<p><strong>Doctor Notes:</strong> ${bill.doctor_notes}</p>` : ''}
            ${bill.instructions ? `<p style="margin-top: 4px;"><strong>Instructions:</strong> ${bill.instructions}</p>` : ''}
            ${bill.follow_up_date ? `<p style="margin-top: 4px;"><strong>Recommended Next Follow-up Date:</strong> ${new Date(bill.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>` : ''}
          </div>
        ` : ''}

        <p style="font-size: 8px; color: #777; font-style: italic;">Created by practitioner in SDC-CRM on ${billDate}. This is a computer-generated billing receipt.</p>

        <!-- Signatures -->
        <table class="signature-table">
          <tr>
            <td>
              <div class="signature-line"></div>
              <p style="font-weight: 600;">Patient Signature</p>
            </td>
            <td class="signature-receptionist">
              <div class="signature-line"></div>
              <p style="font-weight: 700;">Authorized Signatory</p>
              <p style="font-size: 9.5px; color: #444;">Sri Chaitanya Dental Care</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (printWindow) {
      printWindow.document.write(docContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const generatePDF = async (appt: any) => {
    if (!selected) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('p', 'mm', 'a4');
      const bill = parseBilling(appt);
      const actualAge = getPatientMetadata(selected).dob ? calculateAge(getPatientMetadata(selected).dob) : (selected.age || '-');
      
      const billNumber = `SDC-BILL-${appt.id}-${new Date(appt.created_at || Date.now()).getTime().toString().slice(-6)}`;
      const billDate = appt.created_at ? new Date(appt.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const billTime = appt.created_at ? new Date(appt.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      // Header (Black & White, crisp)
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('SRI CHAITANYA MULTISPECIALITY DENTAL CARE', 15, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('ADVANCED DENTAL & IMPLANT CENTRE', 15, 25);
      
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text([
        'Ph: +91 83175 75165  |  Email: srichaitanyadentalcare9@gmail.com',
        'Reg No: HYD/DENT/2026/0894  |  GSTIN: 36AAQCS4501D1Z2'
      ], 15, 30);

      doc.setFontSize(8);
      doc.text([
        'G4, Lakeview Apartments,',
        'Bandam Kommu, Ameenpur,',
        'Hyderabad, Telangana - 502032'
      ], 195, 20, { align: 'right' });

      // Title line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(15, 39, 195, 39);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text('BILL CUM RECEIPT', 105, 45, { align: 'center' });
      
      doc.line(15, 48, 195, 48);

      // Patient and Billing meta grid alignment
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Details', 15, 56);
      doc.text('Bill Details', 115, 56);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);

      const patientInfo = [
        `Patient Name : ${selected.name}`,
        `MR. No (ID)  : ${selected.patient_code}`,
        `Age & Sex    : ${actualAge} / ${selected.gender || '-'}`,
        `Mobile No    : ${selected.phone}`,
        `Address      : ${selected.location || 'Hyderabad'}`
      ];
      patientInfo.forEach((line, i) => doc.text(line, 15, 62 + i * 5));

      const billingInfo = [
        `Bill Number  : ${billNumber}`,
        `Bill Date    : ${billDate}  ${billTime}`,
        `Billing Type : ${appt.payment_mode || 'Cash'}`,
        `Consultant   : ${bill.doctor_name || (doctors && doctors[0]?.name) || 'Dr. Sri Chaitanya'}`
      ];
      billingInfo.forEach((line, i) => doc.text(line, 115, 62 + i * 5));

      // Treatment table start y
      const tableStartY = 62 + Math.max(patientInfo.length, billingInfo.length) * 5 + 6;

      const bodyData = bill.items.map((it: any, index: number) => {
        const gross = it.rate * it.qty;
        const net = gross - (it.discount || 0);
        return [
          index + 1,
          it.treatment_type,
          it.notes || '-',
          `Rs. ${Number(it.rate).toLocaleString('en-IN')}`,
          it.qty,
          `Rs. ${Number(it.discount || 0).toLocaleString('en-IN')}`,
          `Rs. ${Number(net).toLocaleString('en-IN')}`
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [['S.No', 'Procedure / Treatment', 'Particulars', 'Rate', 'Qty', 'Dis(INR)', 'Net Amt']],
        body: bodyData,
        headStyles: {
          fillColor: [248, 249, 250],
          textColor: [0, 0, 0],
          fontSize: 8.5,
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontSize: 8.5,
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        theme: 'grid',
        styles: {
          lineColor: [0, 0, 0],
          cellPadding: 2.5
        },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const nextY = (doc as any).lastAutoTable.finalY + 10;

      // Draw Summary Frame
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(15, nextY, 195, nextY);
      
      // Left summary column
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Payment Mode: ${appt.payment_mode || 'Cash'}`, 17, nextY + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Amount in Words:', 17, nextY + 12);
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(8);
      const wordsLines = doc.splitTextToSize(numberToWords(bill.amount_paid), 100);
      doc.text(wordsLines, 17, nextY + 17);

      // Right totals column
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      
      doc.text('Total Gross Amt:', 120, nextY + 6);
      doc.text(`Rs. ${Number(bill.total_gross).toLocaleString('en-IN')}`, 193, nextY + 6, { align: 'right' });

      doc.text('Total Disc Amt:', 120, nextY + 11);
      doc.text(`Rs. ${Number(bill.discount).toLocaleString('en-IN')}`, 193, nextY + 11, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('Net Amount Due:', 120, nextY + 17);
      doc.text(`Rs. ${Number(bill.net_amount).toLocaleString('en-IN')}`, 193, nextY + 17, { align: 'right' });

      doc.text('Amount Received:', 120, nextY + 23);
      doc.text(`Rs. ${Number(bill.amount_paid).toLocaleString('en-IN')}`, 193, nextY + 23, { align: 'right' });

      doc.line(15, nextY + 27, 195, nextY + 27);

      let lastY = nextY + 27;

      // Balance Due
      if (bill.balance_due > 0) {
        doc.setFillColor(255, 245, 245);
        doc.rect(130, lastY + 4, 65, 8, 'F');
        doc.setDrawColor(224, 49, 49);
        doc.rect(130, lastY + 4, 65, 8, 'S');
        doc.setTextColor(201, 42, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`Balance Due: Rs. ${Number(bill.balance_due).toLocaleString('en-IN')}`, 162.5, lastY + 9, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        lastY += 15;
      } else {
        doc.setFillColor(224, 247, 250);
        doc.rect(130, lastY + 4, 65, 8, 'F');
        doc.setDrawColor(0, 96, 100);
        doc.rect(130, lastY + 4, 65, 8, 'S');
        doc.setTextColor(0, 96, 100);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('BILL FULLY SETTLED', 162.5, lastY + 9.5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        lastY += 15;
      }

      // Notes
      if (bill.doctor_notes || bill.instructions || bill.follow_up_date) {
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.2);
        doc.line(15, lastY, 195, lastY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Clinical Notes & Remarks', 15, lastY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let noteOffset = 10;
        if (bill.doctor_notes) {
          doc.text(`Doctor Notes: ${bill.doctor_notes}`, 15, lastY + noteOffset);
          noteOffset += 4;
        }
        if (bill.instructions) {
          doc.text(`Instructions: ${bill.instructions}`, 15, lastY + noteOffset);
          noteOffset += 4;
        }
        if (bill.follow_up_date) {
          const followUpDateStr = new Date(bill.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          doc.text(`Recommended Next Follow-up Date: ${followUpDateStr}`, 15, lastY + noteOffset);
          noteOffset += 4;
        }
        lastY += noteOffset + 2;
      }

      // disclaimer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Created by practitioner in SDC-CRM on ${billDate}. This is a computer-generated billing receipt.`, 15, lastY + 2);
      
      // Signatures
      doc.setDrawColor(0,0,0);
      doc.setLineWidth(0.3);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      // patient signature line
      doc.line(15, lastY + 25, 65, lastY + 25);
      doc.text('Patient Signature', 15, lastY + 29);

      // Auth signatory line
      doc.line(145, lastY + 25, 195, lastY + 25);
      doc.text('Authorized Signatory', 145, lastY + 29);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Sri Chaitanya Dental Care', 145, lastY + 33);

      doc.save(`SDC_Receipt_${selected.name?.replace(/\s+/g, '_')}_${billNumber}.pdf`);
    } catch (err) {
      console.error('PDF generation error', err);
      alert('PDF generation failed. Close the preview and try again.');
    }
  };

  const handleGenerateBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingBill(true);
    try {
      const items = billForm.items;
      const conFee = Number(billForm.consultation_fee) || 0;
      const treatFee = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.rate)) - Number(item.discount || 0), 0);
      const labChg = Number(billForm.lab_charges) || 0;
      const xrayChg = Number(billForm.x_ray_charges) || 0;
      const discountVal = Number(billForm.discount_amount) || Number(billForm.general_discount) || 0;

      const subtotalBeforeGst = Math.max(0, conFee + treatFee + labChg + xrayChg - discountVal);
      const gstPct = Number(billForm.gst_percent) || 0;
      const gstAmt = Math.round(subtotalBeforeGst * (gstPct / 100));
      const totalAmount = subtotalBeforeGst + gstAmt;

      const paid = Number(billForm.amount_paid || 0);
      const balance = Math.max(0, totalAmount - paid);

      const isStandardId = selected.id && typeof selected.id === 'number' && selected.id < 10000000;
      
      const sessionDate = new Date().toISOString().split('T')[0];
      const sessionTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const invNo = billForm.invoice_no || `SCDC-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 900000)).slice(-6)}`;

      const billingNotes = JSON.stringify({
        items: items.map(it => ({
          treatment_type: it.treatment_type,
          notes: it.notes,
          qty: Number(it.qty),
          rate: Number(it.rate),
          discount: Number(it.discount || 0),
          net_amt: (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0)
        })),
        invoice_no: invNo,
        consultation_fee: conFee,
        treatment_fee: treatFee,
        lab_charges: labChg,
        x_ray_charges: xrayChg,
        discount: discountVal,
        gst_percent: gstPct,
        gst_amount: gstAmt,
        total_amount: totalAmount,
        amount_paid: paid,
        balance_due: balance,
        doctor_notes: billForm.doctor_notes,
        follow_up_date: billForm.follow_up_date,
        instructions: billForm.instructions,
        doctor_name: billForm.doctor_name
      });

      const mainTreatmentsText = items.map(it => it.treatment_type).join(', ');

      let paymentPayload: any = {
        patient_id: isStandardId ? selected.id : null,
        name: selected.name,
        phone: selected.phone,
        email: selected.email,
        location: selected.location || 'Hyderabad',
        treatment: mainTreatmentsText,
        next_visit: sessionDate,
        appointment_time: sessionTime,
        amount_paid: paid,
        balance_amount: balance,
        payment_mode: billForm.payment_mode,
        payment_notes: billingNotes,
        notes: billForm.doctor_notes || 'Generated Bill Cum Receipt',
        status: balance > 0 ? 'Confirmed' : 'Completed',
        visit_count: patientAppointments.length + 1,
        visit_type: patientAppointments.length > 0 ? 'Returning' : 'New',
        doctor_name: billForm.doctor_name,
        advance_payment: paid
      };

      let insertRes = await supabase.from('appointments').insert([paymentPayload]).select();
      let error = insertRes.error;
      let data = insertRes.data;

      if (error) {
        if (error.message && (error.message.includes('payment_notes') || error.message.includes('column') || error.message.includes('fee') || error.message.includes('charge') || error.message.includes('balance'))) {
          // Fallback: merge payment_notes and strip extra columns from payload due to database schema limitations
          const { 
            payment_notes, 
            notes, 
            invoice_no,
            consultation_fee, 
            treatment_fee, 
            lab_charges, 
            x_ray_charges, 
            discount_amount, 
            gst_amount, 
            advance_payment, 
            final_balance, 
            ...rest 
          } = paymentPayload;
          
          const fallbackNotes = billingNotes 
            ? `${notes || ''}\n[Payment Notes / Breakup: ${billingNotes}]`.trim() 
            : notes;
            
          const fallbackPayload = {
            ...rest,
            notes: fallbackNotes
          };
          
          const retryRes = await supabase.from('appointments').insert([fallbackPayload]).select();
          if (retryRes.error) {
            throw retryRes.error;
          }
          data = retryRes.data;
          notify('warning', 'Session Created', 'Saved successfully. (Billing data appended to notes due to schema compatibility).');
        } else {
          throw error;
        }
      }

      for (const item of items) {
        await supabase.from('treatments').insert([{
          patient_id: isStandardId ? selected.id : null,
          patient_name: selected.name,
          phone: selected.phone,
          treatment_type: item.treatment_type,
          stage: 'Completed',
          start_date: sessionDate,
          total_sessions: item.qty,
          sessions_done: item.qty,
          treatment_notes: item.notes || 'Billed',
          status: 'Completed'
        }]);
      }

      let apptQuery;
      let treatQuery;
      if (isStandardId) {
        apptQuery = supabase.from('appointments').select('*').or(`patient_id.eq.${selected.id},phone.eq.${selected.phone}`).order('created_at', { ascending: false });
        treatQuery = supabase.from('treatments').select('*').or(`patient_id.eq.${selected.id},phone.eq.${selected.phone}`).order('created_at', { ascending: false });
      } else {
        apptQuery = supabase.from('appointments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
        treatQuery = supabase.from('treatments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
      }

      const [apptRes, treatRes] = await Promise.all([apptQuery, treatQuery]);

      setPatientAppointments(apptRes.data || []);
      setPatientTreatments(treatRes.data || []);
      
      setShowGenerateBill(false);

      if (data && data.length > 0) {
        printBill(data[0]);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save bill. Please try again.');
    } finally {
      setSavingBill(false);
    }
  };

  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_type: '',
    stage: 'Assessment',
    start_date: new Date().toISOString().split('T')[0],
    total_sessions: '',
    sessions_done: '0',
    treatment_notes: '',
    status: 'In Progress',
    tooth_no: '',
    doctor_name: 'Dr. Sri Chaitanya',
    estimated_cost: '',
    paid_amount: '',
    next_visit: ''
  });

  // Synchronize treatment form notes with localStorage (Draft State)
  useEffect(() => {
    if (!selected) return;
    const storageKey = `sdc_treatment_notes_${selected.id || selected.phone}`;
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes !== null) {
      setTreatmentForm(f => ({ ...f, treatment_notes: savedNotes }));
    } else {
      setTreatmentForm(f => ({ ...f, treatment_notes: '' }));
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const storageKey = `sdc_treatment_notes_${selected.id || selected.phone}`;
    if (treatmentForm.treatment_notes) {
      localStorage.setItem(storageKey, treatmentForm.treatment_notes);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [treatmentForm.treatment_notes, selected]);

  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!canWriteClinical()) {
      alert("Access Denied: Recording treatments is restricted to Doctors and Admins.");
      return;
    }
    setAddingTreatment(true);
    try {
      const isStandardId = selected.id && 
                           typeof selected.id === 'number' && 
                           selected.id < 10000000 && 
                           !(selected.patient_code && selected.patient_code.startsWith('SDC-F-'));

      const estCost = Number(treatmentForm.estimated_cost) || 0;
      const paidAmt = Number(treatmentForm.paid_amount) || 0;
      const balAmt = Math.max(0, estCost - paidAmt);

      const { error } = await supabase.from('treatments').insert([{
        patient_id: isStandardId ? selected.id : null,
        patient_name: selected.name,
        phone: selected.phone,
        treatment_type: treatmentForm.treatment_type,
        stage: treatmentForm.stage,
        start_date: treatmentForm.start_date || null,
        total_sessions: treatmentForm.total_sessions ? Number(treatmentForm.total_sessions) : null,
        sessions_done: treatmentForm.sessions_done ? Number(treatmentForm.sessions_done) : 0,
        treatment_notes: treatmentForm.treatment_notes,
        status: treatmentForm.status,
        tooth_no: treatmentForm.tooth_no || null,
        doctor_name: treatmentForm.doctor_name || 'Dr. Sri Chaitanya',
        estimated_cost: estCost,
        paid_amount: paidAmt,
        balance_amount: balAmt,
        next_visit: treatmentForm.next_visit || null
      }]);

      if (!error) {
        setTreatmentForm({
          treatment_type: '',
          stage: 'Assessment',
          start_date: new Date().toISOString().split('T')[0],
          total_sessions: '',
          sessions_done: '0',
          treatment_notes: '',
          status: 'In Progress',
          tooth_no: '',
          doctor_name: 'Dr. Sri Chaitanya',
          estimated_cost: '',
          paid_amount: '',
          next_visit: ''
        });
        setShowAddTreatment(false);
        let treatQuery;
        if (isStandardId) {
          treatQuery = supabase.from('treatments').select('*').or(`patient_id.eq.${selected.id},phone.eq.${selected.phone}`).order('created_at', { ascending: false });
        } else {
          treatQuery = supabase.from('treatments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
        }
        const { data } = await treatQuery;
        setPatientTreatments(data || []);
      } else {
        alert(error.message);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setAddingTreatment(false);
    }
  };

  const updatePatientTreatmentStage = async (treatId: any, newStage: string) => {
    if (typeof treatId === 'string' && treatId.startsWith('fallback-')) {
      alert("Note: Fallback records cannot be modified. Add a custom treatment record to start tracking clinical progress.");
      return;
    }
    const { error } = await supabase.from('treatments').update({ stage: newStage }).eq('id', treatId);
    if (!error) {
      const treatQuery = selected.id && typeof selected.id === 'number' && selected.id < 10000000 
        ? supabase.from('treatments').select('*').or(`patient_id.eq.${selected.id},phone.eq.${selected.phone}`).order('created_at', { ascending: false })
        : supabase.from('treatments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
      const { data } = await treatQuery;
      setPatientTreatments(data || []);
    }
  };

  const updatePatientTreatmentSessions = async (treatId: any, done: number, total: number) => {
    if (typeof treatId === 'string' && treatId.startsWith('fallback-')) {
      alert("Note: Fallback records cannot be modified. Add a custom treatment record to start tracking clinical progress.");
      return;
    }
    const { error } = await supabase.from('treatments').update({ sessions_done: done, total_sessions: total }).eq('id', treatId);
    if (!error) {
      const treatQuery = selected.id && typeof selected.id === 'number' && selected.id < 10000000 
        ? supabase.from('treatments').select('*').or(`patient_id.eq.${selected.id},phone.eq.${selected.phone}`).order('created_at', { ascending: false })
        : supabase.from('treatments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
      const { data } = await treatQuery;
      setPatientTreatments(data || []);
    }
  };

  const { patients: hookPatients, loading: hookPatientsLoading, refetch: refetchPatientsHook } = usePatientsRealtime();
  const { appointments: hookAppointments, loading: hookAppointmentsLoading, refetch: refetchAppointmentsHook } = useAppointmentsRealtime();

  const [realtimeTrigger, setRealtimeTrigger] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '', dob: ''
  });

  const calculateAge = (dobString: string): string => {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let computedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      computedAge--;
    }
    return String(computedAge);
  };

  const [summary, setSummary] = useState({
    total: 0,
    newThisMonth: 0,
    followupsDue: 0,
    activeTreatments: 0
  });

  // Unique Sync Utility
  const handleSyncPatients = async () => {
    setSyncing(true);
    try {
      // 1. Get all appointments
      const { data: appts, error: apptError } = await supabase
        .from('appointments')
        .select('*');
      
      if (apptError) throw apptError;
      if (!appts || appts.length === 0) {
        alert('No appointments found to sync from.');
        setSyncing(false);
        return;
      }

      // 2. Get all existing patients
      const { data: existingPatients, error: patientError } = await supabase
        .from('patients')
        .select('phone');
      
      if (patientError) throw patientError;

      const existingPhones = new Set(
        (existingPatients || [])
          .map(p => cleanPhone(p.phone))
          .filter(Boolean)
      );

      // 3. Find unique patients in appointments that do not exist in patients table
      const uniqueToCreate = new Map<string, any>();
      for (const appt of appts) {
        if (!appt.phone) continue;
        const phone = appt.phone;
        const normPhone = cleanPhone(phone);
        if (!normPhone || existingPhones.has(normPhone)) continue;

        if (!uniqueToCreate.has(normPhone)) {
          uniqueToCreate.set(normPhone, {
            patient_code: `SDC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: (appt.name || 'Unknown Patient').trim(),
            phone: phone.trim(),
            email: appt.email || '',
            location: appt.location || '',
            patient_status: 'Registered',
            created_at: appt.created_at || new Date().toISOString()
          });
        }
      }

      const toCreate = Array.from(uniqueToCreate.values());

      if (toCreate.length === 0) {
        alert('All patients are already in sync!');
        setSyncing(false);
        return;
      }

      // 4. Insert missing patients
      const { error: insertError } = await supabase
        .from('patients')
        .insert(toCreate);

      if (insertError) throw insertError;

      // 5. Update appointments to link patient_id
      const { data: updatedPatients } = await supabase
        .from('patients')
        .select('id, phone');
      
      if (updatedPatients) {
        const phoneToIdMap = new Map<string, number>();
        for (const pt of updatedPatients) {
          if (pt.phone) {
            const normPtPhone = cleanPhone(pt.phone);
            if (normPtPhone) phoneToIdMap.set(normPtPhone, pt.id);
          }
        }

        const { data: apptsToUpdate } = await supabase
          .from('appointments')
          .select('id, phone')
          .is('patient_id', null);
        
        if (apptsToUpdate) {
          for (const appt of apptsToUpdate) {
            if (appt.phone) {
              const normApptPhone = cleanPhone(appt.phone);
              const pId = phoneToIdMap.get(normApptPhone);
              if (pId) {
                await supabase
                  .from('appointments')
                  .update({ patient_id: pId })
                  .eq('id', appt.id);
              }
            }
          }
        }
      }

      alert(`Successfully synchronized ${toCreate.length} missing patient records!`);
      fetchPatients();
    } catch (err: any) {
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch summary stats
  useEffect(() => {
    const fetchSummary = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const [totalRes, newRes, followupRes, activeRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('patient_status', 'Follow-up Required'),
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('patient_status', 'In Treatment'),
      ]);

      if (totalRes.count && totalRes.count > 0) {
        setSummary({
          total: totalRes.count || 0,
          newThisMonth: newRes.count || 0,
          followupsDue: followupRes.count || 0,
          activeTreatments: activeRes.count || 0,
        });
      }
    };
    fetchSummary();
  }, [patients]);

  useEffect(() => {
    const fetchActiveDoctors = async () => {
      try {
        let activeList = [];
        if (!isSupabaseConfigured) {
          const stored = localStorage.getItem('sandbox_doctors');
          if (stored) {
            const list = JSON.parse(stored);
            activeList = list.filter((d: any) => d.status === 'Active');
          } else {
            activeList = PATIENTS_FALLBACK_DOCTORS;
          }
        } else {
          const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('status', 'Active')
            .order('name', { ascending: true });

          if (error) throw error;
          activeList = data && data.length > 0 ? data : PATIENTS_FALLBACK_DOCTORS;
        }
        setDoctors(activeList);
        if (activeList.length > 0) {
          const defaultDoc = activeList[0];
          setBillForm(prev => ({ ...prev, doctor_name: defaultDoc.name }));
          setApptForm(prev => ({ ...prev, doctorId: defaultDoc.id.toString(), doctorName: defaultDoc.name }));
          setFollowUpForm(prev => ({ ...prev, doctorId: defaultDoc.id.toString(), doctorName: defaultDoc.name }));
        }
      } catch (e) {
        let activeList = [];
        const stored = localStorage.getItem('sandbox_doctors');
        if (stored) {
          const list = JSON.parse(stored);
          activeList = list.filter((d: any) => d.status === 'Active');
        } else {
          activeList = PATIENTS_FALLBACK_DOCTORS;
        }
        setDoctors(activeList);
        if (activeList.length > 0) {
          const defaultDoc = activeList[0];
          setBillForm(prev => ({ ...prev, doctor_name: defaultDoc.name }));
          setApptForm(prev => ({ ...prev, doctorId: defaultDoc.id.toString(), doctorName: defaultDoc.name }));
          setFollowUpForm(prev => ({ ...prev, doctorId: defaultDoc.id.toString(), doctorName: defaultDoc.name }));
        }
      }
    };
    fetchActiveDoctors();
  }, []);

  // Set up Realtime subscriptions so updates in other tabs sync immediately in the Patients CRM.
  useEffect(() => {
    // Rely on the hookPatients and hookAppointments hooks which handle individual realtime postgres channels.
    // If we need to trigger anything on component mount, they already initialize.
    console.info("[Patients] Realtime subscription is active and driven by custom usePatientsRealtime & useAppointmentsRealtime hooks.");
  }, []);

  // Fetch patients with server-side pagination
  useEffect(() => {
    fetchPatients(false);
  }, [debouncedSearch, statusFilter, regSort, currentPage, pageSize, hookPatients, hookAppointments]);

  const fetchPatients = async (forceQuery = true) => {
    setLoading(true);

    try {
      if (forceQuery) {
        console.info("[Database → Query] [Patients] Force query requested. Re-triggering refetch on hooks.");
        await Promise.all([
          refetchPatientsHook(),
          refetchAppointmentsHook()
        ]);
      }
      console.info("[Database → Query → Hook → Component → UI] [Patients] Re-processing display dataset from Hook cache.");
      // 1. Get all appointments to compute dynamic fields
      const safeAppts = hookAppointments || [];

      // 2. Fetch primary patients list
      const dbPatients = hookPatients || [];

      console.log("Supabase patients loaded (from hook):", dbPatients);

      let rawPatientsList: any[] = [];
      const matchedApptIds = new Set<number>();
      const existingPatientPhones = new Set<string>();

      const dbPatientsList = dbPatients || [];

      // A. Process existing DB Patients list
      rawPatientsList = dbPatientsList.map(p => {
        const pPhoneClean = cleanPhone(p.phone);
        if (pPhoneClean) {
          existingPatientPhones.add(pPhoneClean);
        }

        // Find appointments for this patient
        const pAppts = safeAppts.filter(appt => {
          if (appt.patient_id && p.id && Number(appt.patient_id) === Number(p.id)) {
            matchedApptIds.add(appt.id);
            return true;
          }
          const apptPhoneClean = cleanPhone(appt.phone);
          if (pPhoneClean && apptPhoneClean && pPhoneClean === apptPhoneClean) {
            matchedApptIds.add(appt.id);
            return true;
          }
          return false;
        });

        let lastVisit: string | null = null;
        let nextVisit: string | null = null;
        let treatmentSummary: string | null = null;
        const nowStr = new Date().toISOString().split('T')[0];

        for (const appt of pAppts) {
          const apptDate = appt.next_visit || appt.created_at?.split('T')[0];
          const apptStatus = appt.status || 'Pending';

          const isPast = apptDate && apptDate < nowStr;
          if (apptStatus === 'Completed' || (apptDate && isPast)) {
            if (!lastVisit || (apptDate && apptDate > lastVisit)) {
              lastVisit = apptDate;
            }
          } else if (apptStatus === 'Confirmed' || apptStatus === 'Pending') {
            if (!nextVisit || (apptDate && apptDate < nextVisit)) {
              nextVisit = apptDate;
            }
          }

          if (appt.treatment && !treatmentSummary) {
            treatmentSummary = appt.treatment;
          }
        }

        const meta = getPatientMetadata(p);
        const derivedAge = p.age || (meta.dob ? calculateAge(meta.dob).toString() : '');
        const derivedGender = p.gender || meta.gender || '';
        return {
          ...p,
          age: derivedAge,
          gender: derivedGender,
          last_visit_date: p.last_visit_date || lastVisit,
          next_visit_date: p.next_visit_date || nextVisit,
          treatment_summary: p.treatment_summary || treatmentSummary || null
        };
      });

      // B. Process any "orphaned" appointments that didn't get linked to any DB patient
      const orphanAppts = safeAppts.filter(appt => !matchedApptIds.has(appt.id));
      if (orphanAppts.length > 0) {
        const orphanPatientsMap = new Map<string, any>();
        
        for (const appt of orphanAppts) {
          if (!appt.phone) continue;
          const phoneKey = cleanPhone(appt.phone);
          if (!phoneKey) continue;
          
          if (existingPatientPhones.has(phoneKey)) continue;

          const nameKey = (appt.name || 'Unknown Patient').trim();
          const compositeKey = `${nameKey.toLowerCase()}_${phoneKey}`;

          const existing = orphanPatientsMap.get(compositeKey);
          const apptDate = appt.next_visit || appt.created_at?.split('T')[0];
          const apptStatus = appt.status || 'Pending';

          let lastVisit = existing?.last_visit_date || null;
          let nextVisit = existing?.next_visit_date || null;
          const nowStr = new Date().toISOString().split('T')[0];

          const isPast = apptDate && apptDate < nowStr;
          if (apptStatus === 'Completed' || (apptDate && isPast)) {
            if (!lastVisit || (apptDate && apptDate > lastVisit)) {
              lastVisit = apptDate;
            }
          } else if (apptStatus === 'Confirmed' || apptStatus === 'Pending') {
            if (!nextVisit || (apptDate && apptDate < nextVisit)) {
              nextVisit = apptDate;
            }
          }

          let computedStatus: PatientStatus = 'Registered';
          if (apptStatus === 'Completed') computedStatus = 'Completed';
          else if (apptStatus === 'In Treatment' || apptStatus === 'Confirmed') computedStatus = 'In Treatment';
          else if (apptStatus === 'Pending') computedStatus = 'Waiting';

          if (existing) {
            if (lastVisit && (!existing.last_visit_date || lastVisit > existing.last_visit_date)) {
              existing.last_visit_date = lastVisit;
            }
            if (nextVisit && (!existing.next_visit_date || nextVisit < existing.next_visit_date)) {
              existing.next_visit_date = nextVisit;
            }
            if (appt.treatment && !existing.treatment_summary) {
              existing.treatment_summary = appt.treatment;
            }
            const statusHierarchy: Record<PatientStatus, number> = {
              Completed: 1,
              Registered: 2,
              Waiting: 3,
              'Follow-up Required': 4,
              'In Treatment': 5
            };
            if (statusHierarchy[computedStatus] > statusHierarchy[existing.patient_status]) {
              existing.patient_status = computedStatus;
            }
          } else {
            orphanPatientsMap.set(compositeKey, {
              id: appt.patient_id || appt.id || Math.floor(Math.random() * 100000),
              patient_code: `SDC-F-${appt.id}`,
              name: nameKey,
              phone: appt.phone,
              email: appt.email || '',
              location: appt.location || '',
              age: '',
              gender: '',
              notes: appt.notes || '',
              patient_status: computedStatus,
              last_visit_date: lastVisit,
              next_visit_date: nextVisit,
              treatment_summary: appt.treatment || null,
              created_at: appt.created_at || new Date().toISOString()
            });
          }
        }
        
        rawPatientsList.push(...Array.from(orphanPatientsMap.values()));
      }

      // Update Summary Cards from our decorated/computed list
      const now = new Date();
      const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const newThisMonth = rawPatientsList.filter(p => p.created_at >= startOfMonthStr).length;
      const followupsDue = rawPatientsList.filter(p => p.patient_status === 'Follow-up Required').length;
      const activeTreatments = rawPatientsList.filter(p => p.patient_status === 'In Treatment').length;

      setSummary({
        total: rawPatientsList.length,
        newThisMonth,
        followupsDue,
        activeTreatments
      });

      // Filter in-memory
      let filteredList = [...rawPatientsList];

      // Real-time search filter
      if (debouncedSearch) {
        const sLower = debouncedSearch.toLowerCase();
        filteredList = filteredList.filter(p => 
          p.name.toLowerCase().includes(sLower) || 
          p.phone.includes(sLower) || 
          (p.patient_code && p.patient_code.toLowerCase().includes(sLower))
        );
      }

      // Status Filter
      if (statusFilter === 'new') {
        filteredList = filteredList.filter(p => p.created_at >= startOfMonthStr);
      } else if (statusFilter === 'returning') {
        filteredList = filteredList.filter(p => p.last_visit_date !== null);
      } else if (statusFilter === 'followup') {
        filteredList = filteredList.filter(p => p.patient_status === 'Follow-up Required');
      } else if (statusFilter === 'ongoing') {
        filteredList = filteredList.filter(p => p.patient_status === 'In Treatment');
      } else if (statusFilter === 'completed') {
        filteredList = filteredList.filter(p => p.patient_status === 'Completed');
      } else if (statusFilter !== 'all') {
        filteredList = filteredList.filter(p => p.patient_status === statusFilter);
      }

      // Support sorting by newest/oldest registration or default sorting
      filteredList.sort((a, b) => {
        if (regSort === 'newest') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        } else if (regSort === 'oldest') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeA - timeB;
        } else {
          // Default: Order by last visit date descending or created_at descending
          if (a.last_visit_date && b.last_visit_date) {
            return b.last_visit_date.localeCompare(a.last_visit_date);
          }
          if (a.last_visit_date) return -1;
          if (b.last_visit_date) return 1;
          
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

      setTotalCount(filteredList.length);

      // Pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      const paginatedList = filteredList.slice(from, to + 1);

      setPatients(paginatedList);

      // Real-time synchronization of the active details view
      if (selected) {
        const cleanSelPhone = cleanPhone(selected.phone);
        const updatedSelected = filteredList.find(item => 
          item.id === selected.id || 
          (item.phone && cleanPhone(item.phone) === cleanSelPhone && cleanSelPhone !== '')
        );
        if (updatedSelected) {
          setSelected(updatedSelected);
        }
      }
    } catch (err) {
      console.error("Error fetching/processing patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const openPatientProfile = async (p: Patient) => {
    setSelected(p);
    setActiveTab('demographics');

    // Fetch related data
    let apptQuery;
    let treatQuery;

    // Check if the id is a standard auto-increment integer (< 10000000) or a fallback appointment / custom id
    const isStandardId = p.id && 
                         typeof p.id === 'number' && 
                         p.id < 10000000 && 
                         !(p.patient_code && p.patient_code.startsWith('SDC-F-'));

    if (isStandardId) {
      apptQuery = supabase.from('appointments').select('*').or(`patient_id.eq.${p.id},phone.eq.${p.phone}`).order('created_at', { ascending: false });
      treatQuery = supabase.from('treatments').select('*').or(`patient_id.eq.${p.id},phone.eq.${p.phone}`).order('created_at', { ascending: false });
    } else {
      apptQuery = supabase.from('appointments').select('*').eq('phone', p.phone).order('created_at', { ascending: false });
      treatQuery = supabase.from('treatments').select('*').eq('phone', p.phone).order('created_at', { ascending: false });
    }

    const [apptRes, treatRes] = await Promise.all([apptQuery, treatQuery]);

    setPatientAppointments(apptRes.data || []);
    setPatientTreatments(treatRes.data || []);
  };

  const handleQRScanSuccess = async (scannedText: string) => {
    try {
      const trimmedText = scannedText.trim();
      if (!trimmedText) return;

      let matchingPatient: Patient | null = null;
      
      const res = await supabase
        .from('patients')
        .select('*')
        .or(`patient_code.ilike.${trimmedText},phone.eq.${trimmedText}`);
      
      if (res.data && res.data.length > 0) {
        matchingPatient = res.data[0];
      } else if (!isNaN(Number(trimmedText))) {
        // Try fallback query by id
        const idRes = await supabase
          .from('patients')
          .select('*')
          .eq('id', Number(trimmedText));
          
        if (idRes.data && idRes.data.length > 0) {
          matchingPatient = idRes.data[0];
        }
      }

      if (matchingPatient) {
        notify('success', 'Profile Restored', `Found Patient: "${matchingPatient.name}" (${matchingPatient.patient_code})`);
        openPatientProfile(matchingPatient);
      } else {
        notify('warning', 'Patient Record Out of Range', `No clinical file matching code or contact details for "${scannedText}". Register as a new patient.`);
      }
    } catch (err: any) {
      notify('error', 'Profile Sync Restrained', 'Error resolving patient for scanned code.', err?.message || String(err));
    }
  };

  const savePatient = async (e: React.FormEvent, forceBypass = false) => {
    if (e) e.preventDefault();
    setSaving(true);
    
    // Check for duplicate patient (Same Name AND Same Phone Number)
    if (form.phone && form.name && !forceBypass && !bypassNamePhoneDuplicate) {
      const { data: existingPatients, error: checkError } = await supabase
        .from('patients')
        .select('*')
        .eq('phone', form.phone.trim());
      
      if (!checkError && existingPatients && existingPatients.length > 0) {
        const matchNamePhone = existingPatients.find(
          p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase()
        );
        if (matchNamePhone) {
          setDuplicateFoundPatient(matchNamePhone);
          setSaving(false);
          return;
        }
      }
    }

    // Check for duplicate patient (Same Name AND Same Email)
    if (form.email && form.email.trim() && form.name && !forceBypass && !bypassNamePhoneDuplicate) {
      const { data: existingByEmail, error: checkEmailError } = await supabase
        .from('patients')
        .select('*')
        .eq('email', form.email.trim());
      
      if (!checkEmailError && existingByEmail && existingByEmail.length > 0) {
        const matchNameEmail = existingByEmail.find(
          p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase()
        );
        if (matchNameEmail) {
          setDuplicateFoundPatient(matchNameEmail);
          setSaving(false);
          return;
        }
      }
    }

    const code = `SDC-${Date.now()}`;
    const { dob, ...formToSave } = form;
    const finalNotes = dob ? `DOB: ${dob}${form.notes ? ` | ${form.notes}` : ''}` : form.notes;
    const { error } = await supabase.from('patients').insert([{
      ...formToSave,
      notes: finalNotes,
      patient_code: code,
      patient_status: 'Registered'
    }]);
    if (!error) {
      setShowAddModal(false);
      setForm({ name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '', dob: '' });
      setDuplicateFoundPatient(null);
      setBypassNamePhoneDuplicate(false);
      fetchPatients();
    } else {
      notify('error', 'Error Saving Patient', error?.message || 'Could not insert patient record.');
    }
    setSaving(false);
  };

  const updatePatientStatus = async (patient: Patient, newStatus: PatientStatus) => {
    await supabase.from('patients').update({ patient_status: newStatus }).eq('id', patient.id);
    if (selected?.id === patient.id) {
      setSelected({ ...patient, patient_status: newStatus });
    }
    fetchPatients();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const sendWhatsApp = (phone: string, name: string) => {
    const msg = `Hi ${name}, this is a reminder from Sri Chaitanya Dental Care about your upcoming appointment. Please confirm your visit. Thank you!`;
    openWhatsApp(phone, msg);
  };

  const handleRequestFeedback = async (p: Patient) => {
    setSendingWhatsApp(prev => ({ ...prev, feedback: true }));
    const msg = patientFeedbackRequestMessage({
      name: p.name,
      treatment: p.treatment_summary || undefined
    });
    try {
      await logWhatsAppDelivery(
        p.name,
        p.phone,
        'Patient',
        'Feedback Request',
        'Sent',
        msg,
        p.id
      );
      notify('success', 'Feedback Request Sent', `Logged WhatsApp feedback invite for ${p.name}.`);
    } catch (e) {
      console.error('Error logging WhatsApp feedback delivery:', e);
    } finally {
      openWhatsApp(p.phone, msg);
      setSendingWhatsApp(prev => ({ ...prev, feedback: false }));
    }
  };

  const handleRequestGoogleReview = async (p: Patient) => {
    setSendingWhatsApp(prev => ({ ...prev, review: true }));
    const msg = googleReviewRequestMessage({
      name: p.name,
      treatment: p.treatment_summary || undefined
    });
    try {
      await logWhatsAppDelivery(
        p.name,
        p.phone,
        'Patient',
        'Google Review Invite',
        'Sent',
        msg,
        p.id
      );
      notify('success', 'Google Review Invite Sent', `Logged WhatsApp Google review invite for ${p.name}.`);
    } catch (e) {
      console.error('Error logging WhatsApp Google review delivery:', e);
    } finally {
      openWhatsApp(p.phone, msg);
      setSendingWhatsApp(prev => ({ ...prev, review: false }));
    }
  };

  // Summary cards
  const summaryCards = [
    { label: 'Total Patients', value: summary.total, icon: Users, color: 'text-teal-600 bg-teal-50' },
    { label: 'New This Month', value: summary.newThisMonth, icon: UserPlus, color: 'text-blue-600 bg-blue-50' },
    { label: 'Follow-ups Due', value: summary.followupsDue, icon: Bell, color: 'text-orange-600 bg-orange-50' },
    { label: 'Active Treatments', value: summary.activeTreatments, icon: Activity, color: 'text-indigo-600 bg-indigo-50' },
  ];

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Patients' },
    { value: 'new', label: 'New Patients' },
    { value: 'returning', label: 'Returning Patients' },
    { value: 'followup', label: 'Follow-up Due' },
    { value: 'ongoing', label: 'Treatment Ongoing' },
    { value: 'completed', label: 'Completed Treatment' },
  ];

  const apptStatusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Pending' || s === 'Confirmed') return 'bg-amber-100 text-amber-700';
    if (s === 'Cancelled') return 'bg-red-100 text-red-700';
    if (s === 'In Treatment') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  const treatmentStatusColor = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'In Progress') return 'bg-blue-100 text-blue-700';
    if (s === 'On Hold') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const printPatientSummaryPDF = async (
    patient: Patient,
    appointments: PatientAppointment[],
    treatments: Treatment[]
  ) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      
      const totalCollected = appointments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0);
      const outstandingDues = appointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0);
      const totalRevenueValue = totalCollected + outstandingDues;

      // Header block with SCDC clinical branding
      doc.setTextColor(15, 110, 110); // Brand Premium Teal #0F6E6E
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SRI CHAITANYA MULTISPECIALITY DENTAL CARE', 15, 20);
      
      doc.setTextColor(29, 78, 216); // Brand Secondary Blue #1D4ED8
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Dr. J. Durga Bhavani, Cosmetic Dental Surgeon', 15, 26);
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'italic');
      doc.text('"We Care Your Smile"', 15, 31);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Ameenpur, Hyderabad  |  Ph: +91 8317575165', 15, 37);

      // Label on the right
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PATIENT REGISTRY SUMMARY', 195, 20, { align: 'right' });

      // Brand Teal divider
      doc.setDrawColor(15, 110, 110);
      doc.setLineWidth(0.8);
      doc.line(15, 42, 195, 42);

      // Section 1: Demographics info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Patient Demographics & Profile Info', 15, 52);
      
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Patient Name      : ${patient.name ?? '-'}`, 15, 59);
      doc.text(`Patient Code      : ${patient.patient_code ?? '-'}`, 15, 65);
      doc.text(`Contact Phone     : ${patient.phone ?? '-'}`, 15, 71);
      doc.text(`Email Address     : ${patient.email || 'Not Provided'}`, 15, 77);
      
      doc.text(`Age / Gender      : ${patient.age || 'N/A'} / ${patient.gender || 'Unknown'}`, 110, 59);
      doc.text(`Location / Area   : ${patient.location || 'Ameenpur'}`, 110, 65);
      doc.text(`Registration Date : ${formatDate(patient.created_at)}`, 110, 71);
      doc.text(`Dental Remarks    : ${patient.notes || 'No notes added.'}`, 110, 77);

      // Section 2: Clinical Summary Cards
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Financial Record & Visit Ledger Summary', 15, 90);

      const summaryHead = [['Metrics Column', 'Statement Details']];
      const summaryBody = [
        ['Total Practice Visits', `${appointments.length} visit(s)`],
        ['Total Billing Value (Contracted)', `Rs. ${totalRevenueValue.toLocaleString('en-IN')}`],
        ['Total Collected (Paid Revenue)', `Rs. ${totalCollected.toLocaleString('en-IN')}`],
        ['Outstanding Balance (Dues)', `Rs. ${outstandingDues.toLocaleString('en-IN')}`],
        ['Insurance Provider Status', `${getPatientMetadata(patient).insurance_provider || 'Self Paid'}`]
      ];

      autoTable(doc, {
        startY: 94,
        head: summaryHead,
        body: summaryBody,
        theme: 'striped',
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [15, 110, 110], textColor: [255, 255, 255] },
        styles: { fontSize: 9 }
      });

      // Section 3: Clinical Treatment Progress & History (Timeline)
      const nextY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Treatment History & Case Timeline', 15, nextY);

      const historyHead = [['Sl.', 'Date / Visit Time', 'Treatment / Consultation', 'Dentist Consultant', 'Service Cost', 'Financial Status']];
      const historyBody = appointments.map((appt, i) => {
        const totalCost = Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0);
        const statusLabel = Number(appt.balance_amount || 0) > 0 ? 'Dues Pending' : 'Cleared/Paid';
        return [
          i + 1,
          formatDate(appt.next_visit || appt.created_at),
          appt.treatment || 'Consultation Service',
          (appt as any).doctor_name || 'Dr. Sri Chaitanya',
          `Rs. ${totalCost.toLocaleString('en-IN')}`,
          statusLabel
        ];
      });

      autoTable(doc, {
        startY: nextY + 4,
        head: historyHead,
        body: historyBody.length > 0 ? historyBody : [['-', '-', 'No appointments logged yet', '-', '-', '-']],
        theme: 'grid',
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, finalY - 4, 195, finalY - 4);
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Thank you for choosing Sri Chaitanya Multispeciality Dental Care!', 105, finalY + 2, { align: 'center' });
      doc.text('Computer-generated medical summary. Served from SCDC Care Registry.', 105, finalY + 7, { align: 'center' });

      doc.save(`PatientSummary-${patient.name?.replace(/\s+/g, '_')}-${patient.patient_code}.pdf`);
      notify('success', 'Summary Printed', 'Successfully compiled patient health ledger and saved to downloads.');
    } catch (err) {
      console.error('Failed to generate summary PDF:', err);
      notify('error', 'Print Failed', 'Unable to create clinical summary PDF.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or Patient ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
          <button
            onClick={() => setShowQRScanner(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-sm font-extrabold transition cursor-pointer whitespace-nowrap"
            title="Scan Patient ID Card QR Badge"
          >
            <Camera size={16} className="text-indigo-600" />
            <span>Scan QR ID</span>
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white cursor-pointer"
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          id="patient-registration-sort"
          value={regSort}
          onChange={(e) => { setRegSort(e.target.value as any); setCurrentPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white cursor-pointer font-medium text-slate-700"
        >
          <option value="newest">Registration: Newest First</option>
          <option value="oldest">Registration: Oldest First</option>
          <option value="default">Registration: Default (Last Visit)</option>
        </select>
        <button
          onClick={handleSyncPatients}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-sm font-semibold transition whitespace-nowrap disabled:opacity-50"
          title="Sync Patient accounts from Appointment details"
        >
          <RotateCcw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Patients'}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition whitespace-nowrap"
        >
          <Plus size={16} /> Add Patient
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : patients.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No patients found</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input 
                        type="checkbox"
                        id="patient-head-checkbox"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                        checked={patients.length > 0 && selectedPatientIds.length === patients.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPatientIds(patients.map(p => p.id));
                          } else {
                            setSelectedPatientIds([]);
                          }
                        }}
                      />
                    </th>
                    {['Patient ID', 'Name', 'Phone', 'Age', 'Gender', 'Treatment', 'Last Visit', 'Next Visit', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {patients.map(p => {
                    const status = (p.patient_status || 'Registered') as PatientStatus;
                    const style = STATUS_STYLE[status] || STATUS_STYLE['Registered'];
                    const isSelected = selectedPatientIds.includes(p.id);
                    return (
                      <tr 
                        key={p.id} 
                        id={`patient-row-${p.id}`}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40 hover:bg-slate-50/65' : ''}`}
                        onClick={() => openPatientSummaryModal(p)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            id={`patient-checkbox-${p.id}`}
                            checked={isSelected}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                            onChange={() => {
                              if (isSelected) {
                                setSelectedPatientIds(selectedPatientIds.filter(id => id !== p.id));
                              } else {
                                setSelectedPatientIds([...selectedPatientIds, p.id]);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">{p.patient_code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {p.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{p.phone}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.age || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{p.gender || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-[150px] truncate">{p.treatment_summary || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.last_visit_date)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.next_visit_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${style.bg} ${style.text}`}>
                            <style.icon size={11} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openPatientProfile(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600" title="View Profile">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => setLocation(`/crm/appointments`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600" title="Add Appointment">
                              <Calendar size={14} />
                            </button>
                            <button onClick={() => setLocation(`/crm/treatments`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-600" title="Add Treatment">
                              <ClipboardList size={14} />
                            </button>
                            {admin && (
                              <button onClick={() => setLocation(`/crm/billing`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600" title="Generate Bill">
                                <FileText size={14} />
                              </button>
                            )}
                            <button onClick={() => sendWhatsApp(p.phone, p.name)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600" title="Send Reminder">
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {patients.map(p => {
                const status = (p.patient_status || 'Registered') as PatientStatus;
                const style = STATUS_STYLE[status] || STATUS_STYLE['Registered'];
                const isSelected = selectedPatientIds.includes(p.id);
                return (
                  <div key={p.id} className={`p-4 cursor-pointer hover:bg-slate-50/40 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`} onClick={() => openPatientSummaryModal(p)}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 flex-shrink-0 animate-fadeIn" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                          onChange={() => {
                            if (isSelected) {
                              setSelectedPatientIds(selectedPatientIds.filter(id => id !== p.id));
                            } else {
                              setSelectedPatientIds([...selectedPatientIds, p.id]);
                            }
                          }}
                        />
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                          {p.name?.[0]?.toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{p.patient_code}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${style.bg} ${style.text}`}>
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Phone size={10} /> {p.phone}</span>
                          {p.age && <span>{p.age}y</span>}
                        </div>
                        {p.treatment_summary && (
                          <p className="text-xs text-slate-600 mt-1 truncate">{p.treatment_summary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 rounded-lg border border-slate-200 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Profile Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  {selected.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{selected.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selected.patient_code}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 py-3 border-b overflow-x-auto flex-shrink-0">
              {[
                { id: 'demographics', label: 'Demographics', icon: Users },
                { id: 'timeline', label: 'Timeline', icon: Activity },
                { id: 'dental_chart', label: 'Dental Chart', icon: Stethoscope },
                { id: 'appointments', label: 'Appointments', icon: Calendar },
                { id: 'treatments', label: 'Treatments', icon: ClipboardList },
                { id: 'prescriptions', label: 'Prescriptions (Rx)', icon: FileText },
                { id: 'followups', label: 'Follow-ups', icon: Bell },
                ...(admin ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id as TabType);
                    setIsEditingProfile(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    activeTab === id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'demographics' && (
                <div className="space-y-5">
                  {/* PATIENT SUMMARY CARD AGGREGATION */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gradient-to-br from-teal-50 to-slate-50 p-4 rounded-2xl border border-teal-100/50">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-150/60 shadow-xs flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Appointment History</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5">{patientAppointments.length} Booked Visit(s)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          {patientAppointments.filter(a => a.status === 'Completed').length} completed • {patientAppointments.filter(a => a.status === 'Pending' || a.status === 'Confirmed').length} scheduled
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-150/60 shadow-xs flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Treatment Progress</p>
                        <p className="text-sm font-black text-indigo-950 mt-0.5">
                          {patientTreatments.filter(t => t.stage !== 'Completed').length} Pending / {patientTreatments.length} Total
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[170px] font-medium" title={patientTreatments.filter(t => t.stage !== 'Completed').map(t => t.treatment_type).join(', ') || 'No active treatments'}>
                          {patientTreatments.filter(t => t.stage !== 'Completed').map(t => t.treatment_type).join(', ') || 'No active treatments'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-150/60 shadow-xs flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0) > 0 
                          ? 'bg-rose-50 text-rose-600 animate-pulse' 
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <Wallet size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
                        <p className={`text-sm font-black mt-0.5 ${
                          patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0) > 0 
                            ? 'text-rose-700' 
                            : 'text-emerald-700'
                        }`}>
                          ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          Collected: ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* WHATSAPP CONTACT IMPORT & CLICK-TO-CHAT MODULE */}
                  <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 p-4 rounded-2xl border border-emerald-500/20 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 font-bold">
                        <MessageSquare size={20} className="text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-850">WhatsApp Integration</h4>
                        <p className="text-xs text-slate-500">Save patient's contact info globally & click to connect securely on WhatsApp.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${selected.name}\nTEL;TYPE=CELL:${selected.phone}\nEMAIL:${selected.email || ''}\nNOTE:Sri Chaitanya Dental Care Patient ${selected.patient_code || ''}\nEND:VCARD`;
                          const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const downloadLink = document.createElement('a');
                          downloadLink.download = `${selected.name.replace(/\s+/g, '_')}_SCDC.vcf`;
                          downloadLink.href = url;
                          document.body.appendChild(downloadLink);
                          downloadLink.click();
                          document.body.removeChild(downloadLink);
                          URL.revokeObjectURL(url);
                          notify('success', 'vCard Prepared', 'Patient contact card downloaded successfully. Double click the file on mobile/PC to import into your contacts.');
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <UserPlus size={14} />
                        <span>Save Contact</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const rawMsg = `Hi ${selected.name}, this is Sri Chaitanya Dental Care. How can we care for your smile today?`;
                          openWhatsApp(selected.phone, rawMsg);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                      >
                        <Send size={13} />
                        <span>Open WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* FAMILY SHARED PHONE NUMBER / FAMILY GROUP SUPPORT SECTION */}
                  {selected.phone && patients.filter(p => p.phone && p.phone.trim() === selected.phone?.trim() && p.id !== selected.id).length > 0 && (
                    <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/30 p-4 rounded-2xl border border-blue-100/55 shadow-xs">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Users className="text-blue-650 flex-shrink-0" size={18} />
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Family Group (<span className="text-blue-700 font-bold">{patients.filter(p => p.phone && p.phone.trim() === selected.phone?.trim() && p.id !== selected.id).length + 1} Shared Contacts</span>)</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                        The following patient files share the same phone contact number (<strong className="font-semibold text-slate-700">{selected.phone}</strong>). Clinical histories, treatments, and billing remain safely separate.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {patients.filter(p => p.phone && p.phone.trim() === selected.phone?.trim() && p.id !== selected.id).map(member => (
                          <div 
                            key={member.id} 
                            onClick={() => openPatientProfile(member)}
                            className="p-3 bg-white hover:bg-blue-55/70 border border-slate-100 hover:border-blue-200 rounded-xl transition cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-750 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                {member.name?.[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate" title={member.name}>{member.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{member.patient_code}</p>
                              </div>
                            </div>
                            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                              View Profile <ArrowRight size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Badges Row and Edit Profile Trigger */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1.5">Clinical Case Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map(s => {
                          const isActive = (selected.patient_status || 'Registered') === s;
                          const style = STATUS_STYLE[s] || STATUS_STYLE.Registered;
                          return (
                            <button
                              key={s}
                              onClick={() => updatePatientStatus(selected, s)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                isActive ? `${style.bg} ${style.text} ${style.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <style.icon size={11} />
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {!isEditingProfile && (
                      <button
                        onClick={() => {
                          const meta = getPatientMetadata(selected);
                          setProfileForm({
                            name: selected.name || '',
                            phone: selected.phone || '',
                            email: selected.email || '',
                            location: selected.location || '',
                            gender: selected.gender || meta.gender || '',
                            age: selected.age || (meta.dob ? calculateAge(meta.dob).toString() : ''),
                            notes: meta.notes || selected.notes || '',
                            blood_group: meta.blood_group || '',
                            occupation: meta.occupation || '',
                            emergency_contact_name: meta.emergency_contact_name || '',
                            emergency_contact_phone: meta.emergency_contact_phone || '',
                            medical_history: meta.medical_history || [],
                            allergies: meta.allergies || [],
                            current_medications: meta.current_medications || '',
                            habits: meta.habits || [],
                            insurance_provider: meta.insurance_provider || '',
                            insurance_policy_num: meta.insurance_policy_num || '',
                            insurance_expiry: meta.insurance_expiry || '',
                            avatar: meta.avatar || 'avatar1',
                            dob: meta.dob || ''
                          });
                          setIsEditingProfile(true);
                        }}
                        className="self-end sm:self-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                      >
                        Edit Profile Details
                      </button>
                    )}
                  </div>

                  {isEditingProfile ? (
                    /* EDIT PROFILE DEMOGRAPHICS FORM */
                    <form onSubmit={(e) => { e.preventDefault(); saveProfileDetails(); }} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Modify Clinical Demographics</h4>
                        <span className="text-[10px] text-teal-600 font-bold">SDC Practice Management</span>
                      </div>

                      {/* PRIMARY DEMOGRAPHICS */}
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Primary Bio-Demographics</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Patient Full Name *</label>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            placeholder="e.g. Rama Rao"
                            required
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Mobile Contact Phone *</label>
                          <input
                            type="text"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            placeholder="e.g. 9876543210"
                            required
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Email Address</label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            placeholder="e.g. user@example.com"
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Location / Residence</label>
                          <input
                            type="text"
                            value={profileForm.location}
                            onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                            placeholder="e.g. Vijayawada"
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Gender</label>
                          <select
                            value={profileForm.gender}
                            onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Age (If DOB unspecified)</label>
                          <input
                            type="text"
                            value={profileForm.age}
                            onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                            placeholder="e.g. 45"
                            className="w-full px-2 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25 font-mono"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Clinical Metadata & History</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Occupation</label>
                          <input
                            type="text"
                            value={profileForm.occupation}
                            onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                            placeholder="e.g. software Engineer, Student"
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Blood Group</label>
                          <select
                            value={profileForm.blood_group}
                            onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                          >
                            <option value="">Select blood type</option>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Avatar Preset</label>
                          <select
                            value={profileForm.avatar}
                            onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                          >
                            <option value="avatar1">Stylized Avatar 1</option>
                            <option value="avatar2">Stylized Avatar 2</option>
                            <option value="avatar3">Stylized Avatar 3</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-teal-600 font-extrabold block mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={profileForm.dob || ''}
                            onChange={(e) => {
                              const dobVal = e.target.value;
                              const calculated = dobVal ? calculateAge(dobVal) : '';
                              setProfileForm({ ...profileForm, dob: dobVal, age: calculated });
                            }}
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/50">
                          <p className="text-[10px] font-bold tracking-wider uppercase text-teal-700 mb-2">Emergency Contact</p>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={profileForm.emergency_contact_name}
                              onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                              placeholder="Contact Name (e.g. Spouse, Parent)"
                              className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-250 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            />
                            <input
                              type="text"
                              value={profileForm.emergency_contact_phone}
                              onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                              placeholder="Contact Phone Number"
                              className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-250 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/50">
                          <p className="text-[10px] font-bold tracking-wider uppercase text-teal-700 mb-2">Dental Insurance Folders</p>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={profileForm.insurance_provider}
                              placeholder="Insurance Provider Company"
                              onChange={(e) => setProfileForm({ ...profileForm, insurance_provider: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-250 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={profileForm.insurance_policy_num}
                                placeholder="Policy ID"
                                onChange={(e) => setProfileForm({ ...profileForm, insurance_policy_num: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-250 text-xs"
                              />
                              <input
                                type="date"
                                value={profileForm.insurance_expiry}
                                onChange={(e) => setProfileForm({ ...profileForm, insurance_expiry: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-250 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-red-500 block mb-1">Medical Conditions & History</label>
                          <textarea
                            value={profileForm.medical_history.join(', ')}
                            onChange={(e) => setProfileForm({ ...profileForm, medical_history: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            placeholder="e.g. Diabetes, Hypertension, Heart Valve Surgery"
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none"
                            rows={1.5}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block mb-1">Allergies</label>
                          <input
                            type="text"
                            value={profileForm.allergies.join(', ')}
                            onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            placeholder="e.g. Penicillin, Latex, NSAIDs"
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Current Medications</label>
                            <input
                              type="text"
                              value={profileForm.current_medications}
                              onChange={(e) => setProfileForm({ ...profileForm, current_medications: e.target.value })}
                              placeholder="e.g. Aspirin 75mg daily"
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Lifestyle Habits</label>
                            <input
                              type="text"
                              value={profileForm.habits.join(', ')}
                              onChange={(e) => setProfileForm({ ...profileForm, habits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="e.g. Smoking, Tobacco Chewing"
                              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-250 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">General Dentist Remarks & Notes</label>
                          <textarea
                            value={profileForm.notes}
                            onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                            placeholder="Add ongoing clinic dental case remarks or checkup inputs..."
                            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          disabled={isSavingProfile}
                          onClick={() => setIsEditingProfile(false)}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
                        >
                          {isSavingProfile ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Saving Profile...
                            </>
                          ) : (
                            'Save Profile Details'
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* RENDER CLINICAL SUMMARY CARDS */
                    <div className="space-y-4">
                      {/* Clinical Quick Actions Menu */}
                      <div id="quick-actions-card" className="bg-gradient-to-r from-teal-50/40 via-slate-50 to-slate-100/50 rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-xs">
                        <div>
                          <div className="flex items-center justify-between pb-1">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                              <Activity size={14} className="text-teal-600 animate-pulse" /> Clinical Quick Actions
                            </h4>
                            <span className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">Care Roster</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">Instantly book medical schedules, generate ledger receipts, or log recovery reviews.</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <button
                            id="btn-quick-book"
                            type="button"
                            onClick={() => {
                              setInlineAction(inlineAction === 'book_appointment' ? 'none' : 'book_appointment');
                              setApptForm({
                                treatment: 'Consultation',
                                date: new Date().toISOString().split('T')[0],
                                time: '10:00',
                                doctorId: doctors[0]?.id?.toString() || '1',
                                doctorName: doctors[0]?.name || 'Dr. Sri Chaitanya',
                                notes: '',
                                isHistorical: false
                              });
                            }}
                            className={`p-3.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-2 shadow-2xs hover:shadow-xs cursor-pointer ${
                              inlineAction === 'book_appointment'
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold ring-2 ring-blue-500/10'
                                : 'bg-white hover:bg-slate-50 border-slate-250 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className={`p-2 rounded-xl transition ${inlineAction === 'book_appointment' ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600'}`}>
                              <Calendar size={16} />
                            </div>
                            <span className="text-xs font-bold tracking-tight block">Book Appointment</span>
                          </button>

                          <button
                            id="btn-quick-invoice"
                            type="button"
                            onClick={() => {
                              setInlineAction('none');
                              setActiveTab('billing');
                              setBillForm({
                                items: [
                                  { treatment_type: 'Clinical Consultation', notes: 'Initial Oral Examination', qty: 1, rate: 250, discount: 0 }
                                ],
                                amount_paid: '250',
                                general_discount: '0',
                                payment_mode: 'Cash',
                                doctor_notes: 'Initial check-up completed. Generated via Quick Actions.',
                                follow_up_date: '',
                                instructions: 'Avoid eating hard foods for 2 hours.',
                                doctor_name: doctors[0]?.name || 'Dr. Sri Chaitanya'
                              });
                              setShowGenerateBill(true);
                              notify('info', 'Invoice Engine Loaded', 'Opened billing ledger with consulting defaults.');
                            }}
                            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-250 hover:border-slate-300 rounded-xl text-center transition flex flex-col items-center justify-center gap-2 shadow-2xs hover:shadow-xs cursor-pointer text-slate-700"
                          >
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                              <DollarSign size={16} />
                            </div>
                            <span className="text-xs font-bold tracking-tight block">Generate Invoice</span>
                          </button>

                          <button
                            id="btn-quick-followup"
                            type="button"
                            onClick={() => {
                              setInlineAction(inlineAction === 'add_follow_up' ? 'none' : 'add_follow_up');
                              setFollowUpForm({
                                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                time: '11:00',
                                doctorId: doctors[0]?.id?.toString() || '1',
                                doctorName: doctors[0]?.name || 'Dr. Sri Chaitanya',
                                notes: 'Post-op clinical recovery checklist evaluation'
                              });
                            }}
                            className={`p-3.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-2 shadow-2xs hover:shadow-xs cursor-pointer ${
                              inlineAction === 'add_follow_up'
                                ? 'bg-purple-50 border-purple-300 text-purple-700 font-semibold ring-2 ring-purple-500/10'
                                : 'bg-white hover:bg-slate-50 border-slate-250 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className={`p-2 rounded-xl transition ${inlineAction === 'add_follow_up' ? 'bg-purple-100 text-purple-700' : 'bg-purple-50 text-purple-600'}`}>
                              <Bell size={16} />
                            </div>
                            <span className="text-xs font-bold tracking-tight block">Add Follow-up</span>
                          </button>
                        </div>

                        {/* Inline Booking Form Card */}
                        {inlineAction === 'book_appointment' && (
                          <div className="bg-blue-50/45 p-4 rounded-xl border border-blue-200 mt-2 space-y-3.5">
                            <div className="flex items-center justify-between border-b border-blue-200/50 pb-1.5">
                              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Plus size={13} /> Schedule New Appointment for {selected.name}
                              </span>
                              <button type="button" onClick={() => setInlineAction('none')} className="text-blue-500 hover:text-blue-700 text-xs font-bold">Close</button>
                            </div>

                            <form onSubmit={handleInlineBookAppointment} className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block mb-1">Treatment Plan / Category</label>
                                  <select
                                    value={apptForm.treatment}
                                    onChange={(e) => setApptForm({ ...apptForm, treatment: e.target.value })}
                                    className="w-full bg-white text-slate-800 border border-blue-200/80 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                  >
                                    {TREATMENTS_LIST.map((tr) => (
                                      <option key={tr} value={tr}>{tr}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <DoctorSelect
                                    selectedId={apptForm.doctorId}
                                    selectedName={apptForm.doctorName}
                                    required
                                    label="Assigned Dentist"
                                    onChange={(doc) => setApptForm({ ...apptForm, doctorId: doc.id.toString(), doctorName: doc.name })}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block mb-1">Schedule Date</label>
                                  <input
                                    type="date"
                                    required
                                    value={apptForm.date}
                                    onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })}
                                    className="w-full bg-white text-slate-850 border border-blue-200/80 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block mb-1">Scheduled Clock Time</label>
                                  <input
                                    type="time"
                                    required
                                    value={apptForm.time}
                                    onChange={(e) => setApptForm({ ...apptForm, time: e.target.value })}
                                    className="w-full bg-white text-slate-850 border border-blue-200/80 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Historical Record Entry Toggle */}
                              <div className="flex items-center gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/40">
                                <input
                                  type="checkbox"
                                  id="inline_is_historical"
                                  checked={apptForm.isHistorical || false}
                                  onChange={(e) => setApptForm(f => ({ ...f, isHistorical: e.target.checked }))}
                                  className="rounded border-blue-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                                />
                                <label htmlFor="inline_is_historical" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                  Historical Record Entry <span className="text-[10px] text-amber-600 font-normal">(Documentation; past dates allowed; defaults to Completed)</span>
                                </label>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block mb-1">Practitioner Care Notes (Optional)</label>
                                <textarea
                                  placeholder="e.g., Local anesthesia required. Patient requested evening hours."
                                  rows={1.5}
                                  value={apptForm.notes}
                                  onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })}
                                  className="w-full bg-white text-slate-800 border border-blue-200/80 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1 border-t border-blue-200/40">
                                <button
                                  type="button"
                                  onClick={() => setInlineAction('none')}
                                  className="px-3.5 py-2 bg-slate-250 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={bookingLoading}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* Inline Follow-up Form Card */}
                        {inlineAction === 'add_follow_up' && (
                          <div className="bg-purple-50/45 p-4 rounded-xl border border-purple-200 mt-2 space-y-3.5">
                            <div className="flex items-center justify-between border-b border-purple-200/50 pb-1.5">
                              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Plus size={13} /> Configure Follow-up Review Plan for {selected.name}
                              </span>
                              <button type="button" onClick={() => setInlineAction('none')} className="text-purple-500 hover:text-purple-700 text-xs font-bold">Close</button>
                            </div>

                            <form onSubmit={handleInlineAddFollowUp} className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <DoctorSelect
                                    selectedId={followUpForm.doctorId}
                                    selectedName={followUpForm.doctorName}
                                    required
                                    label="Recommended Clinician"
                                    onChange={(doc) => setFollowUpForm({ ...followUpForm, doctorId: doc.id.toString(), doctorName: doc.name })}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block mb-1 font-sans">Return Date</label>
                                    <input
                                      type="date"
                                      required
                                      value={followUpForm.date}
                                      onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                                      className="w-full bg-white text-slate-850 border border-purple-200/80 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block mb-1 font-sans">Return Time</label>
                                    <input
                                      type="time"
                                      required
                                      value={followUpForm.time}
                                      onChange={(e) => setFollowUpForm({ ...followUpForm, time: e.target.value })}
                                      className="w-full bg-white text-slate-850 border border-purple-200/80 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-purple-800 tracking-wider block mb-1">Check-up Scope / Clinical Directives</label>
                                <textarea
                                  placeholder="e.g., General extraction slot healing review. Check for tissue margin closure."
                                  rows={1.5}
                                  value={followUpForm.notes}
                                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                                  className="w-full bg-white text-slate-800 border border-purple-200/80 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1 border-t border-purple-200/40">
                                <button
                                  type="button"
                                  onClick={() => setInlineAction('none')}
                                  className="px-3.5 py-2 bg-slate-250 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={bookingLoading}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {bookingLoading ? 'Scheduling...' : 'Lock Follow-up Plan'}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>

                      {/* Patient Care & Concierge Actions Panel */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                            <MessageSquare size={13} className="text-teal-600 animate-pulse" /> Patient Care & Concierge Actions
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Directly engage with patient, dispatch reminders, request feedback, or print patient summaries.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                          {/* 1. Call Patient */}
                          <a
                            href={`tel:${selected.phone}`}
                            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-2xs text-center group"
                          >
                            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition">
                              <Phone size={14} />
                            </div>
                            <span className="text-[10.5px] font-bold tracking-tight text-slate-700">Call Patient</span>
                          </a>

                          {/* 2. WhatsApp Patient */}
                          <button
                            type="button"
                            onClick={() => {
                              const promo = `Hi ${selected.name}, this is ${clinicConfig.clinicName}. Just checking if you have any questions or require anything? We are happy to help!\n\n${CLINIC_SIGNATURE}`;
                              openWhatsApp(selected.phone, promo);
                              notify('success', 'WhatsApp Initiated', `Opening direct chat for ${selected.name}`);
                            }}
                            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-2xs text-center group cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition">
                              <Send size={14} />
                            </div>
                            <span className="text-[10.5px] font-bold tracking-tight text-slate-700">WhatsApp Chat</span>
                          </button>

                          {/* 3. Send Follow-up Reminder */}
                          <button
                            type="button"
                            onClick={() => {
                              const msg = `Hi ${selected.name}, this is a friendly reminder from ${clinicConfig.clinicName} for your upcoming treatment follow-up. Please feel free to text or call us for appointments.\n\n${CLINIC_SIGNATURE}`;
                              openWhatsApp(selected.phone, msg);
                              logWhatsAppDelivery(selected.name, selected.phone, 'Patient', 'Follow-up Reminder', 'Sent', msg, selected.id);
                              notify('success', 'Follow-up Sent', `WhatsApp follow-up reminder dispatched for ${selected.name}`);
                            }}
                            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-2xs text-center group cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
                              <Bell size={14} />
                            </div>
                            <span className="text-[10.5px] font-bold tracking-tight text-slate-700">Follow-up Sent</span>
                          </button>

                          {/* 4. Request Google Review */}
                          <button
                            type="button"
                            onClick={() => {
                              const msg = `Hi ${selected.name}, thank you for choosing ${clinicConfig.clinicName}. We hope you got your perfect smile! If you had a comfortable experience, could you please take 30 seconds to click and leave us a review to show your support: ${clinicConfig.googleReviewUrl} ? Thank you so much!\n\n${CLINIC_SIGNATURE}`;
                              openWhatsApp(selected.phone, msg);
                              logWhatsAppDelivery(selected.name, selected.phone, 'Patient', 'Google Review Request', 'Sent', msg, selected.id);
                              notify('success', 'Review Sent', `WhatsApp Google review invitation sent to ${selected.name}`);
                            }}
                            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-2xs text-center group cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition">
                              <MessageSquare size={14} className="text-amber-650" />
                            </div>
                            <span className="text-[10.5px] font-bold tracking-tight text-slate-700">Review Request</span>
                          </button>

                          {/* 5. Print Patient Summary */}
                          <button
                            type="button"
                            onClick={() => printPatientSummaryPDF(selected, patientAppointments, patientTreatments)}
                            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-2xs text-center group cursor-pointer"
                          >
                            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-605 group-hover:bg-purple-100 transition">
                              <Printer size={14} />
                            </div>
                            <span className="text-[10.5px] font-bold tracking-tight text-slate-700">Print Summary</span>
                          </button>
                        </div>
                      </div>

                      {/* Demographic basics */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {[
                          { label: 'Patient Name', val: selected.name || '-' },
                          { label: 'Phone', val: selected.phone || '-' },
                          { label: 'Age', val: `${selected.age || '-'}` },
                          { label: 'Gender', val: selected.gender || '-' },
                          { label: 'Address / Location', val: selected.location || '-' },
                          { label: 'Registration Date', val: formatDate(selected.created_at) },
                          { label: 'Last Visit Date', val: formatDate(selected.last_visit_date) },
                          { label: 'Next Appointment', val: formatDate(selected.next_visit_date) },
                          { label: 'Total Visits Count', val: `${patientAppointments.length} Visit(s)` },
                          { 
                            label: 'Total Revenue Generated', 
                            val: `₹${patientAppointments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0).toLocaleString('en-IN')}`,
                            isAccent: true
                          },
                          { 
                            label: 'Outstanding Balance', 
                            val: `₹${patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0).toLocaleString('en-IN')}`,
                            isWarning: true
                          },
                          { label: 'Email ID', val: selected.email || 'Not Provided' },
                        ].map(({ label, val, isAccent, isWarning }) => (
                          <div key={label} className={`rounded-xl p-3 border ${
                            isAccent ? 'bg-teal-50 border-teal-105 text-teal-800' :
                            isWarning ? 'bg-rose-50 border-rose-105 text-rose-800' :
                            'bg-slate-50 border-slate-150 text-slate-700'
                          }`}>
                            <p className="text-[9.5px] uppercase font-black tracking-wider text-slate-400 mb-1">{label}</p>
                            <p className="text-xs font-bold leading-tight font-sans text-slate-800">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Emergency contacts card */}
                      <div className="bg-red-50/30 rounded-2xl p-4 border border-red-100/50">
                        <div className="flex items-center gap-2 mb-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                          <AlertCircle size={14} className="text-rose-500 animate-pulse" />
                          Emergency Clinic Contact Call
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Escalation Person:</span>
                            <p className="font-semibold text-slate-700">{getPatientMetadata(selected).emergency_contact_name || '-'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Emergency Number:</span>
                            <p className="font-bold text-slate-800 font-mono">
                              {getPatientMetadata(selected).emergency_contact_phone ? (
                                <a href={`tel:${getPatientMetadata(selected).emergency_contact_phone}`} className="text-teal-600 hover:underline">
                                  {getPatientMetadata(selected).emergency_contact_phone}
                                </a>
                              ) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Medical alert factors lists */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-amber-50/25 rounded-2xl p-4 border border-amber-100/50">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Medical History & Allergies</h4>
                          <ul className="space-y-1.5 text-xs text-slate-650">
                            <li>
                              <strong className="text-slate-500">Known Conditions:</strong>{' '}
                              <span className="font-medium text-slate-700">
                                {getPatientMetadata(selected).medical_history?.length > 0
                                  ? getPatientMetadata(selected).medical_history.join(', ')
                                  : 'None reported'}
                              </span>
                            </li>
                            <li>
                              <strong className="text-slate-500">Allergies/Penicillin:</strong>{' '}
                              <span className="font-bold text-rose-600">
                                {getPatientMetadata(selected).allergies?.length > 0
                                  ? getPatientMetadata(selected).allergies.join(', ')
                                  : 'No Known Allergies'}
                              </span>
                            </li>
                            <li>
                              <strong className="text-slate-500">Current Medications:</strong>{' '}
                              <span className="font-medium text-slate-750">
                                {getPatientMetadata(selected).current_medications || 'None'}
                              </span>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200/50">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Social Habits & Insurances</h4>
                          <ul className="space-y-1.5 text-xs text-slate-650">
                            <li>
                              <strong className="text-slate-500">Habits (Smoking):</strong>{' '}
                              <span className="font-medium text-orange-700">
                                {getPatientMetadata(selected).habits?.length > 0
                                  ? getPatientMetadata(selected).habits.join(', ')
                                  : 'None (Healthy Lifestyle)'}
                              </span>
                            </li>
                            <li>
                              <strong className="text-slate-500">Insurance Provider:</strong>{' '}
                              <span className="font-semibold text-slate-700">
                                {getPatientMetadata(selected).insurance_provider || 'Self Paid'}
                              </span>
                            </li>
                            {getPatientMetadata(selected).insurance_policy_num && (
                              <li>
                                <strong className="text-slate-500">Policy Details:</strong>{' '}
                                <span className="font-mono font-medium text-slate-650">
                                  ID: {getPatientMetadata(selected).insurance_policy_num} (Exp: {getPatientMetadata(selected).insurance_expiry || 'N/A'})
                                </span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 mb-1">Ongoing Dental History Remarks</p>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {getPatientMetadata(selected).notes || selected.notes || 'No case remarks added yet. Click edit profile to append.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Chronological Case Timeline</h4>
                    <p className="text-xs text-slate-400">Complete historical path of appointments, treatments, prescriptions, and financial activity</p>
                  </div>

                  <TimelineView
                    appointments={patientAppointments}
                    treatments={patientTreatments}
                    prescriptions={getPatientMetadata(selected).prescriptions || []}
                    uploadedImages={getPatientMetadata(selected).images || []}
                    onUploadImage={async (url, name, category, notes) => {
                      const currentImages = getPatientMetadata(selected).images || [];
                      const newImage = {
                        id: `img-${Date.now()}`,
                        url,
                        name,
                        category,
                        notes,
                        date: new Date().toISOString()
                      };
                      await updatePatientMetadata({
                        images: [...currentImages, newImage]
                      });
                      notify('success', 'Image Uploaded', 'Clinical radiograph linked to patient case sheet.');
                    }}
                    onDeleteImage={async (imageId) => {
                      const currentImages = getPatientMetadata(selected).images || [];
                      const filteredImages = currentImages.filter((img: any) => img.id !== imageId);
                      await updatePatientMetadata({
                        images: filteredImages
                      });
                      notify('success', 'Image Deleted', 'Attachment removed from case repository.');
                    }}
                  />

                  {/* Upgraded Treatment History Ledger */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-2xs">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                        <ClipboardList size={14} className="text-teal-605" /> Treatment History Ledger
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Meticulous ledger documenting dates, diagnosed treatments, attending dentists, contracted costs, and payment states.</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/55">
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Sl.</th>
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Date</th>
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Treatment</th>
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Doctor</th>
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Cost</th>
                            <th className="py-2.5 px-3 text-[10px] uppercase font-black text-slate-400 tracking-wider">Payment Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {patientAppointments.length > 0 ? (
                            patientAppointments.map((appt, i) => {
                              const totalCost = Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0);
                              const isPaid = Number(appt.balance_amount || 0) <= 0;
                              return (
                                <tr key={appt.id || i} className="hover:bg-slate-50/40 transition">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-400">{i + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-600">{formatDate(appt.next_visit || appt.created_at)}</td>
                                  <td className="py-2 px-3 font-extrabold text-slate-800">{appt.treatment || 'Routine Dental Checkup'}</td>
                                  <td className="py-2 px-3 font-medium text-slate-650">
                                    <span className="inline-flex items-center gap-1">
                                      <Stethoscope size={11} className="text-teal-550" />
                                      {(appt as any).doctor_name || 'Dr. Sri Chaitanya'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-755">₹{totalCost.toLocaleString('en-IN')}</td>
                                  <td className="py-2 px-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                      isPaid 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                        : 'bg-rose-50 text-rose-700 border border-rose-150'
                                    }`}>
                                      {isPaid ? 'Paid' : 'Dues Pending'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic">No clinical treatment sessions logged yet for this patient.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* INTERACTIVE DENTAL CHART VIEW */}
              {activeTab === 'dental_chart' && (
                <div className="space-y-4">
                  <div className="bg-teal-50 text-teal-700 px-4 py-3 rounded-xl border border-teal-100 text-xs">
                    <p className="font-semibold mb-1">Universal Tooth System Simulator</p>
                    Select an adult or child tooth slot to log caries decay, root canals done, or caps. Clicking <strong>Assemble Treatment</strong> inside a tooth card automatically prepares a clinical session setup.
                  </div>
                  <DentalChart
                    chartData={getPatientMetadata(selected).dental_chart || {}}
                    onChange={saveDentalChart}
                    onAddTreatment={(tooth, status) => {
                      setTreatmentForm(t => ({
                        ...t,
                        treatment_type: status === 'Crown' ? 'Crowns & Bridges' :
                                        status === 'Caries' ? 'Fillings' : 
                                        status === 'Root Canal' ? 'Root Canal' :
                                        status === 'Missing' ? 'Dental Implants' :
                                        'Consultation',
                        tooth_no: String(tooth),
                        treatment_notes: `Scheduled care session targeting Tooth #${tooth} diagnosed with ${status}`
                      }));
                      setActiveTab('treatments');
                      setShowAddTreatment(true);
                    }}
                  />
                </div>
              )}

              {/* RX PRESCRIPTIONS SEGMENT */}
              {activeTab === 'prescriptions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Patient EMR Prescription History</h4>
                      <p className="text-[10px] text-slate-400">Permanent clinical records can be printed instantly</p>
                    </div>
                  </div>

                  {/* Add Prescription form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="sm:w-1/3">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Select Rx Template</label>
                        <select
                          value={rxForm.p_type}
                          onChange={(e) => {
                            const val = e.target.value;
                            const t = RX_TEMPLATES[val] || RX_TEMPLATES.RCT;
                            setRxForm({ p_type: val, notes: '', medicines: t.medicines });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs"
                        >
                          <option value="RCT">RCT Template</option>
                          <option value="Extraction">Tooth Extraction Template</option>
                          <option value="Implant">Implant Surgeries Template</option>
                          <option value="Scaling">Scaling/Whitening Template</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Specific Instructions / Notes</label>
                        <input
                          type="text"
                          value={rxForm.notes}
                          onChange={(e) => setRxForm({ ...rxForm, notes: e.target.value })}
                          placeholder="Take before/after food, precautions..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {/* Table of items editing */}
                    <div className="overflow-x-auto pt-1 bg-white rounded-lg border border-slate-150">
                      <table className="min-w-full divide-y divide-slate-150 text-left text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-2 font-bold text-slate-550">Medicine</th>
                            <th className="p-2 font-bold text-slate-550">Dosage</th>
                            <th className="p-2 font-bold text-slate-550">Frequency</th>
                            <th className="p-2 font-bold text-slate-550">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rxForm.medicines.map((m, idx) => (
                            <tr key={idx}>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={m.name}
                                  onChange={(e) => {
                                    const next = [...rxForm.medicines];
                                    next[idx].name = e.target.value;
                                    setRxForm({ ...rxForm, medicines: next });
                                  }}
                                  className="w-full p-1 border-0 focus:ring-1 rounded bg-slate-50 text-xs text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={m.dosage}
                                  onChange={(e) => {
                                    const next = [...rxForm.medicines];
                                    next[idx].dosage = e.target.value;
                                    setRxForm({ ...rxForm, medicines: next });
                                  }}
                                  className="w-full p-1 border-0 bg-slate-50 text-xs text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={m.frequency}
                                  onChange={(e) => {
                                    const next = [...rxForm.medicines];
                                    next[idx].frequency = e.target.value;
                                    setRxForm({ ...rxForm, medicines: next });
                                  }}
                                  className="w-full p-1 border-0 bg-slate-50 text-xs text-slate-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={m.duration}
                                  onChange={(e) => {
                                    const next = [...rxForm.medicines];
                                    next[idx].duration = e.target.value;
                                    setRxForm({ ...rxForm, medicines: next });
                                  }}
                                  className="w-full p-1 border-0 bg-slate-50 text-xs text-slate-800"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center pt-1.5">
                      <button
                        onClick={() => {
                          setRxForm(r => ({
                            ...r,
                            medicines: [...r.medicines, { name: 'New Medicine', dosage: '1 tab', frequency: 'Twice daily', duration: '5 days' }]
                          }));
                        }}
                        className="text-[10px] font-bold text-teal-700 hover:underline"
                      >
                        + Add Custom Medicine Row
                      </button>
                      <button
                        onClick={() => {
                          savePrescription(rxForm.p_type, rxForm.medicines, rxForm.notes);
                          // Clear instructed note
                          setRxForm(r => ({ ...r, notes: '' }));
                        }}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                      >
                        Commit Prescription (Rx)
                      </button>
                    </div>
                  </div>

                  {/* Historical logs display */}
                  <div className="space-y-2.5">
                    {(getPatientMetadata(selected).prescriptions || []).length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">No recorded clinical prescriptions found.</div>
                    ) : (
                      (getPatientMetadata(selected).prescriptions || []).map((rx: any) => (
                        <div key={rx.id} className="bg-white border rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-800 text-xs">Prescription Scope: {rx.p_type} Template</p>
                            <p className="text-[9px] text-slate-400 font-medium">Logged on: {rx.date} · {rx.medicines?.length || 0} drugs mapped</p>
                            {rx.notes && <p className="text-[10px] text-amber-700 font-semibold italic mt-1">Instructions: {rx.notes}</p>}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => printPrescription(rx)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border text-xs font-bold rounded-lg flex items-center gap-1"
                            >
                              <Printer size={12} /> Print Rx
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestFeedback(selected)}
                              disabled={sendingWhatsApp.feedback}
                              className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-100 text-[10px] font-bold rounded-lg flex items-center gap-1 disabled:opacity-50"
                              title="Ask Patient to submit Feedback for this visit"
                            >
                              {sendingWhatsApp.feedback ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 text-orange-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <span>Logging...</span>
                                </>
                              ) : (
                                <>⭐ Feedback</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestGoogleReview(selected)}
                              disabled={sendingWhatsApp.review}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-lg flex items-center gap-1 disabled:opacity-50"
                              title="Ask Patient to submit Google Star Review"
                            >
                              {sendingWhatsApp.review ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <span>Logging...</span>
                                </>
                              ) : (
                                <>🌟 Review</>
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-2">
                  {patientAppointments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No appointments found</div>
                  ) : (
                    patientAppointments.map(appt => (
                      <div key={appt.id} className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{appt.treatment || 'Appointment'}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(appt.next_visit)} {appt.appointment_time && `at ${appt.appointment_time}`}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${apptStatusColor(appt.status)}`}>
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'treatments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-700">Treatment Management</p>
                    <button
                      onClick={() => setShowAddTreatment(!showAddTreatment)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
                    >
                      {showAddTreatment ? 'Cancel' : 'New Treatment Record'}
                    </button>
                  </div>

                  {showAddTreatment && (
                    <form onSubmit={handleAddTreatment} className="bg-slate-50 rounded-xl p-4 border border-teal-100/55 space-y-3">
                      <p className="text-xs font-bold text-teal-800 flex items-center gap-1">
                        <span>●</span> Record Clinical Dental Treatment for {selected.name}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Treatment/Procedure Type *</label>
                          <select
                            value={treatmentForm.treatment_type}
                            onChange={e => setTreatmentForm(f => ({ ...f, treatment_type: e.target.value }))}
                            required
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          >
                            <option value="">Select Treatment Type</option>
                            {TREATMENTS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Tooth Number (optional)</label>
                          <input
                            type="text"
                            value={treatmentForm.tooth_no}
                            onChange={e => setTreatmentForm(f => ({ ...f, tooth_no: e.target.value }))}
                            placeholder="e.g. 14, A, Lower Left"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Assigned Dentist/Doctor</label>
                          <select
                            value={treatmentForm.doctor_name}
                            onChange={e => setTreatmentForm(f => ({ ...f, doctor_name: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          >
                            {doctors && doctors.length > 0 ? (
                              doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                            ) : (
                              <>
                                <option value="Dr. Sri Chaitanya">Dr. Sri Chaitanya (MDS)</option>
                                <option value="Dr. K. Verma">Dr. K. Verma (BDS)</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Treatment Status</label>
                          <select
                            value={treatmentForm.status}
                            onChange={e => setTreatmentForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          >
                            <option value="Planned">Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Estimated Cost (₹)</label>
                          <input
                            type="number"
                            value={treatmentForm.estimated_cost}
                            onChange={e => setTreatmentForm(f => ({ ...f, estimated_cost: e.target.value }))}
                            placeholder="Cost in ₹"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Paid Amount (₹)</label>
                          <input
                            type="number"
                            value={treatmentForm.paid_amount}
                            onChange={e => setTreatmentForm(f => ({ ...f, paid_amount: e.target.value }))}
                            placeholder="Paid in ₹"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-400 mb-0.5 block">Auto Balance Due (₹)</label>
                          <div className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-slate-100 text-slate-700 flex items-center justify-between">
                            <span>₹</span>
                            <span>{Math.max(0, (Number(treatmentForm.estimated_cost) || 0) - (Number(treatmentForm.paid_amount) || 0))}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Stage</label>
                          <select
                            value={treatmentForm.stage}
                            onChange={e => setTreatmentForm(f => ({ ...f, stage: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          >
                            {STAGES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Start Date</label>
                          <input
                            type="date"
                            value={treatmentForm.start_date}
                            onChange={e => setTreatmentForm(f => ({ ...f, start_date: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Total Sessions</label>
                          <input
                            type="number"
                            value={treatmentForm.total_sessions}
                            onChange={e => setTreatmentForm(f => ({ ...f, total_sessions: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            placeholder="e.g. 5"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Sessions Done</label>
                          <input
                            type="number"
                            value={treatmentForm.sessions_done}
                            onChange={e => setTreatmentForm(f => ({ ...f, sessions_done: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            placeholder="e.g. 0"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Next Visit Date</label>
                          <input
                            type="date"
                            value={treatmentForm.next_visit}
                            onChange={e => setTreatmentForm(f => ({ ...f, next_visit: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-0.5 block">Treatment Notes</label>
                        <textarea
                          value={treatmentForm.treatment_notes}
                          onChange={e => setTreatmentForm(f => ({ ...f, treatment_notes: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-205 text-xs resize-none bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          placeholder="Add details about the treatment..."
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={addingTreatment}
                        className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition disabled:opacity-60 cursor-pointer"
                      >
                        {addingTreatment ? 'Saving Treatment Plan...' : 'Save Dental Treatment Plan'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {patientTreatments.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">No treatments details found. Click "New Treatment Record" to create one.</div>
                    ) : (
                      patientTreatments.map(treat => {
                        const stagesArray = ['Assessment', 'Treatment Started', 'In Progress', 'Review', 'Completed'];
                        const getOverallPercentage = (record: any) => {
                          if (record.stage === 'Completed') return 100;
                          if (record.total_sessions) {
                            const ratio = (Number(record.sessions_done) || 0) / Number(record.total_sessions);
                            return Math.round(ratio * 100);
                          }
                          const weights: Record<string, number> = {
                            'Assessment': 15,
                            'Treatment Started': 35,
                            'In Progress': 60,
                            'Review': 85
                          };
                          return weights[record.stage] || 10;
                        };

                        const overallPercent = getOverallPercentage(treat);

                        return (
                          <div key={treat.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{treat.treatment_type}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold uppercase tracking-wide text-teal-700 bg-teal-55 px-2 py-0.5 rounded text-[9px]">{treat.stage}</span>
                                  <span className="text-slate-300">·</span>
                                  <span>Sessions: <strong className="text-slate-700 font-semibold">{treat.sessions_done || 0}</strong>/{treat.total_sessions || '-'}</span>
                                  {treat.start_date && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span>Started: {formatDate(treat.start_date)}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <span className={`text-[10px] uppercase font-extrabold tracking-wide px-2 py-0.5 rounded-full ${treatmentStatusColor(treat.status)}`}>
                                {treat.status}
                              </span>
                            </div>

                            {/* Detailed planned attributes card list (Priority 2 system fields) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-slate-200/60 text-[11px] text-slate-650">
                              <div>
                                <span className="block text-slate-400 font-bold text-[8px] uppercase tracking-wide">Tooth / Zone</span>
                                <strong className="text-slate-800 text-[11px]">{treat.tooth_no ? `Tooth #${treat.tooth_no}` : 'General Oral'}</strong>
                              </div>
                              <div>
                                <span className="block text-slate-400 font-bold text-[8px] uppercase tracking-wide">Doctor</span>
                                <strong className="text-slate-800 text-[11px]">{treat.doctor_name || 'Dr. Sri Chaitanya'}</strong>
                              </div>
                              <div>
                                <span className="block text-slate-400 font-bold text-[8px] uppercase tracking-wide">Cost / Paid</span>
                                <strong className="text-slate-800 text-[11px]">₹{treat.estimated_cost || 0} / <span className="text-teal-600">₹{treat.paid_amount || 0}</span></strong>
                              </div>
                              <div>
                                <span className="block text-slate-400 font-bold text-[8px] uppercase tracking-wide">Balance Due</span>
                                <span className={`font-bold text-[11px] ${Number(treat.balance_amount) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                  ₹{treat.balance_amount ?? Math.max(0, (Number(treat.estimated_cost) || 0) - (Number(treat.paid_amount) || 0))}
                                </span>
                              </div>
                            </div>
                            
                            {treat.next_visit && (
                              <div className="flex items-center gap-1.5 bg-cyan-50/70 text-cyan-800 px-3 py-1.5 rounded-lg border border-cyan-100/60 text-[10px] font-bold uppercase tracking-wider">
                                <span>📅</span>
                                <span>Next Recall Visit: <strong className="text-slate-800 font-black">{formatDate(treat.next_visit)}</strong></span>
                              </div>
                            )}

                            {/* Stepper Steps UI */}
                            <div className="bg-white rounded-xl p-3 border border-slate-200/60 space-y-3">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                <span>Procedure Stage</span>
                                <span className="text-teal-650">Total Complete: {overallPercent}%</span>
                              </div>

                              <div className="flex items-center justify-between gap-1 py-1">
                                {stagesArray.map((s, idx) => {
                                  const isCurrent = treat.stage === s;
                                  const currentIdx = stagesArray.indexOf(treat.stage);
                                  const isPassed = stagesArray.indexOf(s) <= currentIdx;
                                  return (
                                    <div key={s} className="flex items-center flex-1 last:flex-none">
                                      <div className="flex flex-col items-center relative">
                                        <button
                                          type="button"
                                          onClick={() => updatePatientTreatmentStage(treat.id, s)}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                                            isCurrent ? 'bg-teal-600 text-white ring-4 ring-teal-100 scale-105' :
                                            isPassed ? 'bg-teal-50 text-teal-800 border border-teal-150' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                          }`}
                                          title={`Set stage to ${s}`}
                                        >
                                          {idx + 1}
                                        </button>
                                        <span className={`absolute top-7 whitespace-nowrap text-[8px] font-bold ${
                                          isCurrent ? 'text-teal-700' : isPassed ? 'text-slate-500' : 'text-slate-300'
                                        } max-sm:hidden`}>
                                          {s}
                                        </span>
                                      </div>
                                      {idx < stagesArray.length - 1 && (
                                        <div className={`h-1 flex-1 mx-1.5 rounded-full transition-colors ${
                                          stagesArray.indexOf(stagesArray[idx + 1]) <= currentIdx ? 'bg-teal-400' : 'bg-slate-200'
                                        }`} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Interactive Increment buttons */}
                              <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-100">
                                <span className="text-slate-400 font-bold text-[10px] uppercase">Increment Sessions Done:</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    title="Decrement session"
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(0, (Number(treat.sessions_done) || 0) - 1);
                                      updatePatientTreatmentSessions(treat.id, val, Number(treat.total_sessions || 1));
                                    }}
                                    className="w-5 h-5 bg-slate-50 border border-slate-250 text-slate-550 font-black text-xs rounded hover:bg-slate-100 flex items-center justify-center active:scale-95 transition"
                                  >
                                    -
                                  </button>
                                  <button
                                    title="Increment session"
                                    type="button"
                                    onClick={() => {
                                      const total = Number(treat.total_sessions || 1);
                                      const val = Math.min(total, (Number(treat.sessions_done) || 0) + 1);
                                      updatePatientTreatmentSessions(treat.id, val, total);
                                      if (val === total && treat.stage !== 'Completed') {
                                        if (confirm("Sessions complete! Set plan stage to 'Completed'?")) {
                                          updatePatientTreatmentStage(treat.id, 'Completed');
                                        }
                                      }
                                    }}
                                    className="w-5 h-5 bg-slate-50 border border-slate-250 text-teal-600 font-black text-xs rounded hover:bg-slate-100 flex items-center justify-center active:scale-95 transition"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Visual Progress Bar */}
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300" 
                                  style={{ width: `${overallPercent}%` }} 
                                />
                              </div>
                            </div>

                            {treat.treatment_notes && (
                              <p className="text-xs text-slate-600 mt-2 bg-white/70 p-2.5 rounded border border-slate-150/40 italic">
                                "{treat.treatment_notes}"
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'followups' && (
                <div className="space-y-2">
                  {patientAppointments.filter(a => a.status === 'Pending' || a.status === 'Confirmed').length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">No pending follow-ups</div>
                  ) : (
                    patientAppointments
                      .filter(a => a.status === 'Pending' || a.status === 'Confirmed')
                      .map(appt => (
                        <div key={appt.id} className="bg-slate-50 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{appt.treatment || 'Follow-up'}</p>
                              <p className="text-xs text-slate-500">{formatDate(appt.next_visit)}</p>
                            </div>
                            <button
                              onClick={() => sendWhatsApp(selected.phone, selected.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
                            >
                              <MessageCircle size={12} /> Remind
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-4">
                  {!showGenerateBill ? (
                    <>
                      {/* Billing Summary Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-teal-50/50 rounded-xl p-3 border border-teal-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet size={14} className="text-teal-600" />
                            <span className="text-xs text-teal-600 font-medium">Total Paid</span>
                          </div>
                          <p className="text-lg font-bold text-teal-700">
                            ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.amount_paid) || 0), 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={14} className="text-rose-500" />
                            <span className="text-xs text-rose-500 font-medium">Pending Balance</span>
                          </div>
                          <p className="text-lg font-bold text-rose-600">
                            ₹{patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      {/* Header with New Bill Button */}
                      <div className="flex items-center justify-between pt-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Billing History Receipts</h4>
                        <button
                          onClick={() => {
                            setBillForm({
                              items: [
                                { treatment_type: 'Clinical Consultation', notes: 'Initial Oral Examination', qty: 1, rate: 250, discount: 0 }
                              ],
                              amount_paid: '250',
                              general_discount: '0',
                              payment_mode: 'Cash',
                              doctor_notes: 'Initial check-up completed.',
                              follow_up_date: '',
                              instructions: 'Avoid eating hard foods for 2 hours.',
                              doctor_name: doctors[0]?.name || 'Dr. Sri Chaitanya'
                            });
                            setShowGenerateBill(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
                        >
                          <Plus size={13} /> Generate New Bill
                        </button>
                      </div>

                      {/* Billing List */}
                      {patientAppointments.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-sm bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                          No billing history found.<br/>Click the "Generate New Bill" button above to create one.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {patientAppointments.map(appt => {
                            const billDetails = parseBilling(appt);
                            const billNo = `SDC-BILL-${appt.id}-${new Date(appt.created_at || Date.now()).getTime().toString().slice(-4)}`;
                            return (
                              <div key={appt.id} className="bg-white border border-slate-100 shadow-sm rounded-xl p-3.5 hover:border-slate-200 transition">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="font-bold text-slate-800 text-xs truncate max-w-[200px]" title={appt.treatment || 'Dental Procedure'}>
                                      {appt.treatment || 'Dental Procedure'}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                      <span>{billNo}</span>
                                      <span>•</span>
                                      <span>{appt.created_at ? new Date(appt.created_at).toLocaleDateString('en-IN') : 'Today'}</span>
                                    </p>
                                    <div className="flex gap-2.5 mt-2">
                                      <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-slate-100 rounded text-slate-500">
                                        {appt.payment_mode || 'Cash'}
                                      </span>
                                      {Number(appt.balance_amount) > 0 ? (
                                        <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-rose-50 text-rose-600 rounded border border-rose-100">
                                          PENDING DUE
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold uppercase py-0.5 px-2 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                                          PAID & CLOSED
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right space-y-1">
                                    <p className="text-xs text-slate-400">Received Amount</p>
                                    <p className="text-sm font-extrabold text-teal-600">₹{Number(appt.amount_paid || 0).toLocaleString('en-IN')}</p>
                                    {Number(appt.balance_amount) > 0 && (
                                      <p className="text-[11px] font-bold text-rose-500">Due: ₹{Number(appt.balance_amount).toLocaleString('en-IN')}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Actions Tray */}
                                <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-slate-50">
                                  <button
                                    onClick={() => printBill(appt)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-[11px] font-bold rounded-lg border border-slate-100 transition"
                                    title="Print Bill-Cum-Receipt on A4 Portrait"
                                  >
                                    <Printer size={12} /> Print Receipt
                                  </button>
                                  <button
                                    onClick={() => generatePDF(appt)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100/80 text-teal-700 hover:text-teal-800 text-[11px] font-bold rounded-lg border border-teal-100/50 transition"
                                    title="Download receipt as clean laser-ready PDF"
                                  >
                                    <Download size={12} /> Download PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestFeedback(selected)}
                                    disabled={sendingWhatsApp.feedback}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-850 text-[11px] font-bold rounded-lg border border-orange-150 transition disabled:opacity-50"
                                    title="Send Feedback WhatsApp invite"
                                  >
                                    {sendingWhatsApp.feedback ? (
                                      <>
                                        <svg className="animate-spin h-3 w-3 text-orange-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Logging...</span>
                                      </>
                                    ) : (
                                      <>⭐ Feedback</>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestGoogleReview(selected)}
                                    disabled={sendingWhatsApp.review}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-850 text-[11px] font-bold rounded-lg border border-indigo-150 transition disabled:opacity-50"
                                    title="Send Google Review WhatsApp invite"
                                  >
                                    {sendingWhatsApp.review ? (
                                      <>
                                        <svg className="animate-spin h-3 w-3 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Logging...</span>
                                      </>
                                    ) : (
                                      <>🌟 Review</>
                                    )}
                                  </button>
                                  {admin && (
                                    <button
                                      onClick={async () => {
                                        if (confirm("Are you sure you want to remove this billing record? This is an irreversible admin action.")) {
                                          await supabase.from('appointments').delete().eq('id', appt.id);
                                          // Reload data
                                          const apptRes = await supabase.from('appointments').select('*').eq('phone', selected.phone).order('created_at', { ascending: false });
                                          setPatientAppointments(apptRes.data || []);
                                        }
                                      }}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 rounded-lg transition"
                                      title="Delete bill record (Admin)"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Elegant itemized invoice generator interface */
                    <form onSubmit={handleGenerateBillSubmit} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Itemized Dental Billing Sheet</h4>
                          <p className="text-[10px] text-slate-400">Patient: {selected.name} ({selected.patient_code})</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGenerateBill(false)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Items loop */}
                      <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Clinic Procedures & Services</label>
                        {billForm.items.map((item, index) => {
                          const itemGross = Number(item.qty) * Number(item.rate);
                          const itemNet = itemGross - Number(item.discount || 0);

                          return (
                            <div key={index} className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm space-y-2 relative">
                              {billForm.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...billForm.items];
                                    updated.splice(index, 1);
                                    
                                    // re-estimate aggregates
                                    const grossTotal = updated.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)), 0);
                                    const discTotal = updated.reduce((sum, it) => sum + Number(it.discount || 0), 0) + Number(billForm.general_discount || 0);
                                    const netTotal = Math.max(0, grossTotal - discTotal);

                                    setBillForm({
                                      ...billForm,
                                      items: updated,
                                      amount_paid: String(netTotal)
                                    });
                                  }}
                                  className="absolute top-2.5 right-2.5 text-slate-400 hover:text-rose-500 transition"
                                  title="Delete item row"
                                >
                                  <X size={14} />
                                </button>
                              )}

                              <div className="grid grid-cols-12 gap-2 pt-1">
                                <div className="col-span-8">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Procedure Type</label>
                                  <select
                                    value={item.treatment_type}
                                    onChange={(e) => {
                                      const updated = [...billForm.items];
                                      updated[index].treatment_type = e.target.value;
                                      
                                      // Default rates matching treatment typologies
                                      let defaultRate = 250;
                                      if (e.target.value.includes('Scaling')) defaultRate = 1200;
                                      if (e.target.value.includes('Root Canal')) defaultRate = 4500;
                                      if (e.target.value.includes('Crowns')) defaultRate = 3500;
                                      if (e.target.value.includes('Composite')) defaultRate = 800;
                                      if (e.target.value.includes('Extraction')) defaultRate = 1000;
                                      if (e.target.value.includes('Implants')) defaultRate = 25000;
                                      if (e.target.value.includes('Orthodontic')) defaultRate = 35000;
                                      if (e.target.value.includes('Surgical')) defaultRate = 6000;
                                      
                                      updated[index].rate = defaultRate;
                                      
                                      // recompute totals
                                      const grossTotal = updated.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)), 0);
                                      const discTotal = updated.reduce((sum, it) => sum + Number(it.discount || 0), 0) + Number(billForm.general_discount || 0);
                                      const netTotal = Math.max(0, grossTotal - discTotal);

                                      setBillForm({
                                        ...billForm,
                                        items: updated,
                                        amount_paid: String(netTotal)
                                      });
                                    }}
                                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500"
                                  >
                                    <option value="Clinical Consultation">Clinical Consultation</option>
                                    <option value="Scaling & Polishing">Scaling & Polishing</option>
                                    <option value="Composite Fillings">Composite Fillings</option>
                                    <option value="Root Canal Treatment (RCT)">Root Canal Treatment (RCT)</option>
                                    <option value="Crowns & Bridges">Crowns & Bridges</option>
                                    <option value="Tooth Extraction">Tooth Extraction</option>
                                    <option value="Dental Implants">Dental Implants</option>
                                    <option value="Orthodontic Braces/Aligners">Orthodontic Braces/Aligners</option>
                                    <option value="Surgical Procedures">Surgical Procedures</option>
                                    <option value="Emergency Dental Care">Emergency Dental Care</option>
                                    <option value="Other Service">Other Service</option>
                                  </select>
                                </div>

                                <div className="col-span-4">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Rate (₹)</label>
                                  <input
                                    type="number"
                                    value={item.rate}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = [...billForm.items];
                                      updated[index].rate = val;

                                      const grossTotal = updated.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)), 0);
                                      const discTotal = updated.reduce((sum, it) => sum + Number(it.discount || 0), 0) + Number(billForm.general_discount || 0);
                                      const netTotal = Math.max(0, grossTotal - discTotal);

                                      setBillForm({
                                        ...billForm,
                                        items: updated,
                                        amount_paid: String(netTotal)
                                      });
                                    }}
                                    className="w-full text-xs font-mono px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-8">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Itemized Notes</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Upper molar single-visit restoration"
                                    value={item.notes}
                                    onChange={(e) => {
                                      const updated = [...billForm.items];
                                      updated[index].notes = e.target.value;
                                      setBillForm({ ...billForm, items: updated });
                                    }}
                                    className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-500"
                                  />
                                </div>

                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Qty</label>
                                  <input
                                    type="number"
                                    value={item.qty}
                                    min="1"
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = [...billForm.items];
                                      updated[index].qty = Math.max(1, val);

                                      const grossTotal = updated.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)), 0);
                                      const discTotal = updated.reduce((sum, it) => sum + Number(it.discount || 0), 0) + Number(billForm.general_discount || 0);
                                      const netTotal = Math.max(0, grossTotal - discTotal);

                                      setBillForm({
                                        ...billForm,
                                        items: updated,
                                        amount_paid: String(netTotal)
                                      });
                                    }}
                                    className="w-full text-xs font-mono px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center"
                                  />
                                </div>

                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Disc</label>
                                  <input
                                    type="number"
                                    value={item.discount}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = [...billForm.items];
                                      updated[index].discount = val;

                                      const grossTotal = updated.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)), 0);
                                      const discTotal = updated.reduce((sum, it) => sum + Number(it.discount || 0), 0) + Number(billForm.general_discount || 0);
                                      const netTotal = Math.max(0, grossTotal - discTotal);

                                      setBillForm({
                                        ...billForm,
                                        items: updated,
                                        amount_paid: String(netTotal)
                                      });
                                    }}
                                    className="w-full text-xs font-mono px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 font-mono">
                                <span>Gross: ₹{itemGross.toLocaleString('en-IN')}.00</span>
                                <span className="font-bold text-teal-700">Net: ₹{itemNet.toLocaleString('en-IN')}.00</span>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setBillForm({
                              ...billForm,
                              items: [...billForm.items, { treatment_type: 'Other Service', notes: '', qty: 1, rate: 500, discount: 0 }]
                            });
                          }}
                          className="w-full py-1.5 border border-dashed border-teal-300 hover:bg-teal-50/50 text-teal-700 hover:text-teal-800 text-xs font-bold rounded-lg transition"
                        >
                          + Add Another Dental Procedure
                        </button>
                      </div>

                      {/* General Aggregates */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100 mb-1">
                          <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider">Generated Receipt code</span>
                          <span className="text-xs font-mono font-extrabold text-teal-700">{billForm.invoice_no || 'GENERATING...'}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-505 uppercase block mb-0.5">Consultation Fee (₹)</label>
                            <input
                              type="number"
                              value={billForm.consultation_fee}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillForm(f => {
                                  const itemsT = f.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                                  const discSub = Number(f.discount_amount || f.general_discount) || 0;
                                  const sub = Math.max(0, (Number(val) || 0) + itemsT + (Number(f.lab_charges) || 0) + (Number(f.x_ray_charges) || 0) - discSub);
                                  const gstA = Math.round(sub * (Number(f.gst_percent) || 0) / 100);
                                  return {
                                    ...f,
                                    consultation_fee: val,
                                    amount_paid: String(sub + gstA)
                                  };
                                });
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-505 uppercase block mb-0.5">Lab Charges (₹)</label>
                            <input
                              type="number"
                              value={billForm.lab_charges}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillForm(f => {
                                  const itemsT = f.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                                  const discSub = Number(f.discount_amount || f.general_discount) || 0;
                                  const sub = Math.max(0, (Number(f.consultation_fee) || 0) + itemsT + (Number(val) || 0) + (Number(f.x_ray_charges) || 0) - discSub);
                                  const gstA = Math.round(sub * (Number(f.gst_percent) || 0) / 100);
                                  return {
                                    ...f,
                                    lab_charges: val,
                                    amount_paid: String(sub + gstA)
                                  };
                                });
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-550 uppercase block mb-0.5">X-Ray Charges (₹)</label>
                            <input
                              type="number"
                              value={billForm.x_ray_charges}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillForm(f => {
                                  const itemsT = f.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                                  const discSub = Number(f.discount_amount || f.general_discount) || 0;
                                  const sub = Math.max(0, (Number(f.consultation_fee) || 0) + itemsT + (Number(f.lab_charges) || 0) + (Number(val) || 0) - discSub);
                                  const gstA = Math.round(sub * (Number(f.gst_percent) || 0) / 100);
                                  return {
                                    ...f,
                                    x_ray_charges: val,
                                    amount_paid: String(sub + gstA)
                                  };
                                });
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-505 uppercase block mb-0.5">Discount Amount (₹)</label>
                            <input
                              type="number"
                              value={billForm.discount_amount || billForm.general_discount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillForm(f => {
                                  const itemsT = f.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                                  const sub = Math.max(0, (Number(f.consultation_fee) || 0) + itemsT + (Number(f.lab_charges) || 0) + (Number(f.x_ray_charges) || 0) - (Number(val) || 0));
                                  const gstA = Math.round(sub * (Number(f.gst_percent) || 0) / 100);
                                  return {
                                    ...f,
                                    discount_amount: val,
                                    general_discount: val,
                                    amount_paid: String(sub + gstA)
                                  };
                                });
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-teal-700 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-550 uppercase block mb-0.5">GST Rate (%)</label>
                            <select
                              value={billForm.gst_percent}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillForm(f => {
                                  const itemsT = f.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                                  const discSub = Number(f.discount_amount || f.general_discount) || 0;
                                  const sub = Math.max(0, (Number(f.consultation_fee) || 0) + itemsT + (Number(f.lab_charges) || 0) + (Number(f.x_ray_charges) || 0) - discSub);
                                  const gstA = Math.round(sub * (Number(val) || 0) / 100);
                                  return {
                                    ...f,
                                    gst_percent: val,
                                    amount_paid: String(sub + gstA)
                                  };
                                });
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                            >
                              <option value="0">0% (Dental Exempt)</option>
                              <option value="5">5% (Dental Consumables)</option>
                              <option value="12">12% (Clinical Diagnostics)</option>
                              <option value="18">18% (Standard Healthcare GST)</option>
                            </select>
                          </div>

                          <div className="max-sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-550 uppercase block mb-0.5">Advance Payment (₹)</label>
                            <input
                              type="number"
                              value={billForm.amount_paid}
                              onChange={(e) => {
                                setBillForm(f => ({
                                  ...f,
                                  amount_paid: e.target.value
                                }));
                              }}
                              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-emerald-700 font-extrabold"
                            />
                          </div>
                        </div>

                        {/* Calculations summary breakdown display */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-800 font-semibold font-mono">
                          {(() => {
                            const conFee = Number(billForm.consultation_fee) || 0;
                            const itemsT = billForm.items.reduce((sum, it) => sum + (Number(it.qty) * Number(it.rate)) - Number(it.discount || 0), 0);
                            const labChg = Number(billForm.lab_charges) || 0;
                            const xrayChg = Number(billForm.x_ray_charges) || 0;
                            const discSub = Number(billForm.discount_amount || billForm.general_discount) || 0;

                            const subtotal = Math.max(0, conFee + itemsT + labChg + xrayChg - discSub);
                            const gstPct = Number(billForm.gst_percent) || 0;
                            const gstAmt = Math.round(subtotal * (gstPct / 100));
                            const totalAmount = subtotal + gstAmt;
                            const paidAmt = Number(billForm.amount_paid || 0);
                            const balanceDue = Math.max(0, totalAmount - paidAmt);

                            return (
                              <>
                                <div className="space-y-0.5 text-[11px]">
                                  <p className="text-slate-500">Gross Subtotal: ₹{subtotal.toLocaleString('en-IN')}</p>
                                  <p className="text-slate-500">GST ({gstPct}%): ₹{gstAmt.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="text-right space-y-1">
                                  <p className="text-teal-700 font-extrabold text-[13px]">Total Payable: ₹{totalAmount.toLocaleString('en-IN')}</p>
                                  {balanceDue > 0 ? (
                                    <p className="text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded inline-block text-[11px]">Final Balance: ₹{balanceDue.toLocaleString('en-IN')}</p>
                                  ) : (
                                    <p className="text-emerald-600 font-bold uppercase text-[9px] tracking-wider animate-pulse">Fully Cleared</p>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Payment mode, practitioner name */}
                      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode</label>
                          <select
                            value={billForm.payment_mode}
                            onChange={(e) => setBillForm({ ...billForm, payment_mode: e.target.value })}
                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI / GPay</option>
                            <option value="Card">Credit/Debit Card</option>
                            <option value="Net Banking">Net Banking</option>
                            <option value="EMI">EMI Plan</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <DoctorSelect
                            selectedName={billForm.doctor_name}
                            required
                            label="Doctor / Consultant"
                            onChange={(doc) => setBillForm({ ...billForm, doctor_name: doc.name })}
                          />
                        </div>
                      </div>

                      {/* Notes / Instructions Remarks Section */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Clinical Notes & Remarks</label>
                        <div>
                          <label className="text-[9px] text-slate-400 font-medium block">Diagnoses & Doctor Notes</label>
                          <input
                            type="text"
                            value={billForm.doctor_notes}
                            onChange={(e) => setBillForm({ ...billForm, doctor_notes: e.target.value })}
                            placeholder="e.g. Scaling treatment completed. Soft tissues appear intact."
                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-400 font-medium block">Instructions</label>
                            <input
                              type="text"
                              value={billForm.instructions}
                              onChange={(e) => setBillForm({ ...billForm, instructions: e.target.value })}
                              placeholder="e.g. Refrain from hot drinks for 2h"
                              className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 font-medium block">Next Follow-up Date</label>
                            <input
                              type="date"
                              value={billForm.follow_up_date}
                              onChange={(e) => setBillForm({ ...billForm, follow_up_date: e.target.value })}
                              className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer submit */}
                      <div className="flex gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowGenerateBill(false)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition"
                        >
                          Back to List
                        </button>
                        <button
                          type="submit"
                          disabled={savingBill}
                          className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {savingBill ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Printer size={13} />
                              <span>Save & Print Receipt</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3 border-t flex flex-col gap-2 flex-shrink-0 bg-slate-50/50">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full">
                <button
                  onClick={() => sendWhatsApp(selected.phone, selected.name)}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm transition"
                >
                  <MessageCircle size={16} /> Send Reminder
                </button>
                <button
                  onClick={() => setLocation('/crm/appointments')}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs sm:text-sm transition"
                >
                  <Calendar size={16} /> Add Appointment
                </button>
                <button
                  onClick={() => {
                    setActiveTab('billing');
                    setBillForm({
                      items: [
                        { treatment_type: 'Clinical Consultation', notes: 'Initial Oral Examination', qty: 1, rate: 250, discount: 0 }
                      ],
                      amount_paid: '250',
                      general_discount: '0',
                      payment_mode: 'Cash',
                      doctor_notes: 'Initial check-up completed.',
                      follow_up_date: '',
                      instructions: 'Avoid eating hard foods for 2 hours.',
                      doctor_name: doctors[0]?.name || 'Dr. Sri Chaitanya'
                    });
                    setShowGenerateBill(true);
                  }}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-700 border border-amber-200 font-semibold text-xs sm:text-sm transition"
                >
                  <FileText size={16} /> Generate Bill
                </button>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRequestFeedback(selected)}
                  disabled={sendingWhatsApp.feedback}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-50 hover:bg-orange-100/90 text-orange-700 hover:text-orange-800 border border-orange-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Request Feedback from Patient"
                >
                  {sendingWhatsApp.feedback ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-orange-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Logging...</span>
                    </>
                  ) : (
                    <span>Request Feedback ⭐</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestGoogleReview(selected)}
                  disabled={sendingWhatsApp.review}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 hover:text-indigo-800 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Request Google Star Review via WhatsApp"
                >
                  {sendingWhatsApp.review ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Logging...</span>
                    </>
                  ) : (
                    <span>Request Google Review 🌟</span>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions Floating Button Menu */}
            <div className="absolute bottom-16 right-6 z-40 flex flex-col items-end">
              {showQuickActions && (
                <div className="mb-3 bg-white border border-slate-205 shadow-xl rounded-2xl p-3 w-56 flex flex-col gap-1 text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 pb-1.5 border-b border-slate-100">
                    Patient Quick Actions
                  </div>
                  
                  {/* Action 1: Add New Appointment */}
                  <button
                    onClick={() => {
                      setActiveTab('appointments');
                      setInlineAction('book_appointment');
                      setApptForm({
                        treatment: 'Consultation',
                        date: new Date().toISOString().split('T')[0],
                        time: '10:00',
                        doctorId: doctors[0]?.id?.toString() || '1',
                        doctorName: doctors[0]?.name || 'Dr. Sri Chaitanya',
                        notes: '',
                        isHistorical: false
                      });
                      setShowQuickActions(false);
                      notify('info', 'Appointment Form Ready', 'Please complete appointment details below.');
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Calendar size={13} />
                    </div>
                    <span>Add New Appointment</span>
                  </button>

                  {/* Action 2: Log Payment */}
                  <button
                    onClick={() => {
                      setActiveTab('billing');
                      setBillForm({
                        items: [
                          { treatment_type: 'Clinical Consultation', notes: 'Initial Oral Examination', qty: 1, rate: 250, discount: 0 }
                        ],
                        amount_paid: '250',
                        general_discount: '0',
                        payment_mode: 'Cash',
                        doctor_notes: 'Initial check-up completed.',
                        follow_up_date: '',
                        instructions: 'Avoid eating hard foods for 2 hours.',
                        doctor_name: doctors[0]?.name || 'Dr. Sri Chaitanya'
                      });
                      setShowGenerateBill(true);
                      setShowQuickActions(false);
                      notify('info', 'Billing Sheet Triggered', 'Create and log professional invoice below.');
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                      <DollarSign size={13} />
                    </div>
                    <span>Log Payment</span>
                  </button>

                  {/* Action 3: Send WhatsApp Follow-up */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowWhatsAppMenu(!showWhatsAppMenu);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors text-left font-sans"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                          <MessageCircle size={13} />
                        </div>
                        <span>Send WhatsApp Follow-up</span>
                      </div>
                      <span className="text-[9px] text-slate-400">{showWhatsAppMenu ? '▲' : '▶'}</span>
                    </button>
                    
                    {showWhatsAppMenu && (
                      <div className="mt-1 bg-slate-50 border border-slate-150 rounded-xl p-1.5 space-y-1 z-50">
                        {/* Option A: Follow up Reminder */}
                        <button
                          onClick={() => {
                            const msg = followupMessage({
                              name: selected.name,
                              treatment: 'Routine Follow-up',
                              followup_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                              notes: 'Kindly schedule your follow-up checkup.'
                            });
                            openWhatsApp(selected.phone, msg);
                            setShowQuickActions(false);
                            setShowWhatsAppMenu(false);
                            notify('success', 'WhatsApp Prefilled', 'Follow-up template opened.');
                          }}
                          className="w-full text-left px-2 py-1 hover:bg-white hover:shadow-2xs rounded-lg text-[10px] font-semibold text-slate-600 flex items-center gap-1.5 font-sans"
                        >
                          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                          <span>Clinical Follow-up</span>
                        </button>

                        {/* Option B: Appt Confirmation */}
                        <button
                          onClick={() => {
                            const msg = appointmentConfirmationMessage({
                              name: selected.name,
                              next_visit: new Date().toISOString().split('T')[0],
                              appointment_time: '10:00 AM',
                              treatment: 'Dental Consultation'
                            });
                            openWhatsApp(selected.phone, msg);
                            setShowQuickActions(false);
                            setShowWhatsAppMenu(false);
                            notify('success', 'WhatsApp Prefilled', 'Confirmation template opened.');
                          }}
                          className="w-full text-left px-2 py-1 hover:bg-white hover:shadow-2xs rounded-lg text-[10px] font-semibold text-slate-600 flex items-center gap-1.5 font-sans"
                        >
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                          <span>Appt Confirmation</span>
                        </button>

                        {/* Option C: Payment Request */}
                        <button
                          onClick={() => {
                            const pendingBal = patientAppointments.reduce((sum, a) => sum + (Number(a.balance_amount) || 0), 0);
                            const msg = paymentReminderMessage({
                              name: selected.name,
                              balance_amount: pendingBal || 250,
                              treatment: 'Dental Care Procedures'
                            });
                            openWhatsApp(selected.phone, msg);
                            setShowQuickActions(false);
                            setShowWhatsAppMenu(false);
                            notify('success', 'WhatsApp Prefilled', 'Balance reminder opened.');
                          }}
                          className="w-full text-left px-2 py-1 hover:bg-white hover:shadow-2xs rounded-lg text-[10px] font-semibold text-slate-600 flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                          <span>Balance Reminder</span>
                        </button>

                        {/* Option D: Thank you */}
                        <button
                          onClick={() => {
                            const msg = thankYouMessage({
                              name: selected.name,
                              treatment: 'Consultation'
                            });
                            openWhatsApp(selected.phone, msg);
                            setShowQuickActions(false);
                            setShowWhatsAppMenu(false);
                            notify('success', 'WhatsApp Prefilled', 'Thank you greeting opened.');
                          }}
                          className="w-full text-left px-2 py-1 hover:bg-white hover:shadow-2xs rounded-lg text-[10px] font-semibold text-slate-600 flex items-center gap-1.5 font-sans"
                        >
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                          <span>Post-Visit Thank You</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Main Floating Button */}
              <button
                type="button"
                onClick={() => {
                  setShowQuickActions(!showQuickActions);
                  if (showQuickActions) setShowWhatsAppMenu(false);
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer ${showQuickActions ? 'bg-slate-800 rotate-45 animate-none' : 'bg-teal-600 hover:bg-teal-700 animate-pulse'}`}
                title="Open Quick Actions Desk"
              >
                {showQuickActions ? <X size={20} /> : <Activity size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScanSuccess}
      />

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Add New Patient</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            {duplicateFoundPatient ? (
              <div className="p-5 space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" size={20} />
                  <div>
                    <h4 className="font-bold text-sm text-amber-800">Possible duplicate patient found</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      A patient named <strong className="font-semibold">"{duplicateFoundPatient.name}"</strong> already exists with the contact info <strong className="font-semibold">{duplicateFoundPatient.phone || duplicateFoundPatient.email}</strong> (Code: <code className="bg-amber-100 px-1 py-0.5 rounded text-[10.5px] font-mono">{duplicateFoundPatient.patient_code}</code>).
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      openPatientProfile(duplicateFoundPatient);
                      setShowAddModal(false);
                      setDuplicateFoundPatient(null);
                      setBypassNamePhoneDuplicate(false);
                      setForm({ name: '', phone: '', email: '', location: '', age: '', gender: '', notes: '', dob: '' });
                    }}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck size={16} /> Open Existing Patient
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setBypassNamePhoneDuplicate(true);
                      savePatient(null as any, true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={16} /> Create New Patient Anyway
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateFoundPatient(null);
                      setBypassNamePhoneDuplicate(false);
                    }}
                    className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold text-sm transition flex items-center justify-center cursor-pointer"
                  >
                    Back to Edit Form
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={savePatient} className="p-5 space-y-3">
                {[
                  { key: 'name', label: 'Full Name', required: true, type: 'text' },
                  { key: 'phone', label: 'Phone Number', required: true, type: 'text' },
                  { key: 'email', label: 'Email', required: false, type: 'text' },
                  { key: 'location', label: 'Location', required: false, type: 'text' },
                ].map(({ key, label, required, type }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">
                      {label}{required && ' *'}
                    </label>
                    <input
                      value={(form as any)[key]}
                      onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      required={required}
                      type={type}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob || ''}
                    onChange={(e) => {
                      const dobVal = e.target.value;
                      const calculated = dobVal ? calculateAge(dobVal) : '';
                      setForm(f => ({ ...f, dob: dobVal, age: calculated }));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Age (Calculated)</label>
                  <input
                    type="text"
                    value={form.age}
                    placeholder="Calculated automatically from Date of Birth"
                    onChange={(e) => setForm(f => ({ ...f, age: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition disabled:opacity-60 shadow-sm"
                >
                  {saving ? 'Saving…' : 'Add Patient'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Patient Summary Modal */}
      {showSummaryModal && summaryPatient && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-5 flex items-center justify-between text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-lg">
                  {summaryPatient.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base">{summaryPatient.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-teal-100">
                    <span className="font-mono">{summaryPatient.patient_code}</span>
                    <span>•</span>
                    <span>{summaryPatient.phone}</span>
                    {summaryPatient.age && (
                      <>
                        <span>•</span>
                        <span>{summaryPatient.age} yrs / {summaryPatient.gender || 'Unknown'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {loadingSummary ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto animate-spin" />
                  <p className="text-slate-400 text-xs mt-3">Loading electronic history summaries...</p>
                </div>
              ) : (
                <>
                  {/* Cards metric row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                        <Calendar size={13} className="text-teal-500" />
                        <span>APPOINTMENTS</span>
                      </div>
                      <p className="text-xl font-extrabold text-slate-800">{summaryAppointments.length}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                        <Stethoscope size={13} className="text-teal-500" />
                        <span>TREATMENTS</span>
                      </div>
                      <p className="text-xl font-extrabold text-slate-800">{summaryTreatments.length}</p>
                    </div>

                    {/* Pending Balance Card */}
                    {(() => {
                      const totalPending = summaryAppointments.reduce((sum, app) => sum + (Number(app.balance_amount) || 0), 0);
                      const isDue = totalPending > 0;
                      return (
                        <div className={`p-4 rounded-xl border ${isDue ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/45 border-emerald-100'}`}>
                          <div className={`flex items-center gap-2 text-xs font-semibold mb-1 ${isDue ? 'text-rose-500' : 'text-emerald-600'}`}>
                            <DollarSign size={13} />
                            <span>PENDING DUE</span>
                          </div>
                          <p className={`text-xl font-extrabold font-mono ${isDue ? 'text-rose-600' : 'text-emerald-700'}`}>
                            ₹{totalPending.toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Two Column Layout for Treatments and Appointments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Appointments list */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                        <Calendar size={14} className="text-teal-600" /> Appointments History
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {summaryAppointments.length === 0 ? (
                          <p className="text-slate-400 text-xs italic py-4 text-center">No appointment logs reported</p>
                        ) : (
                          summaryAppointments.slice(0, 6).map(app => (
                            <div key={app.id} className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 rounded-lg p-2.5 transition">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <p className="text-xs font-bold text-slate-700">{app.treatment}</p>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {app.next_visit} at {app.appointment_time || 'No specified time'}
                                  </p>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-md ${
                                  app.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                  app.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                                  app.status === 'Confirmed' ? 'bg-blue-100 text-blue-850' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {app.status}
                                </span>
                              </div>
                              {app.notes && (
                                <p className="text-[10px] text-slate-500 italic mt-1.5 bg-white p-1 rounded border border-slate-50 line-clamp-2">
                                  "{app.notes}"
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Treatments list */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                        <Stethoscope size={14} className="text-teal-600" /> Treatments History
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {summaryTreatments.length === 0 ? (
                          <p className="text-slate-400 text-xs italic py-4 text-center">No active or historic treatment plans</p>
                        ) : (
                          summaryTreatments.slice(0, 6).map(treat => (
                            <div key={treat.id} className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 rounded-lg p-2.5 transition">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <p className="text-xs font-bold text-slate-700">{treat.treatment_type}</p>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    Started {treat.start_date} • {treat.sessions_done || 0}/{treat.total_sessions || '∞'} sessions
                                  </p>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 font-bold rounded-md ${
                                  treat.stage === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                  treat.stage === 'In Progress' || treat.stage === 'Treatment Started' ? 'bg-blue-105 text-blue-850' :
                                  'bg-slate-105 text-slate-700'
                                }`}>
                                  {treat.stage}
                                </span>
                              </div>
                              {treat.treatment_notes && (
                                <p className="text-[10px] text-slate-500 italic mt-1.5 bg-white p-1 rounded border border-slate-50 line-clamp-2">
                                  "{treat.treatment_notes}"
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  openPatientProfile(summaryPatient);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition animate-pulse"
              >
                <Eye size={14} /> Open Full Demographics Profile <ArrowRight size={12} className="text-teal-600" />
              </button>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar for Bulk Activities */}
      {selectedPatientIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[49] w-[95%] max-w-lg bg-slate-900 border border-slate-800 text-white px-5 py-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 animate-slideIn">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-450 bg-indigo-400 animate-pulse" />
            <div>
              <p className="text-xs font-black">Patient Selection Buffer</p>
              <p className="text-[10px] text-indigo-200 mt-0.5 font-bold">
                {selectedPatientIds.length} {selectedPatientIds.length === 1 ? 'Patient' : 'Patients'} selected for mass notification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSelectedPatientIds([])}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-350 hover:bg-slate-800 hover:text-white text-[11px] font-black cursor-pointer transition uppercase tracking-wider"
            >
              Clear
            </button>
            <button
              onClick={() => {
                const templates = getSMSTemplates();
                setBulkSMSMessage(templates.general);
                setShowBulkSMSModal(true);
              }}
              className="flex items-center gap-1.5 px-4.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black cursor-pointer transition shadow-md uppercase tracking-wider"
            >
              <MessageSquare size={13} />
              <span>Send Bulk SMS</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk SMS Campaign Composer MODAL */}
      {showBulkSMSModal && (
        <div id="bulk-sms-campaign-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-xl w-full overflow-hidden animate-zoomIn flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm leading-tight text-left">SCDC Campaign & WhatsApp Dispatcher</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5 font-sans uppercase tracking-wide text-left">Automated Broadcast Center</p>
                </div>
              </div>
              <button 
                onClick={() => !isSendingBulkSMS && setShowBulkSMSModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                disabled={isSendingBulkSMS}
              >
                <X size={15} />
              </button>
            </div>

            {/* Campaign Navigation Tabs inside Modal */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 py-1 select-none">
              <button
                onClick={() => setCampaignTab('compose')}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
                  campaignTab === 'compose' 
                    ? 'border-indigo-600 text-indigo-650' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Compose Campaign
              </button>
              <button
                onClick={() => setCampaignTab('history')}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
                  campaignTab === 'history' 
                    ? 'border-indigo-600 text-indigo-650' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Delivery Logs & Failures
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              
              {campaignTab === 'compose' ? (
                <>
                  {/* Duplicate warning alert */}
                  {(() => {
                    const logs = getCampaignLogs();
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const duplicateCount = patients
                      .filter(p => selectedPatientIds.includes(p.id))
                      .filter(p => logs.some(l => l.phone === p.phone && l.timestamp > oneDayAgo && l.status === 'Sent')).length;
                    
                    if (duplicateCount > 0) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] p-3 rounded-2xl font-bold flex items-start gap-2">
                          <span className="text-amber-600 text-xs mt-0.5">⚠️</span>
                          <span>
                            Caution: {duplicateCount} selected patient(s) received notifications in the last 24h. The engine will skip them to prevent spamming.
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Broadcast Target List */}
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Selected Targets ({selectedPatientIds.length})</span>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                      {patients
                        .filter(p => selectedPatientIds.includes(p.id))
                        .map(p => (
                          <span key={p.id} className="text-[9.5px] bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-lg font-bold">
                            {p.name}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Template selector buttons block */}
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-black uppercase text-slate-550">Category Templates Quick Load</label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50/50 border border-slate-100 rounded-xl">
                      {Object.entries(WHATSAPP_TEMPLATES).map(([key, t]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedTemplate(key);
                            setBulkSMSMessage(t.text);
                            setPreviewRecipIndex(0);
                          }}
                          className={`px-2 py-1 text-[9.5px] font-bold rounded-lg border text-center transition cursor-pointer truncate ${
                            selectedTemplate === key
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message body textbox */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-left select-none">
                      <span className="text-xs font-black text-slate-700">Write Broadcast Blueprint</span>
                      <span className="text-[9px] text-slate-450 font-bold">Click dynamic token to insert:</span>
                    </div>

                    {/* Variable Injection Quick chips */}
                    <div className="flex flex-wrap gap-1 mb-1.5 select-none">
                      {['[Name]', '[Doctor]', '[Treatment]', '[Date]', '[Time]', '[Balance]', '[Message]'].map(token => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => setBulkSMSMessage(prev => prev + token)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded text-[9px] font-mono font-bold text-slate-600 transition cursor-pointer"
                        >
                          + {token}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={bulkSMSMessage}
                      onChange={(e) => setBulkSMSMessage(e.target.value)}
                      disabled={isSendingBulkSMS}
                      rows={4}
                      className="w-full p-3 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none leading-relaxed text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="Draft personalized notification blueprints here..."
                    />

                    {/* Character segments */}
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 font-bold">
                      <span>Total Blueprint length: {bulkSMSMessage.length} indices</span>
                      <span>Estimated fragments: {Math.ceil(bulkSMSMessage.length / 160)} SMS</span>
                    </div>
                  </div>

                  {/* Personalized Recipient Demonstration / Previewer */}
                  {selectedPatientIds.length > 0 && (
                    <div className="bg-emerald-50/45 border border-emerald-100 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black text-emerald-800 uppercase tracking-wider">Dynamic Preview (Recipient Demonstration)</span>
                        
                        {/* Pagination Selector */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={previewRecipIndex === 0}
                            onClick={() => setPreviewRecipIndex(prev => prev - 1)}
                            className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-[10px] font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                          >
                            ← Prev
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {previewRecipIndex + 1} / {selectedPatientIds.length}
                          </span>
                          <button
                            type="button"
                            disabled={previewRecipIndex >= selectedPatientIds.length - 1}
                            onClick={() => setPreviewRecipIndex(prev => prev + 1)}
                            className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-[10px] font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      {/* Render demonstrator */}
                      {(() => {
                        const recips = patients.filter(p => selectedPatientIds.includes(p.id));
                        const currentRecip = recips[previewRecipIndex];
                        if (!currentRecip) return null;
                        return (
                          <div className="space-y-1.5 text-left">
                            <p className="text-[9px] text-slate-450 font-bold">
                              Renders for : <strong className="text-slate-700">{currentRecip.name}</strong> • Phone: <span className="font-mono">{currentRecip.phone}</span>
                            </p>
                            <p className="text-xs text-slate-750 font-semibold leading-relaxed p-3 bg-white border border-emerald-100/50 rounded-xl italic">
                              "{getReplacedTokenMessage(bulkSMSMessage, currentRecip)}"
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Scheduled Delivery Section */}
                  <div className="p-3 bg-slate-50/80 border border-slate-150 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="mass-schedule-toggle"
                          checked={scheduleLater}
                          onChange={(e) => setScheduleLater(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                        />
                        <label htmlFor="mass-schedule-toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          Schedule Broadcast For Later
                        </label>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded-md ${scheduleLater ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-550'}`}>
                        {scheduleLater ? 'Delayed Delivery Active' : 'Dispatch immediately'}
                      </span>
                    </div>

                    {scheduleLater && (
                      <div className="flex items-center gap-3 animate-fade-in pt-1.5 border-t border-slate-150">
                        <span className="text-[10px] text-slate-500 font-bold shrink-0">Release Timestamp:</span>
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550 focus:border-indigo-400 font-sans cursor-pointer bg-white"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Sending status progress bar */}
                  {isSendingBulkSMS && (
                    <div className="space-y-2 pt-2 border-t border-slate-50 animate-pulse text-left">
                      <div className="flex justify-between text-xs font-bold text-indigo-700">
                        <span>Delivering medical broadcasts...</span>
                        <span>{bulkSMSSemaphore.current} / {bulkSMSSemaphore.total}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-indigo-600 transition-all duration-300"
                          style={{ width: `${(bulkSMSSemaphore.current / bulkSMSSemaphore.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* DELIVERY LOGS AND RETRY TAB CONTROL */
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150 select-none">
                    <span className="text-[10px] text-slate-500 font-bold">HISTORIC MASS BROADCAST ARCHIVES</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Clear local broadcast delivery cache?')) {
                          localStorage.removeItem('whatsapp_messages_logs');
                          notify('success', 'Logs Cleared', 'Message log history cleared.');
                        }
                      }}
                      className="text-[9.5px] text-[#2F63E0] hover:underline font-black cursor-pointer"
                    >
                      Clear Log Cache
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {getCampaignLogs().length === 0 ? (
                      <p className="text-center text-slate-400 italic text-xs py-8">No previous campaigns reported</p>
                    ) : (
                      getCampaignLogs().map((log) => (
                        <div key={log.id} className="bg-slate-50/55 hover:bg-slate-50 p-3 rounded-2xl border border-slate-150 transition text-left flex flex-col gap-1.5">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="text-xs font-extrabold text-slate-700">{log.patient_name}</p>
                              <p className="text-[9.5px] text-slate-400 font-medium mt-0.5">Phone: <span className="font-mono">{log.phone}</span></p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-[9px] px-1.5 py-0.5 font-black rounded-lg uppercase tracking-wider ${
                                log.status === 'Sent' ? 'bg-emerald-100 text-emerald-800' :
                                log.status === 'Scheduled' ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800 shadow-sm'
                              }`}>
                                {log.status}
                              </span>
                              <span className="text-[8.5px] font-mono text-slate-400 font-bold">
                                {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-[10.5px] text-slate-600 italic leading-relaxed bg-white/70 border p-2 rounded-xl">
                            "{log.message}"
                          </p>

                          {log.status === 'Failed' && (
                            <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 text-[10px] bg-rose-50/50 p-2 rounded-lg">
                              <span className="text-rose-600 font-bold">Error: {log.error_message || 'Timeout'}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  notify('success', 'Retry Initiated', `Retrying delivery to ${log.patient_name}...`);
                                  try {
                                    const res = await sendSMS({
                                      name: log.patient_name,
                                      phone: log.phone,
                                      message: log.message
                                    });
                                    if (res.success) {
                                      notify('success', 'Retry Success', 'Broadcast delivered successfully.');
                                      log.status = 'Sent';
                                      log.timestamp = new Date().toISOString();
                                      saveCampaignLog(log);
                                    } else {
                                      notify('error', 'Retry Failed', res.error || 'Server rejected request');
                                    }
                                  } catch (err: any) {
                                    notify('error', 'Retry Error', err.message);
                                  }
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold"
                              >
                                Retry Now
                              </button>
                            </div>
                          )}

                          {log.status === 'Scheduled' && (
                            <p className="text-[9.5px] text-amber-600 font-bold">
                              queued for: {new Date(log.scheduled_at || '').toLocaleDateString('en-IN')} {new Date(log.scheduled_at || '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowBulkSMSModal(false)}
                disabled={isSendingBulkSMS}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              
              {campaignTab === 'compose' && (
                <button
                  onClick={handleBulkSMSSend}
                  disabled={isSendingBulkSMS || !bulkSMSMessage.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md disabled:bg-indigo-400 disabled:cursor-not-allowed uppercase tracking-wide"
                >
                  {isSendingBulkSMS ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Broadcasting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>{scheduleLater ? 'Schedule Broadcast' : 'Launch Broadcast'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
