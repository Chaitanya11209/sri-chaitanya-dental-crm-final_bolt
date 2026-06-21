import { clinicConfig } from '../config/clinicConfig';

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
    <div id="dental-logo-container" className={`flex items-center select-none ${className}`}>
      {/* Brand Typography */}
      {!iconOnly && (
        <div id="dental-logo-text" className="flex flex-col">
          <span className={`text-[12px] font-black tracking-tight leading-none ${textColor} uppercase`}>
            {clinicConfig.clinicName.replace(" MULTISPECIALITY DENTAL CARE", "")}
          </span>
          <span className="text-[7.5px] font-bold text-[#6B7280] uppercase tracking-widest mt-0.5 leading-none">
            MULTISPECIALITY DENTAL CARE
          </span>
        </div>
      )}
    </div>
  );
}
