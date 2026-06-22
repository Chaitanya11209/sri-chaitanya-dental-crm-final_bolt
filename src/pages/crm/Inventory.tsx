import { useState, useEffect } from 'react';
import { Package, ShieldAlert, RefreshCcw, Search, Plus, AlertCircle, ShoppingCart, UserCheck, Trash2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../components/NotificationProvider';

interface InventoryItem {
  id: string;
  name: string;
  type: 'Medicine' | 'Consumable';
  stock: number;
  minStock: number; // Low stock threshold
  reorderLevel?: number; // Optional custom reorder benchmark level
  unit: string;
  expiryDate?: string;
  supplier: string;
  cost?: number;
  notes?: string;
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Amoxicillin 500mg Oral tablets', type: 'Medicine', stock: 120, minStock: 50, reorderLevel: 80, unit: 'Strips', expiryDate: '2027-09-24', supplier: 'Zydus Cadila Healthcare', cost: 150, notes: 'Standard broad spectrum antibiotic.' },
  { id: '2', name: 'Ketorol DT Dental painkillers', type: 'Medicine', stock: 45, minStock: 60, reorderLevel: 100, unit: 'Strips', expiryDate: '2026-11-12', supplier: 'Dr. Reddy Labs', cost: 85, notes: 'Fast acting anti-inflammatory.' },
  { id: '3', name: 'Latex Surgical Examination Gloves (M)', type: 'Consumable', stock: 15, minStock: 25, reorderLevel: 50, unit: 'Boxes', expiryDate: '2029-05-30', supplier: 'Kargil Medico Dist', cost: 380, notes: 'Sterilized physical barrier.' },
  { id: '4', name: 'Sterilizer autoclave pouches (90mm)', type: 'Consumable', stock: 350, minStock: 100, reorderLevel: 200, unit: 'Pouches', supplier: 'Smileware Dental Supply', cost: 4.5, notes: 'Protective steam sterilization.' },
  { id: '5', name: 'Alginate Dental Impression Powder', type: 'Consumable', stock: 8, minStock: 10, reorderLevel: 20, unit: 'Packets', supplier: 'Kargil Medico Dist', cost: 520, notes: 'Fast-setting dental crown mapping compound.' },
  { id: '6', name: 'Sodium Hypochlorite 3% Endodontic Irrigation', type: 'Consumable', stock: 14, minStock: 5, reorderLevel: 15, unit: 'Bottles', expiryDate: '2027-01-20', supplier: 'Smileware Dental Supply', cost: 190, notes: 'Canal washing solution.' }
];

const getLocalInventory = (): InventoryItem[] => {
  try {
    const raw = localStorage.getItem('srichaitanya_local_inventory');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('[Inventory] Error reading local storage:', e);
  }
  return DEFAULT_INVENTORY;
};

const saveLocalInventory = (items: InventoryItem[]) => {
  try {
    localStorage.setItem('srichaitanya_local_inventory', JSON.stringify(items));
  } catch (e) {
    console.error('[Inventory] Error writing to local storage:', e);
  }
};

export default function Inventory() {
  const { notify } = useNotification();
  const [useLocalOnly, setUseLocalOnly] = useState(() => {
    return localStorage.getItem('srichaitanya_inventory_use_local') === 'true';
  });
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [alertFilter, setAlertFilter] = useState('All');
  
  // Custom dialog state (Add Form)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'Medicine' | 'Consumable'>('Medicine');
  const [newStock, setNewStock] = useState('');
  const [newMinStock, setNewMinStock] = useState('');
  const [newReorderLevel, setNewReorderLevel] = useState('');
  const [newUnit, setNewUnit] = useState('Strips');
  const [newSupplier, setNewSupplier] = useState('Dr. Reddy Labs');
  const [newExpiry, setNewExpiry] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Selected item restock operation
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');

  // Edit item state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'Medicine' | 'Consumable'>('Medicine');
  const [editStock, setEditStock] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Custom columns mapping state for database schema resilience
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    name: 'item_name',
    type: 'category',
    stock: 'quantity',
    minStock: 'reorder_level',
    reorderLevel: '',
    expiryDate: '',
    unit: 'unit',
    supplier: 'supplier',
    notes: 'notes',
    cost: 'cost'
  });
  const [schemaChecked, setSchemaChecked] = useState(false);

  // Dynamically detect which columns exist on the inventory table
  const probeSchema = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*').limit(1);
      if (error) throw error;
      
      let columns: string[] = [];
      if (data && data.length > 0) {
        columns = Object.keys(data[0]);
      } else {
        // If empty, select candidate columns individually to see which exist
        columns = ['id', 'unit', 'supplier', 'notes', 'cost', 'created_at', 'updated_at'];
        const candidates = [
          ['name', 'item_name'],
          ['type', 'category'],
          ['stock', 'current_stock', 'quantity'],
          ['min_stock', 'safety_min_limit', 'reorder_level'],
          ['expiry_date']
        ];
        
        for (const list of candidates) {
          for (const col of list) {
            try {
              const { error: colError } = await supabase.from('inventory').select(col).limit(0);
              if (!colError) {
                columns.push(col);
                break;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
      
      const map: Record<string, string> = {
        name: columns.includes('name') ? 'name' : (columns.includes('item_name') ? 'item_name' : 'item_name'),
        type: columns.includes('type') ? 'type' : (columns.includes('category') ? 'category' : 'category'),
        stock: columns.includes('current_stock') ? 'current_stock' : (columns.includes('stock') ? 'stock' : (columns.includes('quantity') ? 'quantity' : 'quantity')),
        minStock: columns.includes('safety_min_limit') ? 'safety_min_limit' : (columns.includes('min_stock') ? 'min_stock' : 'reorder_level'),
        reorderLevel: columns.includes('reorder_level') ? 'reorder_level' : '',
        expiryDate: columns.includes('expiry_date') ? 'expiry_date' : '',
        unit: columns.includes('unit') ? 'unit' : 'unit',
        supplier: columns.includes('supplier') ? 'supplier' : 'supplier',
        notes: columns.includes('notes') ? 'notes' : 'notes',
        cost: columns.includes('cost') ? 'cost' : 'cost'
      };
      
      setColumnMap(map);
      setSchemaChecked(true);
      return map;
    } catch (err) {
      console.warn('[Schema Probe] Error probing, falling back to safe defaults:', err);
      const fallback = {
        name: 'item_name',
        type: 'category',
        stock: 'quantity',
        minStock: 'reorder_level',
        reorderLevel: '',
        expiryDate: '',
        unit: 'unit',
        supplier: 'supplier',
        notes: 'notes',
        cost: 'cost'
      };
      setColumnMap(fallback);
      setSchemaChecked(true);
      return fallback;
    }
  };

  // Fetch from Supabase using dynamic column map
  const fetchInventory = async (activeMap?: Record<string, string>) => {
    setLoading(true);
    const mapToUse = activeMap || columnMap;
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*');

      if (error) throw error;

      if (data) {
        const mapped: InventoryItem[] = data.map(item => {
          let expiryDate: string | undefined = undefined;
          if (mapToUse.expiryDate && item[mapToUse.expiryDate]) {
            expiryDate = item[mapToUse.expiryDate];
          }
          
          let cleanNotes = (mapToUse.notes && item[mapToUse.notes]) || '';
          if (!expiryDate && cleanNotes.startsWith('[Expiry: ')) {
            const endBracketIdx = cleanNotes.indexOf(']');
            if (endBracketIdx !== -1) {
              expiryDate = cleanNotes.slice(9, endBracketIdx).trim();
              cleanNotes = cleanNotes.slice(endBracketIdx + 1).trim();
            }
          }

          return {
            id: item.id.toString(),
            name: (mapToUse.name && item[mapToUse.name]) || '',
            type: (mapToUse.type && item[mapToUse.type]) || 'Medicine',
            stock: Number(mapToUse.stock && item[mapToUse.stock]) || 0,
            minStock: Number(mapToUse.minStock && item[mapToUse.minStock]) || 0,
            reorderLevel: mapToUse.reorderLevel && item[mapToUse.reorderLevel] !== undefined ? Number(item[mapToUse.reorderLevel]) : undefined,
            unit: (mapToUse.unit && item[mapToUse.unit]) || '',
            expiryDate: expiryDate,
            supplier: (mapToUse.supplier && item[mapToUse.supplier]) || '',
            cost: Number(mapToUse.cost && item[mapToUse.cost]) || 0,
            notes: cleanNotes
          };
        });
        
        // Front-End sort to ensure perfect alphabetization regardless of DB schema differences
        mapped.sort((a, b) => a.name.localeCompare(b.name));
        setItems(mapped);
      }
    } catch (err: any) {
      console.warn('[Inventory Sync] Error fetching inventory. Falling back to local storage.', err);
      const isRlsOrPermissionError = 
        err.message?.toLowerCase().includes('row-level security') ||
        err.message?.toLowerCase().includes('rls') ||
        err.message?.toLowerCase().includes('policy') ||
        err.message?.toLowerCase().includes('permission') ||
        err.code === '42501' ||
        err.code === 'PGRST116' ||
        err.code === '42703';

      if (isRlsOrPermissionError) {
        localStorage.setItem('srichaitanya_inventory_use_local', 'true');
        setUseLocalOnly(true);
        const stored = getLocalInventory();
        setItems(stored);
      } else {
        const stored = getLocalInventory();
        setItems(stored);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to compile payload for updates & inserts using ONLY detected columns
  const buildPayload = (
    activeMap: Record<string, string>,
    values: {
      name: string;
      type: string;
      stock: number;
      minStock: number;
      reorderLevel?: number;
      unit: string;
      supplier: string;
      notes: string;
      cost: number;
      expiryDate: string;
    }
  ) => {
    const payload: Record<string, any> = {};
    if (activeMap.name) payload[activeMap.name] = values.name;
    if (activeMap.type) payload[activeMap.type] = values.type;
    if (activeMap.stock) payload[activeMap.stock] = values.stock;
    if (activeMap.minStock) payload[activeMap.minStock] = values.minStock;
    if (activeMap.reorderLevel && values.reorderLevel !== undefined) {
      payload[activeMap.reorderLevel] = values.reorderLevel;
    }
    if (activeMap.unit) payload[activeMap.unit] = values.unit;
    if (activeMap.supplier) payload[activeMap.supplier] = values.supplier;
    
    if (activeMap.notes) {
      // If expiryDate has been selected but DB doesn't support expiry_date column, store in notes
      if (values.expiryDate && !activeMap.expiryDate) {
        payload[activeMap.notes] = `[Expiry: ${values.expiryDate}] ${values.notes}`;
      } else {
        payload[activeMap.notes] = values.notes;
      }
    }
    if (activeMap.cost) payload[activeMap.cost] = values.cost;
    if (activeMap.expiryDate && values.expiryDate) {
      payload[activeMap.expiryDate] = values.expiryDate;
    }
    return payload;
  };

  // Seeding sample data into Supabase if empty
  const seedIfEmpty = async (activeMap: Record<string, string>) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id')
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        console.info('[Inventory] Database is empty. Seeding sample collection...');
        
        const payloads = DEFAULT_INVENTORY.map(it => buildPayload(activeMap, {
          name: it.name,
          type: it.type,
          stock: it.stock,
          minStock: it.minStock,
          reorderLevel: it.reorderLevel,
          unit: it.unit,
          supplier: it.supplier,
          notes: it.notes || 'Standard starter stock sample.',
          cost: it.cost || 0,
          expiryDate: it.expiryDate || ''
        }));

        const { error: seedError } = await supabase.from('inventory').insert(payloads);
        if (seedError) throw seedError;
        console.info('[Inventory] Sample collection successfully seeded.');
      }
    } catch (err) {
      console.warn('[Inventory] Seeding bypassed or failed:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const activeMap = await probeSchema();
      if (useLocalOnly) {
        const stored = getLocalInventory();
        setItems(stored);
      } else {
        await seedIfEmpty(activeMap);
        await fetchInventory(activeMap);
      }
    };
    init();

    let channel: any = null;
    if (!useLocalOnly) {
      channel = supabase
        .channel('inventory-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
          // Fetch inventory with the stateful columnMap
          fetchInventory();
        })
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [useLocalOnly]);

  const handleWriteError = (err: any, actionName: string, executeLocal: () => void) => {
    console.error(`[Inventory Error] ${actionName}:`, err);
    
    const isRlsError = 
      err.message?.toLowerCase().includes('row-level security') ||
      err.message?.toLowerCase().includes('rls') ||
      err.message?.toLowerCase().includes('policy') ||
      err.message?.toLowerCase().includes('permission') ||
      err.code === '42501';

    if (isRlsError) {
      localStorage.setItem('srichaitanya_inventory_use_local', 'true');
      setUseLocalOnly(true);
      executeLocal();
      notify('warning', 'Local Sandbox Active', 'Database RLS restrictions detected. Seamlessly switched to Local Sandbox Mode.');
    } else {
      notify('error', 'Execution Error', err.message || `Failed to perform ${actionName}.`);
    }
  };

  const disableLocalFallbackAndRetry = async () => {
    localStorage.removeItem('srichaitanya_inventory_use_local');
    setUseLocalOnly(false);
    notify('info', 'Reconnecting to Cloud', 'Bypassed Local Sandbox. Attempting to synchronize with Supabase...');
    const activeMap = await probeSchema();
    await seedIfEmpty(activeMap);
    await fetchInventory(activeMap);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStock.trim() || !newMinStock.trim()) {
      notify('error', 'Validation Error', 'All fields are required.');
      return;
    }

    const nextId = (items.length > 0 ? (Math.max(...items.map(it => parseInt(it.id, 10) || 0)) + 1) : 1).toString();

    const runLocalAdd = () => {
      const newItem: InventoryItem = {
        id: nextId,
        name: newName,
        type: newType,
        stock: parseInt(newStock, 10) || 0,
        minStock: parseInt(newMinStock, 10) || 0,
        reorderLevel: newReorderLevel ? parseInt(newReorderLevel, 10) : undefined,
        unit: newUnit,
        supplier: newSupplier,
        cost: parseFloat(newCost) || 0,
        notes: newNotes,
        expiryDate: newExpiry || undefined
      };
      
      const updated = [newItem, ...items];
      updated.sort((a, b) => a.name.localeCompare(b.name));
      setItems(updated);
      saveLocalInventory(updated);
      
      setNewName('');
      setNewStock('');
      setNewMinStock('');
      setNewReorderLevel('');
      setNewCost('');
      setNewNotes('');
      setNewExpiry('');
      setShowAddForm(false);
    };

    if (useLocalOnly) {
      runLocalAdd();
      notify('success', 'Logged Locally', `Successfully saved stock item: ${newName} (Local Sandbox)`);
      return;
    }

    try {
      const payload = buildPayload(columnMap, {
        name: newName,
        type: newType,
        stock: parseInt(newStock, 10),
        minStock: parseInt(newMinStock, 10),
        reorderLevel: newReorderLevel ? parseInt(newReorderLevel, 10) : undefined,
        unit: newUnit,
        supplier: newSupplier,
        notes: newNotes,
        cost: parseFloat(newCost) || 0,
        expiryDate: newExpiry
      });

      // --- CRITICAL AUDIT & DEBUG LOGGING ---
      const [userRes, sessionRes] = await Promise.all([
        supabase.auth.getUser().catch(e => ({ data: { user: null }, error: e })),
        supabase.auth.getSession().catch(e => ({ data: { session: null }, error: e }))
      ]);
      console.log('[DEBUG-INVENTORY] --- SAVE WORKFLOW AUDIT ---');
      console.log('[DEBUG-INVENTORY] Authenticated User:', userRes.data?.user);
      console.log('[DEBUG-INVENTORY] Session Details:', sessionRes.data?.session);
      console.log('[DEBUG-INVENTORY] Payload to Insert:', payload);
      console.log('[DEBUG-INVENTORY] Supabase Client Conf:', {
        url: (supabase as any).supabaseUrl,
        headers: (supabase as any).headers
      });

      const { error } = await supabase.from('inventory').insert([payload]);
      if (error) {
        console.error('[DEBUG-INVENTORY] Exact Supabase DB Error:', error);
        throw error;
      }

      notify('success', 'Logged Successfully', `Successfully registered stock item ${newName}`);
      fetchInventory();

      setNewName('');
      setNewStock('');
      setNewMinStock('');
      setNewReorderLevel('');
      setNewCost('');
      setNewNotes('');
      setNewExpiry('');
      setShowAddForm(false);
    } catch (err: any) {
      handleWriteError(err, 'Add Item', runLocalAdd);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editName.trim() || !editStock.trim() || !editMinStock.trim()) {
      notify('error', 'Validation Error', 'Required fields cannot be empty.');
      return;
    }

    const runLocalUpdate = () => {
      const updated = items.map(it => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            name: editName,
            type: editType,
            stock: parseInt(editStock, 10) || 0,
            minStock: parseInt(editMinStock, 10) || 0,
            reorderLevel: editReorderLevel ? parseInt(editReorderLevel, 10) : undefined,
            unit: editUnit,
            supplier: editSupplier,
            notes: editNotes,
            cost: parseFloat(editCost) || 0,
            expiryDate: editExpiry || undefined
          };
        }
        return it;
      });
      updated.sort((a, b) => a.name.localeCompare(b.name));
      setItems(updated);
      saveLocalInventory(updated);
      setEditingItem(null);
    };

    if (useLocalOnly) {
      runLocalUpdate();
      notify('success', 'Updated Locally', `Successfully updated inventory item: ${editName} (Local Sandbox)`);
      return;
    }

    try {
      const payload = buildPayload(columnMap, {
        name: editName,
        type: editType,
        stock: parseInt(editStock, 10),
        minStock: parseInt(editMinStock, 10),
        reorderLevel: editReorderLevel ? parseInt(editReorderLevel, 10) : undefined,
        unit: editUnit,
        supplier: editSupplier,
        notes: editNotes,
        cost: parseFloat(editCost) || 0,
        expiryDate: editExpiry
      });

      const { error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('id', parseInt(editingItem.id, 10));

      if (error) throw error;

      notify('success', 'Updated Successfully', `Successfully updated inventory item: ${editName}`);
      fetchInventory();
      setEditingItem(null);
    } catch (err: any) {
      handleWriteError(err, 'Update Item', runLocalUpdate);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !restockAmount.trim()) {
      notify('error', 'Validation Error', 'Quantity is required for stock adjustment.');
      return;
    }

    const amt = parseInt(restockAmount, 10);
    if (isNaN(amt) || amt < 0) {
      notify('error', 'Validation Error', 'Please enter a valid positive number.');
      return;
    }

    let updatedStock = selectedItem.stock;
    if (adjustmentType === 'add') {
      updatedStock += amt;
    } else if (adjustmentType === 'subtract') {
      updatedStock = Math.max(0, selectedItem.stock - amt);
    } else if (adjustmentType === 'set') {
      updatedStock = amt;
    }

    const runLocalRestock = () => {
      const updated = items.map(it => {
        if (it.id === selectedItem.id) {
          return { ...it, stock: updatedStock };
        }
        return it;
      });
      setItems(updated);
      saveLocalInventory(updated);
    };

    if (useLocalOnly) {
      runLocalRestock();
      notify('success', 'Replenished Locally', `Stock adjusted for ${selectedItem.name} to ${updatedStock} ${selectedItem.unit} (Local Sandbox).`);
      setSelectedItem(null);
      setRestockAmount('');
      return;
    }

    try {
      const payload: Record<string, any> = {};
      if (columnMap.stock) {
        payload[columnMap.stock] = updatedStock;
      }
      
      const { error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('id', parseInt(selectedItem.id, 10));

      if (error) throw error;

      notify('success', 'Replenished', `Stock adjusted for ${selectedItem.name} to ${updatedStock} ${selectedItem.unit}.`);
      fetchInventory();
    } catch (err: any) {
      handleWriteError(err, 'Restock Item', runLocalRestock);
    }

    setSelectedItem(null);
    setRestockAmount('');
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to remove this medical stock item?')) {
      const runLocalDelete = () => {
        const updated = items.filter(it => it.id !== id);
        setItems(updated);
        saveLocalInventory(updated);
      };

      if (useLocalOnly) {
        runLocalDelete();
        notify('success', 'Deleted Locally', 'Stock item was purged successfully (Local Sandbox).');
        return;
      }

      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', parseInt(id, 10));
        if (error) throw error;

        notify('success', 'Item Deleted', 'Stock item was purged successfully.');
        fetchInventory();
      } catch (err: any) {
        handleWriteError(err, 'Delete Item', runLocalDelete);
      }
    }
  };

  const getSeverity = (stock: number, minStock: number) => {
    if (stock <= 0) return 3; // Out of Stock
    if (stock <= minStock * 0.25) return 2; // Critical Supply Warning
    if (stock <= minStock) return 1; // Low Stock
    return 0; // Normal
  };

  const getItemStatusAndColor = (stock: number, minStock: number) => {
    if (stock <= 0) {
      return {
        status: 'Out of Stock',
        color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50',
        rowBg: 'bg-rose-50/50 dark:bg-rose-950/10'
      };
    }
    if (stock <= minStock * 0.25) {
      return {
        status: 'Critical Supply Warning',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 animate-pulse',
        rowBg: 'bg-amber-50/50 dark:bg-amber-950/10'
      };
    }
    if (stock <= minStock) {
      return {
        status: 'Low Stock',
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-200/40',
        rowBg: 'bg-orange-50/30 dark:bg-orange-950/5'
      };
    }
    return {
      status: 'Normal',
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400 border border-emerald-100/30',
      rowBg: ''
    };
  };

  const lowStockCount = items.filter(it => it.stock <= it.minStock).length;

  const filtered = items.filter(it => {
    if (typeFilter !== 'All' && it.type !== typeFilter) return false;
    
    // Alert Filter
    const sev = getSeverity(it.stock, it.minStock);
    if (alertFilter === 'Normal' && sev !== 0) return false;
    if (alertFilter === 'Low' && sev !== 1) return false;
    if (alertFilter === 'Critical' && sev !== 2) return false;
    if (alertFilter === 'Out' && sev !== 3) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = (it.name || '').toLowerCase().includes(q);
      const supplierMatch = (it.supplier || '').toLowerCase().includes(q);
      const unitMatch = (it.unit || '').toLowerCase().includes(q);
      const notesMatch = (it.notes || '').toLowerCase().includes(q);
      return nameMatch || supplierMatch || unitMatch || notesMatch;
    }
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const sevA = getSeverity(a.stock, a.minStock);
    const sevB = getSeverity(b.stock, b.minStock);
    if (sevA !== sevB) {
      return sevB - sevA; // High severity floats to the top
    }
    return a.name.localeCompare(b.name); // Secondary alphabetical sort
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
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

      {useLocalOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm font-sans">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5 shrink-0">
              <AlertCircle size={18} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-amber-900 leading-tight font-sans">Local Sandbox Mode Enabled</h4>
              <p className="text-xs text-amber-800 mt-1 max-w-3xl leading-normal font-medium font-sans">
                Your database row-level security (RLS) is protecting public writes or is missing appropriate insert policies for the <code>inventory</code> table. 
                Sensing this, we successfully activated the local sandbox to save your inventory entries/edits. Custom entries have been safely persisted to your local browser!
              </p>
            </div>
          </div>
          <button
            onClick={disableLocalFallbackAndRetry}
            className="self-start md:self-center shrink-0 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-sans"
          >
            <RefreshCcw size={12} /> Retry Cloud Sync
          </button>
        </div>
      )}

      {/* Restocking Alert Summary Widget at the Top */}
      <div 
        id="restock_alert_widget" 
        className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm font-sans transition-all duration-300 ${
          lowStockCount > 0 
            ? 'bg-rose-50 border-rose-100 text-rose-950' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-950'
        }`}
      >
        <div className="flex gap-3 items-center">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            lowStockCount > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'
          }`}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black leading-tight">
              {lowStockCount > 0 ? `${lowStockCount} Medical Items Need Restocking!` : 'Clinical Materials are Fully Secured'}
            </h4>
            <p className="text-xs mt-1 max-w-2xl leading-normal font-medium opacity-90">
              {lowStockCount > 0 
                ? `Some vital dental medicines or clinical surgical consumables are running under their minimum safety limits. Please replenish them as soon as possible.`
                : 'All medical SKUs, painkillers, gloves and compounds are verified above their critical safety levels.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          {lowStockCount > 0 ? (
            <button
              onClick={() => {
                setAlertFilter('Low');
                setSearch('');
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm shadow-rose-500/20"
            >
              Examine {lowStockCount} Critical SKUs
            </button>
          ) : (
            <span className="px-3 py-1 bg-emerald-150 text-emerald-800 font-extrabold text-[9px] uppercase tracking-wider rounded-lg">
              Status optimal
            </span>
          )}
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
            <h3 className={`text-2xl font-extrabold mt-0.5 ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockCount} SKUs</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Suppliers</p>
            <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">3 Trusted</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Supplies Sufficiency</p>
            <h3 className="text-2xl font-extrabold text-[#2fb574] mt-0.5">
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

            <div className="flex flex-wrap gap-2 font-sans text-xs">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 px-2.5 border border-gray-200 rounded-lg font-bold bg-white cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Medicine">Medicines</option>
                <option value="Consumable">Consumables</option>
              </select>

              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="h-8 px-2.5 border border-gray-200 rounded-lg font-bold bg-white cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Normal">Normal Stock</option>
                <option value="Low">Low Stock</option>
                <option value="Critical">Critical supply warning</option>
                <option value="Out">Out of stock</option>
              </select>

              <button
                onClick={() => {
                  const itemsToReorder = items.filter(it => it.stock <= it.minStock);
                  if (itemsToReorder.length === 0) {
                    notify('info', 'All Optimal', 'No items require restocking at this moment.');
                    return;
                  }
                  
                  let txt = `SRI CHAITANYA DENTAL CARE — MEDICAL SUPPLIES REORDER REPORT\n`;
                  txt += `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
                  txt += `========================================================================\n\n`;
                  txt += String("MATERIAL SKU").padEnd(35) + " | " + 
                         String("CURRENT").padEnd(12) + " | " + 
                         String("BENCHMARK").padEnd(12) + " | " + 
                         String("REORDER LVL").padEnd(12) + " | " + 
                         String("SUGGESTED REORDER").padEnd(18) + " | " + 
                         String("SUPPLIER") + "\n";
                  txt += `------------------------------------------------------------------------------------------------------------------------\n`;
                  itemsToReorder.forEach(it => {
                    const suggestedRef = (it.reorderLevel !== undefined ? it.reorderLevel : it.minStock * 2);
                    const suggestedQty = Math.max(0, suggestedRef - it.stock);
                    const currentStr = `${it.stock} ${it.unit}`;
                    const minStr = `${it.minStock} ${it.unit}`;
                    const reorderStr = it.reorderLevel !== undefined ? `${it.reorderLevel} ${it.unit}` : 'N/A';
                    const sugStr = `${suggestedQty} ${it.unit}`;
                    txt += `${it.name.substring(0, 34).padEnd(35)} | ` + 
                           `${currentStr.padEnd(12)} | ` + 
                           `${minStr.padEnd(12)} | ` + 
                           `${reorderStr.padEnd(12)} | ` + 
                           `${sugStr.padEnd(18)} | ` + 
                           `${it.supplier}\n`;
                  });
                  txt += `\n========================================================================\n`;
                  txt += `Total Items Needing Replenishment: ${itemsToReorder.length}\n`;
                  
                  const blob = new Blob([txt], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Srichaitanya_Reorder_Report_${new Date().toISOString().split('T')[0]}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  notify('success', 'Report Exported', 'A medical supply reorder manifest has been compiled & downloaded.');
                }}
                className="h-8 px-3 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 rounded-lg font-extrabold flex items-center gap-1.5 cursor-pointer"
                title="Download Reorder manifestations"
              >
                <Download size={12} /> Export Reorder Manifest
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by label name, supplier brand, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-teal-400 focus:outline-none placeholder:text-gray-400 font-sans font-medium"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-2 pl-3">Material SKU</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2">Unit Cost</th>
                  <th className="pb-2">Qty in Stock</th>
                  <th className="pb-2">Safety Limit</th>
                  <th className="pb-2">Reorder Benchmark</th>
                  <th className="pb-2 col-suggested">Suggested Reorder</th>
                  <th className="pb-2">Expiry Date</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60 text-gray-700 font-medium text-[11.5px]">
                {sortedFiltered.map((it) => {
                  const { status, color, rowBg } = getItemStatusAndColor(it.stock, it.minStock);
                  const isUnderLimit = it.stock <= it.minStock;
                  const targetReorder = it.reorderLevel !== undefined ? it.reorderLevel : it.minStock * 2;
                  const suggestedReorderQty = isUnderLimit ? Math.max(0, targetReorder - it.stock) : 0;
                  
                  return (
                    <tr 
                      key={it.id} 
                      className={`transition-colors duration-150 ${rowBg || 'hover:bg-slate-50/80'}`}
                    >
                      <td className={`py-3 pl-3 transition-all ${isUnderLimit ? 'border-l-4 border-rose-500' : ''}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-[#111827]">{it.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">Supplier: {it.supplier}</p>
                          {it.notes && (
                            <p className="text-[10px] font-medium text-slate-600 bg-slate-100/85 rounded px-1.5 py-0.5 inline-block max-w-xs truncate">
                              Notes: {it.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                          it.type === 'Medicine' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {it.type}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span id={`status_badge_${it.id}`} className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${color}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        ₹{(it.cost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 font-extrabold">
                        <span className={isUnderLimit ? "text-red-600 font-black" : "text-gray-900"}>
                          {it.stock} {it.unit}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-gray-500">
                        {it.minStock} {it.unit}
                      </td>
                      <td className="py-3 font-medium text-gray-500">
                        {it.reorderLevel !== undefined ? `${it.reorderLevel} ${it.unit}` : 'N/A'}
                      </td>
                      <td className="py-3 font-mono font-bold text-teal-700">
                        {suggestedReorderQty > 0 ? (
                          <span className="bg-teal-50 px-2 py-0.5 rounded border border-teal-100 text-teal-800">
                            + {suggestedReorderQty} {it.unit}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium font-sans">Sufficient</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-gray-500">
                        {it.expiryDate || 'N/A'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedItem(it);
                              setAdjustmentType('add');
                              setRestockAmount('');
                            }}
                            className="p-1 px-2.5 bg-sky-100 text-[#2f63e0] hover:bg-sky-200 rounded font-extrabold text-[9.5px] uppercase cursor-pointer"
                            title="Adjust Stock Level"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(it);
                              setEditName(it.name);
                              setEditType(it.type);
                              setEditStock(it.stock.toString());
                              setEditMinStock(it.minStock.toString());
                              setEditUnit(it.unit);
                              setEditSupplier(it.supplier);
                              setEditExpiry(it.expiryDate || '');
                              setEditCost((it.cost || 0).toString());
                              setEditNotes(it.notes || '');
                            }}
                            className="p-1 px-2.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded font-extrabold text-[9.5px] uppercase cursor-pointer"
                            title="Edit Item Details"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(it.id)}
                            className="p-1 px-1.5 text-gray-400 hover:text-red-700 hover:bg-slate-100 rounded cursor-pointer"
                            title="Purge Item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Restock / Stock Adjustor box */}
        <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5 font-sans">
            <RefreshCcw size={14} className="text-[#8757EA]" /> Dynamic Stock-Adjuster
          </h3>

          {selectedItem ? (
            <form onSubmit={handleRestock} className="space-y-4 font-sans text-xs">
              <div className="bg-teal-50 border border-teal-100 p-3.5 rounded-xl space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wide text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                  {selectedItem.type} SKU
                </span>
                <h4 className="font-extrabold text-xs text-slate-900">{selectedItem.name}</h4>
                <p className="text-[11px] text-slate-705">Current Qty: <strong>{selectedItem.stock} {selectedItem.unit}</strong></p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`h-8 rounded-lg font-bold text-[10px] uppercase transition ${
                      adjustmentType === 'add' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-650'
                    }`}
                  >
                    Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('subtract')}
                    className={`h-8 rounded-lg font-bold text-[10px] uppercase transition ${
                      adjustmentType === 'subtract' ? 'bg-red-650 text-white' : 'bg-gray-100 text-gray-650'
                    }`}
                  >
                    Subtract
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('set')}
                    className={`h-8 rounded-lg font-bold text-[10px] uppercase transition ${
                      adjustmentType === 'set' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-650'
                    }`}
                  >
                    Override
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">
                  {adjustmentType === 'add' && `Quantity to Add (${selectedItem.unit})`}
                  {adjustmentType === 'subtract' && `Quantity to Deduct (${selectedItem.unit})`}
                  {adjustmentType === 'set' && `New Absolute Value (${selectedItem.unit})`}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-extrabold text-xs"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 h-9 rounded-lg border border-gray-200 font-bold uppercase transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 bg-teal-600 text-white rounded-lg font-bold uppercase transition hover:opacity-90"
                >
                  Commit
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12 text-slate-400 font-sans italic text-xs leading-relaxed">
              Click <strong className="text-[#2F63E0]">"Adjust"</strong> next to any SKU row to replenish supply batches or record daily consumption audits.
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

      {/* Edit Item Overlay */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden">
            <div className="bg-amber-500 p-5 text-white">
              <h3 className="text-base font-black tracking-tight uppercase">Edit Supply Stock</h3>
              <p className="text-xs text-white/80 mt-1 font-medium font-sans">Modify medicine or hygiene consumable details</p>
            </div>

            <form onSubmit={handleUpdateItem} className="p-5 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Material SKU Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Stock Type</label>
                  <select
                    value={editType}
                    onChange={(e: any) => setEditType(e.target.value)}
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
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Current Stock</label>
                  <input
                    type="number"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Safety Min</label>
                  <input
                    type="number"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Reorder Level</label>
                  <input
                    type="number"
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Unit Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Expiry Batch Date (Optional)</label>
                  <input
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Supplier Brand Name</label>
                <select
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl bg-white font-semibold"
                >
                  <option value="Zydus Cadila Healthcare">Zydus Cadila Healthcare</option>
                  <option value="Dr. Reddy Labs">Dr. Reddy Labs</option>
                  <option value="Smileware Dental Supply">Smileware Dental Supply</option>
                  <option value="Kargil Medico Dist">Kargil Medico Dist</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Storage requirements, notes, etc."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-55 shadow-sm font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-amber-600 text-white hover:opacity-90 font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Current Stock</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Safety Min</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Reorder Level</label>
                  <input
                    type="number"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-400 font-bold"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Unit Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full h-10 border border-gray-200 px-3 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Expiry Batch Date (Optional)</label>
                  <input
                    type="date"
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                    className="w-full h-10 border border-gray-205 px-3 rounded-xl text-xs font-semibold"
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
                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Storage requirements, notes, etc."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full h-10 border border-gray-202 px-3 rounded-xl focus:outline-none"
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
