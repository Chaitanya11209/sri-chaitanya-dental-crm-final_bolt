/**
 * SRI CHAITANYA DENTAL CARE — WHATSAPP NOTIFICATION ENGINE
 * Handles generating and sending formatted notifications to both patients and doctors.
 */

import { CLINIC_SIGNATURE, extractPatientFromMessage } from '../utils/whatsapp';
import { supabase } from './supabase';

export interface WhatsAppNotificationParams {
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorPhone?: string;
  date: string;
  time: string;
  treatment: string;
  status: string;
}

export interface DispatchStatus {
  patientUrl: string;
  doctorUrl: string;
  sentAutomatically: boolean;
  error?: string;
}

export interface MessageStatusIndicator {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}

/**
 * Returns a color-coded status indicator and icon for different WhatsApp message types to improve visual tracking.
 */
export function getWhatsAppMessageTypeIndicator(type: string): MessageStatusIndicator {
  const t = type ? type.toLowerCase() : '';
  
  if (t.includes('confirm') || t.includes('scheduled') || t.includes('schedule')) {
    // Green for confirmations & bookings
    return {
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-200',
      icon: '✅'
    };
  }
  
  if (t.includes('reminder') || t.includes('1-hour') || t.includes('follow-up') || t.includes('queue')) {
    // Blue for reminders & patient waiting queue updates
    return {
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
      icon: '⏰'
    };
  }
  
  if (t.includes('bulk') || t.includes('campaign') || t.includes('broadcast')) {
    // Amber for campaign and bulk alerts
    return {
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
      icon: '📢'
    };
  }
  
  if (t.includes('google') || t.includes('review') || t.includes('survey')) {
    // Purple/Indigo for review requests or patient feedback surveys
    return {
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200',
      icon: '⭐'
    };
  }
  
  // Default/Fallback — Slate styling
  return {
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    icon: '💬'
  };
}

/**
 * Standardize phone number for WhatsApp API
 */
export function formatWhatsAppPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `91${clean}`; // Default to Indian country code
  }
  return clean;
}

/**
 * Constructs the beautifully formatted notification message as requested:
 */
export function constructWhatsAppMessage({
  patientName,
  doctorName,
  date,
  time,
  status
}: WhatsAppNotificationParams): string {
  const heading = status === 'Rescheduled' ? 'Appointment Rescheduled' : 'Appointment Confirmed';
  return `${heading}

Patient: ${patientName}
Doctor: ${doctorName}
Date: ${date}
Time: ${time || '6:00 PM'}

${CLINIC_SIGNATURE}`;
}

export interface WhatsAppLog {
  id: string;
  recipientName: string;
  recipientPhone: string;
  role: 'Patient' | 'Doctor';
  type: string; // Confirmation, Reschedule, 1-Hour Reminder
  status: 'Sent' | 'Failed' | 'Pending';
  message: string;
  timestamp: string;
}

