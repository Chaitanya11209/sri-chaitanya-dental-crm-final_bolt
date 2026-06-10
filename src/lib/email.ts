import emailjs from '@emailjs/browser';

interface EmailParams {
  user_name: string;
  user_phone: string;
  user_email: string;
  service: string;
  message: string;
  date?: string;
  time?: string;
}

export interface EmailResponse {
  success: boolean;
  error?: string;
}

/**
 * Send an email notification via EmailJS.
 * Defaults to Sri Chaitanya Dental Care's live configuration.
 */
export async function sendClinicEmail(params: EmailParams): Promise<EmailResponse> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_c4b7i3o';
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_39o7jsh';
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'LEVcKGAOwVogIq0Ob';

  console.log('[EMAIL SYSTEM] Dispatching notification:', params);

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        user_name: params.user_name,
        user_phone: params.user_phone,
        user_email: params.user_email,
        service: params.service,
        message: params.message,
        date: params.date || 'N/A',
        time: params.time || 'N/A',
        to_email: 'srichaitanyadentalcare9@gmail.com',
        from_email: 'srichaitanyadentalcare9@gmail.com',
      },
      publicKey
    );
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL SYSTEM] Error sending email:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Triggers an automatic email when an appointment is booked inside the admin/staff panel.
 */
export async function notifyAppointmentBooked(appt: {
  name: string;
  phone: string;
  email?: string;
  treatment: string;
  next_visit: string;
  appointment_time: string;
  notes?: string;
  bookedBy?: string;
}): Promise<EmailResponse> {
  const cleanEmail = appt.email && appt.email.trim() !== '' ? appt.email : 'srichaitanyadentalcare9@gmail.com';
  
  const messageBody = `
🏥 Sri Chaitanya CRM Notification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
An appointment has been successfully booked by the staff/administration.

Patient Information:
• Name: ${appt.name}
• Phone: ${appt.phone}
• Email: ${appt.email || 'N/A'}

Appointment Details:
• Scheduled Treatment: ${appt.treatment}
• Appointment Date: ${appt.next_visit}
• Preferred Time-slot: ${appt.appointment_time}
• Internal Staff Notes: ${appt.notes || 'No additional notes'}

Processed By: ${appt.bookedBy || 'Admin Panel'}
Recipient: srichaitanyadentalcare9@gmail.com
Sender Account: srichaitanyadentalcare9@gmail.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return sendClinicEmail({
    user_name: appt.name,
    user_phone: appt.phone,
    user_email: cleanEmail,
    service: appt.treatment || 'Dental Consultation',
    message: messageBody.trim(),
    date: appt.next_visit,
    time: appt.appointment_time,
  });
}

/**
 * Triggers an automatic email when a patient is added inside the admin/staff panel.
 */
export async function notifyPatientAdded(patient: {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  age?: string;
  gender?: string;
  notes?: string;
  addedBy?: string;
}): Promise<EmailResponse> {
  const cleanEmail = patient.email && patient.email.trim() !== '' ? patient.email : 'srichaitanyadentalcare9@gmail.com';
  
  const messageBody = `
🏥 Sri Chaitanya CRM Notification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A new Patient Profile has been created in the CRM directory.

New Patient Credentials:
• Full Name: ${patient.name}
• Contact Number: ${patient.phone}
• Email Address: ${patient.email || 'N/A'}
• Location/Address: ${patient.location || 'N/A'}
• Age: ${patient.age || 'N/A'}
• Biological Gender: ${patient.gender || 'N/A'}
• Clinical Intake Notes: ${patient.notes || 'No notes provided'}

Created By: ${patient.addedBy || 'Clinical Staff/Admin'}
Recipient: srichaitanyadentalcare9@gmail.com
Sender Account: srichaitanyadentalcare9@gmail.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return sendClinicEmail({
    user_name: patient.name,
    user_phone: patient.phone,
    user_email: cleanEmail,
    service: 'New Patient Registration',
    message: messageBody.trim(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  });
}
