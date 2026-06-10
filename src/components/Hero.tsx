import { useEffect, useRef, useState } from 'react';
import { Calendar, MessageCircle, Users, Award, Sparkles } from 'lucide-react';
import { useDarkMode } from '../App';

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView) {
      const duration = 2000;
      const steps = 60;
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function Hero() {
  const { darkMode } = useDarkMode();

  return (
    <section id="home" className={`relative pt-20 sm:pt-24 pb-12 sm:pb-16 lg:pt-32 lg:pb-24 overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-white to-teal-50/30'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-72 sm:w-96 h-72 sm:h-96 bg-teal-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 sm:w-80 h-60 sm:h-80 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300 whitespace-nowrap">Advanced Dental Technology</span>
            </div>

            <h1 className={`text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Transform Your Smile With{' '}
              <span className="bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                Advanced Modern Dentistry
              </span>
            </h1>

            <p className={`text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 leading-relaxed px-2 sm:px-0 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Experience world-class dental care with cutting-edge technology, painless treatments, and personalized attention from our expert team.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-10">
              <a
                href="#appointment"
                className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-lg sm:shadow-xl shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 active:scale-[0.98]"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                Book Appointment
              </a>

              <a
                href="https://wa.me/918520851209"
                target="_blank"
                rel="noopener noreferrer"
                className={`group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl border-2 transition-all duration-300 active:scale-[0.98] ${darkMode
                    ? 'border-slate-700 text-white hover:bg-slate-800 active:bg-slate-700'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                  }`}
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                WhatsApp Consultation
              </a>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-white">
                    <AnimatedNumber target={1000} suffix="+" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Happy Patients</p>
              </div>

              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-white">
                    <AnimatedNumber target={10} suffix="+" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Years Experience</p>
              </div>

              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 dark:text-white">
                    <AnimatedNumber target={50} suffix="+" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Treatments</p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative z-10">
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/20">
                <img
                  src="/hero-img.avif"
                  alt="Modern Dental Clinic"
                  className="w-full h-auto sm:h-[600px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent" />
              </div>

              <div className="absolute -bottom-4 sm:-bottom-6 -left-4 sm:-left-6 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xl shadow-slate-900/10 p-4 sm:p-5 z-20 animate-float">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 sm:w-12 h-10 sm:h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-5 sm:w-6 h-5 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">4.9/5</p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Patient Rating</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-3 sm:-top-4 -right-3 sm:-right-4 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-xl shadow-slate-900/10 p-3 sm:p-4 z-20 animate-float-delayed">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-br from-teal-400 to-teal-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <svg className="w-4 sm:w-5 h-4 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white">Same Day</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Appointments</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-1/2 -left-8 w-48 sm:w-64 h-48 sm:h-64 bg-teal-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-36 sm:w-48 h-36 sm:h-48 bg-blue-400/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 3s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </section>
  );
}
