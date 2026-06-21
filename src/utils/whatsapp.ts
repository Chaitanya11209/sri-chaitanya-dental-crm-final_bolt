// Helpers for opening WhatsApp with prefilled messages.

import { clinicConfig } from '../config/clinicConfig';

const DEFAULT_SIGNATURE = `Thanks & Regards,

${clinicConfig.clinicName}
${clinicConfig.address}

📞 ${clinicConfig.phone}

📍 Location:
${clinicConfig.googleReviewUrl}

"We Care For Your Smile"`;

export let CLINIC_SIGNATURE = DEFAULT_SIGNATURE;

if (typeof window !== 'undefined') {
  const cached = localStorage.getItem('clinic_signature');
  if (cached) {
    CLINIC_SIGNATURE = cached;
  }
}

export function getClinicSignature(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('clinic_signature') || DEFAULT_SIGNATURE;
  }
  return DEFAULT_SIGNATURE;
}

export function saveClinicSignature(sig: string) {
  CLINIC_SIGNATURE = sig;
  if (typeof window !== 'undefined') {
    localStorage.setItem('clinic_signature', sig);
  }
}

export interface WhatsAppTemplates {
  appointment_confirmation: string;
  appointment_reminder: string;
  followup: string;
  payment_reminder: string;
  thank_you: string;
  recall: string;
  birthday: string;
  missed_appointment: string;
  feedback_request: string;
  google_review: string;
  treatment_completion: string;
  invoice: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplates = {
  appointment_confirmation: `Hello {PatientName},

✅ Appointment Confirmed!

📍 Clinic: {ClinicAddress}
📅 Date: {Date}
🕐 Time: {Time}
🦷 Treatment: {Treatment}

Please arrive 10 minutes before your scheduled time.

For any changes, please contact the clinic.

Looking forward to seeing you!

{Signature}`,

  appointment_reminder: `Hello {PatientName},

⏰ Appointment Reminder

You have an upcoming appointment:

📅 Date: {Date}
🕐 Time: {Time}
🦷 Treatment: {Treatment}

📍 {ClinicAddress}

Please arrive 10 minutes before your appointment.

For any changes, kindly contact the clinic.

{Signature}`,

  followup: `Hello {PatientName},

🔔 Follow-up Reminder

This is a reminder from {ClinicName}.

Your follow-up visit is due: {Date}

Previous Treatment: {Treatment}{NotesBlock}

Please schedule your follow-up appointment at your convenience.

To book, reply to this message or call us.

{Signature}`,

  payment_reminder: `Hello {PatientName},

💰 Payment Reminder

This is a gentle reminder regarding your pending payment at {ClinicName}.

Treatment: {Treatment}
Pending Amount: Rs. {PendingAmount}/-

Please clear the balance at your earliest convenience.

You can pay via:
- Cash at the clinic
- UPI / Google Pay / PhonePe
- Card / Bank Transfer

For any queries, please contact us.

Thank you for your trust in {ClinicName}.

{Signature}`,

  thank_you: `Hello {PatientName},

🙏 Thank You for Visiting!

We appreciate you choosing {ClinicName} for your dental care.

Treatment Completed: {Treatment}{NextVisitBlock}
Your next suggested preventive dental check-up recall is on {RecallDate} (6 months from now).

For any post-treatment concerns, please don't hesitate to contact us.

Wishing you a healthy smile!

{Signature}`,

  recall: `Hello {PatientName},

🦷 Time for Your Dental Check-up!

It's been over 6 months since your last visit to {ClinicName}.

Regular dental check-ups help:
- Catch problems early
- Maintain oral health
- Keep your smile bright

Previous Treatment: {Treatment}

Would you like to schedule an appointment? Reply to this message or call us.

We look forward to seeing you!

{Signature}`,

  birthday: `Dear {PatientName},

🎂 Happy Birthday! 🎉

Wishing you a wonderful birthday filled with joy, laughter, and bright smiles!

May this year bring you good health, happiness, and everything you wish for.

🎁 Special Birthday Gift:
Enjoy a complimentary dental check-up this month!

To schedule, simply reply to this message.

{Signature}`,

  missed_appointment: `Hello {PatientName},

We noticed we missed you at your recent appointment.

📅 Missed Appointment: {Date}
🦷 Treatment: {Treatment}

We hope everything is alright. If you'd like to reschedule, please reply to this message or call us.

Your oral health is important to us, and we're here to help.

{Signature}`,

  feedback_request: `Hello {PatientName},

🙏 Thank you for choosing {ClinicName} for your dental treatment!

We recently completed your {Treatment} treatment. We would highly value your comments to help us continue refining our custom clinical care. 

Could you please reply to this message and let us know your honest feedback regarding your visit and overall experience?

Thank you for your valuable support!

{Signature}`,

  google_review: `Hello {PatientName},

🌟 We would love your support!

It was a pleasure providing your {Treatment} treatment at {ClinicName}. 

Could you spare 30 seconds to support our practitioners by sharing a quick Google review of your experience? It means the world to our small team!

👉 Share your review here:
{ReviewUrl}

Thank you so much for your kind support!

{Signature}`,

  treatment_completion: `Hello {PatientName},

✅ Treatment Completed!

Treatment: {Treatment}
{BalanceStatus}
{NextVisitBlock}

Post-Treatment Care:
- Follow the doctor's instructions
- Maintain oral hygiene
- Contact us if you experience any issues

Thank you for trusting {ClinicName}!

{Signature}`,

  invoice: `Hello {PatientName},

Thank you for your payment at {ClinicName}.

📄 Invoice: {InvoiceNum}
💰 Amount Received: Rs. {AmountReceived}/-
{BalanceStatus}

For a detailed receipt, please visit the clinic.

Thank you for your payment!

{Signature}`
};

export function getWhatsAppTemplates(): WhatsAppTemplates {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('whatsapp_templates');
      if (stored) {
        return { ...DEFAULT_WHATSAPP_TEMPLATES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error parsing whatsapp_templates', e);
    }
  }
  return DEFAULT_WHATSAPP_TEMPLATES;
}

export function saveWhatsAppTemplates(templates: WhatsAppTemplates) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('whatsapp_templates', JSON.stringify(templates));
  }
}

