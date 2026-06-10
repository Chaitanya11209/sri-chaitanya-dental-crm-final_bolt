import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn } from '../../lib/auth';
import { DollarSign, TrendingUp, Calendar, Download, ShieldX } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

type CollectionEntry = { date: string; collected: number; pending: number; count: number };

export default function Collections() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();

  useEffect(() => {
    if (!isLoggedIn()) { setLocation('/admin'); return; }
    if (!admin) { setLocation('/crm/dashboard'); return; }
  }, [admin, setLocation]);

  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'month'>('7d');
  const [collections, setCollections] = useState<CollectionEntry[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<Record<string, number>>({});

  useEffect(() => { if (admin) fetchData(); }, [dateRange, admin]);

  const fetchData = async () => {
    setLoading(true);
    let from = new Date();
    if (dateRange === 'today') { from = new Date(); }
    else if (dateRange === '7d') { from.setDate(from.getDate() - 7); }
    else if (dateRange === '30d') { from.setDate(from.getDate() - 30); }
    else { from = new Date(from.getFullYear(), from.getMonth(), 1); }
    const fromStr = from.toISOString().split('T')[0];

    const { data } = await supabase.from('appointments').select('*')
      .gte('next_visit', fromStr).neq('status', 'Deleted').order('next_visit', { ascending: true });
    setAppointments(data || []);

    const grouped: Record<string, CollectionEntry> = {};
    (data || []).forEach((a: any) => {
      const d = a.next_visit;
      if (!grouped[d]) grouped[d] = { date: d, collected: 0, pending: 0, count: 0 };
      grouped[d].collected += Number(a.amount_paid || 0);
      grouped[d].pending += Number(a.balance_amount || 0);
      grouped[d].count += 1;
    });
    setCollections(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));

    const modes: Record<string, number> = {};
    (data || []).forEach((a: any) => {
      const m = a.payment_mode || 'Cash';
      modes[m] = (modes[m] || 0) + Number(a.amount_paid || 0);
    });
    setPaymentMode(modes);
    setLoading(false);
  };

  const totalCollected = collections.reduce((t, c) => t + c.collected, 0);
  const totalPending = collections.reduce((t, c) => t + c.pending, 0);
  const totalVisits = collections.reduce((t, c) => t + c.count, 0);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Collected (₹)', 'Pending (₹)', 'Appointments'],
      ...collections.map(c => [c.date, c.collected, c.pending, c.count]),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `collections-${dateRange}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Staff blocked view
  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldX size={32} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-700">Access Restricted</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm">
            Collections and revenue data are only accessible to Admin users. Contact your administrator for access.
          </p>
        </div>
        <button
          onClick={() => setLocation('/crm/dashboard')}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['today', '7d', '30d', 'month'] as const).map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                ${dateRange === r ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
              {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'This Month'}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition shadow-sm">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Collected', value: `₹${Number(totalCollected).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'bg-teal-600' },
          { label: 'Total Pending', value: `₹${Number(totalPending).toLocaleString('en-IN')}`, icon: DollarSign, color: 'bg-amber-500' },
          { label: 'Total Appointments', value: totalVisits, icon: Calendar, color: 'bg-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <p className="text-xl font-black text-slate-800 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-4">Collections Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={collections}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={45} />
              <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="collected" name="Collected" stroke="#0d9488" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={2.5} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-4">Daily Appointment Count</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={collections}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={24} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Appointments" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Mode Breakdown */}
      {Object.keys(paymentMode).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-700 text-sm mb-4">Payment Mode Breakdown</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(paymentMode).map(([mode, amount]) => (
              <div key={mode} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-sm font-semibold text-slate-700">{mode}</span>
                <span className="text-sm font-black text-teal-600">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appointment Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Appointment Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Date', 'Patient', 'Treatment', 'Mode', 'Paid', 'Balance', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {appointments.slice(0, 50).map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{a.next_visit}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.treatment || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{a.payment_mode || 'Cash'}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">₹{Number(a.amount_paid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">{Number(a.balance_amount || 0) > 0 ? `₹${Number(a.balance_amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${a.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        a.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        a.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No data for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
