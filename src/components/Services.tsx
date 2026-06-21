import { useState } from 'react';
import { Activity, Anchor, Sparkles, AlignCenter, Smile, Palette, Baby, Droplets } from 'lucide-react';
import { useDarkMode } from '../App';

const services = [
  {
    icon: Anchor,
    title: 'Dental Implants',
    description: 'Permanent, natural-looking tooth replacement with titanium implants.',
    features: ['Same-day placement', '3D guided surgery', 'Lifetime warranty'],
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Activity,
    title: 'Root Canal Treatment',
    description: 'Pain-free root canal therapy using microscopic precision technology.',
    features: ['Single-visit treatment', 'No pain guarantee', 'High success rate'],
    color: 'from-rose-500 to-rose-600',
  },
  {
    icon: Sparkles,
    title: 'Teeth Whitening',
    description: 'Professional whitening treatments with dramatic results in one session.',
    features: ['Up to 8 shades whiter', 'LED acceleration', 'Long-lasting results'],
    color: 'from-amber-500 to-amber-600',
  },
  {
    icon: AlignCenter,
    title: 'Braces & Aligners',
    description: 'Invisible aligners and modern braces for perfect teeth alignment.',
    features: ['Invisible options', 'Faster results', 'Payment plans'],
    color: 'from-teal-500 to-teal-600',
  },
  {
    icon: Smile,
    title: 'Smile Makeover',
    description: 'Complete smile transformation combining multiple treatments.',
    features: ['Digital preview', 'Customized plan', 'Financing available'],
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Palette,
    title: 'Cosmetic Dentistry',
    description: 'Veneers, bonding, and contouring to enhance your smile aesthetics.',
    features: ['Porcelain veneers', 'Smile design', 'Natural results'],
    color: 'from-pink-500 to-pink-600',
  },
  {
    icon: Baby,
    title: 'Pediatric Dentistry',
    description: 'Gentle, child-friendly dental care that kids love.',
    features: ['Kid-friendly environment', 'Gentle approach', 'Fun atmosphere'],
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    icon: Droplets,
    title: 'Dental Cleaning',
    description: 'Professional cleaning and polishing for optimal oral health.',
    features: ['Deep cleaning', 'Polish & fluoride', 'Gum health focus'],
    color: 'from-emerald-500 to-emerald-600',
  },
];

export default function Services() {
  const { darkMode } = useDarkMode();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="services" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-600 rounded-full" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Our Services</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Comprehensive Dental Care
            <span className="block mt-1 sm:mt-2 text-teal-600">For Your Entire Family</span>
          </h2>

          <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            From routine cleanings to complex procedures, we offer a full range of dental services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`group relative rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all duration-300 cursor-pointer overflow-hidden ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-white hover:shadow-xl hover:shadow-slate-200/50'
              } ${hoveredIndex === index ? 'scale-[1.02]' : ''}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

              <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 sm:mb-5 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <service.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>

              <h3 className={`relative text-lg sm:text-xl font-semibold mb-2 sm:mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {service.title}
              </h3>

              <p className={`relative text-xs sm:text-sm mb-3 sm:mb-4 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {service.description}
              </p>

              <div className="relative space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                {service.features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${service.color} flex-shrink-0`} />
                    <span className={`text-[10px] sm:text-xs font-medium ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className={`relative pt-3 sm:pt-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <a
                  href="#appointment"
                  className={`inline-flex items-center text-xs sm:text-sm font-semibold transition-colors ${
                    darkMode ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                  }`}
                >
                  Book Now
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1.5 sm:ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
