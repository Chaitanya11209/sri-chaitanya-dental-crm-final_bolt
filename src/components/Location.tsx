import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useDarkMode } from '../App';

export default function Location() {
  const { darkMode } = useDarkMode();

  return (
    <section id="contact" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-800/50' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Find Us</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Visit Our Clinic
            <span className="block mt-1 sm:mt-2 text-teal-600">We're Easy to Find</span>
          </h2>

          <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Located in the heart of the city with ample parking and excellent public transport access.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          <div className={`p-4 sm:p-8 rounded-xl smrounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                darkMode ? 'bg-teal-900/50' : 'bg-teal-100'
              }`}>
                <MapPin className={`w-5 h-5 sm:w-6 sm:h-6 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
              <div>
                <h3 className={`text-base sm:text-lg font-semibold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Clinic Address
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Sri Chaitanya Multispeciality Dental Care<br />
                  Ground Floor,Lakeview Apartments,Bandam kommu, Ameenpur Rd, Ameenpur, Telangana 502032
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                darkMode ? 'bg-teal-900/50' : 'bg-teal-100'
              }`}>
                <Phone className={`w-5 h-5 sm:w-6 sm:h-6 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
              <div>
                <h3 className={`text-base sm:text-lg font-semibold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Phone
                </h3>
                <div className="space-y-0.5">
                  <a href="tel:+918520851209" className={`text-xs sm:text-sm block hover:text-teal-600 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    +91 8520851209
                  </a>
                  <a href="tel:+918317575165" className={`text-xs sm:text-sm block hover:text-teal-600 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    +91 8317575165
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                darkMode ? 'bg-teal-900/50' : 'bg-teal-100'
              }`}>
                <Mail className={`w-5 h-5 sm:w-6 sm:h-6 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
              <div>
                <h3 className={`text-base sm:text-lg font-semibold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Email
                </h3>
                <a href="mailto:srichaitanyadentalcare9@gmail.com" className={`text-xs sm:text-sm hover:text-teal-600 transition-colors break-all ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  srichaitanyadentalcare9@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                darkMode ? 'bg-teal-900/50' : 'bg-teal-100'
              }`}>
                <Clock className={`w-5 h-5 sm:w-6 sm:h-6 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>
              <div>
                <h3 className={`text-base sm:text-lg font-semibold mb-1 sm:mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Working Hours
                </h3>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Mon - Fri: 10:00 AM - 8:00 PM<br />
                  Saturday: 10:00 AM - 6:00 PM<br />
                  Sunday: 10:00 AM - 4:00 PM<br />
                  <span className="text-teal-600 font-medium">Emergency: 24/7</span>
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl min-h-[300px] sm:min-h-[400px] lg:h-[500px]">
            <iframe
              src="https://www.google.com/maps?q=Sri%20Chaitanya%20Multispeciality%20Dental%20Care%20Ameenpur&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '300px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Sri Chaitanya Multispeciality Dental Care Location"
            />
          </div>
        </div>

        <div className={`mt-4 sm:mt-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 ${darkMode ? 'bg-slate-800' : 'bg-teal-50'}`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L18.657 15.657a1.5 1.5 0 01.212-.204c.258-.184.516-.368.77-.557.972-.722 1.738-1.64 2.25-2.696a7.956 7.956 0 00.852-3.55c0-3.866-3.134-7-7-7s-7 3.134-7 7c0 3.866 3.134 7 7 7z" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <p className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-white' : 'text-slate-800'}`}>Free Valet Parking</p>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Complimentary parking for all patients</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-12 bg-slate-300 dark:bg-slate-600" />

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="text-center sm:text-left">
              <p className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-white' : 'text-slate-800'}`}>Prime Clinic Location</p>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Easily accessible for patients across Ameenpur and nearby areas</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
