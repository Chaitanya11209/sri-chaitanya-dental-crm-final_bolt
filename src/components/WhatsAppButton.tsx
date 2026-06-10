import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/918277090710"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 sm:bottom-24 right-5 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      <span className="absolute right-full mr-2 sm:mr-3 bg-white text-slate-800 px-3 sm:px-4 py-2 rounded-lg shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        WhatsApp
      </span>
    </a>
  );
}
