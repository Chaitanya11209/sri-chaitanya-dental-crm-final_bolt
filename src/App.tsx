import {
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';

import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustIndicators from './components/TrustIndicators';
import MeetDentist from './components/MeetDentist';
import Services from './components/Services';
import BeforeAfter from './components/BeforeAfter';
import WhyChooseUs from './components/WhyChooseUs';
import Testimonials from './components/Testimonials';
import Gallery from './components/Gallery';
import Appointment from './components/Appointment';
import FAQ from './components/FAQ';
import Location from './components/Location';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import ScrollProgress from './components/ScrollProgress';
import WhatsAppButton from './components/WhatsAppButton';
import BackToTop from './components/BackToTop';
import LoadingScreen from './components/LoadingScreen';

interface DarkModeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const DarkModeContext =
  createContext<DarkModeContextType>({
    darkMode: false,
    toggleDarkMode: () => {},
  });

export const useDarkMode = () =>
  useContext(DarkModeContext);

function App() {

  const [darkMode, setDarkMode] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    return () => clearTimeout(timer);

  }, []);

  // Global scroll-reveal: auto-mark every top-level section in <main>
  // and observe with IntersectionObserver.
  useEffect(() => {
    if (loading) return;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>('main > *')
    );
    targets.forEach((el) => el.classList.add('reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [loading]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (

    <DarkModeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
      }}
    >

      <div
        className={`min-h-screen transition-colors duration-500 ${
          darkMode
            ? 'bg-slate-900'
            : 'bg-[#FAF7F0]'
        }`}
      >

        <ScrollProgress />

        <Navbar />

        <main>

          <Hero />

          <TrustIndicators />

          <MeetDentist />

          <Services />

          <BeforeAfter />

          <WhyChooseUs />

          <Testimonials />

          <Gallery />

          <Appointment />

          <FAQ />

          <Location />

          <FinalCTA />

        </main>

        <Footer />

        <WhatsAppButton />

        <BackToTop />

      </div>

    </DarkModeContext.Provider>
  );
}

export default App;
