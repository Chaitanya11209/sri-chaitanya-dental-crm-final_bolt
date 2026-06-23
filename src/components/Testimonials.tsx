import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useDarkMode } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

const testimonials = [
  {
    name: 'Bala Krishna',
    date: 'April 2026',
    rating: 5,
    text: "I recently underwent root canal treatment for two of my teeth at Sri Chaitanya Dental Clinic, and I had an excellent experience. Dr Durga Bhavani was highly professional, patient, and took the time to provide a detailed analysis of my teeth using the X-rays, which made me feel very comfortable and informed about the procedure. The treatment itself went smoothly and was handled with great care. The entire staff was professional and care. Highly recommend this clinic for anyone looking for dental treatment.",
    treatment: 'Full Smile Makeover',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=300&h=300&q=80',
  },
  {
    name: 'Anusha P',
    date: 'February 2026',
    rating: 5,
    text: "I visited Sri Chaitanya Dental care and underwent a root canal treatment with a crown cap.Dr. Bhavani is very experienced and clearly explained each step of the procedure.The entire treatment was completed in three sittings with great care and expertise.She handled everything gently and professionally, which made me feel comfortable.I am very happy with the treatment, and the clinic ambience is positive, neat, and clean.",
    treatment: 'Dental Implants',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fit=crop&w=300&h=300&q=80',
  },
  {
    name: 'Murali Krishna',
    date: 'January 2025',
    rating: 5,
    text: "I highly recommend Dr. Bhavani at Sri Chaitanya Dental Clinic. I took my 11-year-old son there for a root canal treatment, and the experience was exceptional. Dr. Bhavani is very professional, friendly, and truly takes the time to listen to the patient's concerns.She used X-rays to find the exact root cause and explained the entire process carefully. I really appreciated that there were no unwanted treatments suggested. The procedure itself was done with great care, including multiple follow-up checks to ensure everything was perfect. If you're looking for a trustworthy dentist this is the place!",
    treatment: 'Pediatric Care',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fit=crop&w=300&h=300&q=80',
  },
  {
    name: 'Ramya M',
    date: 'May 2025',
    rating: 5,
    text: "Thank you so much, Dr. Bhavani, for the root canal treatment for me and my son. We really appreciate your patience and calm way of treating patients—especially kids, which makes such a big difference. You made the whole process comfortable and stress-free for both of us. Truly grateful for your care, kindness, and gentle approach.Sri chaitanya dental clinic is the best clinic for any dental issues where all the upgraded technology is used and recommended for all.Wish you a happy new year and please do continue your best services.Thank you once again",
    treatment: 'Teeth Whitening',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fit=crop&w=300&h=300&q=80',
  },
  {
    name: 'Pindra Lalitha',
    date: 'March 2025',
    rating: 5,
    text: "I recently visited this dental hospital with my mother, and we were blown away by the friendly doctor and the excellent treatment she received. The root canal treatment for her 2 teeth was done with utmost care and professionalism. Highly recommend this hospital for anyone looking for quality dental care!",
    treatment: 'Root Canal Treatment',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=300&h=300&q=80',
  },
];

export default function Testimonials() {
  const { darkMode } = useDarkMode();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToPrev = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section id="reviews" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Patient Reviews</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            What Our Patients Say
            <span className="block mt-1 sm:mt-2 text-teal-600">Real Stories, Real Smiles</span>
          </h2>

          <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <span className="font-semibold text-slate-800 dark:text-white">4.9/5</span>
            </div>
            <span className="hidden sm:block text-slate-400">•</span>
            <span className="text-xs sm:text-sm">Based on 500+ reviews</span>
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl">
            <div className={`p-4 sm:p-8 lg:p-12 ${darkMode ? 'bg-slate-800 animate-fade-in' : 'bg-gradient-to-br from-slate-50 to-teal-50'}`}>
              <div className="flex flex-col items-center text-center">
                <div className="flex-shrink-0 mb-4 sm:mb-6">
                  <div className="relative inline-block group">
                    {/* Glowing outer aura that matches brand color */}
                    <div className="absolute -inset-1.5 bg-gradient-to-tr from-teal-500 via-emerald-400 to-teal-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition-all duration-500 animate-pulse" />
                    
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full p-1 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={activeIndex}
                          initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.9, rotate: 4 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          src={testimonials[activeIndex].image}
                          alt={testimonials[activeIndex].name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </AnimatePresence>
                    </div>
                    
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 20 }}
                      className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-teal-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900"
                    >
                      <Quote className="w-3 h-3 sm:w-4 sm:h-4 text-white fill-white/10" />
                    </motion.div>
                  </div>
                </div>

                <div className="flex-grow w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeIndex}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col items-center"
                    >
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex gap-1">
                          {Array.from({ length: testimonials[activeIndex].rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400 animate-bounce" style={{ animationDelay: `${i * 100}ms`, animationDuration: '2s' }} />
                          ))}
                        </div>
                        <span className={`text-xs sm:text-sm font-semibold tracking-wide uppercase ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                          {testimonials[activeIndex].treatment}
                        </span>
                      </div>

                      <p className={`text-base sm:text-lg lg:text-xl mb-4 sm:mb-6 leading-relaxed max-w-2xl px-2 font-serif italic ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        "{testimonials[activeIndex].text}"
                      </p>

                      <div>
                        <p className={`font-bold text-lg sm:text-xl tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                          {testimonials[activeIndex].name}
                        </p>
                        <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                          {testimonials[activeIndex].date}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-4 mt-4 sm:mt-6">
            <button
              onClick={goToPrev}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-white hover:bg-teal-50 text-slate-700 shadow-md sm:shadow-lg'
              }`}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={goToNext}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-white hover:bg-teal-50 text-slate-700 shadow-md sm:shadow-lg'
              }`}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="flex justify-center gap-1.5 sm:gap-2 mt-4 sm:mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsAutoPlaying(false);
                  setActiveIndex(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? 'w-5 sm:w-6 bg-teal-600'
                    : `w-2 ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400'}`
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
