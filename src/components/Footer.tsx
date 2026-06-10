import { Facebook, Instagram, Twitter, Linkedin, Youtube, ArrowRight } from 'lucide-react';
import { useDarkMode } from '../App';

export default function Footer() {
  const { darkMode } = useDarkMode();
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: 'Home', href: '#home' },
    { label: 'About Us', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Results', href: '#results' },
    { label: 'Reviews', href: '#reviews' },
    { label: 'Contact', href: '#contact' },
  ];

  const services = [
    { label: 'Dental Implants', href: '#services' },
    { label: 'Root Canal', href: '#services' },
    { label: 'Teeth Whitening', href: '#services' },
    { label: 'Braces & Aligners', href: '#services' },
    { label: 'Pediatric', href: '#services' },
    { label: 'Emergency Care', href: '#contact' },
  ];

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Youtube, href: '#', label: 'YouTube' },
  ];

  return (
    <footer className={`pt-12 sm:pt-16 pb-6 sm:pb-8 ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-slate-900'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 mb-8 sm:mb-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white">
                Sri Chaitanya<span className="text-teal-400">Dental Care</span>
              </span>
            </div>

            <p className="text-slate-400 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
              Premium dental care with cutting-edge technology and compassionate experts. Transforming smiles and lives since 2021.
            </p>

            <div className="flex gap-2 sm:gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-teal-600 flex items-center justify-center transition-all duration-300 group"
                >
                  <social.icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-white font-semibold mb-4 sm:mb-6 text-sm sm:text-base">Quick Links</h4>
            <ul className="space-y-2 sm:space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-slate-400 text-xs sm:text-sm hover:text-teal-400 transition-colors duration-200 flex items-center gap-1.5 sm:gap-2 group"
                  >
                    <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 sm:-translate-x-2 group-hover:translate-x-0" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-white font-semibold mb-4 sm:mb-6 text-sm sm:text-base">Services</h4>
            <ul className="space-y-2 sm:space-y-3">
              {services.map((service, index) => (
                <li key={index}>
                  <a
                    href={service.href}
                    className="text-slate-400 text-xs sm:text-sm hover:text-teal-400 transition-colors duration-200 flex items-center gap-1.5 sm:gap-2 group"
                  >
                    <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 sm:-translate-x-2 group-hover:translate-x-0" />
                    {service.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-white font-semibold mb-4 sm:mb-6 text-sm sm:text-base">Contact Info</h4>
            <ul className="space-y-3 sm:space-y-4">
              <li className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L18.657 15.657a1.5 1.5 0 01.212-.204c.258-.184.516-.368.77-.557.972-.722 1.738-1.64 2.25-2.696a7.956 7.956 0 00.852-3.55c0-3.866-3.134-7-7-7s-7 3.134-7 7c0 3.866 3.134 7 7 7z" />
                  </svg>
                </div>
                <span className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Ameenpur,Hydeabad
                </span>
              </li>
              <li className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.137a11.045 11.045 0 005.086 5.086l1.137-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <a href="tel:+918520851209" className="text-slate-400 hover:text-teal-400 transition-colors text-xs sm:text-sm">
                  +91 8520851209
                </a>
              </li>
              <li className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3zM3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l7.89 5.26a2 2 0 002.22 0L21 8" />
                  </svg>
                </div>
                <a href="mailto:srichaitanyadentalcare9@gmail.com" className="text-slate-400 hover:text-teal-400 transition-colors text-xs sm:text-sm break-all">
                  srichaitanyadentalcare9@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-xs sm:text-sm text-center sm:text-left">
              © {currentYear} Sri Chaitanya Multispeciality Dental Care. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <a href="#" className="text-slate-500 hover:text-slate-400 text-xs sm:text-sm transition-colors">Privacy Policy</a>
              <span className="text-slate-700 text-xs">|</span>
              <a href="#" className="text-slate-500 hover:text-slate-400 text-xs sm:text-sm transition-colors">Terms</a>
              <span className="text-slate-700 text-xs">|</span>
              <a href="#" className="text-slate-500 hover:text-slate-400 text-xs sm:text-sm transition-colors">Sitemap</a>
              <span className="text-slate-700 text-xs">|</span>
              <a href="/admin" className="text-slate-500 hover:text-slate-400 text-xs sm:text-sm transition-colors">Staff Login</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
