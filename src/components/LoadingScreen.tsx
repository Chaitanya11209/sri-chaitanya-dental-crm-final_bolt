import { useEffect, useState } from 'react';
import clinicLogo from '../assets/images/regenerated_image_1782225273405.png';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <div className="mb-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <img src={clinicLogo} alt="Sri Chaitanya Dental Care" className="w-full h-auto object-contain rounded-full" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-[#0F6E6E] tracking-tight uppercase">Sri Chaitanya</h1>
            <p className="text-[10px] font-bold text-[#1D4ED8] tracking-widest uppercase">Multispeciality Dental Care</p>
          </div>
        </div>
      </div>

      <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#0F6E6E] to-[#14B8A6] transition-all duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-6 text-[#0F6E6E] text-xs font-bold uppercase tracking-wider">Loading Healthcare Platform...</p>
    </div>
  );
}
