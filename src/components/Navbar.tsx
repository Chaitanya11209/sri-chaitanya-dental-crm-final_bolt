import { useState, useEffect } from 'react';
import { Menu, X, Phone, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../App';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navLinks = [
    { href: '#home', label: 'Home' },
    { href: '#about', label: 'About' },
    { href: '#services', label: 'Services' },
    { href: '#results', label: 'Results' },
    { href: '#reviews', label: 'Reviews' },
    { href: '#faq', label: 'FAQ' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-lg shadow-lg shadow-slate-200/50'
          : 'bg-transparent'
      } ${darkMode ? '!bg-slate-900/95 shadow-slate-900/50' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <a href="#home" className="flex items-center gap-2 sm:gap-3 z--1">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
     <span className={`text-sm sm:text-lg lg:text-xl font-bold leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
  Sri Chaitanya Multispeciality
  <br />
  <span className="block text-center text-teal-600">
    Dental Care
  </span>
</span>
          </a>

          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 hover:text-teal-600 ${
                  darkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3 xl:gap-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors duration-200 ${
                darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <a
              href="tel:+918317575165"
              className="hidden xl:flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-teal-600 transition-colors duration-200"
            >
              <Phone className="w-4 h-4" />
              <span className="font-medium text-sm">+91 8317575165</span>
            </a>

            <a
              href="#appointment"
              className="px-5 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-semibold rounded-lg sm:rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 hover:-translate-y-0.5"
            >
              Book Appointment
            </a>
          </div>

          <div className="flex lg:hidden items-center gap-2 sm:gap-3">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-lg transition-colors z-10 ${
                darkMode ? 'text-white hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-100'
              }`}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`lg:hidden fixed inset-0 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
        />

        <div
          className={`absolute top-0 right-0 bottom-0 w-[280px] sm:w-[320px] transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          } ${
            darkMode ? 'bg-slate-900' : 'bg-white'
          } shadow-2xl`}
        >
          <div className="flex items-center justify-end h-16 sm:h-20 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setIsOpen(false)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'text-white hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-100'
              }`}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 sm:p-6 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {navLinks.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-base font-medium transition-all duration-300 py-3 px-4 rounded-lg ${
                    darkMode
                      ? 'text-slate-300 hover:text-teal-400 hover:bg-slate-800'
                      : 'text-slate-600 hover:text-teal-600 hover:bg-slate-50'
                  } ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                  style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <a
                href="tel:+918317575165"
                className={`flex items-center gap-3 py-3 px-4 rounded-lg transition-colors ${
                  darkMode
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Phone className="w-4 h-4 text-teal-600" />
                <span className="font-medium">+91 8317575165</span>
              </a>
            </div>

            <div className="mt-6">
              <a
                href="#appointment"
                onClick={() => setIsOpen(false)}
                className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-center font-semibold rounded-xl shadow-lg shadow-teal-500/30 block active:scale-[0.98] transition-transform"
              >
                Book Appointment
              </a>
            </div>
          </nav>
        </div>
      </div>
    </nav>
  );
}