export function getWhatsAppLogs(): WhatsAppLog[] {
  try {
    const raw = localStorage.getItem('whatsapp_delivery_logs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function logWhatsAppDelivery(
  recipientName: string,
  recipientPhone: string,
  role: 'Patient' | 'Doctor',
  type: string,
  status: 'Sent' | 'Failed',
  message: string,
  patientId?: number | null,
  appointmentId?: number | null
) {
  try {
    const logs = getWhatsAppLogs();
    const newLog: WhatsAppLog = {
      id: 'WAL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      recipientName,
      recipientPhone,
      role,
      type,
      status,
      message,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    localStorage.setItem('whatsapp_delivery_logs', JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save to local storage cache:', e);
  }

  try {
    let resolvedPatientId = patientId ? Number(patientId) : null;
    let resolvedAppointmentId = appointmentId ? Number(appointmentId) : null;

    if (role !== 'Doctor' && !resolvedPatientId) {
      const cleanPhone = recipientPhone.replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);

      if (last10) {
        const { data: matchedPatients } = await supabase
          .from('patients')
          .select('id')
          .or(`phone.ilike.%${last10}%,name.ilike.%${recipientName}%`)
          .limit(1);

        if (matchedPatients && matchedPatients.length > 0) {
          resolvedPatientId = Number(matchedPatients[0].id);
        }
      }
    }

    // Validate patient_id before insert unless it's a notification specifically to a Dentist
    if (role !== 'Doctor' && !resolvedPatientId) {
      console.warn(`[logWhatsAppDelivery] Skipping remote table insert as no patient record could be validated for ${recipientName} (${recipientPhone}).`);
      return;
    }

    const payload: any = {
      phone: recipientPhone,
      message: message,
      status: status || 'Sent',
      sent_at: new Date().toISOString()
    };

    if (resolvedPatientId) {
      payload.patient_id = resolvedPatientId;
    }
    if (resolvedAppointmentId) {
      payload.appointment_id = resolvedAppointmentId;
    }

    const { error } = await supabase.from('whatsapp_messages').insert(payload);
    if (error) {
      console.error('[logWhatsAppDelivery] Supabase audit insert failed:', error);
    } else {
      console.log('[logWhatsAppDelivery] Audit row recorded in whatsapp_messages:', payload);
    }
  } catch (err) {
    console.error('[logWhatsAppDelivery] Failed to write notification log to database:', err);
  }
}

/**
 * Dispatches WhatsApp Notification
 * Option A: Returns direct Click-To-Chat links for Patient and Doctor.
 * Option B: Automatically dispatches via Twilio WhatsApp API if environment secrets exist.
 */
export async function sendWhatsAppNotification(params: WhatsAppNotificationParams): Promise<DispatchStatus> {
  const messageText = constructWhatsAppMessage(params);
  
  const formattedPatientPhone = formatWhatsAppPhone(params.patientPhone);
  const formattedDoctorPhone = params.doctorPhone ? formatWhatsAppPhone(params.doctorPhone) : '918317575165'; // Fallback to Chief Dentist phone

  const patientUrl = `https://wa.me/${formattedPatientPhone}?text=${encodeURIComponent(messageText)}`;
  const doctorUrl = `https://wa.me/${formattedDoctorPhone}?text=${encodeURIComponent(messageText)}`;

  // Option B: Auto-Dispatch via Twilio WhatsApp API if variables are present
  const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const twilioWhatsAppNumber = import.meta.env.VITE_TWILIO_WHATSAPP_NUMBER; // e.g. 'whatsapp:+14155238886'

  let sentAutomatically = false;
  let apiError: string | undefined;

  if (twilioSid && twilioAuthToken && twilioWhatsAppNumber) {
    try {
      console.log(`[WHATSAPP-API] Automatic Twilio dispatch initiated...`);
      
      // Send to Patient
      const patientRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `whatsapp:+${formattedPatientPhone}`,
            From: twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`,
            Body: messageText,
          }),
        }
      );

      // Send to Doctor
      const doctorRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `whatsapp:+${formattedDoctorPhone}`,
            From: twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`,
            Body: messageText,
          }),
        }
      );

      if (patientRes.ok && doctorRes.ok) {
        sentAutomatically = true;
        console.log(`[WHATSAPP-API] Standard templates broadcasted to both Patient and Doctor successfully.`);
      } else {
        apiError = `Twilio API rejected with status: ${patientRes.status} (Patient) / ${doctorRes.status} (Doctor)`;
        console.error(`[WHATSAPP-API] Dispatch rejected: ${apiError}`);
      }
    } catch (e: any) {
      apiError = e.message || 'Network timeout or CORS block';
      console.error(`[WHATSAPP-API] Error dispatching automatically:`, e);
    }
  }

  // Always log both actions (for reporting & tracking logs)
  logWhatsAppDelivery(
    params.patientName,
    params.patientPhone,
    'Patient',
    params.status === 'Rescheduled' ? 'Rescheduled Alert' : 'Confirmation Alert',
    'Sent',
    messageText
  );

  logWhatsAppDelivery(
    params.doctorName,
    formattedDoctorPhone,
    'Doctor',
    params.status === 'Rescheduled' ? 'Rescheduled Alert' : 'Confirmation Alert',
    'Sent',
    messageText
  );

  return {
    patientUrl,
    doctorUrl,
    sentAutomatically,
    error: apiError
  };
}

