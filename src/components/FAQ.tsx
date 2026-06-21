import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDarkMode } from '../App';

const faqs = [
  {
    question: 'Is dental treatment painful?',
    answer: 'Modern dentistry has made significant advances in pain management. We use advanced anesthesia techniques, sedation options, and laser technology to ensure virtually painless treatments.',
  },
  {
    question: 'How long does recovery take after treatment?',
    answer: 'Recovery time varies by procedure. Simple cleanings have no downtime. Fillings and root canals typically require 2-3 days. Dental implants need 3-6 months for complete healing.',
  },
  {
    question: 'How much does dental treatment cost?',
    answer: 'Costs vary based on treatment complexity. We believe in transparent pricing with no hidden fees. We offer flexible payment plans and work with most major insurance providers.',
  },
  {
    question: 'How do I book an appointment?',
    answer: 'Booking is easy! You can use the appointment form, call us at 831 7575 165, or message us on WhatsApp. Our team will confirm within 24 hours.',
  },
  {
    question: 'Do you accept dental insurance?',
    answer: 'Yes, we accept most major dental insurance plans. Our team will help verify your coverage and maximize your benefits. For uninsured patients, we offer flexible financing.',
  },
  {
    question: 'What safety measures do you follow?',
    answer: 'We maintain the highest sterilization standards exceeding WHO and ADA guidelines. All instruments undergo autoclave sterilization and we follow strict cross-infection protocols.',
  },
];

function FAQItem({ faq, isOpen, onClick }: { faq: typeof faqs[0]; isOpen: boolean; onClick: () => void }) {
  const { darkMode } = useDarkMode();

  return (
    <div className={`rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 ${darkMode ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
      <button
        onClick={onClick}
        className={`w-full text-left p-4 sm:p-6 flex items-start sm:items-center justify-between gap-3 sm:gap-4 transition-colors duration-200 ${
          darkMode ? 'hover:bg-slate-700 active:bg-slate-600' : 'hover:bg-slate-50 active:bg-slate-100'
        }`}
      >
        <h3 className={`font-semibold text-sm sm:text-base flex-grow ${darkMode ? 'text-white' : 'text-slate-800'}`}>
          {faq.question}
        </h3>
        <div
          className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? 'bg-teal-600 rotate-180'
              : darkMode
                ? 'bg-slate-700'
                : 'bg-slate-100'
          }`}
        >
          <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 ${isOpen ? 'text-white' : darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`px-4 sm:px-6 pb-4 sm:pb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          <div className={`pl-3 sm:pl-4 border-l-2 border-teal-500 text-sm sm:text-base leading-relaxed ${isOpen ? 'animate-fadeIn' : ''}`}>
            {faq.answer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const { darkMode } = useDarkMode();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-600 rounded-full" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">FAQ</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Frequently Asked
            <span className="block mt-1 sm:mt-2 text-teal-600">Questions Answered</span>
          </h2>

          <p className={`text-base sm:text-lg ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Can't find what you're looking for? Contact our team directly.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </section>
  );
}
