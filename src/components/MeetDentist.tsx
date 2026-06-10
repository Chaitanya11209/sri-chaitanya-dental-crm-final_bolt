import { GraduationCap, Award, Clock, Star } from 'lucide-react';
import { useDarkMode } from '../App';

export default function MeetDentist() {
  const { darkMode } = useDarkMode();

  const credentials = [
    { icon: GraduationCap, label: 'BDS (Root Canal Specailist)' },
    { icon: Award, label: '10+ Years Experience' },
    { icon: Star, label: '1000+ Successful Cases' },
    { icon: Clock, label: 'Available 6 Days/Week' },
  ];

  return (
    <section id="about" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl sm:rounded-3xl transform rotate-2 sm:rotate-3 scale-[0.98]" />

              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-teal-500/20">
                <img
                  src="/doctor.jpg"
                  alt="Dr. J Durga Bhavani - Lead Dentist"
                  className="w-full h-80 sm:h-96 lg:h-[600px] object-cover object-top"
                />
              </div>

              <div className="absolute -bottom-4 sm:-bottom-6 -right-4 sm:-right-6 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 z-10">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <Award className="w-6 sm:w-8 h-6 sm:h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">Best Dentist</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Award 2024</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-600 rounded-full" />
              <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Meet Your Doctor</span>
            </div>

            <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Dr. J Durga Bhavani
              <span className="block text-xl sm:text-2xl lg:text-3xl mt-1 sm:mt-2 text-teal-600">
                Chief Dental Surgeon
              </span>
            </h2>

            <p className={`text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              With over 10 years of specialized experience, Dr. Bhavani has transformed thousands of smiles using the latest dental technologies. Her patient-first approach combines artistic precision with advanced medical expertise to deliver results that exceed expectations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {credentials.map((cred, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-50'
                    }`}
                >
                  <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-teal-900/50' : 'bg-teal-100'
                    }`}>
                    <cred.icon className={`w-4 sm:w-5 h-4 sm:h-5 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
                  </div>
                  <span className={`text-sm sm:text-base font-medium ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                    {cred.label}
                  </span>
                </div>
              ))}
            </div>

            <blockquote className={`border-l-4 border-teal-500 pl-4 sm:pl-6 py-2 mb-6 sm:mb-8 ${darkMode ? 'bg-slate-800 rounded-r-xl' : 'bg-teal-50/50 rounded-r-xl'
              }`}>
              <p className={`italic text-base sm:text-lg ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                "Every smile tells a story, and I'm here to help you write one you'll love to share."
              </p>
              <footer className={`mt-2 sm:mt-3 text-xs sm:text-sm font-medium ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                — Dr. J Durga Bhavani
              </footer>
            </blockquote>

            <div className="flex flex-wrap gap-3 sm:gap-4">
              <div className={`px-3 sm:px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <p className={`text-[10px] sm:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Member of</p>
                <p className={`text-xs sm:text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Indian Dental Association</p>
              </div>
              <div className={`px-3 sm:px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <p className={`text-[10px] sm:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fellow</p>
                <p className={`text-xs sm:text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>International College of Dentists</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
