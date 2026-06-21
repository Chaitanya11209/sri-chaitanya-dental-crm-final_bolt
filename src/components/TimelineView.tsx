import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Pill, 
  DollarSign, 
  Activity, 
  ReceiptText, 
  Search, 
  ArrowUpDown, 
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';

interface TimelineViewProps {
  appointments: any[];
  treatments: any[];
  prescriptions: any[];
}

interface TimelineEvent {
  id: string;
  timestamp: string; // Used for chronological sorting
  rawDate: string; // Date displayed
  type: 'appointment' | 'treatment' | 'prescription' | 'billing' | 'payment';
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeColor?: string;
  details?: string[];
  amount?: number;
  doctorName?: string;
}

export default function TimelineView({ appointments = [], treatments = [], prescriptions = [] }: TimelineViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Aggregate all events
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // 1. Appointments
    appointments.forEach((appt) => {
      const dateStr = appt.created_at || appt.next_visit || '';
      if (!dateStr) return;

      events.push({
        id: `appt-${appt.id}`,
        timestamp: dateStr,
        rawDate: appt.next_visit || dateStr.split('T')[0],
        type: 'appointment',
        title: appt.treatment || 'Clinical Consultation',
        subtitle: `Appointment Slot: ${appt.appointment_time || 'General Slot'} with ${appt.doctor_name || 'Dr. Sri Chaitanya'}`,
        badgeText: appt.status || 'Scheduled',
        badgeColor: appt.status === 'Completed' 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
          : appt.status === 'Cancelled' || appt.status === 'Deleted'
          ? 'bg-rose-50 text-rose-700 border-rose-100'
          : 'bg-amber-50 text-amber-700 border-amber-100',
        details: appt.notes ? [`Remarks: ${appt.notes}`] : [],
        doctorName: appt.doctor_name
      });

      // 2. Billing from same appointment
      const totalCost = Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0);
      if (totalCost > 0) {
        events.push({
          id: `bill-${appt.id}`,
          timestamp: dateStr,
          rawDate: appt.next_visit || dateStr.split('T')[0],
          type: 'billing',
          title: `Invoice Rendered: ${appt.treatment || 'Dental Service'}`,
          subtitle: `Invoice No: ${appt.invoice_no || `SDC-BILL-${appt.id || 'N/A'}`}`,
          badgeText: Number(appt.balance_amount) > 0 ? 'PARTIAL BILL' : 'PAID IN FULL',
          badgeColor: Number(appt.balance_amount) > 0
            ? 'bg-orange-50 text-orange-700 border-orange-100'
            : 'bg-teal-50 text-teal-700 border-teal-100',
          amount: totalCost,
          details: [
            `Total Charge: ₹${totalCost.toLocaleString('en-IN')}`,
            `Amount Paid: ₹${Number(appt.amount_paid || 0).toLocaleString('en-IN')}`,
            `Remaining Balance: ₹${Number(appt.balance_amount || 0).toLocaleString('en-IN')}`
          ],
          doctorName: appt.doctor_name
        });
      }

      // 3. Payment from same appointment (Cash/Card/Online transaction event)
      if (Number(appt.amount_paid) > 0) {
        events.push({
          id: `pay-${appt.id}`,
          timestamp: dateStr,
          rawDate: appt.next_visit || dateStr.split('T')[0],
          type: 'payment',
          title: `Payment Received: ${appt.payment_mode || 'Cash'}`,
          subtitle: `Successfully collected ₹${Number(appt.amount_paid).toLocaleString('en-IN')}`,
          badgeText: 'SUCCESS',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          amount: Number(appt.amount_paid),
          details: appt.payment_notes ? [`Payment Notes: ${appt.payment_notes}`] : [],
          doctorName: appt.doctor_name
        });
      }
    });

    // 4. Treatments
    treatments.forEach((t) => {
      const dateStr = t.created_at || '';
      if (!dateStr) return;

      events.push({
        id: `treat-${t.id}`,
        timestamp: dateStr,
        rawDate: dateStr.split('T')[0],
        type: 'treatment',
        title: t.treatment_type || 'Dental Procedure',
        subtitle: `Tooth System: ${t.tooth_no ? `Tooth ${t.tooth_no}` : 'General Oral Examination'}${t.doctor_name ? ` • Doctor: ${t.doctor_name}` : ''}`,
        badgeText: t.status || 'In Progress',
        badgeColor: t.status === 'Completed'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-blue-50 text-blue-700 border-blue-100',
        details: [
          `Procedure Code: ${t.tooth_no ? `Tooth ${t.tooth_no}` : 'N/A'}`,
          `Cost: ₹${Number(t.cost || 0).toLocaleString('en-IN')}`,
          `Notes: ${t.notes || 'None'}`
        ],
        doctorName: t.doctor_name
      });
    });

    // 5. Prescriptions
    prescriptions.forEach((rx: any) => {
      const dateStr = rx.date || rx.created_at || '';
      if (!dateStr) return;

      const medicinesList = rx.medicines?.map((m: any) => `${m.name} (${m.frequency || '1-0-1'} for ${m.duration || '3 days'})`).join(', ');

      events.push({
        id: `rx-${rx.id || Math.random()}`,
        timestamp: dateStr,
        rawDate: dateStr.split('T')[0],
        type: 'prescription',
        title: rx.templateName || rx.p_type || 'Prescription Issued',
        subtitle: `Prescribed by: ${rx.doctorName || 'Dr. Sri Chaitanya'}`,
        badgeText: 'Rx Active',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        details: [
          `Medicines count: ${rx.medicines?.length || 0} drugs`,
          ...(medicinesList ? [`Items: ${medicinesList}`] : []),
          ...(rx.notes ? [`Special instructions: ${rx.notes}`] : [])
        ],
        doctorName: rx.doctorName
      });
    });

    // Sort by timestamp
    events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return events;
  }, [appointments, treatments, prescriptions, sortOrder]);

  // Filter events based on search and selected type
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      const matchesSearch = 
        ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.details && ev.details.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        ev.type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'all' || ev.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [allEvents, searchTerm, filterType]);

  // Aggregate Statistics
  const stats = useMemo(() => {
    const counts = {
      appointment: 0,
      treatment: 0,
      prescription: 0,
      billing: 0,
      payment: 0
    };
    allEvents.forEach(e => {
      if (counts[e.type] !== undefined) {
        counts[e.type]++;
      }
    });
    return counts;
  }, [allEvents]);

  // Helper for setting type specific colors & icons
  const getEventMeta = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'appointment':
        return {
          icon: Calendar,
          bgColor: 'bg-amber-500',
          textColor: 'text-amber-700',
          accentBorder: 'border-l-amber-500',
          ringColor: 'ring-amber-100',
          label: 'Appointment'
        };
      case 'treatment':
        return {
          icon: Activity,
          bgColor: 'bg-blue-500',
          textColor: 'text-blue-700',
          accentBorder: 'border-l-blue-500',
          ringColor: 'ring-blue-100',
          label: 'Treatment'
        };
      case 'prescription':
        return {
          icon: Pill,
          bgColor: 'bg-indigo-500',
          textColor: 'text-indigo-700',
          accentBorder: 'border-l-indigo-500',
          ringColor: 'ring-indigo-100',
          label: 'Prescription'
        };
      case 'billing':
        return {
          icon: ReceiptText,
          bgColor: 'bg-orange-500',
          textColor: 'text-orange-700',
          accentBorder: 'border-l-orange-500',
          ringColor: 'ring-orange-100',
          label: 'Invoice'
        };
      case 'payment':
        return {
          icon: DollarSign,
          bgColor: 'bg-emerald-500',
          textColor: 'text-emerald-700',
          accentBorder: 'border-l-emerald-500',
          ringColor: 'ring-emerald-100',
          label: 'Payment'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters panel */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search chronological medical history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-700 transition"
            />
          </div>

          <div className="flex gap-2">
            {/* Sort order toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition select-none"
              title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            >
              <ArrowUpDown size={12} className="text-slate-500" />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Filter Badges Pill Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1.5 flex items-center gap-1">
            <Filter size={10} /> Filter Type:
          </span>
          {[
            { id: 'all', label: 'All History', count: allEvents.length },
            { id: 'appointment', label: 'Appointments', count: stats.appointment, icon: Calendar, activeColor: 'bg-amber-500 text-white' },
            { id: 'treatment', label: 'Treatments', count: stats.treatment, icon: Activity, activeColor: 'bg-blue-500 text-white' },
            { id: 'prescription', label: 'Prescriptions', count: stats.prescription, icon: Pill, activeColor: 'bg-indigo-500 text-white' },
            { id: 'billing', label: 'Invoices', count: stats.billing, icon: ReceiptText, activeColor: 'bg-orange-500 text-white' },
            { id: 'payment', label: 'Payments', count: stats.payment, icon: DollarSign, activeColor: 'bg-emerald-500 text-white' }
          ].map((btn) => {
            const isActive = filterType === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setFilterType(btn.id)}
                className={`py-1 px-2.5 rounded-full text-xs font-semibold cursor-pointer transition duration-150 flex items-center gap-1 border border-slate-100 select-none ${
                  isActive 
                    ? btn.id === 'all' 
                      ? 'bg-teal-600 text-white border-teal-600' 
                      : `${btn.activeColor} border-transparent`
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                {btn.icon && <btn.icon size={11} />}
                <span>{btn.label}</span>
                <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {btn.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline items list */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl space-y-2">
          <AlertCircle className="mx-auto text-slate-300" size={24} />
          <p className="text-sm font-medium">No chronological history logs found</p>
          <p className="text-xs text-slate-400">Try clearing search keywords or changing the history filter.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-100 pl-4 ml-3 py-2 space-y-5">
          {filteredEvents.map((ev) => {
            const meta = getEventMeta(ev.type);
            if (!meta) return null;
            const Icon = meta.icon;

            return (
              <div key={ev.id} className="relative group">
                {/* Glowing icon circle indicator on timeline spine */}
                <div className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full ${meta.bgColor} text-white flex items-center justify-center ring-4 ${meta.ringColor} transition duration-200 group-hover:scale-125 z-10`} title={meta.label}>
                  <Icon size={9} strokeWidth={2.5} />
                </div>
                
                {/* Timeline Card details */}
                <div className={`bg-white border-l-4 ${meta.accentBorder} border-y border-r border-slate-100 hover:border-slate-200/80 p-3.5 rounded-r-xl transition shadow-xs hover:shadow-sm`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 ${meta.textColor} rounded-md tracking-wide`}>
                        {meta.label}
                      </span>
                      <span className="text-slate-300 text-xs">|</span>
                      <span className="text-xs font-extrabold text-slate-400 font-mono">
                        {new Date(ev.rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {ev.badgeText && (
                      <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border-xs uppercase font-mono shadow-3xs tracking-wider self-start sm:self-center ${ev.badgeColor}`}>
                        {ev.badgeText}
                      </span>
                    )}
                  </div>
                  
                  <h5 className="font-extrabold text-[13px] text-slate-800 tracking-tight leading-snug">{ev.title}</h5>
                  <p className="text-[11px] text-slate-500 font-medium">{ev.subtitle}</p>

                  {/* Render list of specific details */}
                  {ev.details && ev.details.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-105/50 text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded-lg space-y-1">
                      {ev.details.map((det, i) => (
                        <p key={i} className="font-semibold text-slate-600 leading-relaxed flex items-start gap-1">
                          <span className="text-slate-350 select-none">•</span>
                          <span>{det}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
