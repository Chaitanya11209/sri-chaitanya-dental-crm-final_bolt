import { useState } from 'react';
import { ShieldCheck, FlameKindling, Info, Sparkles, Heart } from 'lucide-react';

export type ToothStatus = 'Healthy' | 'Caries' | 'Filled' | 'Crown' | 'Root Canal' | 'Missing' | 'Extraction' | 'Implant' | 'Bridge';

export interface DentalChartProps {
  chartData: Record<string, ToothStatus>;
  onChange: (tooth: string, status: ToothStatus) => void;
  onAddTreatment: (tooth: string, status: ToothStatus) => void;
}

const TOOTH_STATUSES: { id: ToothStatus; label: string; color: string; border: string; desc: string }[] = [
  { id: 'Healthy', label: 'Healthy', color: 'bg-emerald-500', border: 'border-emerald-600', desc: 'No issues detected' },
  { id: 'Caries', label: 'Caries (Cavity)', color: 'bg-rose-500', border: 'border-rose-600', desc: 'Active tooth decay' },
  { id: 'Filled', label: 'Filled', color: 'bg-sky-500', border: 'border-sky-600', desc: 'Dental filling applied' },
  { id: 'Crown', label: 'Crown', color: 'bg-amber-500', border: 'border-amber-600', desc: 'Cap or crown installed' },
  { id: 'Root Canal', label: 'Root Canal', color: 'bg-violet-500', border: 'border-violet-600', desc: 'Root Canal Treatment' },
  { id: 'Missing', label: 'Missing', color: 'bg-slate-300', border: 'border-slate-400', desc: 'Absent or extracted' },
  { id: 'Extraction', label: 'Extraction', color: 'bg-orange-500', border: 'border-orange-600', desc: 'Removal scheduled' },
  { id: 'Implant', label: 'Implant', color: 'bg-teal-600', border: 'border-teal-700', desc: 'Successful implant prosthetic' },
  { id: 'Bridge', label: 'Bridge', color: 'bg-fuchsia-500', border: 'border-fuchsia-600', desc: 'Dental bridge prosthetic' },
];