export function renderTemplate(template: string, valueMap: Record<string, string>): string {
  let rendered = template;
  for (const [key, val] of Object.entries(valueMap)) {
    rendered = rendered.replaceAll(`{${key}}`, val || '');
  }
  return rendered;
}

const CLINIC_NAME = clinicConfig.clinicName;
const CLINIC_ADDRESS = clinicConfig.address;

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  // If user already saved with country code, keep last 12 digits (91 + 10).
  if (digits.length > 10) return digits.slice(-12);
  return `91${digits}`;
}

export function sanitizeWhatsAppMessage(msg: string): string {
  if (!msg) return '';

  // 1. Map known decorative symbols, currencies, smart quotes, dashes, and bullet points to plain text
  let cleaned = msg
    .replace(/[\u20B9]/g, 'Rs. ')                 // Indian Rupee sign
    .replace(/[\u201C\u201D]/g, '"')              // Smart double quotes “ and ”
    .replace(/[\u2018\u2019]/g, "'")              // Smart single quotes ‘ and ’
    .replace(/[\u2013\u2014]/g, '-')              // Em/En dashes
    .replace(/[\u2022\u25CF]/g, '-')              // Bullet points • and black circle
    .replace(/[\u00B7]/g, '*')                    // Middle dot
    .replace(/[\u200B-\u200D\uFEFF]/g, '');       // Hidden formatting or zero-width spacing characters

  // 2. Map known emojis to readable plain-text equivalents
  const emojiMap: Record<string, string> = {
    '✅': '[OK]',
    '⏰': '[Reminder]',
    '🔔': '[Alert]',
    '📅': '[Date]',
    '🕐': '[Time]',
    '🦷': '[Dentist]',
    '📍': '[Location]',
    '📞': '[Phone]',
    '💰': '[Payment]',
    '🔴': '[Due]',
    '🙏': '[Thank You]',
    '🎂': '[Birthday]',
    '🎉': '[Celebrate]',
    '🎁': '[Gift]',
    '🌟': '[Review]',
    '👉': '->',
    '📄': '[Invoice]',
    '📋': '[Notes]'
  };

  for (const [emoji, replacement] of Object.entries(emojiMap)) {
    cleaned = cleaned.replaceAll(emoji, replacement);
  }

  // 3. Strict Printable ASCII filter (codes 32 to 126, plus newline, carriage return, and horizontal tab)
  // This guarantees there are absolutely ZERO non-ASCII characters that can be mis-decoded as '?' by any browser or gateway.
  let asciiOnly = '';
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      asciiOnly += cleaned[i];
    }
  }

  return asciiOnly.trim();
}

