import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useDarkMode } from '../App';

const testimonials = [
  {
    name: 'Jennifer Adams',
    date: 'March 2026',
    rating: 5,
    text: "Dr. Mitchell completely transformed my smile. I was terrified of dentists, but her gentle approach and clear communication put me at ease. The results exceeded my expectations!",
    treatment: 'Full Smile Makeover',
    image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Michael Chen',
    date: 'February 2026',
    rating: 5,
    text: "After years of hiding my smile, I finally got dental implants here. The 3D technology they use is incredible - I could see exactly what my new teeth would look like!",
    treatment: 'Dental Implants',
    image: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Sarah Williams',
    date: 'January 2026',
    rating: 5,
    text: "My kids actually look forward to their dental appointments now! The pediatric team makes every visit fun and educational. Best decision we ever made.",
    treatment: 'Pediatric Care',
    image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Robert Johnson',
    date: 'December 2025',
    rating: 5,
    text: "Professional teeth whitening here transformed my wedding photos. The team was amazing - they even opened early to accommodate my schedule. Highly recommend!",
    treatment: 'Teeth Whitening',
    image: 'https://images.pexels.com/photos/937481/pexels-photo-937481.jpeg?auto=compress&cs=tinysrgb&w=200',
  },
  {
    name: 'Lisa Martinez',
    date: 'November 2025',
    rating: 5,
    text: "My root canal was completely painless. I couldn't believe it! Dr. Mitchell's expertise with microscopic dentistry is remarkable.",
    treatment: 'Root Canal Treatment',
    image: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200',
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
            <div className={`p-4 sm:p-8 lg:p-12 ${darkMode ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-50 to-teal-50'}`}>
              <div className="flex flex-col items-center text-center">
                <div className="flex-shrink-0 mb-4 sm:mb-6">
                  <div className="relative inline-block">
                    <img
                      src={testimonials[activeIndex].image}
                      alt={testimonials[activeIndex].name}
                      className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full object-cover ring-4 ring-teal-100 dark:ring-teal-900"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-teal-600 rounded-full flex items-center justify-center">
                      <Quote className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                </div>

                <div className="flex-grow w-full">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                    <div className="flex gap-1">
                      {Array.from({ length: testimonials[activeIndex].rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                      {testimonials[activeIndex].treatment}
                    </span>
                  </div>

                  <p className={`text-base sm:text-lg lg:text-xl mb-4 sm:mb-6 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    "{testimonials[activeIndex].text}"
                  </p>

                  <div>
                    <p className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                      {testimonials[activeIndex].name}
                    </p>
                    <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      {testimonials[activeIndex].date}
                    </p>
                  </div>
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
