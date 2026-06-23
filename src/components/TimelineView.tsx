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
  FileText,
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Eye,
  TrendingUp,
  X,
  Maximize2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TimelineViewProps {
  appointments: any[];
  treatments: any[];
  prescriptions: any[];
  uploadedImages?: any[];
  onUploadImage?: (url: string, name: string, category: string, notes: string) => void;
  onDeleteImage?: (id: string) => void;
}

interface TimelineEvent {
  id: string;
  timestamp: string; // Used for chronological sorting
  rawDate: string; // Date displayed
  type: 'appointment' | 'treatment' | 'prescription' | 'billing' | 'payment' | 'image';
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeColor?: string;
  details?: string[];
  amount?: number;
  doctorName?: string;
  imageUrl?: string;
  category?: string;
}

export default function TimelineView({ 
  appointments = [], 
  treatments = [], 
  prescriptions = [],
  uploadedImages = [],
  onUploadImage,
  onDeleteImage
}: TimelineViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Local state for expandable upload drawer panel
  const [showUploadPane, setShowUploadPane] = useState(false);
  const [newImageForm, setNewImageForm] = useState({
    name: '',
    category: 'X-Ray / OPG',
    notes: '',
    tempUrl: ''
  });
  const [uploadError, setUploadError] = useState('');

  // Lightbox zoom view state
  const [activeLightboxImage, setActiveLightboxImage] = useState<any>(null);

  // Convert uploaded file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Size limit exceeded: keep attachments under 2MB.');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewImageForm(prev => ({
        ...prev,
        tempUrl: reader.result as string,
        name: prev.name || file.name.split('.')[0]
      }));
    };
    reader.readAsDataURL(file);
  };

  const submitUploadedImage = () => {
    if (!newImageForm.tempUrl || !newImageForm.name) {
      setUploadError('Both description code and image file are required.');
      return;
    }
    if (onUploadImage) {
      onUploadImage(newImageForm.tempUrl, newImageForm.name, newImageForm.category, newImageForm.notes);
    }
    setNewImageForm({ name: '', category: 'X-Ray / OPG', notes: '', tempUrl: '' });
    setShowUploadPane(false);
  };

  // Aggregate all events chronologically
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
        badgeText: t.stage || t.status || 'In Progress',
        badgeColor: t.stage === 'Completed' || t.status === 'Completed'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-blue-50 text-blue-700 border-blue-100',
        details: [
          `Procedure Code: ${t.tooth_no ? `Tooth ${t.tooth_no}` : 'N/A'}`,
          `Cost: ₹${Number(t.cost || 0).toLocaleString('en-IN')}`,
          `Treatment Remarks: ${t.notes || t.treatment_notes || 'None'}`
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

    // 6. Uploaded clinical images / radiographs
    if (uploadedImages && uploadedImages.length > 0) {
      uploadedImages.forEach((img: any) => {
        const dateStr = img.date || img.created_at || '';
        if (!dateStr) return;

        events.push({
          id: img.id,
          timestamp: dateStr,
          rawDate: dateStr.split('T')[0],
          type: 'image',
          title: img.name || 'X-Ray / Diagnostic Scan',
          subtitle: `Uploaded under repository folder: ${img.category || 'Clinical Image'}`,
          badgeText: (img.category || 'X-Ray').toUpperCase(),
          badgeColor: 'bg-violet-50 text-violet-700 border-violet-100',
          details: img.notes ? [`Clinical Observation: ${img.notes}`] : ['Standard radiograph attachment saved.'],
          imageUrl: img.url
        });
      });
    }

    // Sort by timestamp
    events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return events;
  }, [appointments, treatments, prescriptions, uploadedImages, sortOrder]);

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

  // Aggregated Monthly activity count for Recharts
  const monthlyActivityTrend = useMemo(() => {
    const dataMap: Record<string, { month: string; Appointments: number; Treatments: number; Scans: number }> = {};
    
    // Sort oldest first for natural left-to-right plotting
    const oldestFirst = [...allEvents].reverse();
    
    oldestFirst.forEach(ev => {
      if (!ev.rawDate) return;
      try {
        const d = new Date(ev.rawDate);
        if (isNaN(d.getTime())) return;
        const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        
        if (!dataMap[key]) {
          dataMap[key] = { month: key, Appointments: 0, Treatments: 0, Scans: 0 };
        }
        
        if (ev.type === 'appointment') {
          dataMap[key].Appointments++;
        } else if (ev.type === 'treatment') {
          dataMap[key].Treatments++;
        } else if (ev.type === 'image') {
          dataMap[key].Scans++;
        }
      } catch (err) {
        // Safe skip
      }
    });

    const values = Object.values(dataMap);
    if (values.length === 0) {
      // Clean fallback curve if no real records to bind
      return [
        { month: 'Apr 26', Appointments: 1, Treatments: 1, Scans: 0 },
        { month: 'May 26', Appointments: 2, Treatments: 3, Scans: 1 },
        { month: 'Jun 26', Appointments: 3, Treatments: 4, Scans: 2 }
      ];
    }
    return values;
  }, [allEvents]);

  // Aggregate stats
  const stats = useMemo(() => {
    const counts = {
      appointment: 0,
      treatment: 0,
      prescription: 0,
      billing: 0,
      payment: 0,
      image: 0
    };
    allEvents.forEach(e => {
      if (counts[e.type] !== undefined) {
        counts[e.type]++;
      }
    });
    return counts;
  }, [allEvents]);

  // Types helper
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
      case 'image':
        return {
          icon: ImageIcon,
          bgColor: 'bg-violet-600',
          textColor: 'text-violet-700',
          accentBorder: 'border-l-violet-600',
          ringColor: 'ring-violet-100',
          label: 'Clinical Image'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. VISUAL CLINICAL ACTIVITY TREND (RECHARTS INTERACTIVE) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-teal-600" />
          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Clinical Trajectory Mapping</h5>
          <span className="text-[9px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-extrabold uppercase font-sans">Active telemetry</span>
        </div>
        
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyActivityTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={24} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Area type="monotone" dataKey="Appointments" name="Visits" stroke="#f59e0b" fillOpacity={0.06} fill="url(#colorVis)" strokeWidth={2} />
              <Area type="monotone" dataKey="Treatments" name="Procedures" stroke="#3b82f6" fillOpacity={0.06} fill="url(#colorProc)" strokeWidth={2} />
              <Area type="monotone" dataKey="Scans" name="Clinical Photos" stroke="#8b5cf6" fillOpacity={0.05} fill="url(#colorScans)" strokeWidth={2} />
              
              <defs>
                <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEARCH AND FILTERS WITH UPLOAD ACTION BAR */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search patient medical history, procedure, remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-700 transition font-sans"
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

            {/* Upload image trigger */}
            {onUploadImage && (
              <button
                onClick={() => setShowUploadPane(!showUploadPane)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-3xs select-none"
              >
                <Camera size={12} />
                <span>Link Clinical Scan</span>
              </button>
            )}
          </div>
        </div>

        {/* EXPANDABLE ATTACHMENT UPLOADER DRAWER */}
        {showUploadPane && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h6 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1">
                <Upload size={12} className="text-indigo-600" /> Upload Radiographic Scans & clinical Images
              </h6>
              <button onClick={() => setShowUploadPane(false)} className="p-1 hover:bg-slate-200 rounded text-slate-450">
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Attachment Code / Caption *</label>
                <input
                  type="text"
                  placeholder="e.g. Left Molars Intraoral X-Ray"
                  value={newImageForm.name}
                  onChange={e => setNewImageForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Radiology Category</label>
                <select
                  value={newImageForm.category}
                  onChange={e => setNewImageForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700"
                >
                  <option value="X-Ray / OPG">X-Ray / OPG</option>
                  <option value="Intraoral Photo">Intraoral Photo</option>
                  <option value="Pre-operative Dental View">Pre-operative Dental View</option>
                  <option value="Post-operative Restoration">Post-operative Restoration</option>
                  <option value="Diagnostic CT Scan">Diagnostic CT Scan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Clinical Pathology Observations & Notes</label>
              <input
                type="text"
                placeholder="e.g. Tooth 36 apical bone loss visible, scheduling root treatment"
                value={newImageForm.notes}
                onChange={e => setNewImageForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="relative flex items-center justify-center gap-2 border border-dashed border-slate-350 hover:bg-slate-100 p-2.5 rounded-xl cursor-pointer text-xs font-bold text-slate-600">
                  <ImageIcon size={14} className="text-indigo-600" />
                  <span>Choose JPG/PNG Scan File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {newImageForm.tempUrl && (
                <div className="w-12 h-12 border rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <img src={newImageForm.tempUrl} alt="Thumbnail preview" className="object-cover w-full h-full" />
                </div>
              )}
            </div>

            {uploadError && <p className="text-[10px] text-rose-600 font-extrabold">{uploadError}</p>}

            <div className="flex justify-end gap-1.5 pt-1.5">
              <button
                onClick={() => setShowUploadPane(false)}
                className="px-3 py-1 bg-white border rounded text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitUploadedImage}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold"
              >
                Upload Attachment
              </button>
            </div>
          </div>
        )}

        {/* Filter Badges Pill Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1.5 flex items-center gap-1">
            <Filter size={10} /> Filter Type:
          </span>
          {[
            { id: 'all', label: 'All History', count: allEvents.length },
            { id: 'appointment', label: 'Visits', count: stats.appointment, icon: Calendar, activeColor: 'bg-amber-500 text-white' },
            { id: 'treatment', label: 'Treatments', count: stats.treatment, icon: Activity, activeColor: 'bg-blue-500 text-white' },
            { id: 'prescription', label: 'Prescriptions', count: stats.prescription, icon: Pill, activeColor: 'bg-indigo-500 text-white' },
            { id: 'billing', label: 'Invoices', count: stats.billing, icon: ReceiptText, activeColor: 'bg-orange-500 text-white' },
            { id: 'payment', label: 'Payments', count: stats.payment, icon: DollarSign, activeColor: 'bg-emerald-500 text-white' },
            { id: 'image', label: 'Clinical Scans', count: stats.image, icon: Camera, activeColor: 'bg-violet-600 text-white' }
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

      {/* TIMELINE EVENT LIST - CUSTOM HIGH RESOLUTION STEPPER */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl space-y-2">
          <AlertCircle className="mx-auto text-slate-300" size={24} />
          <p className="text-sm font-medium">No chronological history logs found</p>
          <p className="text-xs text-slate-400 font-sans">Try clearing search keywords or changing the history filter.</p>
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
                <div className={`absolute -left-[27px] top-1.5 w-4.5 h-4.5 rounded-full ${meta.bgColor} text-white flex items-center justify-center ring-4 ${meta.ringColor} transition duration-200 group-hover:scale-125 z-10`} title={meta.label}>
                  <Icon size={9} strokeWidth={2.5} />
                </div>
                
                {/* Timeline Card details */}
                <div className={`bg-white border-l-4 ${meta.accentBorder} border-y border-r border-slate-100 hover:border-slate-200/80 p-3.5 rounded-r-xl transition shadow-xs hover:shadow-sm relative`}>
                  
                  {/* Delete Option for clinical images only */}
                  {ev.type === 'image' && onDeleteImage && (
                    <button
                      onClick={() => {
                        if (confirm(`Do you want to unlink the clinical attachment "${ev.title}" forever?`)) {
                          onDeleteImage(ev.id);
                        }
                      }}
                      className="absolute right-2 top-2 p-1 text-slate-350 hover:text-rose-600 rounded bg-slate-50 hover:bg-rose-50 cursor-pointer"
                      title="Delete photograph attachment"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

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

                  {/* Render Clinical Attachment Image inside corresponding card type */}
                  {ev.type === 'image' && ev.imageUrl && (
                    <div className="mt-3 relative max-w-sm rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group-image flex justify-center items-center">
                      <img 
                        src={ev.imageUrl} 
                        alt="Radiograph clinical scan preview" 
                        className="max-h-48 object-contain w-full brightness-95 group-hover:brightness-90 transition" 
                      />
                      <button
                        onClick={() => setActiveLightboxImage(ev)}
                        className="absolute bottom-2 right-2 bg-black/60 text-white p-1.5 rounded-lg border border-white/20 flex items-center gap-1 text-[10px] font-bold active:scale-95 transition cursor-pointer"
                      >
                        <Maximize2 size={10} />
                        Zoom Scan
                      </button>
                    </div>
                  )}

                  {/* Render list of specific details */}
                  {ev.details && ev.details.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-105/50 text-[11px] text-slate-650 bg-slate-50/50 p-2 rounded-lg space-y-1">
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

      {/* GORGEOUS HIGH RESOLUTION DIAGNOSTIC LIGHTBOX MODAL */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-55 bg-black/90 flex items-center justify-center p-4" onClick={() => setActiveLightboxImage(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h4 className="font-extrabold text-white text-xs sm:text-sm">{activeLightboxImage.title}</h4>
                <p className="text-[10px] text-slate-400">{activeLightboxImage.subtitle}</p>
              </div>
              <button 
                onClick={() => setActiveLightboxImage(null)} 
                className="p-1.5 hover:bg-slate-850 bg-slate-905 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 bg-black overflow-auto p-6 flex items-center justify-center min-h-[50vh]">
              <img 
                src={activeLightboxImage.imageUrl} 
                alt="Enlarged clinical radiograph radiography view" 
                className="max-h-[60vh] object-contain rounded-lg shadow-xl"
              />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 space-y-1">
              <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider block">Pathology Diagnostic Information</span>
              <p className="font-medium text-[11px] text-slate-200">{activeLightboxImage.details?.[0] || 'Standard radiograph attachment linked'}</p>
              <p className="text-[10px] text-slate-500 italic">Sri Chaitanya Clinical Radiodontology Database • Uploaded on {new Date(activeLightboxImage.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
