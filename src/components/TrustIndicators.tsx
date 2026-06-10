import { Award, Cog, DollarSign, Clock, Heart } from 'lucide-react';
import { useDarkMode } from '../App';

const indicators = [
  { icon: Award, title: 'Certified Specialists', desc: 'Board certified experts' },
  { icon: Cog, title: 'Modern Equipment', desc: 'Latest technology' },
  { icon: DollarSign, title: 'Transparent Pricing', desc: 'No hidden charges' },
  { icon: Clock, title: 'Emergency Care', desc: '24/7 availability' },
  { icon: Heart, title: 'Patient Satisfaction', desc: '99% success rate' },
];

export default function TrustIndicators() {
  const { darkMode } = useDarkMode();

  return (
    <section className={`py-8 sm:py-12 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
          {indicators.map((indicator, index) => (
            <div
              key={index}
              className={`group p-4 sm:p-6 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-105 ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-white hover:bg-teal-50 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-colors duration-300 ${
                  darkMode
                    ? 'bg-teal-900/50 group-hover:bg-teal-800'
                    : 'bg-teal-100 group-hover:bg-teal-200'
                }`}>
                  <indicator.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
                </div>
                <h3 className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 leading-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {indicator.title}
                </h3>
                <p className={`text-[10px] sm:text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {indicator.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