export default function DentalChart({ chartData, onChange, onAddTreatment }: DentalChartProps) {
  const [chartType, setChartType] = useState<'adult' | 'child'>('adult');
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  // Universal System Tooth lists
  const adultTeethUpper = Array.from({ length: 16 }, (_, i) => String(i + 1));      // 1 to 16 (Upper R -> L)
  const adultTeethLower = Array.from({ length: 16 }, (_, i) => String(32 - i));     // 17 to 32 (Lower R -> L drawn mirror)
  
  const childTeethUpper = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const childTeethLower = ['T', 'S', 'R', 'Q', 'P', 'O', 'N', 'M', 'L', 'K'];

  const handleToothClick = (tooth: string) => {
    setSelectedTooth(selectedTooth === tooth ? null : tooth);
  };

  const handleStatusChange = (status: ToothStatus) => {
    if (!selectedTooth) return;
    onChange(selectedTooth, status);
    setSelectedTooth(null);
  };

  const handleRecordTreatment = () => {
    if (!selectedTooth) return;
    const currentStatus = chartData[selectedTooth] || 'Healthy';
    onAddTreatment(selectedTooth, currentStatus);
    setSelectedTooth(null);
  };

  const getToothStyle = (tooth: string) => {
    const status = chartData[tooth] || 'Healthy';
    const cellClass = TOOTH_STATUSES.find(s => s.id === status);
    return cellClass ? `${cellClass.color} text-white` : 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Heart size={16} className="text-teal-600 fill-teal-50" />
            Interactive Anatomical Charting
          </h3>
          <p className="text-[11px] text-slate-500">Click on any tooth to view diagnosis, update health status, or plan direct clinical bookings</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setChartType('adult'); setSelectedTooth(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'adult' ? 'bg-white shadow-xs text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Adult Chart (1-32)
          </button>
          <button
            onClick={() => { setChartType('child'); setSelectedTooth(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'child' ? 'bg-white shadow-xs text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Child Chart (A-T)
          </button>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="bg-slate-50/60 rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center space-y-6 overflow-x-auto">
        <div className="min-w-[620px] text-center space-y-5">
          {/* Upper Jaw */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Upper Arch (Maxillary)</div>
            <div className="flex justify-center gap-1.5">
              {(chartType === 'adult' ? adultTeethUpper : childTeethUpper).map(tooth => {
                const status = chartData[tooth] || 'Healthy';
                const isSelected = selectedTooth === tooth;
                return (
                  <button
                    key={tooth}
                    onClick={() => handleToothClick(tooth)}
                    className={`w-9 h-11 rounded-t-lg rounded-b-md border transition-all flex flex-col items-center justify-between py-1 shadow-xs hover:scale-105 active:scale-95 ${
                      isSelected ? 'ring-3 ring-teal-500 border-teal-500 z-10 scale-105' : 'border-slate-205'
                    } ${getToothStyle(tooth)}`}
                    title={`Tooth ${tooth} - ${status}`}
                  >
                    <span className="text-[10px] font-extrabold">{tooth}</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-white/25 border border-white/40 shadow-inner flex items-center justify-center text-[7px]" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* midline visual */}
          <div className="relative h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent flex items-center justify-center">
            <span className="absolute px-2.5 py-0.5 bg-white border border-slate-100 text-[8px] font-black tracking-widest text-slate-400 rounded-full uppercase">MIDLINE</span>
          </div>

          {/* Lower Jaw */}
          <div className="space-y-1">
            <div className="flex justify-center gap-1.5">
              {(chartType === 'adult' ? adultTeethLower : childTeethLower).map(tooth => {
                const status = chartData[tooth] || 'Healthy';
                const isSelected = selectedTooth === tooth;
                return (
                  <button
                    key={tooth}
                    onClick={() => handleToothClick(tooth)}
                    className={`w-9 h-11 rounded-b-lg rounded-t-md border transition-all flex flex-col items-center justify-between py-1 shadow-xs hover:scale-105 active:scale-95 ${
                      isSelected ? 'ring-3 ring-teal-500 border-teal-500 z-10 scale-105' : 'border-slate-205'
                    } ${getToothStyle(tooth)}`}
                    title={`Tooth ${tooth} - ${status}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white/25 border border-white/40 shadow-inner" />
                    <span className="text-[10px] font-extrabold">{tooth}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">Lower Arch (Mandibular)</div>
          </div>
        </div>
      </div>

      {/* Tooth Details Dialogue / Selection */}
      {selectedTooth ? (
        <div className="bg-teal-500/10 border border-teal-500/25 p-4 rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-teal-850">
                Editing Tooth #{selectedTooth} <span className="font-medium text-[11px] text-teal-650">(Current status: {chartData[selectedTooth] || 'Healthy'})</span>
              </p>
              <p className="text-[10px] text-teal-650">Set a localized health parameter below, or log a treatment event</p>
            </div>
            <button
              onClick={handleRecordTreatment}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition self-start"
            >
              + Create Treatment Entry
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 pt-1">
            {TOOTH_STATUSES.map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => handleStatusChange(id)}
                className="group flex flex-col items-center p-1 rounded-lg border border-slate-200/50 hover:bg-white text-center hover:border-teal-500 transition-all cursor-pointer"
                title={label}
              >
                <span className={`w-3 h-3 rounded-full ${color} mb-1 shadow-inner`} />
                <span className="text-[8px] font-bold text-slate-600 group-hover:text-teal-700 line-clamp-1">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-slate-550 leading-relaxed">
            The dental mapping is saved persistently with the SDC Patient ID profile. When a tooth is logged as <strong>Caries</strong> or <strong>Missing</strong>, clicking <span className="font-semibold text-teal-700">"Create Treatment Entry"</span> will automatically pre-populate the treatment system with specified tooth information.
          </p>
        </div>
      )}

      {/* Legend Block */}
      <div className="pt-2 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Diagnosis Legend & Parameters</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {TOOTH_STATUSES.map(({ id, label, color, desc }) => (
            <div key={id} className="flex items-start gap-2 p-1.5 bg-slate-50/50 hover:bg-slate-50 rounded-lg border border-slate-100 transition">
              <span className={`w-3.5 h-3.5 rounded-md ${color} flex-shrink-0 shadow-xs`} />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-700 leading-none">{label}</p>
                <p className="text-[8px] text-slate-400 mt-0.5 leading-tight truncate" title={desc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
