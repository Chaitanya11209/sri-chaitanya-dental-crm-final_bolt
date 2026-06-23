import { clinicConfig } from '../config/clinicConfig';
import clinicLogo from '../assets/images/regenerated_image_1782225273405.png';

interface DentalLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: number;
  textColor?: string;
}

export default function DentalLogo({ 
  className = "", 
  iconOnly = false, 
  size = 24, 
  textColor = "text-slate-900" 
}: DentalLogoProps) {
  return (
    <div id="dental-logo-container" className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Clinic Logo Image */}
      <div className="w-8 h-8 rounded-full bg-teal-50/50 p-0.5 flex items-center justify-center border border-teal-100/60 flex-shrink-0">
        <img 
          src={clinicLogo} 
          alt="Sri Chaitanya Logo" 
          className="w-full h-full object-contain rounded-full"
        />
      </div>
      
      {/* Brand Typography */}
      {!iconOnly && (
        <div id="dental-logo-text" className="flex flex-col">
          <span className={`text-[12px] font-black tracking-tight leading-none ${textColor} uppercase`}>
            SRI CHAITANYA
          </span>
          <span className="text-[7.5px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-widest mt-1 leading-none font-sans">
            MULTISPECIALITY DENTAL CARE
          </span>
        </div>
      )}
    </div>
  );
}