export function openWhatsApp(phone: string, message: string) {
  const num = normalizePhone(phone);
  if (!num) {
    alert('No phone number on file.');
    return;
  }
  
  // Clean all problematic emoji, rupee symbols, smart quotes, dashes, etc. to pure plane text ASCII
  const sanitized = sanitizeWhatsAppMessage(message);
  const encodedText = encodeURIComponent(sanitized);
  const url = `https://wa.me/${num}?text=${encodedText}`;

  // Log and inspect exact string being passed, satisfying audit requirements
  console.log('[SCDC-WhatsApp-Audit] Destination Phone No:', num);
  console.log('[SCDC-WhatsApp-Audit] Raw Message Input:', message);
  console.log('[SCDC-WhatsApp-Audit] Sanitized Message (ASCII Plain Text):', sanitized);
  console.log('[SCDC-WhatsApp-Audit] encodeURIComponent() Result Payload:', encodedText);
  console.log('[SCDC-WhatsApp-Audit] Final Constructed URL passed to window.open():', url);

  window.open(url, '_blank', 'noopener,noreferrer');
}

// =====================================================
// APPOINTMENT CONFIRMATION
// =====================================================
export function appointmentConfirmationMessage(p: {
  name?: string;
  next_visit?: string;
  appointment_time?: string;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const date = p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const time = p.appointment_time || 'Please contact clinic';

  return renderTemplate(templates.appointment_confirmation, {
    PatientName: p.name || 'Patient',
    ClinicAddress: CLINIC_ADDRESS,
    Date: date,
    Time: time,
    Treatment: p.treatment || 'Consultation',
    Signature: signature
  });
}

// =====================================================
// APPOINTMENT REMINDER (Day Before / Same Day)
// =====================================================
export function appointmentReminderMessage(p: {
  name?: string;
  next_visit?: string;
  appointment_time?: string;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const date = p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '-';
  const time = p.appointment_time || 'Please contact clinic';

  return renderTemplate(templates.appointment_reminder, {
    PatientName: p.name || 'Patient',
    ClinicAddress: CLINIC_ADDRESS,
    Date: date,
    Time: time,
    Treatment: p.treatment || 'Consultation',
    Signature: signature
  });
}

// =====================================================
// FOLLOWUP REMINDER
// =====================================================
export function followupMessage(p: {
  name?: string;
  treatment?: string;
  followup_date?: string;
  notes?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const date = p.followup_date ? new Date(p.followup_date).toLocaleDateString('en-IN') : 'as advised by the doctor';
  const notesText = p.notes ? `\nNotes: ${p.notes}` : '';

  return renderTemplate(templates.followup, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Date: date,
    Treatment: p.treatment || 'Consultation',
    NotesBlock: notesText,
    Notes: p.notes || '',
    Signature: signature
  });
}

// =====================================================
// PAYMENT REMINDER
// =====================================================
export function paymentReminderMessage(p: {
  name?: string;
  balance_amount?: number;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const balance = Number(p.balance_amount || 0).toLocaleString('en-IN');

  return renderTemplate(templates.payment_reminder, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'Dental Treatment',
    PendingAmount: balance,
    Signature: signature
  });
}

// =====================================================
// THANK YOU MESSAGE (After Visit)
// =====================================================
export function thankYouMessage(p: {
  name?: string;
  treatment?: string;
  next_visit?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const nextVisitText = p.next_visit ? `\nNext Visit: ${new Date(p.next_visit).toLocaleDateString('en-IN')}` : '';

  const rDate = new Date();
  rDate.setMonth(rDate.getMonth() + 6);
  const recallDateStr = rDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return renderTemplate(templates.thank_you, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'Consultation',
    NextVisitBlock: nextVisitText,
    NextVisitDate: p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN') : '',
    RecallDate: recallDateStr,
    Signature: signature
  });
}

// =====================================================
// RECALL MESSAGE (6-Month Checkup)
// =====================================================
export function recallMessage(p: { name?: string; treatment?: string }) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();

  return renderTemplate(templates.recall, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'Consultation',
    Signature: signature
  });
}

