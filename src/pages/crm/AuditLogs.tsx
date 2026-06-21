import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Clock, Search, RefreshCw, User, FileText, Calendar, Activity } from 'lucide-react';

interface AuditLog {
  id: number;
  created_at: string;
  action: string;
  target_user_id?: string;
  target_user_name?: string;
  performed_by_id?: string;
  performed_by_name: string;
  details: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAuditLogs = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuditLogs();
  };

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(query) ||
      (log.performed_by_name || '').toLowerCase().includes(query) ||
      (log.target_user_name || '').toLowerCase().includes(query) ||
      (log.details || '').toLowerCase().includes(query)
    );
  });

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('deactivate') || act.includes('remove') || act.includes('inactive')) {
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    }
    if (act.includes('create') || act.includes('insert') || act.includes('add') || act.includes('new') || act.includes('success')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (act.includes('update') || act.includes('edit') || act.includes('change')) {
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
              <Shield size={20} />
            </div>
            <h1 className="text-xl font-black tracking-tight font-sans">CRM System Audit Logs</h1>
          </div>
          <p className="text-xs text-teal-200 mt-1.5 leading-relaxed max-w-xl">
            Inspect the historic changelog, action ledgers, and operational histories recorded securely in real-time across Sri Chaitanya Dental Clinic.
          </p>
        </div>
        <div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Control panel and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="w-full relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400/80" />
          <input
            type="text"
            placeholder="Search audit records by action, details, actor or target user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 select-none hover:bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:border-teal-500 outline-none transition-all placeholder:text-slate-450 font-medium"
          />
        </div>
        <div className="flex-shrink-0 text-slate-450 font-mono text-[10px] uppercase font-bold tracking-wider px-2">
          Logs fetched: <span className="text-slate-700 font-extrabold">{filteredLogs.length}</span> / {logs.length}
        </div>
      </div>

      {/* Logs Table/List */}
      <div className="bg-white rounded-3xl border border-slate-200/85 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <RefreshCw size={32} className="animate-spin text-teal-600" />
            <p className="text-xs font-semibold uppercase tracking-wider font-mono">Loading System Ledgers...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-2">
            <Activity size={40} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-700 text-sm">No Audit Logs Found</h3>
            <p className="text-xs max-w-xs mx-auto leading-relaxed">
              Either there are no security logs recorded or your filter did not match any historical parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action / Event</th>
                  <th className="py-4 px-6">Performed By</th>
                  <th className="py-4 px-6">Target User</th>
                  <th className="py-4 px-6">Change Ledger Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-4 px-6 whitespace-nowrap text-slate-450 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Performed By */}
                    <td className="py-4 px-6 whitespace-nowrap text-slate-800 font-bold">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-[10px] font-black">
                          {log.performed_by_name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        {log.performed_by_name || 'System / Trigger'}
                      </div>
                    </td>

                    {/* Target User */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {log.target_user_name ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User size={12} className="text-slate-400" />
                          <span>{log.target_user_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">--</span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="py-4 px-6 max-w-xs md:max-w-md">
                      <div className="flex items-start gap-1.5 leading-relaxed text-slate-500">
                        <FileText size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{log.details}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
