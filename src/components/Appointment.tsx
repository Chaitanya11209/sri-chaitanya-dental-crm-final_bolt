import { useState } from 'react';
import { Calendar, Mail, Phone, MessageSquare, Send, CheckCircle } from 'lucide-react';
import { useDarkMode } from '../App';
import emailjs from '@emailjs/browser';
import { createAppointment } from '../services/appointmentService';
import { sanitizeWhatsAppMessage } from '../utils/whatsapp';

const services = [
  'General Consultation',
  'Dental Implants',
  'Root Canal Treatment',
  'Teeth Whitening',
  'Braces & Aligners',
  'Smile Makeover',
  'Cosmetic Dentistry',
  'Pediatric Dentistry',
  'Dental Cleaning',
  'Emergency Care',
];

export default function Appointment() {
  const { darkMode } = useDarkMode();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service: '',
    date: '',
    time: '',
    location: '',
    message: '',
  });

  const validateField = (name: string, value: string) => {
    let error = '';
    if (name === 'name') {
      const trimmed = value.trim();
      if (!trimmed) {
        error = 'Full Name is required.';
      } else if (trimmed.length < 2) {
        error = 'Full Name must be at least 2 characters.';
      } else if (!/^[A-Za-z\s.]+$/.test(trimmed)) {
        error = 'Full Name can only contain letters, spaces, and dots.';
      }
    } else if (name === 'phone') {
      const stripped = value.replace(/[\s\-()]/g, '');
      if (!value.trim()) {
        error = 'Phone Number is required.';
      } else if (!/^(?:\+?91|0)?[6-9]\d{9}$/.test(stripped)) {
        error = 'Please enter a valid 10-digit Indian phone number (starting with 6, 7, 8, or 9).';
      }
    } else if (name === 'email') {
      const trimmed = value.trim();
      if (trimmed) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          error = 'Please enter a valid email address.';
        }
      }
    } else if (name === 'location') {
      const trimmed = value.trim();
      if (!trimmed) {
        error = 'Location is required.';
      } else if (trimmed.length < 2) {
        error = 'Location must be at least 2 characters.';
      }
    } else if (name === 'service') {
      if (!value) {
        error = 'Please select a service.';
      }
    } else if (name === 'date') {
      if (!value) {
        error = 'Preferred Date is required.';
      }
    } else if (name === 'time') {
      if (!value) {
        error = 'Preferred Time is required.';
      }
    }
    return error;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields on submit
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key as keyof typeof formData]);
      if (err) {
        newErrors[key] = err;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrKey = Object.keys(newErrors)[0];
      const element = document.getElementsByName(firstErrKey)[0];
      if (element) {
        element.focus();
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await createAppointment(formData);
    } catch (error: any) {
      alert(error.message || 'Failed to request appointment. Please try again.');
      setIsSubmitting(false);
      return;
    }

  // 2. WhatsApp Message
  const whatsappMessage = `*SRI CHAITANYA DENTAL CARE*
━━━━━━━━━━━━━━━━━━

*NEW APPOINTMENT ENQUIRY*

Name:
${formData.name}

Mobile Number:
${formData.phone}

Location:
${formData.location}

Treatment Requested:
${formData.service}

Appointment Date:
${formData.date}

Preferred Time:
${formData.time}

Additional Notes:
${formData.message || 'No additional notes'}

━━━━━━━━━━━━━━━━━━

Patient submitted appointment request from the official website.

Please contact the patient to confirm the appointment.`;

  // 3. Open WhatsApp
  const cleanMessage = sanitizeWhatsAppMessage(whatsappMessage);
  window.open(
    `https://wa.me/918277090710?text=${encodeURIComponent(cleanMessage)}`,
    '_blank',
    'noopener,noreferrer'
  );

  // 4. EmailJS (optional)
  try {
    await emailjs.send(
      'service_c4b7i3o',
      'template_39o7jsh',
      {
        user_name: formData.name,
        user_phone: formData.phone,
        user_email: formData.email,
        service: formData.service,
        message: formData.message,
        date: formData.date,
        time: formData.time,
      },
      'LEVcKGAOwVogIq0Ob'
    );
  } catch (emailError) {
    console.error('EmailJS Error:', emailError);
  }

  // 5. Success UI
  setIsSubmitted(true);
  setIsSubmitting(false);

  // 6. Reset Form
  setFormData({
    name: '',
    phone: '',
    email: '',
    service: '',
    date: '',
    time: '',
    location: '',
    message: '',
  });
  setErrors({});
};

  if (isSubmitted) {
    return (
      <section id="appointment" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 animate-bounce">
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Appointment Requested!
            </h2>
            <p className={`text-base sm:text-lg mb-6 sm:mb-8 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Thank you, {formData.name}! We've received your request and will contact you within 1 hour.
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  name: '',
                  phone: '',
                  email: '',
                  service: '',
                  date: '',
                  time: '',
                  location: '',
                  message: '',
                });
                setErrors({});
              }}
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm sm:text-base font-semibold rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-300"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="appointment" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
              <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Book Now</span>
            </div>

            <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Schedule Your
              <span className="block mt-1 sm:mt-2 text-teal-600">Appointment Today</span>
            </h2>

            <p className={`text-base sm:text-lg mb-6 sm:mb-8 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Ready to transform your smile? Fill out the form and our team will contact you to confirm your appointment within 24 hours.
            </p>

            <div className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                Clinic Hours
              </h3>
              <div className={`space-y-2 sm:space-y-3 text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <div className="flex justify-between">
                  <span>Monday - Friday</span>
                  <span className="font-medium text-teal-600">10:00 AM - 8:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday</span>
                  <span className="font-medium text-teal-600">10:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday</span>
                  <span className="font-medium text-teal-600">10:00 AM - 4:00 PM</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-teal-50 dark:bg-teal-900/30 rounded-lg sm:rounded-xl">
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 flex-shrink-0" />
              <div>
                <p className={`text-[10px] sm:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Need immediate assistance?</p>
                <a href="tel:+918317575165" className="text-sm sm:text-base font-semibold text-teal-600 hover:text-teal-700">
                  +91 9346099856
                </a>
              </div>
            </div>
          </div>

          <div className={`p-4 sm:p-8 rounded-2xl sm:rounded-3xl ${darkMode ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-50 to-teal-50/30 shadow-lg sm:shadow-xl'}`}>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
                      errors.name
                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
                        : darkMode
                        ? 'bg-slate-700 border-slate-600 focus:ring-teal-500 text-white placeholder-slate-400'
                        : 'bg-white border-slate-200 focus:ring-teal-500 text-slate-800 placeholder-slate-400'
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
                      errors.phone
                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
                        : darkMode
                        ? 'bg-slate-700 border-slate-600 focus:ring-teal-500 text-white placeholder-slate-400'
                        : 'bg-white border-slate-200 focus:ring-teal-500 text-slate-800 placeholder-slate-400'
                    }`}
                    placeholder="Enter your phone number"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-500 font-medium">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  Location *
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
                    errors.location
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
                      : darkMode
                      ? 'bg-slate-700 border-slate-600 focus:ring-teal-500 text-white placeholder-slate-400'
                      : 'bg-white border-slate-200 focus:ring-teal-500 text-slate-800 placeholder-slate-400'
                  }`}
                  placeholder="Ameenpur, Hyderabad"
                />
                {errors.location && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.location}</p>
                )}
              </div>

              <div>
                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
                    errors.email
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
                      : darkMode
                      ? 'bg-slate-700 border-slate-600 focus:ring-teal-500 text-white placeholder-slate-400'
                      : 'bg-white border-slate-200 focus:ring-teal-500 text-slate-800 placeholder-slate-400'
                  }`}
                  placeholder="john@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.email}</p>
                )}
              </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

  {/* Service */}
  <div>
    <label className={`block text-sm font-medium mb-2 ${
      darkMode ? 'text-white' : 'text-slate-700'
    }`}>
      Service Required *
    </label>

    <select
      name="service"
      value={formData.service}
      onChange={handleInputChange}
      required
      className={`w-full h-14 px-4 text-sm rounded-2xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
        errors.service
          ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
          : darkMode
          ? 'bg-slate-700 border-slate-600 text-white'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      <option value="">Select a service</option>

      {services.map((service) => (
        <option key={service} value={service}>
          {service}
        </option>
      ))}
    </select>
    {errors.service && (
      <p className="mt-1 text-xs text-red-500 font-medium">{errors.service}</p>
    )}
  </div>

  {/* Date */}
  <div>
    <label className={`block text-sm font-medium mb-2 ${
      darkMode ? 'text-white' : 'text-slate-700'
    }`}>
      Preferred Date *
    </label>

    <input
      type="date"
      name="date"
      value={formData.date}
      onChange={handleInputChange}
      required
      className={`w-full h-14 px-4 text-sm rounded-2xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
        errors.date
          ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
          : darkMode
          ? 'bg-slate-700 border-slate-600 text-white'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    />
    {errors.date && (
      <p className="mt-1 text-xs text-red-500 font-medium">{errors.date}</p>
    )}
  </div>

</div>

{/* Time */}
<div className="mt-4">
  <label className={`block text-sm font-medium mb-2 ${
    darkMode ? 'text-white' : 'text-slate-700'
  }`}>
    Preferred Time *
  </label>

  <select
    name="time"
    value={formData.time}
    onChange={handleInputChange}
    required
    className={`w-full h-14 px-4 text-sm rounded-2xl border transition-all duration-200 focus:ring-2 focus:ring-transparent ${
      errors.time
        ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
        : darkMode
        ? 'bg-slate-700 border-slate-600 text-white'
        : 'bg-white border-slate-200 text-slate-800'
    }`}
  >
    <option value="">Select Time</option>

    <option value="10:00 AM">10:00 AM</option>
    <option value="10:30 AM">10:30 AM</option>

    <option value="11:00 AM">11:00 AM</option>
    <option value="11:30 AM">11:30 AM</option>

    <option value="12:00 PM">12:00 PM</option>
    <option value="12:30 PM">12:30 PM</option>

    <option value="01:00 PM">01:00 PM</option>
    <option value="01:30 PM">01:30 PM</option>

    <option value="02:00 PM">02:00 PM</option>
    <option value="02:30 PM">02:30 PM</option>

    <option value="03:00 PM">03:00 PM</option>
    <option value="03:30 PM">03:30 PM</option>

    <option value="04:00 PM">04:00 PM</option>
    <option value="04:30 PM">04:30 PM</option>

    <option value="05:00 PM">05:00 PM</option>
    <option value="05:30 PM">05:30 PM</option>

    <option value="06:00 PM">06:00 PM</option>
    <option value="06:30 PM">06:30 PM</option>

    <option value="07:00 PM">07:00 PM</option>
    <option value="07:30 PM">07:30 PM</option>

    <option value="08:00 PM">08:00 PM</option>
    
  </select>
  {errors.time && (
    <p className="mt-1 text-xs text-red-500 font-medium">{errors.time}</p>
  )}
</div>
              <div>
                <label className={`block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  Message (Optional)
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none ${
                    darkMode
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                  }`}
                  placeholder="Any specific requirements or concerns?"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 sm:py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm sm:text-base font-semibold rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 flex items-center justify-center gap-2 active:scale-[0.98] ${
                  isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    Request Appointment
                  </>
                )}
              </button>

              <p className={`text-[10px] sm:text-xs text-center ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                By submitting, you agree to our Privacy Policy and Terms of Service.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}