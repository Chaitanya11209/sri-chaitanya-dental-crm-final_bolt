import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { useDarkMode } from '../App';

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
}

function BeforeAfterSlider({ before, after, beforeAlt, afterAlt }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging || e.buttons === 1) handleMove(e.clientX);
  };
  const handleClick = (e: React.MouseEvent) => handleMove(e.clientX);

  const handleTouchStart = () => setIsDragging(true);
  const handleTouchEnd = () => setIsDragging(false);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden cursor-ew-resize select-none shadow-lg sm:shadow-xl touch-pan-y"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <img
        src={after}
        alt={afterAlt}
        className="absolute inset-0 w-full h-full object-cover"
        draggable="false"
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={before}
          alt={beforeAlt}
          className="w-full h-full object-cover"
          draggable="false"
        />
      </div>

      <div
        className="absolute top-0 bottom-0 w-0.5 sm:w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 sm:w-10 h-8 sm:h-10 bg-white rounded-full shadow-xl flex items-center justify-center">
          <div className="flex items-center gap-0.5">
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600" />
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-600" />
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-2 sm:bottom-4 left-2 sm:left-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-900/80 text-white text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg backdrop-blur-sm ${sliderPosition < 20 ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: 'opacity 0.2s' }}
      >
        BEFORE
      </div>

      <div
        className={`absolute bottom-2 sm:bottom-4 right-2 sm:right-4 px-2 sm:px-3 py-1 sm:py-1.5 bg-teal-600/80 text-white text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg backdrop-blur-sm ${sliderPosition > 80 ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: 'opacity 0.2s' }}
      >
        AFTER
      </div>
    </div>
  );
}

const cases = [
  {
    before: 'https://blog.dentalchat.com/wp-content/uploads/2019/03/1-bad-teeth-image-adult-img.png',
    after: 'https://images.unsplash.com/photo-1658847075261-84ecf3e4ca56?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fFRlZXRoJTIwYWZ0ZXJ0cmVhdG1lbnR8ZW58MHx8MHx8fDA%3D',
    beforeAlt: 'Teeth before treatment',
    afterAlt: 'Teeth after whitening treatment',
    title: 'Professional Whitening',
    patient: 'Manjula Reddy',
    treatment: 'LED Whitening',
    duration: '1 Session',
  },
  {
    before: 'https://i0.wp.com/post.healthline.com/wp-content/uploads/2019/04/Crooked-bottom-teeth-1296x728-gallery_slide1.jpg?w=1155',
    after: 'https://asset3.toothsi.in/Screen_Shot_2020_08_05_at_9_19_34_PM_7ae9289f75_2ab_7c6a0b1eac.jpeg?q=75&w=1920',
    beforeAlt: 'Teeth alignment before',
    afterAlt: 'Teeth alignment after Invisalign',
    title: 'Invisalign Treatment',
    patient: 'Anvesh Ponugoti',
    treatment: 'Invisible Aligners',
    duration: '8 Months',
  },
  {
    before: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVWyZBvDV_DkVX79bhmmjP9i4MHiqiPGrfzQ&s',
    after: 'https://drruchidental.com/wp-content/uploads/2025/11/What-Are-Dental-Veneers-and-How-Do-They-Work-3.jpg',
    beforeAlt: 'Smile with gaps before',
    afterAlt: 'Smile with veneers',
    title: 'Porcelain Veneers',
    patient: 'Ramya M',
    treatment: 'Smile Makeover',
    duration: '2 Visits',
  },
];

export default function BeforeAfter() {
  const { darkMode } = useDarkMode();
  const [activeCase, setActiveCase] = useState(0);

  return (
    <section id="results" className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Real Results</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            See the Transformation
            <span className="block mt-1 sm:mt-2 text-teal-600">Your Smile Journey</span>
          </h2>

          <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Drag the slider to compare before and after photos of actual patients.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-10">
          {cases.map((caseItem, index) => (
            <button
              key={index}
              onClick={() => setActiveCase(index)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 ${activeCase === index
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                : darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {caseItem.title}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
          <div className="relative">
            <BeforeAfterSlider
              before={cases[activeCase].before}
              after={cases[activeCase].after}
              beforeAlt={cases[activeCase].beforeAlt}
              afterAlt={cases[activeCase].afterAlt}
            />
          </div>

          <div className={`p-4 sm:p-8 rounded-xl sm:rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <h3 className={`text-xl sm:text-2xl font-bold mb-3 sm:mb-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {cases[activeCase].title}
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className={`text-center p-3 sm:p-4 rounded-lg sm:rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                <p className={`text-[10px] sm:text-xs mb-0.5 sm:mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Patient</p>
                <p className={`text-xs sm:text-sm sm:text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{cases[activeCase].patient}</p>
              </div>
              <div className={`text-center p-3 sm:p-4 rounded-lg sm:rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                <p className={`text-[10px] sm:text-xs mb-0.5 sm:mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Treatment</p>
                <p className={`text-xs sm:text-sm sm:text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{cases[activeCase].treatment}</p>
              </div>
              <div className={`text-center p-3 sm:p-4 rounded-lg sm:rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                <p className={`text-[10px] sm:text-xs mb-0.5 sm:mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Duration</p>
                <p className={`text-xs sm:text-sm sm:text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{cases[activeCase].duration}</p>
              </div>
            </div>

            <p className={`text-sm sm:text-base mb-4 sm:mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Every patient receives a customized treatment plan designed to achieve optimal results. Our advanced technology ensures predictable outcomes.
            </p>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex -space-x-1.5 sm:-space-x-2">
                {[1, 2, 3].map((i) => (
                  <img
                    key={i}
                    src={`https://plus.unsplash.com/premium_photo-1671656349322-41de944d259b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bWVufGVufDB8fDB8fHww/${300 + i}/people?auto=compress&cs=tinysrgb&w=100`}
                    alt="Verified patient"
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-800 object-cover"
                  />
                ))}
              </div>
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className="font-semibold text-teal-600">500+</span> successful treatments
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
