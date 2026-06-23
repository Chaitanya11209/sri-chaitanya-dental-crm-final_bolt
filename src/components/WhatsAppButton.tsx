import { clinicConfig } from '../config/clinicConfig';

export default function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${clinicConfig.phone.replace(/\D/g, '')}?text=${encodeURIComponent("Hello Sri Chaitanya Dental Care, I would like to book a dental consultation.")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 sm:bottom-24 right-5 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 hover:scale-110 active:scale-95 transition-all duration-300 group rounded-full"
      aria-label="Chat on WhatsApp"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
        alt="WhatsApp"
        className="w-full h-full drop-shadow-lg"
        referrerPolicy="no-referrer"
      />
      <span className="absolute right-full mr-2 sm:mr-3 bg-white text-slate-800 px-3 sm:px-4 py-2 rounded-lg shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        WhatsApp
      </span>
    </a>
  );
}
