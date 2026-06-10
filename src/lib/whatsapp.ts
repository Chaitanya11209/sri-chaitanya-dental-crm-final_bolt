/**
 * SRI CHAITANYA DENTAL CARE — WHATSAPP NOTIFICATION ENGINE
 * Handles generating and sending formatted notifications to both patients and doctors.
 */

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
  patientPhone,
  doctorName,
  date,
  time,
  treatment,
  status
}: WhatsAppNotificationParams): string {
  return `Sri Chaitanya Dental Care

New Appointment Scheduled

Patient:
${patientName}

Phone:
${patientPhone}

Doctor:
${doctorName}

Date:
${date}

Time:
${time}

Treatment:
${treatment}

Status:
${status}`;
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

  return {
    patientUrl,
    doctorUrl,
    sentAutomatically,
    error: apiError
  };
}
