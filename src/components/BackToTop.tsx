import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-5 sm:bottom-6 right-5 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
      aria-label="Back to top"
    >
      <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
    </button>
  );
}
