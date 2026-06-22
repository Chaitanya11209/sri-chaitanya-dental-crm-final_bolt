import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, ClipboardList, TrendingDown, Layers, FileDown, PiggyBank, Briefcase, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../components/NotificationProvider';

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'Dental Materials' | 'Staff Salaries' | 'Clinic Rent' | 'Power & Utilities' | 'Marketing' | 'Others';
  date: string;
  notes: string;
}

const DEFAULT_EXPENSES: Expense[] = [
  { id: '1', title: 'Implant Screws & Crowns Restock', amount: 35000, category: 'Dental Materials', date: '2026-06-12', notes: 'Ordered from DentSply India Ltd. Batch-204.' },
  { id: '2', title: 'June Part-time Dental Orthodontist Consultant Charge', amount: 45000, category: 'Staff Salaries', date: '2026-06-15', notes: 'Paid to Dr. Deshmukh. Consulting ledger attached.' },
  { id: '3', title: 'Clinic Premium Rent - June block', amount: 65000, category: 'Clinic Rent', date: '2026-06-01', notes: 'Direct bank transfer to Gachibowli Properties.' },
  { id: '4', title: 'Clinic Centralized AC electricity bill', amount: 12450, category: 'Power & Utilities', date: '2026-06-12', notes: 'TSSPDCL online pay confirmation.' },
  { id: '5', title: 'Google Maps Business Listing Promotion ads', amount: 8500, category: 'Marketing', date: '2026-06-10', notes: 'AdWords campaigns targeting local dental requests.' }
];

