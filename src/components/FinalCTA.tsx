import { Calendar, Phone } from 'lucide-react';
import { useDarkMode } from '../App';

export default function FinalCTA() {
  const { darkMode } = useDarkMode();

  return (
    <section className={`py-12 sm:py-16 lg:py-28 relative overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-500 via-teal-600 to-teal-700'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-72 sm:w-96 h-72 sm:h-96 bg-white/10 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-60 sm:w-80 h-60 sm:h-80 bg-teal-300/20 rounded-full blur-3xl transform translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/2 w-48 sm:h-64 h-48 sm:h-64 bg-teal-400/10 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6 sm:mb-8">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">Limited Time: Free Consultation</span>
        </div>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl sm:xl:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight px-2 sm:px-0">
          Ready For A Healthier,{' '}
          <span className="text-teal-100">More Confident Smile?</span>
        </h2>

        <p className="text-base sm:text-lg lg:text-xl text-teal-100 mb-8 sm:mb-10 max-w-2xl mx-auto px-4">
          Join thousands of happy patients who've transformed their lives with our world-class dental care. Your perfect smile is just one appointment away.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-4 sm:px-0">
          <a
            href="#appointment"
            className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-teal-600 text-sm sm:text-base font-bold rounded-xl sm:rounded-2xl hover:bg-teal-50 transition-all duration-300 shadow-lg sm:shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            Schedule Appointment
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>

          <a
            href="tel:+918520851209"
            className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white/20 backdrop-blur-sm text-white text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl border-2 border-white/30 hover:bg-white/30 hover:border-white/50 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
            Call Clinic
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-0.5 sm:mb-1">1000+</div>
            <div className="text-[10px] sm:text-xs lg:text-sm text-teal-200">Happy Patients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-0.5 sm:mb-1">10+</div>
            <div className="text-[10px] sm:text-xs lg:text-sm text-teal-200">Years Experience</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-0.5 sm:mb-1">5+</div>
            <div className="text-[10px] sm:text-xs lg:text-sm text-teal-200">Specialist Doctors</div>
          </div>
        </div>
      </div>
    </section>
  );
}
