import { useEffect, useRef, useState } from 'react';
import { Shield, Zap, Users, Heart, Clock, Building2 } from 'lucide-react';
import { useDarkMode } from '../App';

const features = [
  {
    icon: Shield,
    title: 'Pain-Free Treatment',
    description: 'Advanced anesthesia and sedation options ensure completely painless procedures.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Zap,
    title: 'Advanced Technology',
    description: '3D imaging, laser dentistry, and computer-guided surgery for precision results.',
    color: 'from-yellow-500 to-amber-500',
  },
  {
    icon: Users,
    title: 'Experienced Team',
    description: 'Our specialists have 50+ combined years of expertise in modern dentistry.',
    color: 'from-teal-500 to-teal-600',
  },
  {
    icon: Heart,
    title: 'Personalized Care',
    description: 'Every treatment plan is tailored to your unique needs, goals, and budget.',
    color: 'from-rose-500 to-pink-500',
  },
  {
    icon: Clock,
    title: 'Flexible Scheduling',
    description: 'Evening and weekend appointments available. Same-day emergency care.',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Building2,
    title: 'Modern Facilities',
    description: 'State-of-the-art clinic designed for comfort, safety, and optimal outcomes.',
    color: 'from-emerald-500 to-green-500',
  },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const { darkMode } = useDarkMode();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setInView(true), index * 100);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      className={`group p-4 sm:p-6 rounded-xl sm:rounded-2xl transition-all duration-500 ${
        darkMode
          ? 'bg-slate-800 hover:bg-slate-700'
          : 'bg-white hover:shadow-xl hover:shadow-slate-200/60'
      } ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 sm:mb-5 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
        <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
      </div>

      <h3 className={`text-lg sm:text-xl font-semibold mb-2 sm:mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
        {feature.title}
      </h3>

      <p className={`text-xs sm:text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        {feature.description}
      </p>
    </div>
  );
}

export default function WhyChooseUs() {
  const { darkMode } = useDarkMode();

  return (
    <section className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-teal-600 rounded-full" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Why Choose Us</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Exceptional Care,
            <span className="block mt-1 sm:mt-2 text-teal-600">Every Step of the Way</span>
          </h2>

          <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            We combine expertise, technology, and compassion to deliver dental experiences that exceed expectations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
