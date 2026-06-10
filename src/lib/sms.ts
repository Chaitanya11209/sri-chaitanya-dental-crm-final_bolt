/**
 * Utility function to integrate an SMS Gateway Provider (e.g. Twilio or custom SMS gateways)
 * and trigger real-time SMS dispatch for appointments and billing reminders.
 */

interface SendSMSParams {
  phone: string;
  name: string;
  message: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface SMSTemplates {
  appointment: string;
  payment: string;
  general: string;
}

export const DEFAULT_SMS_TEMPLATES: SMSTemplates = {
  appointment: "Hi [Name], your appointment for [Treatment] is scheduled on [Date] at [Time]. Thank you! - Sri Chaitanya Dental Care",
  payment: "Hi [Name], your billing summary for [Treatment] treatment: Total Bill: ₹[Total], Paid: ₹[Paid], Balance Due: ₹[Balance]. Thank you!",
  general: "Hi [Name], Sri Chaitanya Dental Care wishes you a healthy smile! Note: [Message]"
};

export function getSMSTemplates(): SMSTemplates {
  try {
    const stored = localStorage.getItem('sms_templates');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error parsing sms_templates', e);
  }
  return DEFAULT_SMS_TEMPLATES;
}

export function saveSMSTemplates(templates: SMSTemplates) {
  localStorage.setItem('sms_templates', JSON.stringify(templates));
}

export type SMSChannel = 'whatsapp' | 'device' | 'cloud';

export function getSMSChannel(): SMSChannel {
  // Free WhatsApp is the default recommended channel
  return (localStorage.getItem('sms_channel') as SMSChannel) || 'whatsapp';
}

export function saveSMSChannel(channel: SMSChannel) {
  localStorage.setItem('sms_channel', channel);
}

/**
 * Sends an SMS to a patient. Falls back to simulation if credentials are not configured,
 * ensuring flawless local testing. Supports free routing channels like WhatsApp and Mobile Device native SMS.
 */
export async function sendSMS({ phone, name, message }: SendSMSParams): Promise<SMSResponse> {
  const cleanPhone = phone.trim().replace(/\D/g, ''); // strip any non-numeric symbols
  // Standardize to include country code (default to 91 for India if exactly 10 digits)
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const activeChannel = getSMSChannel();

  console.log(`[SMS SYSTEM] Dispatching Message via [${activeChannel.toUpperCase()}] to ${name} (${formattedPhone}). Content: "${message}"`);

  // --- FREE ROUTING OPTIONS ---

  if (activeChannel === 'whatsapp') {
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    // Open WhatsApp Web or Mobile Client in a new tab
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    
    return {
      success: true,
      messageId: `WA-FREE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      simulated: false
    };
  }

  if (activeChannel === 'device') {
    const smsUrl = `sms:${formattedPhone}?body=${encodeURIComponent(message)}`;
    // Open in current layer to prompt the native messaging client
    window.location.href = smsUrl;

    return {
      success: true,
      messageId: `DEVICE-SMS-FREE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      simulated: false
    };
  }

  // --- PREMIUM CLOUD API GATEWAYS ---

  const twilioSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const twilioAuthToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const twilioFromNumber = import.meta.env.VITE_TWILIO_FROM_NUMBER;

  // 1. twilio integration (if configured)
  if (twilioSid && twilioAuthToken && twilioFromNumber) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `+${formattedPhone}`,
            From: twilioFromNumber,
            Body: message,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        return { success: true, messageId: data.sid };
      } else {
        const errorMsg = data.message || 'Twilio REST response failed';
        window.dispatchEvent(new CustomEvent('sms-failed', { 
          detail: { name, phone: formattedPhone, error: errorMsg } 
        }));
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('[SMS SYSTEM] Error dispatching live Twilio SMS:', err);
      const errorMsg = err.message || 'Twilio network/CORS boundary issue';
      window.dispatchEvent(new CustomEvent('sms-failed', { 
        detail: { name, phone: formattedPhone, error: errorMsg } 
      }));
      return { success: false, error: errorMsg };
    }
  }

  // 2. Generic custom gateway integration (if configured)
  const genericGatewayUrl = import.meta.env.VITE_SMS_GATEWAY_URL;
  const gatewayApiKey = import.meta.env.VITE_SMS_GATEWAY_API_KEY;

  if (genericGatewayUrl && gatewayApiKey) {
    try {
      const response = await fetch(genericGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayApiKey}`,
        },
        body: JSON.stringify({
          to: formattedPhone,
          message: message,
          sender: import.meta.env.VITE_SMS_SENDER_ID || 'SDCARE',
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        return { success: true, messageId: resData.id || 'GENERIC-SMS-ID' };
      } else {
        const errorMsg = 'Custom SMS Gateway returned status: ' + response.status;
        window.dispatchEvent(new CustomEvent('sms-failed', { 
          detail: { name, phone: formattedPhone, error: errorMsg } 
        }));
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('[SMS SYSTEM] Error dispatching customer gateway SMS:', err);
      const errorMsg = err.message || 'Custom interface network error';
      window.dispatchEvent(new CustomEvent('sms-failed', { 
        detail: { name, phone: formattedPhone, error: errorMsg } 
      }));
      return { success: false, error: errorMsg };
    }
  }

  // 3. Fallback: Simulation mode for perfect UI/UX validation in mock environments 
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        messageId: `SIM-SMS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        simulated: true
      });
    }, 600);
  });
}