export default function Expenses() {
  const { notify } = useNotification();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  
  // Create state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newCategory, setNewCategory] = useState<Expense['category']>('Dental Materials');

  // Fetch from Supabase
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: Expense[] = data.map(item => ({
          id: item.id.toString(),
          title: item.title || '',
          amount: parseFloat(item.amount || '0'),
          category: item.category || 'Others',
          date: item.date || new Date().toISOString().split('T')[0],
          notes: item.notes || ''
        }));
        setExpenses(mapped);
      } else {
        setExpenses(DEFAULT_EXPENSES);
      }
    } catch (err) {
      console.warn('[Expenses Sync] Falling back to default list state.');
      setExpenses(DEFAULT_EXPENSES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount.trim()) {
      notify('error', 'Validation Error', 'Description and amount are required.');
      return;
    }

    try {
      const { error } = await supabase.from('expenses').insert([{
        title: newTitle,
        amount: parseFloat(newAmount),
        category: newCategory,
        date: new Date().toISOString().split('T')[0],
        notes: newNotes
      }]);

      if (error) throw error;

      notify('success', 'Expense Registered', `Successfully added expense: ${newTitle}`);
      fetchExpenses();

      setNewTitle('');
      setNewAmount('');
      setNewNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      notify('error', 'Submission Failed', err.message || 'Failed to sync ledger entry with database.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Are you absolutely sure you want to remove this ledger entry?')) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', parseInt(id));

        if (error) throw error;

        notify('success', 'Entry Pruned', 'Ledger item removed from database.');
        fetchExpenses();
      } catch (err: any) {
        notify('error', 'Removal Failed', err.message || 'Failed to remove ledger item.');
      }
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryAggregation = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const filtered = expenses.filter(e => {
    if (catFilter !== 'All' && e.category !== catFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-650 to-amber-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <DollarSign size={160} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4 animate-fade-in">
          <div>
            <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
              Operating Expenditure Suite
            </span>
            <h1 className="text-2xl font-black tracking-tight mt-2">Clinic Expense, Materials & Salary Ledger</h1>
            <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
              Log medical inventory imports, clinic facility rents, electricity bills, and staff compensatory ledgers to compute accurate net EBITDA earnings model.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="self-start md:self-center bg-white text-rose-800 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> New Expense entry
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <TrendingDown size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Expenses (INR)</p>
            <h3 className="text-2xl font-black text-gray-900 mt-0.5">₹{totalExpense.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center font-bold">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Materials Restock</p>
            <h3 className="text-2xl font-black text-gray-950 mt-0.5">₹{(categoryAggregation['Dental Materials'] || 0).toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Salaries & Payroll</p>
            <h3 className="text-2xl font-black text-gray-950 mt-0.5">₹{(categoryAggregation['Staff Salaries'] || 0).toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-630 flex items-center justify-center font-bold">
            <PiggyBank size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Avg Expense Per Item</p>
            <h3 className="text-2xl font-black text-gray-950 mt-0.5">
              ₹{expenses.length > 0 ? Math.round(totalExpense / expenses.length).toLocaleString('en-IN') : '0'}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ledger table (7 columns) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5 font-sans">
              <ClipboardList size={15} /> Operational Cost Entries ({filtered.length})
            </h2>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-8 px-2.5 border rounded-lg font-bold text-xs bg-white outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Dental Materials">Dental Materials</option>
              <option value="Staff Salaries">Staff Salaries</option>
              <option value="Clinic Rent">Clinic Rent</option>
              <option value="Power & Utilities">Power & Utilities</option>
              <option value="Marketing">Marketing</option>
              <option value="Others">Others</option>
            </select>
          </div>

          <div className="relative">
            <RefreshCw size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-rose-400 focus:outline-none placeholder:text-gray-400 font-medium font-sans"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Expense Particulars</th>
                  <th className="pb-2">Group Category</th>
                  <th className="pb-2">Amount Paid</th>
                  <th className="pb-2 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium text-[11.5px]">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 font-mono text-gray-500">{e.date}</td>
                    <td className="py-3 max-w-[220px]">
                      <div>
                        <p className="font-extrabold text-[#111827]">{e.title}</p>
                        <p className="text-[10px] text-gray-500 truncate" title={e.notes}>{e.notes || 'No notes added'}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 uppercase tracking-tight">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 font-extrabold text-rose-600">₹{e.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual category breakups (4 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
            Cost Allocation Breakdown
          </h3>

          <div className="space-y-4 font-sans text-xs">
            {['Dental Materials', 'Staff Salaries', 'Clinic Rent', 'Power & Utilities', 'Marketing', 'Others'].map((cat) => {
              const amount = categoryAggregation[cat] || 0;
              const ratio = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-bold text-gray-700">{cat}</span>
                    <span className="font-mono font-bold text-rose-600">₹{amount.toLocaleString('en-IN')} ({Math.round(ratio)}%)</span>
                  </div>
                  <div className="w-full bg-gray-105 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-2 transition-all rounded-full" 
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-2.5 text-[11px] text-amber-800 leading-relaxed font-sans">
            <AlertCircle size={15} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
              <strong>Overhead Warning Limits:</strong> Ensure that clinical dental materials & consumables cost do not exceed 35% of cumulative monthly SaaS invoicing receipt ledgers.
            </div>
          </div>
        </div>
      </div>

      {/* Entry dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-amber-600 p-5 text-white">
              <h3 className="text-base font-black tracking-tight uppercase">Log Clinical Expense</h3>
              <p className="text-xs text-white/80 mt-1 font-medium font-sans">Record a new operational outlay matching your ledger codes</p>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Particular Title</label>
                <input
                  type="text"
                  placeholder="e.g. Toothpaste Samples, Reception Stationeries..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Amount (INR)</label>
                  <input
                    type="number"
                    placeholder="₹ Paid"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs font-black"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:ring-1 focus:ring-rose-400 bg-white font-bold"
                  >
                    <option value="Dental Materials">Dental Materials</option>
                    <option value="Staff Salaries">Staff Salaries</option>
                    <option value="Clinic Rent">Clinic Rent</option>
                    <option value="Power & Utilities">Power & Utilities</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Notes & Explanations</label>
                <textarea
                  rows={3}
                  placeholder="Explain billing reference number, payee account routing parameters..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-550 text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-55 shadow-sm font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 text-white hover:opacity-90 font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Record Particular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
