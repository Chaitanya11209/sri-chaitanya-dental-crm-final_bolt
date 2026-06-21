import { useState, useEffect } from 'react';
import { Package, ShieldAlert, BadgePlus, RefreshCcw, Search, Plus, AlertCircle, ShoppingCart, UserCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface InventoryItem {
  id: string;
  name: string;
  type: 'Medicine' | 'Consumable';
  stock: number;
  minStock: number; // Low stock threshold
  unit: string;
  expiryDate?: string;
  supplier: string;
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Amoxicillin 500mg Oral tablets', type: 'Medicine', stock: 120, minStock: 50, unit: 'Strips', expiryDate: '2027-09-24', supplier: 'Zydus Cadila Healthcare' },
  { id: '2', name: 'Ketorol DT Dental painkillers', type: 'Medicine', stock: 45, minStock: 60, unit: 'Strips', expiryDate: '2026-11-12', supplier: 'Dr. Reddy Labs' },
  { id: '3', name: 'Latex Surgical Examination Gloves (M)', type: 'Consumable', stock: 15, minStock: 25, unit: 'Boxes', expiryDate: '2029-05-30', supplier: 'Kargil Medico Dist' },
  { id: '4', name: 'Sterilizer autoclave pouches (90mm)', type: 'Consumable', stock: 350, minStock: 100, unit: 'Pouches', supplier: 'Smileware Dental Supply' },
  { id: '5', name: 'Alginate Dental Impression Powder', type: 'Consumable', stock: 8, minStock: 10, unit: 'Packets', supplier: 'Kargil Medico Dist' },
  { id: '6', name: 'Sodium Hypochlorite 3% Endodontic Irrigation', type: 'Consumable', stock: 14, minStock: 5, unit: 'Bottles', expiryDate: '2027-01-20', supplier: 'Smileware Dental Supply' }
];

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const cached = localStorage.getItem('crm_inventory_items');
    return cached ? JSON.parse(cached) : DEFAULT_INVENTORY;
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [alertFilter, setAlertFilter] = useState('All');
  
  // Custom dialog state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'Medicine' | 'Consumable'>('Medicine');
  const [newStock, setNewStock] = useState('');
  const [newMinStock, setNewMinStock] = useState('');
  const [newUnit, setNewUnit] = useState('Strips');
  const [newSupplier, setNewSupplier] = useState('Dr. Reddy Labs');
  const [newExpiry, setNewExpiry] = useState('');

  // Selected item restock operation
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState('');

  // Fetch from Supabase
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: InventoryItem[] = data.map(item => ({
          id: item.id.toString(),
          name: item.name || '',
          type: item.type || 'Medicine',
          stock: item.stock || 0,
          minStock: item.min_stock || 0,
          unit: item.unit || '',
          expiryDate: item.expiry_date || undefined,
          supplier: item.supplier || ''
        }));
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.warn('[Inventory Sync] Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel('inventory-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStock.trim() || !newMinStock.trim()) return;

    try {
      const { error } = await supabase.from('inventory').insert([{
        name: newName,
        type: newType,
        stock: parseInt(newStock),
        min_stock: parseInt(newMinStock),
        unit: newUnit,
        supplier: newSupplier,
        expiry_date: newExpiry || null
      }]);
      if (error) throw error;
      fetchInventory();
    } catch (err) {
      console.error('[Inventory Add] Failed to insert:', err);
    }

    setNewName('');
    setNewStock('');
    setNewMinStock('');
    setShowAddForm(false);
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !restockAmount.trim()) return;

    const amt = parseInt(restockAmount);
    const updatedStock = selectedItem.stock + amt;

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ stock: updatedStock })
        .eq('id', parseInt(selectedItem.id));
      if (error) throw error;
      fetchInventory();
    } catch (err) {
      console.error('[Inventory Restock] Failed to update:', err);
    }

    setSelectedItem(null);
    setRestockAmount('');
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to remove this medical stock item?')) {
      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', parseInt(id));
        if (error) throw error;
        fetchInventory();
      } catch (err) {
        console.error('[Inventory Delete] Failed to delete:', err);
      }
    }
  };

  const lowStockCount = items.filter(it => it.stock < it.minStock).length;

  const filtered = items.filter(it => {
    if (typeFilter !== 'All' && it.type !== typeFilter) return false;
    
    // Alert Filter
    if (alertFilter === 'Low' && it.stock >= it.minStock) return false;
    if (alertFilter === 'Safe' && it.stock < it.minStock) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return it.name.toLowerCase().includes(q) || it.supplier.toLowerCase().includes(q) || it.unit.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-650 to-blue-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Package size={160} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <span className="bg-white/20 text-white font-mono font-bold text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
              Medicines & Consumables Depot
            </span>
            <h1 className="text-2xl font-black tracking-tight mt-2">Clinical Stock, Pharma & Consumables</h1>
            <p className="text-xs text-white/80 max-w-xl font-medium mt-1">
              Oversee oral painkillers, surgical latex glove packs, restorative implant screws, and dental impression composite materials with automatic alert benchmarks.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="self-start md:self-center bg-white text-teal-800 font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Add Inventory Item
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div id="metric_total_items" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2F63E0] flex items-center justify-center font-bold">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total SKUs</p>
            <h3 className="text-2xl font-extrabold text-gray-900 mt-0.5">{items.length} Items</h3>
          </div>
        </div>

        <div id="metric_low_stock" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-bold">
            <ShieldAlert size={22} className={lowStockCount > 0 ? "animate-bounce" : ""} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className={`text-2xl font-extrabold mt-0.5 ${lowStockCount > 0 ? 'text-red-650' : 'text-gray-900'}`}>{lowStockCount} SKUs</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Suppliers</p>
            <h3 className="text-2xl font-extrabold text-gray-900 mt-0.5">3 Trusted</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Supplies Sufficiency</p>
            <h3 className="text-2xl font-extrabold text-teal-650 mt-0.5">
              {Math.round(((items.length - lowStockCount) / items.length) * 100) || 100}%
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3 flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5 font-sans">
              <Package size={15} /> Medicines & Consumables Catalog
            </h2>

            <div className="flex gap-2 font-sans text-xs">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 px-2.5 border rounded-lg font-bold bg-white cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Medicine">Medicines</option>
                <option value="Consumable">Consumables</option>
              </select>

              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="h-8 px-2.5 border rounded-lg font-bold bg-white cursor-pointer"
              >
                <option value="All">All Levels</option>
                <option value="Low">Low Stock alert</option>
                <option value="Safe">Sufficient</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by label name, supplier brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-teal-400 focus:outline-none placeholder:text-gray-400 font-sans font-medium"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-2">Material SKU</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Qty in Stock</th>
                  <th className="pb-2">Safety Benchmark</th>
                  <th className="pb-2">Expiry Date</th>
                  <th className="pb-2 text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium text-[11.5px]">
                {filtered.map((it) => {
                  const isLow = it.stock < it.minStock;
                  return (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="py-3">
                        <div>
                          <p className="font-extrabold text-[#111827]">{it.name}</p>
                          <p className="text-[10px] text-gray-500">Supplier: {it.supplier}</p>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                          it.type === 'Medicine' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {it.type}
                        </span>
                      </td>
                      <td className="py-3 font-extrabold">
                        <span className={isLow ? "text-red-600 font-black animate-pulse" : "text-gray-900"}>
                          {it.stock} {it.unit}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-gray-500">
                        {it.minStock} {it.unit}
                      </td>
                      <td className="py-3 font-mono text-gray-500">
                        {it.expiryDate || 'N/A'}
                      </td>
                      <td className="py-3 text-right flex justify-end gap-1">
                        <button
                          onClick={() => setSelectedItem(it)}
                          className="p-1 px-2.5 bg-[#2F63E0] text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer hover:bg-opacity-90"
                        >
                          Restock
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="p-1 px-1.5 text-gray-400 hover:text-red-650 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Restock box */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5 font-sans">
            <RefreshCcw size={14} className="text-[#8757EA]" /> Dynamic Quick-Restocker
          </h3>

          {selectedItem ? (
            <form onSubmit={handleRestock} className="space-y-4 font-sans text-xs">
              <div className="bg-teal-50 border border-teal-100 p-3.5 rounded-xl space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wide text-teal-850 bg-teal-100 px-1.5 py-0.5 rounded">
                  {selectedItem.type} SKU
                </span>
                <h4 className="font-extrabold text-xs text-slate-900">{selectedItem.name}</h4>
                <p className="text-[11px] text-slate-700">Current Qty: <strong>{selectedItem.stock} {selectedItem.unit}</strong></p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Quantity to Add ({selectedItem.unit})</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-black text-xs"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 h-9 rounded-lg border border-gray-200 font-bold uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 bg-teal-600 text-white rounded-lg font-bold uppercase transition"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12 text-slate-400 font-sans italic text-xs">
              Click "Restock" next to any medicine/consumable item to adjust counts or record supplier invoices dynamically here.
            </div>
          )}

          <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-2.5 text-[11px] text-red-850 leading-relaxed font-sans">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <strong>Low-stock warnings:</strong> Safety benchmarks trigger immediate alerts to clinic practitioners when stock quantities fall below threshold levels.
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-blue-600 p-5 text-white">
              <h3 className="text-base font-black tracking-tight uppercase">Register Supply Stock</h3>
              <p className="text-xs text-white/80 mt-1 font-medium font-sans">Index new medicine or hygiene consumable SKU in clinical catalog</p>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Material SKU Name</label>
                <input
                  type="text"
                  placeholder="e.g. Disposable Dental bibs/towels"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Stock Type</label>
                  <select
                    value={newType}
                    onChange={(e: any) => setNewType(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl bg-white font-bold"
                  >
                    <option value="Medicine">Medicine Pill/Syrup</option>
                    <option value="Consumable">Hygiene Consumables</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Unit Metric</label>
                  <input
                    type="text"
                    placeholder="e.g. Strips, Pouches"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Current Stock Level</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Safety Min Limit</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Supplier Brand Name</label>
                <select
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl bg-white font-semibold"
                >
                  <option value="Zydus Cadila Healthcare">Zydus Cadila Healthcare</option>
                  <option value="Dr. Reddy Labs">Dr. Reddy Labs</option>
                  <option value="Smileware Dental Supply">Smileware Dental Supply</option>
                  <option value="Kargil Medico Dist">Kargil Medico Dist</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Expiry Batch Date (Optional)</label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl text-xs font-semibold"
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
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:opacity-90 font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