// =====================================================
// BIRTHDAY MESSAGE
// =====================================================
export function birthdayMessage(p: { name?: string }) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();

  return renderTemplate(templates.birthday, {
    PatientName: p.name || 'Patient',
    Signature: signature
  });
}

// =====================================================
// MISSED APPOINTMENT MESSAGE
// =====================================================
export function missedAppointmentMessage(p: {
  name?: string;
  next_visit?: string;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const date = p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN') : '-';

  return renderTemplate(templates.missed_appointment, {
    PatientName: p.name || 'Patient',
    Date: date,
    Treatment: p.treatment || 'Consultation',
    Signature: signature
  });
}

// =====================================================
// PATIENT FEEDBACK REQUEST
// =====================================================
export function patientFeedbackRequestMessage(p: {
  name?: string;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();

  return renderTemplate(templates.feedback_request, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'dental',
    Signature: signature
  });
}

// =====================================================
// GOOGLE REVIEW REQUEST
// =====================================================
export function googleReviewRequestMessage(p: {
  name?: string;
  treatment?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const reviewUrl = clinicConfig.googleReviewUrl;

  return renderTemplate(templates.google_review, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'dental',
    ReviewUrl: reviewUrl,
    Signature: signature
  });
}

// =====================================================
// TREATMENT COMPLETION MESSAGE
// =====================================================
export function treatmentCompletionMessage(p: {
  name?: string;
  treatment?: string;
  next_visit?: string;
  balance_amount?: number;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const balance = Number(p.balance_amount || 0);
  const balanceStatus = balance > 0 ? `\nBalance Amount: Rs. ${balance.toLocaleString('en-IN')}/-` : '\nPayment: Fully Paid';
  const nextVisitText = p.next_visit ? `\n📅 Next Visit: ${new Date(p.next_visit).toLocaleDateString('en-IN')}` : '';

  return renderTemplate(templates.treatment_completion, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    Treatment: p.treatment || 'Consultation',
    BalanceStatus: balanceStatus,
    Balance: balance ? balance.toString() : '0',
    NextVisitBlock: nextVisitText,
    NextVisitDate: p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN') : '',
    Signature: signature
  });
}

// =====================================================
// INVOICE/RECEIPT MESSAGE
// =====================================================
export function invoiceMessage(p: {
  name?: string;
  amount_paid?: number;
  balance_amount?: number;
  invoice_number?: string;
}) {
  const templates = getWhatsAppTemplates();
  const signature = getClinicSignature();
  const paid = Number(p.amount_paid || 0).toLocaleString('en-IN');
  const balance = Number(p.balance_amount || 0);
  const balanceStatus = balance > 0 ? `🔴 Balance Due: Rs. ${balance.toLocaleString('en-IN')}/-` : '✅ Payment Complete';
  const invoiceNum = p.invoice_number || `INV-${Date.now().toString().slice(-6)}`;

  return renderTemplate(templates.invoice, {
    PatientName: p.name || 'Patient',
    ClinicName: CLINIC_NAME,
    InvoiceNum: invoiceNum,
    AmountReceived: paid,
    BalanceStatus: balanceStatus,
    Balance: balance ? balance.toString() : '0',
    Signature: signature
  });
}

// =====================================================
// AUTOMATED INCOMING WHATSAPP PATIENT EXTRACTOR
// =====================================================
export interface ExtractedPatientDetails {
  name: string;
  phone: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other' | 'Unknown';
  age: number | null;
  location: string;
}

export function extractPatientFromMessage(messageText: string, defaultPhone = ''): ExtractedPatientDetails {
  const text = messageText.trim();
  
  // 1. Extract Name
  let name = '';
  // Match patterns: "my name is [Name]", "this is [Name]", "name: [Name]", "patient name is [Name]", "i am [Name]"
  const nameRegexes = [
    /(?:my name is|i am|this is|patient name is)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3})/i,
    /(?:name\s*:\s*)([A-Z][A-Za-z\s]+?)(?=\r|\n|$)/i,
    /(?:regards,?\s*|thanks,?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i
  ];
  
  for (const regex of nameRegexes) {
    const match = text.match(regex);
    if (match && match[1] && match[1].trim()) {
      const parsed = match[1].trim();
      // Ensure it doesn't match single words like "Hi", "Hello", "Dear"
      if (!/^(dear|hello|hii+|hey|doctor|dr|sri|chaitanya|dentist|appointment)$/i.test(parsed)) {
        name = parsed;
        break;
      }
    }
  }
  
  // If no prefix name match, look for direct Name: tag
  if (!name) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().startsWith('name:')) {
        name = line.replace(/name\s*:\s*/i, '').trim();
      }
    }
  }
  
  // Fallback name
  if (!name) {
    name = 'New Patient (Extracted)';
  }

  // 2. Extract Phone
  let phone = defaultPhone ? defaultPhone.replace(/\D/g, '') : '';
  const phoneMatch = text.match(/(?:\+?91|0)?[6-9]\d{9}\b/);
  if (phoneMatch) {
    phone = phoneMatch[0].replace(/\D/g, '');
  }
  if (phone.length > 10 && phone.startsWith('91')) {
    phone = phone.slice(-10);
  } else if (phone.length > 10) {
    phone = phone.slice(-10);
  }

  // 3. Extract Email
  let email = '';
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].trim().toLowerCase();
  }

  // 4. Extract Age
  let age: number | null = null;
  const ageMatch = text.match(/\b(?:age|aged|years old|yrs old|yr old|years|yrs|age is)\b\s*(?::|=|-|\s)?\s*(\d{1,3})\b/i) || 
                   text.match(/\b(\d{1,3})\s*(?:years old|yrs old|yr old|years|yrs|aged)\b/i);
  if (ageMatch && ageMatch[1]) {
    age = parseInt(ageMatch[1], 10);
  }

  // 5. Extract Gender
  let gender: 'Male' | 'Female' | 'Other' | 'Unknown' = 'Unknown';
  if (/\b(?:female|woman|lady|girl|she|her)\b/i.test(text)) {
    gender = 'Female';
  } else if (/\b(?:male|man|gentleman|boy|he|him)\b/i.test(text)) {
    gender = 'Male';
  }

  // 6. Extract Location
  let location = '';
  const locationMatch = text.match(/\b(?:live at|living in|located in|address is|from|at|near|location(?:\s*:)?)\s+([A-Za-z\s]+?)(?=\n|\r|,|\.|$)/i);
  if (locationMatch && locationMatch[1]) {
    location = locationMatch[1].trim();
  } else {
    // Check for common local areas in Hyderabad
    const areas = ['Ameenpur', 'Miyapur', 'Beeramguda', 'Chanda Nagar', 'Lingampally', 'Kukatpally', 'Bollaram', 'Patancheru', 'Bachupally', 'Nizampet'];
    for (const area of areas) {
      if (new RegExp('\\b' + area + '\\b', 'i').test(text)) {
        location = area;
        break;
      }
    }
  }

  if (!location) {
    location = 'Ameenpur'; // default near clinic
  }

  return { name, phone, email, gender, age, location };
}