/**
 * Automatically extracts patient demographics from a WhatsApp message and persists to patient directory.
 * Prevents duplicates, logs an audit log row, and provides exact execution outcomes.
 */
export async function autoExtractAndSavePatient(
  messageText: string,
  fromPhone: string
): Promise<{ success: boolean; isNew: boolean; patient: any; error?: string }> {
  try {
    const details = extractPatientFromMessage(messageText, fromPhone);
    const cleanPh = details.phone.replace(/\D/g, '');
    const last10 = cleanPh.slice(-10);

    if (!last10) {
      return { success: false, isNew: false, patient: null, error: 'A valid 10-digit phone number is required.' };
    }

    // Query patients with standard wildcard to avoid duplicate phone records
    const { data: existingPatients, error: searchError } = await supabase
      .from('patients')
      .select('*')
      .ilike('phone', `%${last10}%`)
      .limit(1);

    if (searchError) {
      throw searchError;
    }

    if (existingPatients && existingPatients.length > 0) {
      const existing = existingPatients[0];
      let updatedPatient = existing;
      
      const isPlaceholder = !existing.name || 
        existing.name.toLowerCase().includes('unknown') || 
        existing.name.toLowerCase().includes('extracted') || 
        existing.name === 'New Patient';

      const hasBetterName = details.name && 
        !details.name.toLowerCase().includes('extracted') && 
        !details.name.toLowerCase().includes('unknown');

      // Update placeholder attributes if better details were provided
      if (isPlaceholder && hasBetterName) {
        const updatePayload: any = {
          name: details.name
        };
        if (details.email && !existing.email) updatePayload.email = details.email;
        if (details.location && (!existing.location || existing.location === 'Ameenpur')) updatePayload.location = details.location;
        if (details.age && !existing.age) updatePayload.age = details.age;
        if (details.gender !== 'Unknown' && (!existing.gender || existing.gender === 'Unknown')) updatePayload.gender = details.gender;

        const { data: updated, error: updateError } = await supabase
          .from('patients')
          .update(updatePayload)
          .eq('id', existing.id)
          .select();

        if (!updateError && updated && updated.length > 0) {
          updatedPatient = updated[0];
        }
      }

      return { success: true, isNew: false, patient: updatedPatient };
    }

    // Format new patient record and save
    const code = `SDC-${Date.now().toString().slice(-6)}`;
    const newPatientName = details.name === 'New Patient (Extracted)' ? 'WhatsApp Patient' : details.name;
    const cleanPhoneVal = details.phone ? details.phone : fromPhone.replace(/\D/g, '').slice(-10);

    const insertPayload = {
      name: newPatientName,
      phone: cleanPhoneVal,
      email: details.email || '',
      location: details.location || 'Ameenpur',
      gender: details.gender || 'Unknown',
      age: details.age || null,
      notes: `Extracted from live message: "${messageText.length > 120 ? messageText.slice(0, 120) + '...' : messageText}"`,
      patient_code: code,
      patient_status: 'Registered'
    };

    const { data: inserted, error: insertError } = await supabase
      .from('patients')
      .insert([insertPayload])
      .select();

    if (insertError) {
      throw insertError;
    }

    const savedPatient = inserted && inserted.length > 0 ? inserted[0] : null;

    if (savedPatient) {
      // Audit in whatsapp_messages log table
      await supabase.from('whatsapp_messages').insert({
        phone: cleanPhoneVal,
        message: `[Incoming Onbording System] Automatically parsed contact: ${newPatientName} (${cleanPhoneVal})`,
        status: 'Sent',
        patient_id: savedPatient.id,
        sent_at: new Date().toISOString()
      });
    }

    return {
      success: true,
      isNew: true,
      patient: savedPatient
    };
  } catch (err: any) {
    console.error('[autoExtractAndSavePatient] Failed to extract incoming whatsapp detail:', err);
    return { success: false, isNew: false, patient: null, error: err.message };
  }
}

