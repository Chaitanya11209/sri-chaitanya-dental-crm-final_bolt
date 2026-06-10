// Helpers for opening WhatsApp with prefilled messages.

const CLINIC_NAME = 'Sri Chaitanya Dental Care';
const CLINIC_ADDRESS = 'Sri Chaitanya Multi-Speciality Dental Care';

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  // If user already saved with country code, keep last 12 digits (91 + 10).
  if (digits.length > 10) return digits.slice(-12);
  return `91${digits}`;
}

export function openWhatsApp(phone: string, message: string) {
  const num = normalizePhone(phone);
  if (!num) {
    alert('No phone number on file.');
    return;
  }
  window.open(
    `https://wa.me/${num}?text=${encodeURIComponent(message)}`,
    '_blank'
  );
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
  const date = p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const time = p.appointment_time || 'Please contact clinic';

  return `Hello ${p.name || 'Patient'},

✅ Appointment Confirmed!

📍 Clinic: ${CLINIC_ADDRESS}
📅 Date: ${date}
🕐 Time: ${time}
🦷 Treatment: ${p.treatment || 'Consultation'}

Please arrive 10 minutes before your scheduled time.

For any changes, please contact the clinic.

Looking forward to seeing you!

Best regards,
${CLINIC_NAME}`;
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
  const date = p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
  const time = p.appointment_time || 'Please contact clinic';

  return `Hello ${p.name || 'Patient'},

⏰ Appointment Reminder

You have an upcoming appointment:

📅 Date: ${date}
🕐 Time: ${time}
🦷 Treatment: ${p.treatment || 'Consultation'}

📍 ${CLINIC_ADDRESS}

Please arrive 10 minutes before your appointment.

For any changes, kindly contact the clinic.

Thank you,
${CLINIC_NAME}`;
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
  const date = p.followup_date ? new Date(p.followup_date).toLocaleDateString('en-IN') : 'as advised by the doctor';

  return `Hello ${p.name || 'Patient'},

🔔 Follow-up Reminder

This is a reminder from ${CLINIC_NAME}.

Your follow-up visit is due: ${date}

Previous Treatment: ${p.treatment || 'Consultation'}
${p.notes ? `\nNotes: ${p.notes}` : ''}

Please schedule your follow-up appointment at your convenience.

To book, reply to this message or call us.

Best regards,
${CLINIC_NAME}`;
}

// =====================================================
// PAYMENT REMINDER
// =====================================================
export function paymentReminderMessage(p: {
  name?: string;
  balance_amount?: number;
  treatment?: string;
}) {
  const balance = Number(p.balance_amount || 0).toLocaleString('en-IN');

  return `Hello ${p.name || 'Patient'},

💰 Payment Reminder

This is a gentle reminder regarding your pending payment at ${CLINIC_NAME}.

Treatment: ${p.treatment || 'Dental Treatment'}
Pending Amount: ₹${balance}/-

Please clear the balance at your earliest convenience.

You can pay via:
• Cash at the clinic
• UPI / Google Pay / PhonePe
• Card / Bank Transfer

For any queries, please contact us.

Thank you for your trust in ${CLINIC_NAME}.

Best regards,
${CLINIC_NAME}`;
}

// =====================================================
// THANK YOU MESSAGE (After Visit)
// =====================================================
export function thankYouMessage(p: {
  name?: string;
  treatment?: string;
  next_visit?: string;
}) {
  return `Hello ${p.name || 'Patient'},

🙏 Thank You for Visiting!

We appreciate you choosing ${CLINIC_NAME} for your dental care.

Treatment Completed: ${p.treatment || 'Consultation'}
${p.next_visit ? `\nNext Visit: ${new Date(p.next_visit).toLocaleDateString('en-IN')}` : ''}

For any post-treatment concerns, please don't hesitate to contact us.

Wishing you a healthy smile!

Warm regards,
${CLINIC_NAME}`;
}

// =====================================================
// RECALL MESSAGE (6-Month Checkup)
// =====================================================
export function recallMessage(p: { name?: string; treatment?: string }) {
  return `Hello ${p.name || 'Patient'},

🦷 Time for Your Dental Check-up!

It's been over 6 months since your last visit to ${CLINIC_NAME}.

Regular dental check-ups help:
• Catch problems early
• Maintain oral health
• Keep your smile bright

Previous Treatment: ${p.treatment || 'Consultation'}

Would you like to schedule an appointment? Reply to this message or call us.

We look forward to seeing you!

Warm regards,
${CLINIC_NAME}`;
}

// =====================================================
// BIRTHDAY MESSAGE
// =====================================================
export function birthdayMessage(p: { name?: string }) {
  return `Dear ${p.name || 'Patient'},

🎂 Happy Birthday! 🎉

Wishing you a wonderful birthday filled with joy, laughter, and bright smiles!

May this year bring you good health, happiness, and everything you wish for.

🎁 Special Birthday Gift:
Enjoy a complimentary dental check-up this month!

To schedule, simply reply to this message.

With warm wishes,
${CLINIC_NAME}`;
}

// =====================================================
// MISSED APPOINTMENT MESSAGE
// =====================================================
export function missedAppointmentMessage(p: {
  name?: string;
  next_visit?: string;
  treatment?: string;
}) {
  return `Hello ${p.name || 'Patient'},

We noticed we missed you at your recent appointment.

📅 Missed Appointment: ${p.next_visit ? new Date(p.next_visit).toLocaleDateString('en-IN') : '-'}
🦷 Treatment: ${p.treatment || 'Consultation'}

We hope everything is alright. If you'd like to reschedule, please reply to this message or call us.

Your oral health is important to us, and we're here to help.

Best regards,
${CLINIC_NAME}`;
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
  const balance = Number(p.balance_amount || 0);

  return `Hello ${p.name || 'Patient'},

✅ Treatment Completed!

Treatment: ${p.treatment || 'Consultation'}
${balance > 0 ? `\nBalance Amount: ₹${balance.toLocaleString('en-IN')}/-` : '\nPayment: Fully Paid'}

${p.next_visit ? `\n📅 Next Visit: ${new Date(p.next_visit).toLocaleDateString('en-IN')}` : ''}

Post-Treatment Care:
• Follow the doctor's instructions
• Maintain oral hygiene
• Contact us if you experience any issues

Thank you for trusting ${CLINIC_NAME}!

Best regards,
${CLINIC_NAME}`;
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
  const paid = Number(p.amount_paid || 0).toLocaleString('en-IN');
  const balance = Number(p.balance_amount || 0);
  const invoiceNum = p.invoice_number || `INV-${Date.now().toString().slice(-6)}`;

  return `Hello ${p.name || 'Patient'},

Thank you for your payment at ${CLINIC_NAME}.

📄 Invoice: ${invoiceNum}
💰 Amount Received: ₹${paid}/-
${balance > 0 ? `🔴 Balance Due: ₹${balance.toLocaleString('en-IN')}/-` : '✅ Payment Complete'}

For a detailed receipt, please visit the clinic.

Thank you for your payment!

Best regards,
${CLINIC_NAME}`;
}
