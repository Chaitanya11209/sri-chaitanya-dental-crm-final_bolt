import { useEffect, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Stethoscope, ChevronDown, Check, Search } from 'lucide-react';

export interface Doctor {
  id: number | string;
  name: string;
  phone?: string;
  qualification?: string;
  specialization?: string;
  status?: string;
}

export const FALLBACK_SELECT_DOCTORS: Doctor[] = [
  { id: 1, name: 'Dr. Sri Chaitanya', phone: '918317575165', qualification: 'BDS, MDS', specialization: 'Chief Implantologist' },
  { id: 2, name: 'Dr. K. Verma', phone: '919988776655', qualification: 'BDS', specialization: 'Consultant Oral Surgeon' }
];

interface DoctorSelectProps {
  selectedId?: string | number;
  selectedName?: string;
  onChange: (doc: Doctor) => void;
  required?: boolean;
  label?: string;
  className?: string;
}

export default function DoctorSelect({
  selectedId,
  selectedName,
  onChange,
  required = false,
  label = "Consulting Specialist",
  className = ""
}: DoctorSelectProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDoctorsList = async () => {
      try {
        if (!isSupabaseConfigured) {
          const stored = localStorage.getItem('sandbox_doctors');
          if (stored) {
            const list = JSON.parse(stored);
            setDoctors(list.filter((d: any) => d.status === 'Active'));
          } else {
            setDoctors(FALLBACK_SELECT_DOCTORS);
          }
          return;
        }

        const { data, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('status', 'Active')
          .order('name', { ascending: true });

        if (error) throw error;
        setDoctors(data && data.length > 0 ? data : FALLBACK_SELECT_DOCTORS);
      } catch (err) {
        const stored = localStorage.getItem('sandbox_doctors');
        if (stored) {
          const list = JSON.parse(stored);
          setDoctors(list.filter((d: any) => d.status === 'Active'));
        } else {
          setDoctors(FALLBACK_SELECT_DOCTORS);
        }
      }
    };

    fetchDoctorsList();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find currently selected doctor
  const currentDoc = doctors.find(
    (d) =>
      (selectedId && d.id.toString() === selectedId.toString()) ||
      (selectedName && d.name.toLowerCase() === selectedName.toLowerCase())
  ) || doctors[0];

  const filteredDoctors = doctors.filter((d) => {
    const s = search.toLowerCase();
    return (
      !s ||
      d.name.toLowerCase().includes(s) ||
      (d.specialization || '').toLowerCase().includes(s) ||
      (d.qualification || '').toLowerCase().includes(s)
    );
  });

  return (
    <div ref={containerRef} className={`space-y-1 relative ${className}`}>
      {label && (
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition duration-150 focus:outline-none focus:ring-1 focus:ring-teal-500 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Stethoscope size={14} className="text-teal-500 shrink-0" />
            <span className="truncate">{currentDoc ? currentDoc.name : 'Select Specialist'}</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col">
            <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50/50">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search specialist or specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-xs text-slate-700 placeholder:text-slate-400 focus:ring-0 p-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 max-h-48">
              {filteredDoctors.length === 0 ? (
                <div className="p-3 text-[11px] text-slate-400 italic text-center">
                  No active specialists match.
                </div>
              ) : (
                filteredDoctors.map((doc) => {
                  const isSelected = currentDoc && currentDoc.id.toString() === doc.id.toString();
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        onChange(doc);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`w-full p-2.5 text-left hover:bg-teal-50/50 cursor-pointer flex items-center justify-between gap-2 transition ${
                        isSelected ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-bold text-slate-800 text-xs truncate">
                          {doc.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                          <span className="text-teal-600 truncate">{doc.qualification || doc.specialization || 'Dental Specialist'}</span>
                          <span>•</span>
                          <span className="text-slate-400 truncate">{doc.specialization || 'Clinical'}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-teal-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
