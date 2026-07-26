import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ClipboardList, Package, Cpu, QrCode, Plus, User, Clock, Layers, Search, Check, X, Calendar,
  Palette, Scissors, Printer, Sliders, Sparkles, ZoomIn, ZoomOut, FileText, PlusCircle, Table,
  Shield, Users, Lock, Edit2, Trash2, Tag, Scale, CalendarDays, FileEdit, Gift, Loader2, AlertTriangle
} from 'lucide-react';

// ============================================================
// PRIPOJENIE NA SUPABASE
// Hodnoty sa berú z .env súboru (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// Pozri SETUP.md pre návod, ako projekt v Supabase založiť.
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const DAYS_OF_WEEK = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa'];

const STATION_CONFIGS = {
  grafik: { name: 'Grafika', icon: Printer, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'export', label: 'Export dát', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  strihanie: { name: 'Strihanie', icon: Scissors, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'strihanie', label: 'Strihá sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  transfer: { name: 'Transfer tlač', icon: Layers, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sietotlac: { name: 'Sieťotlač', icon: Palette, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  laser: { name: 'Laser', icon: Cpu, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'rezanie', label: 'Rezanie', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sublimacia: { name: 'Sublimácia', icon: Sparkles, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]}
};

const FALLBACK_ACL = {
  create_order: { master: true, supervisor: true, sales: true, employee: false },
  delete_order: { master: true, supervisor: false, sales: false, employee: false },
  edit_priority: { master: true, supervisor: true, sales: false, employee: false },
  scan_qr: { master: true, supervisor: true, sales: false, employee: true },
  update_status: { master: true, supervisor: true, sales: false, employee: true },
  manage_profiles: { master: true, supervisor: false, sales: false, employee: false },
  edit_stock: { master: true, supervisor: true, sales: false, employee: false },
  manage_catalog: { master: true, supervisor: true, sales: false, employee: false }
};

// ============================================================
// MAPOVANIE MEDZI STĹPCAMI V DATABÁZE (snake_case) A APPKOU (camelCase)
// ============================================================
const mapMaterialFromDb = (r) => ({ id: r.id, name: r.name, color: r.color, width: r.width, weight: r.weight, pricePerM: r.price_per_m, qty: r.qty, unit: r.unit, minQty: r.min_qty, history: r.history || [] });
const mapMaterialToDb = (m) => ({ id: m.id, name: m.name, color: m.color, width: m.width, weight: m.weight, price_per_m: m.pricePerM, qty: m.qty, unit: m.unit, min_qty: m.minQty, history: m.history });

const mapProductFromDb = (r) => ({ id: r.id, customCode: r.custom_code, name: r.name, sports: r.sports || [], layer1: r.layer1, layer2: r.layer2, layer3: r.layer3, threadM: r.thread_m });
const mapProductToDb = (p) => ({ id: p.id, custom_code: p.customCode, name: p.name, sports: p.sports, layer1: p.layer1, layer2: p.layer2, layer3: p.layer3, thread_m: p.threadM });

const mapTierFromDb = (r) => ({ id: r.id, name: r.name, fit: r.fit, ventilation: r.ventilation, desc: r.description });
const mapTierToDb = (t) => ({ id: t.id, name: t.name, fit: t.fit, ventilation: t.ventilation, description: t.desc });

const mapEmployeeFromDb = (r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, birthday: r.birthday, nameday: r.nameday, entryDate: r.entry_date, role: r.role, position: r.position });
const mapEmployeeToDb = (e) => ({ id: e.id, first_name: e.firstName, last_name: e.lastName, birthday: e.birthday, nameday: e.nameday, entry_date: e.entryDate, role: e.role, position: e.position });

const mapOrderFromDb = (r) => ({ id: r.id, customer: r.customer, createdAt: r.created_at, scheduledDay: r.scheduled_day, driveLink: r.drive_link, notes: r.notes, items: r.items || [] });
const mapOrderToDb = (o) => ({ id: o.id, customer: o.customer, created_at: o.createdAt, scheduled_day: o.scheduledDay, drive_link: o.driveLink, notes: o.notes, items: o.items });

// Univerzálny handler pre realtime zmeny (INSERT/UPDATE/DELETE) nad poľom v stave appky
function applyRealtimeChange(setter, payload, mapFn) {
  setter(prev => {
    if (payload.eventType === 'DELETE') {
      return prev.filter(x => x.id !== payload.old.id);
    }
    const mapped = mapFn(payload.new);
    const exists = prev.some(x => x.id === mapped.id);
    return exists ? prev.map(x => (x.id === mapped.id ? mapped : x)) : [...prev, mapped];
  });
}

function flattenOrderItems(ordersList) {
  const flat = [];
  ordersList.forEach(order => {
    (order.items || []).forEach(item => {
      flat.push({ ...item, orderId: order.id, customer: order.customer, scheduledDay: order.scheduledDay, createdAt: order.createdAt, driveLink: order.driveLink, orderNotes: order.notes });
    });
  });
  return flat;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [qualityTiers, setQualityTiers] = useState([]);
  const [sports, setSports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [acl, setAcl] = useState(FALLBACK_ACL);

  const [activeTab, setActiveTab] = useState('planner'); 
  const [activeStationFilter, setActiveStationFilter] = useState('grafik'); 
  const [zoomLevel, setZoomLevel] = useState(85);
  const [plannerViewMode, setPlannerViewMode] = useState('matrix');

  const [currentUser, setCurrentUser] = useState(null); 

  const [rowSearch, setRowSearch] = useState('');
  const [rowDayFilter, setRowDayFilter] = useState('vsetko');

  const [catalogSportFilter, setCatalogSportFilter] = useState('vsetko');

  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [newOrderDay, setNewOrderDay] = useState('Pondelok');
  const [orderDriveLink, setOrderDriveLink] = useState('https://drive.google.com/');
  const [orderNotes, setOrderNotes] = useState('');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQualityTier, setSelectedProductTier] = useState(null);
  const [selectedGender, setSelectedGender] = useState('men');
  const [itemQty, setItemQty] = useState(10);
  const [selectedLayer1Mat, setSelectedLayer1Mat] = useState('');
  const [selectedLayer2Mat, setSelectedLayer2Mat] = useState('');
  const [selectedLayer3Mat, setSelectedLayer3Mat] = useState('');
  const [selectedPrintTypes, setSelectedPrintTypes] = useState({ transfer: false, sublimacia: true, sietotlac: false });
  const [itemNotes, setItemNotes] = useState('');

  const [pendingItems, setPendingItems] = useState([]);

  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState(null);
  const [stockCorrectionQty, setStockCorrectionQty] = useState('');
  const [stockCorrectionType, setStockCorrectionType] = useState('Pridanie na sklad');
  const [stockCorrectionNote, setStockCorrectionNote] = useState('');

  const [calcWidth, setCalcWidth] = useState(160);
  const [calcWeight, setCalcWeight] = useState(140);
  const [calcLength, setCalcLength] = useState(100);
  const [calcKg, setCalcKg] = useState(22.4);

  const [newMatName, setNewMatName] = useState('');
  const [newMatColor, setNewMatColor] = useState('Biela');
  const [newMatWidth, setNewMatWidth] = useState(160);
  const [newMatWeight, setNewMatWeight] = useState(140);
  const [newMatPrice, setNewMatPrice] = useState(4.50);
  const [newMatQty, setNewMatQty] = useState(100);

  const [editingProduct, setEditingProduct] = useState(null);
  const [newModelCode, setNewModelCode] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelSports, setNewModelSports] = useState([]);
  const [newModelPrimary, setNewModelPrimary] = useState('');
  const [newModelSecondary, setNewModelSecondary] = useState('');
  const [newModelTertiary, setNewModelTertiary] = useState('');

  const [newSportInput, setNewSportInput] = useState('');
  const [editingSportIndex, setEditingSportIndex] = useState(null);
  const [editingSportValue, setEditingSportValue] = useState('');

  const [editingTier, setEditingTier] = useState(null);
  const [newTierName, setNewTierName] = useState('');
  const [newTierFit, setNewTierFit] = useState('');
  const [newTierVent, setNewTierVent] = useState('');
  const [newTierDesc, setNewTierDesc] = useState('');

  const [selectedTerminalStation, setSelectedTerminalStation] = useState('grafik');
  const [manualQrInput, setManualQrInput] = useState('');
  const [scanNotification, setScanNotification] = useState(null);

  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [newEmpFirstName, setNewEmpFirstName] = useState('');
  const [newEmpLastName, setNewEmpLastName] = useState('');
  const [newEmpBirthday, setNewEmpBirthday] = useState('');
  const [newEmpNameday, setNewEmpNameday] = useState('');
  const [newEmpEntryDate, setNewEmpEntryDate] = useState('2026-07-24');
  const [newEmpRole, setNewEmpRole] = useState('employee');
  const [newEmpPosition, setNewEmpPosition] = useState('');

  const qrInputRef = useRef(null);

  // --- POČIATOČNÉ NAČÍTANIE DÁT ZO SUPABASE ---
  useEffect(() => {
    if (!supabase) {
      setLoadError('Appka nie je pripojená na Supabase. Skontroluj .env súbor (VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY) - pozri SETUP.md.');
      setIsLoading(false);
      return;
    }
    async function loadAll() {
      try {
        const [matRes, prodRes, tierRes, sportRes, empRes, aclRes, orderRes] = await Promise.all([
          supabase.from('materials').select('*').order('name'),
          supabase.from('products').select('*'),
          supabase.from('quality_tiers').select('*'),
          supabase.from('sports').select('*').order('name'),
          supabase.from('employees').select('*'),
          supabase.from('acl_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('orders').select('*').order('created_at', { ascending: false })
        ]);
        const firstErr = [matRes, prodRes, tierRes, sportRes, empRes, orderRes].find(r => r.error);
        if (firstErr) throw firstErr.error;

        const loadedMaterials = (matRes.data || []).map(mapMaterialFromDb);
        const loadedProducts = (prodRes.data || []).map(mapProductFromDb);
        const loadedTiers = (tierRes.data || []).map(mapTierFromDb);
        const loadedEmployees = (empRes.data || []).map(mapEmployeeFromDb);

        setMaterials(loadedMaterials);
        setProducts(loadedProducts);
        setQualityTiers(loadedTiers);
        setSports((sportRes.data || []).map(r => r.name));
        setEmployees(loadedEmployees);
        setAcl(aclRes.data ? aclRes.data.rules : FALLBACK_ACL);
        setOrders((orderRes.data || []).map(mapOrderFromDb));

        if (loadedEmployees.length > 0) setCurrentUser(loadedEmployees[0]);
        if (loadedProducts.length > 0) {
          setSelectedProduct(loadedProducts[0]);
          setSelectedLayer1Mat(loadedProducts[0].layer1?.materialId || '');
          setSelectedLayer2Mat(loadedProducts[0].layer2?.materialId || '');
          setSelectedLayer3Mat(loadedProducts[0].layer3?.materialId || '');
        }
        if (loadedTiers.length > 0) setSelectedProductTier(loadedTiers[0]);
      } catch (err) {
        console.error(err);
        setLoadError(err.message || 'Chyba pri načítaní dát zo servera.');
      } finally {
        setIsLoading(false);
      }
    }
    loadAll();
  }, []);

  // --- REALTIME SYNCHRONIZÁCIA (zmeny od iných tabletov sa premietnu okamžite) ---
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('tex-master-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, (payload) => applyRealtimeChange(setMaterials, payload, mapMaterialFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => applyRealtimeChange(setProducts, payload, mapProductFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quality_tiers' }, (payload) => applyRealtimeChange(setQualityTiers, payload, mapTierFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => applyRealtimeChange(setEmployees, payload, mapEmployeeFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => applyRealtimeChange(setOrders, payload, mapOrderFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports' }, (payload) => {
        if (payload.eventType === 'DELETE') setSports(prev => prev.filter(s => s !== payload.old.name));
        else setSports(prev => prev.includes(payload.new.name) ? prev : [...prev, payload.new.name]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acl_settings' }, (payload) => {
        if (payload.new?.rules) setAcl(payload.new.rules);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'qr-terminal' && qrInputRef.current) qrInputRef.current.focus();
  }, [activeTab]);

  const hasPermission = (action) => acl[action] ? acl[action][currentUser?.role] : false;

  const triggerNotification = (type, text) => {
    setScanNotification({ type, text });
    setTimeout(() => setScanNotification(null), 5000);
  };

  const getFormattedDateTime = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getTodayDisplay = () => {
    const d = new Date();
    return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const calculateKg = (length, width, grammage) => parseFloat(((parseFloat(length || 0) * (parseFloat(width || 0) / 100) * parseFloat(grammage || 0)) / 1000).toFixed(3));
  const calculateMeters = (kg, width, grammage) => {
    const factor = (parseFloat(width || 0) / 100) * parseFloat(grammage || 0);
    if (factor === 0) return 0;
    return parseFloat(((parseFloat(kg || 0) * 1000) / factor).toFixed(2));
  };
  const handleCalcLengthChange = (val) => { setCalcLength(val); setCalcKg(calculateKg(val, calcWidth, calcWeight)); };
  const handleCalcKgChange = (val) => { setCalcKg(val); setCalcLength(calculateMeters(val, calcWidth, calcWeight)); };

  // --- SKLAD: korekcia zásoby ---
  const handleApplyStockAdjustment = async (e) => {
    e.preventDefault();
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Chyba: Nemáte prístup ku korekcii skladu.'); return; }
    const changeVal = parseFloat(stockCorrectionQty);
    if (isNaN(changeVal) || changeVal === 0) { alert('Zadajte platnú zmenu množstva (+ pre prirátanie, - pre odpočítanie).'); return; }
    const now = getFormattedDateTime();
    const newQty = Math.max(0, parseFloat((selectedMaterialForDetail.qty + changeVal).toFixed(2)));
    const newHistory = [...(selectedMaterialForDetail.history || []), { date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: stockCorrectionType, change: changeVal, note: stockCorrectionNote || 'Korekcia zásoby' }];
    const { error } = await supabase.from('materials').update({ qty: newQty, history: newHistory }).eq('id', selectedMaterialForDetail.id);
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    setSelectedMaterialForDetail({ ...selectedMaterialForDetail, qty: newQty, history: newHistory });
    setStockCorrectionQty('');
    setStockCorrectionNote('');
    triggerNotification('success', 'Stav skladovej položky bol aktualizovaný.');
  };

  const handleAddNewMaterial = async (e) => {
    e.preventDefault();
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    const now = getFormattedDateTime();
    const created = {
      id: `tex-${Date.now()}`, name: newMatName, color: newMatColor, width: parseInt(newMatWidth), weight: parseInt(newMatWeight),
      pricePerM: parseFloat(newMatPrice), qty: parseFloat(newMatQty), unit: 'm', minQty: 50,
      history: [{ date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Pridanie na sklad', change: parseFloat(newMatQty), note: 'Prvotný príjem novej položky' }]
    };
    const { error } = await supabase.from('materials').insert(mapMaterialToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    setNewMatName('');
    triggerNotification('success', `Položka "${created.name}" bola naskladnená.`);
  };

  const calculateLayerConsumption = (product, gender, layerKey, qty) => {
    if (!product || !product[layerKey]) return 0;
    const rates = product[layerKey].consumption[gender];
    const rate = qty >= 5 ? rates.ge5 : rates.lt5;
    return parseFloat((rate * qty).toFixed(2));
  };

  // --- KATALÓG: modely ---
  const handleSaveModel = async (e) => {
    e.preventDefault();
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Prístup zamietnutý do správy katalógu.'); return; }
    if (editingProduct) {
      const { error } = await supabase.from('products').update(mapProductToDb(editingProduct)).eq('id', editingProduct.id);
      if (error) { triggerNotification('error', error.message); return; }
      setEditingProduct(null);
      triggerNotification('success', 'Model bol úspešne upravený.');
    } else {
      if (!newModelName || !newModelCode) { alert('Zadajte kód a názov modelu.'); return; }
      const created = {
        id: `prod-${Date.now()}`, customCode: newModelCode, name: newModelName, sports: newModelSports,
        layer1: { materialId: newModelPrimary, alternativeIds: [], consumption: { men: { lt5: 1.30, ge5: 1.10 }, women: { lt5: 1.15, ge5: 0.95 }, children: { lt5: 0.85, ge5: 0.70 } } },
        layer2: newModelSecondary ? { materialId: newModelSecondary, alternativeIds: [], consumption: { men: { lt5: 0.25, ge5: 0.20 }, women: { lt5: 0.20, ge5: 0.15 }, children: { lt5: 0.15, ge5: 0.10 } } } : null,
        layer3: newModelTertiary ? { materialId: newModelTertiary, alternativeIds: [], consumption: { men: { lt5: 1.35, ge5: 1.15 }, women: { lt5: 1.20, ge5: 1.00 }, children: { lt5: 0.90, ge5: 0.75 } } } : null,
        threadM: 15
      };
      const { error } = await supabase.from('products').insert(mapProductToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewModelCode('');
      setNewModelName('');
      triggerNotification('success', `Model "${created.name}" pridaný do katalógu.`);
    }
  };

  const handleDeleteModel = async (id) => {
    if (!hasPermission('manage_catalog')) return;
    if (!window.confirm('Naozaj vymazať tento model z katalógu?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) triggerNotification('error', error.message);
  };

  // --- KATALÓG: športy ---
  const handleAddSport = async () => {
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Nemáte prístup do správy katalógu.'); return; }
    const val = newSportInput.trim();
    if (!val) return;
    if (sports.includes(val)) { triggerNotification('error', 'Tento šport už v zozname existuje.'); return; }
    const { error } = await supabase.from('sports').insert({ name: val });
    if (error) { triggerNotification('error', error.message); return; }
    setNewSportInput('');
    triggerNotification('success', `Šport "${val}" bol pridaný.`);
  };

  const handleStartEditSport = (idx) => { setEditingSportIndex(idx); setEditingSportValue(sports[idx]); };

  const handleSaveEditSport = async (idx) => {
    const oldVal = sports[idx];
    const newVal = editingSportValue.trim();
    if (!newVal || newVal === oldVal) { setEditingSportIndex(null); return; }
    const { error: insErr } = await supabase.from('sports').insert({ name: newVal });
    if (insErr) { triggerNotification('error', insErr.message); return; }
    await supabase.from('sports').delete().eq('name', oldVal);
    const affected = products.filter(p => (p.sports || []).includes(oldVal));
    for (const p of affected) {
      const updatedSports = p.sports.map(s => (s === oldVal ? newVal : s));
      await supabase.from('products').update({ sports: updatedSports }).eq('id', p.id);
    }
    setEditingSportIndex(null);
    setEditingSportValue('');
  };

  const handleDeleteSport = async (idx) => {
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Nemáte prístup do správy katalógu.'); return; }
    const val = sports[idx];
    if (!window.confirm(`Naozaj vymazať šport "${val}" zo zoznamu?`)) return;
    await supabase.from('sports').delete().eq('name', val);
    const affected = products.filter(p => (p.sports || []).includes(val));
    for (const p of affected) {
      const updatedSports = p.sports.filter(s => s !== val);
      await supabase.from('products').update({ sports: updatedSports }).eq('id', p.id);
    }
    if (catalogSportFilter === val) setCatalogSportFilter('vsetko');
  };

  // --- KATALÓG: kvalitatívne rady ---
  const handleSaveTier = async (e) => {
    e.preventDefault();
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Nemáte prístup do správy katalógu.'); return; }
    if (editingTier) {
      const { error } = await supabase.from('quality_tiers').update(mapTierToDb(editingTier)).eq('id', editingTier.id);
      if (error) { triggerNotification('error', error.message); return; }
      setEditingTier(null);
      triggerNotification('success', 'Kvalitatívny rad bol upravený.');
    } else {
      if (!newTierName.trim()) { alert('Zadajte názov kvalitatívneho radu.'); return; }
      const created = { id: `tier-${Date.now()}`, name: newTierName, fit: newTierFit, ventilation: newTierVent, desc: newTierDesc };
      const { error } = await supabase.from('quality_tiers').insert(mapTierToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewTierName(''); setNewTierFit(''); setNewTierVent(''); setNewTierDesc('');
      triggerNotification('success', `Kvalitatívny rad "${created.name}" bol pridaný.`);
    }
  };

  const handleDeleteTier = async (id) => {
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Nemáte prístup do správy katalógu.'); return; }
    if (!window.confirm('Naozaj vymazať tento kvalitatívny rad?')) return;
    const { error } = await supabase.from('quality_tiers').delete().eq('id', id);
    if (error) triggerNotification('error', error.message);
  };

  // --- GENERÁTOR ZÁKAZIEK ---
  const handleAddPendingItem = () => {
    if (!selectedProduct) return;
    const neededList = [];
    if (selectedProduct.layer1) neededList.push({ layerName: 'Primárna látka', materialId: selectedLayer1Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer1', itemQty) });
    if (selectedProduct.layer2) neededList.push({ layerName: 'Sekundárna látka', materialId: selectedLayer2Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer2', itemQty) });
    if (selectedProduct.layer3) neededList.push({ layerName: 'Terciárna látka', materialId: selectedLayer3Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer3', itemQty) });
    const activePrintList = Object.keys(selectedPrintTypes).filter(k => selectedPrintTypes[k]);
    const newItem = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: selectedProduct.id, productName: selectedProduct.name, customCode: selectedProduct.customCode,
      qualityTier: selectedQualityTier.name, gender: selectedGender, qty: itemQty, printTypes: activePrintList,
      notes: itemNotes, materialsNeeded: neededList, threadQtyM: selectedProduct.threadM * itemQty
    };
    setPendingItems([...pendingItems, newItem]);
    setItemQty(10);
    setItemNotes('');
    triggerNotification('success', `Položka "${selectedProduct.name}" pridaná do zoznamu zákazky.`);
  };

  const handleRemovePendingItem = (tempId) => setPendingItems(pendingItems.filter(i => i.tempId !== tempId));

  const handleGenerateOrder = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Chyba: Vaša úroveň nemá právo na zadávanie zákaziek.'); return; }
    if (!newOrderCustomer.trim()) { alert('Vyplňte odberateľa.'); return; }
    if (pendingItems.length === 0) { alert('Pridajte aspoň jednu položku (produkt) do zákazky.'); return; }

    const orderId = `ZAK-${Date.now()}`;
    const allExistingItems = flattenOrderItems(orders);
    const sameDayCount = allExistingItems.filter(i => i.scheduledDay === newOrderDay).length;

    const itemsWithMeta = pendingItems.map((item, idx) => {
      const itemId = `${orderId}-${idx + 1}`;
      const initialStatuses = {};
      Object.keys(STATION_CONFIGS).forEach(key => { initialStatuses[key] = key === 'grafik' ? 'priprava' : 'neaktivne'; });
      item.printTypes.forEach(pt => { initialStatuses[pt] = 'priprava'; });
      return {
        itemId, productId: item.productId, productName: item.productName, customCode: item.customCode,
        qualityTier: item.qualityTier, gender: item.gender, qty: item.qty, printTypes: item.printTypes, notes: item.notes,
        materialsNeeded: item.materialsNeeded, threadQtyM: item.threadQtyM, priority: sameDayCount + idx + 1,
        stationStatuses: initialStatuses, materialDeducted: false
      };
    });

    const created = { id: orderId, customer: newOrderCustomer, createdAt: getFormattedDateTime(), scheduledDay: newOrderDay, driveLink: orderDriveLink, notes: orderNotes, items: itemsWithMeta };
    const { error } = await supabase.from('orders').insert(mapOrderToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }

    setSelectedOrderDetails(created);
    setActiveTab('planner');
    setNewOrderCustomer('');
    setOrderNotes('');
    setOrderDriveLink('https://drive.google.com/');
    setPendingItems([]);
    triggerNotification('success', `Zákazka ${orderId} bola zaradená do výroby (${itemsWithMeta.length} položiek).`);
  };

  const findItemByItemId = (itemId) => {
    for (const order of orders) {
      const item = (order.items || []).find(i => i.itemId.toUpperCase() === itemId.toUpperCase());
      if (item) return { order, item };
    }
    return null;
  };

  const handleQrScan = (scannedCode) => {
    if (!hasPermission('scan_qr')) { triggerNotification('error', 'Prístup zamietnutý na skenovanie.'); return; }
    if (!scannedCode.trim()) return;
    const code = scannedCode.trim();
    const found = findItemByItemId(code);
    if (!found) { triggerNotification('error', `Položka ${code} nebola nájdená.`); setManualQrInput(''); return; }
    const { order, item } = found;
    const currentStatus = item.stationStatuses[selectedTerminalStation] || 'neaktivne';
    if (currentStatus === 'neaktivne' || currentStatus === 'priprava') {
      let targetStatus = 'hotove';
      if (selectedTerminalStation === 'grafik') targetStatus = 'export';
      if (selectedTerminalStation === 'laser') targetStatus = 'rezanie';
      if (['transfer', 'sietotlac', 'sublimacia'].includes(selectedTerminalStation)) targetStatus = 'tlac';
      updateStationStatus(order.id, item.itemId, selectedTerminalStation, targetStatus);
      triggerNotification('success', `VSTUP naskenovaný: Položka ${item.itemId} (${item.productName}) je v práci.`);
    } else {
      updateStationStatus(order.id, item.itemId, selectedTerminalStation, 'hotove');
      triggerNotification('success', `VÝSTUP naskenovaný: Práca na položke ${item.itemId} ukončená.`);
    }
    setManualQrInput('');
  };

  // Zápis stavu stanice + prípadné odpísanie materiálu — zapisuje priamo do Supabase
  const updateStationStatus = async (orderId, itemId, stationId, statusId) => {
    if (!hasPermission('update_status')) { triggerNotification('error', 'Nemáte oprávnenie meniť stavy staníc.'); return; }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const now = getFormattedDateTime();
    const materialUpdates = [];

    const updatedItems = order.items.map(item => {
      if (item.itemId !== itemId) return item;
      let isDeductedNow = item.materialDeducted;
      if ((stationId === 'strihanie' || stationId === 'laser') && statusId !== 'neaktivne' && statusId !== 'priprava' && !item.materialDeducted) {
        item.materialsNeeded.forEach(needed => {
          const mat = materials.find(m => m.id === needed.materialId);
          if (mat) {
            const newQty = Math.max(0, parseFloat((mat.qty - needed.qtyNeeded).toFixed(2)));
            const newHist = [...(mat.history || []), { date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Odpísanie pre výrobu', change: -needed.qtyNeeded, note: `Zákazka ${orderId} • Položka ${itemId}` }];
            materialUpdates.push({ id: mat.id, qty: newQty, history: newHist });
          }
        });
        isDeductedNow = true;
      }
      return { ...item, stationStatuses: { ...item.stationStatuses, [stationId]: statusId }, materialDeducted: isDeductedNow };
    });

    const { error: orderErr } = await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);
    if (orderErr) { triggerNotification('error', orderErr.message); return; }

    for (const mu of materialUpdates) {
      await supabase.from('materials').update({ qty: mu.qty, history: mu.history }).eq('id', mu.id);
    }

    if (selectedOrderDetails?.id === orderId) setSelectedOrderDetails({ ...order, items: updatedItems });
  };

  // --- ZAMESTNANCI ---
  const handleSubmitEmployee = async (e) => {
    e.preventDefault();
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte prístup do správy profilov.'); return; }
    if (editingEmployee) {
      const { error } = await supabase.from('employees').update(mapEmployeeToDb(editingEmployee)).eq('id', editingEmployee.id);
      if (error) { triggerNotification('error', error.message); return; }
      if (currentUser.id === editingEmployee.id) setCurrentUser(editingEmployee);
      setEditingEmployee(null);
      triggerNotification('success', 'Zamestnanec bol upravený.');
    } else {
      if (!newEmpFirstName.trim() || !newEmpLastName.trim()) { alert('Zadajte meno a priezvisko.'); return; }
      const created = { id: `emp-${Date.now()}`, firstName: newEmpFirstName, lastName: newEmpLastName, birthday: newEmpBirthday, nameday: newEmpNameday, entryDate: newEmpEntryDate, role: newEmpRole, position: newEmpPosition };
      const { error } = await supabase.from('employees').insert(mapEmployeeToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewEmpFirstName(''); setNewEmpLastName(''); setNewEmpBirthday(''); setNewEmpNameday(''); setNewEmpPosition('');
      triggerNotification('success', `Zamestnanec "${created.firstName}" bol pridaný.`);
    }
  };

  const handleStartEditEmployee = (emp) => setEditingEmployee({ ...emp });
  const handleCancelEditEmployee = () => setEditingEmployee(null);

  const handleDeleteEmployee = async (id) => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte prístup do správy profilov.'); return; }
    if (!window.confirm('Naozaj vymazať tohto zamestnanca?')) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { triggerNotification('error', error.message); return; }
    if (currentUser.id === id) {
      const remaining = employees.filter(e => e.id !== id);
      if (remaining.length > 0) setCurrentUser(remaining[0]);
    }
    if (editingEmployee?.id === id) setEditingEmployee(null);
  };

  const handleToggleAcl = async (actionKey, roleKey) => {
    if (currentUser.role !== 'master') return;
    const updatedRules = { ...acl, [actionKey]: { ...acl[actionKey], [roleKey]: !acl[actionKey][roleKey] } };
    const { error } = await supabase.from('acl_settings').update({ rules: updatedRules }).eq('id', 1);
    if (error) triggerNotification('error', error.message);
  };

  const allItems = flattenOrderItems(orders);

  const sortedRows = allItems.filter(item => {
    const matchesSearch = item.customer.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.orderId.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.itemId.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.productName.toLowerCase().includes(rowSearch.toLowerCase());
    const matchesDay = rowDayFilter === 'vsetko' || item.scheduledDay === rowDayFilter;
    return matchesSearch && matchesDay;
  });

  const catalogFilteredProducts = products.filter(p => catalogSportFilter === 'vsetko' ? true : p.sports?.includes(catalogSportFilter));
  const pendingTotalQty = pendingItems.reduce((sum, i) => sum + i.qty, 0);
  const genderLabel = (g) => g === 'men' ? 'Muži' : g === 'women' ? 'Ženy' : 'Deti';

  // --- OBRAZOVKA NAČÍTAVANIA / CHYBY ---
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg bg-slate-950 border border-rose-900/50 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-rose-300">Nepodarilo sa pripojiť na server</h2>
          <p className="text-sm text-slate-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <span className="text-sm text-slate-400">Načítavam dáta zo servera...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased">
      
      <div className="bg-slate-950 border-b border-indigo-950 px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-slate-300 print:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" />
          <span className="font-bold">Prihlásený zamestnanec:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {employees.map(emp => {
            const isSelected = currentUser.id === emp.id;
            return (
              <button key={emp.id} onClick={() => setCurrentUser(emp)}
                className={`px-3 py-1 rounded-md font-bold transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-md scale-105' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}`}>
                {emp.firstName} ({emp.role.toUpperCase()})
              </button>
            );
          })}
        </div>
      </div>

      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-gradient-to-br from-indigo-500 to-pink-500 p-2 rounded-lg text-white"><Scissors className="h-5 w-5" /></div>
              <div>
                <span className="font-extrabold text-md tracking-wider text-white block">TEX-MASTER ERP v6.0</span>
                <span className="text-[10px] text-indigo-400 block -mt-1 font-semibold">Živé dáta • Supabase</span>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800 w-full lg:w-auto">
              <button onClick={() => setActiveTab('planner')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'planner' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Calendar className="h-3.5 w-3.5" /> Plánovacia Matica</button>
              <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><PlusCircle className="h-3.5 w-3.5" /> Konfigurátor Zákaziek</button>
              <button onClick={() => setActiveTab('catalog')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'catalog' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Tag className="h-3.5 w-3.5" /> Katalóg Modelov</button>
              <button onClick={() => setActiveTab('isolated-station')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'isolated-station' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Sliders className="h-3.5 w-3.5" /> Samostatné Dielne</button>
              <button onClick={() => setActiveTab('materials')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'materials' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Package className="h-3.5 w-3.5" /> Sklad</button>
              <button onClick={() => setActiveTab('profiles')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'profiles' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Users className="h-3.5 w-3.5" /> Zamestnanci & Práva</button>
              <button onClick={() => setActiveTab('qr-terminal')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'qr-terminal' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><QrCode className="h-3.5 w-3.5" /> Čítačka QR</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {scanNotification && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 shadow-xl flex items-start gap-3 transition-all duration-300 print:hidden ${scanNotification.type === 'success' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200' : 'bg-rose-950/80 border-rose-500 text-rose-200'}`}>
            <div className={`p-1 rounded-full ${scanNotification.type === 'success' ? 'bg-emerald-800' : 'bg-rose-800'}`}>
              {scanNotification.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-bold text-sm">{scanNotification.type === 'success' ? 'Potvrdené' : 'Upozornenie'}</p>
              <p className="text-xs opacity-90">{scanNotification.text}</p>
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="space-y-4 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="text-indigo-400 h-5 w-5" /> Týždenný Plánovací Panel</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Prihlásený: <strong>{currentUser.firstName} {currentUser.lastName} ({currentUser.position})</strong></p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto">
                  <button onClick={() => setPlannerViewMode('matrix')} className={`flex-1 md:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${plannerViewMode === 'matrix' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Sliders className="h-3.5 w-3.5" /> Plánovacia Matica</button>
                  <button onClick={() => setPlannerViewMode('rows')} className={`flex-1 md:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${plannerViewMode === 'rows' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Table className="h-3.5 w-3.5" /> Riadkový Zoznam</button>
                </div>
              </div>

              {plannerViewMode === 'matrix' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Mierka:</span>
                      <button onClick={() => setZoomLevel(prev => Math.max(50, prev - 5))} className="p-1 bg-slate-800 hover:bg-slate-700 rounded"><ZoomOut className="h-3.5 w-3.5" /></button>
                      <span className="font-bold text-white w-8 text-center">{zoomLevel}%</span>
                      <button onClick={() => setZoomLevel(prev => Math.min(110, prev + 5))} className="p-1 bg-slate-800 hover:bg-slate-700 rounded"><ZoomIn className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                    <table className="w-full text-left border-collapse" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${100 / (zoomLevel / 100)}%` }}>
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-40 border-r border-slate-850">Stanica</th>
                          {DAYS_OF_WEEK.map(day => (<th key={day} className="p-3 text-xs font-bold text-slate-300 uppercase tracking-wider text-center border-r border-slate-850">{day}</th>))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {Object.keys(STATION_CONFIGS).map(stationId => {
                          const config = STATION_CONFIGS[stationId];
                          return (
                            <tr key={stationId} className="hover:bg-slate-900/10">
                              <td className="p-3 font-bold text-xs text-slate-200 bg-slate-900/40 border-r border-slate-850">
                                <div className="flex items-center gap-1.5"><config.icon className="h-4 w-4 text-indigo-400 shrink-0" /><span>{config.name}</span></div>
                              </td>
                              {DAYS_OF_WEEK.map(day => {
                                const dayItems = allItems.filter(it => it.scheduledDay === day && it.stationStatuses[stationId] !== 'neaktivne').sort((a, b) => a.priority - b.priority);
                                return (
                                  <td key={day} className="p-1 border-r border-slate-850 align-top min-h-[110px] bg-slate-950/15">
                                    <div className="grid grid-cols-1 gap-1">
                                      {dayItems.map(item => {
                                        const statusId = item.stationStatuses[stationId];
                                        const statusCfg = config.statuses.find(s => s.id === statusId) || config.statuses[0];
                                        return (
                                          <div key={item.itemId} onClick={() => setSelectedOrderDetails(orders.find(o => o.id === item.orderId))} className="bg-slate-900 hover:bg-slate-800 border border-slate-750 p-2 rounded cursor-pointer transition-all flex flex-col justify-between text-[10px] space-y-1 shadow hover:scale-[1.02] transform">
                                            <div className="flex items-center justify-between">
                                              <span className="font-mono font-bold text-indigo-400">#{item.priority} • {item.itemId}</span>
                                              <span className="text-slate-400 font-bold">{item.qty}ks</span>
                                            </div>
                                            <p className="font-extrabold text-slate-100 truncate">{item.customer}</p>
                                            <p className="text-[9px] text-slate-300 truncate">{item.productName} ({item.qualityTier})</p>
                                            <div className={`text-[9px] px-1 py-0.5 rounded text-center font-bold ${statusCfg.color} truncate`}>{statusCfg.label}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ height: `${(105 - zoomLevel) * 4.8}px` }}></div>
                </div>
              )}

              {plannerViewMode === 'rows' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                      <input type="text" placeholder="Hľadať ID, odberateľa, produkt..." value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none" />
                    </div>
                    <div>
                      <select value={rowDayFilter} onChange={(e) => setRowDayFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100">
                        <option value="vsetko">Všetky dni</option>
                        {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-end text-slate-400 text-[11px]"><span>Záznamov: <strong className="text-white font-bold">{sortedRows.length}</strong></span></div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/20">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Položka</th>
                          <th className="px-4 py-3">Zákazka</th>
                          <th className="px-4 py-3">Odberateľ</th>
                          <th className="px-4 py-3">Produkt (Vyhotovenie)</th>
                          <th className="px-4 py-3 text-center">Ks</th>
                          <th className="px-4 py-3 text-center">Deň</th>
                          <th className="px-4 py-3 text-center">Priorita</th>
                          <th className="px-4 py-3 text-center">Akcie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {sortedRows.map(item => (
                          <tr key={item.itemId} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-400">{item.itemId}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">{item.orderId}</td>
                            <td className="px-4 py-3 font-bold text-white">{item.customer}</td>
                            <td className="px-4 py-3 text-slate-300">{item.productName} (<span className="text-indigo-400">{item.qualityTier}</span>)</td>
                            <td className="px-4 py-3 text-center font-bold text-white">{item.qty}</td>
                            <td className="px-4 py-3 text-center"><span className="bg-slate-800 px-2 py-0.5 rounded">{item.scheduledDay}</span></td>
                            <td className="px-4 py-3 text-center"><span className="bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">#{item.priority}</span></td>
                            <td className="px-4 py-3 text-center"><button onClick={() => setSelectedOrderDetails(orders.find(o => o.id === item.orderId))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1 rounded">Sprievodka</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            {!hasPermission('create_order') ? (
              <div className="bg-rose-950/40 border border-rose-800 p-6 rounded-2xl text-center space-y-3">
                <Lock className="h-12 w-12 text-rose-500 mx-auto" />
                <h3 className="text-lg font-bold text-rose-300">Prístup zamietnutý</h3>
                <p className="text-xs text-rose-400">Vaša rola nemá práva na vytváranie nových zákaziek.</p>
              </div>
            ) : (
              <>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><User className="text-indigo-400 h-5 w-5" /> 1. Zákazník & Harmonogram</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Odberateľ (Klub / Firma)</label>
                      <input type="text" placeholder="napr. MŠK Kežmarok" value={newOrderCustomer} onChange={(e) => setNewOrderCustomer(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Dátum vytvorenia (automaticky)</label>
                      <div className="w-full bg-slate-900/60 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-indigo-400" /> {getTodayDisplay()}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Deň vyhotovenia zákazky</label>
                      <select value={newOrderDay} onChange={(e) => setNewOrderDay(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                        {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Odkaz na Cloud / PDF (grafika)</label>
                      <input type="text" value={orderDriveLink} onChange={(e) => setOrderDriveLink(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-400" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k celej zákazke (napr. termín dodania, spôsob dopravy)</label>
                    <textarea rows={2} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Poznámka pre celú zákazku..." className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><PlusCircle className="text-indigo-400 h-5 w-5" /> 2. Pridať položku (produkt) do zákazky</h2>
                  <p className="text-xs text-slate-400 mb-4">Jedna zákazka môže obsahovať viacero rôznych produktov. Každú položku pridajte samostatne.</p>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2"><Search className="h-4 w-4 text-indigo-400" /> Model & Strih</h3>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Produkt z katalógu</label>
                        <select value={selectedProduct?.id || ''} onChange={(e) => {
                            const prod = products.find(p => p.id === e.target.value);
                            setSelectedProduct(prod);
                            if (prod) { setSelectedLayer1Mat(prod.layer1?.materialId || ''); setSelectedLayer2Mat(prod.layer2?.materialId || ''); setSelectedLayer3Mat(prod.layer3?.materialId || ''); }
                          }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} [{p.customCode}] ({p.sports?.join(', ')})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Úroveň vyhotovenia</label>
                        <select value={selectedQualityTier?.id || ''} onChange={(e) => setSelectedProductTier(qualityTiers.find(q => q.id === e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                          {qualityTiers.map(q => <option key={q.id} value={q.id}>{q.name} ({q.fit})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Veľkostná kategória</label>
                        <div className="grid grid-cols-3 gap-1">
                          {['men', 'women', 'children'].map(g => (
                            <button type="button" key={g} onClick={() => setSelectedGender(g)} className={`py-1.5 text-center text-xs font-bold rounded transition-colors ${selectedGender === g ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}>{genderLabel(g)}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Množstvo (ks)</label>
                        <input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(parseInt(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-white" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2"><Sliders className="h-4 w-4 text-indigo-400" /> Značenie & Detaily</h3>
                      <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1.5">Značenie dresu:</span>
                        <div className="grid grid-cols-3 gap-1">
                          {['transfer', 'sublimacia', 'sietotlac'].map(type => (
                            <label key={type} className="flex items-center gap-1 bg-slate-950 p-2 rounded cursor-pointer text-[10px] uppercase font-bold border border-slate-850">
                              <input type="checkbox" checked={selectedPrintTypes[type]} onChange={(e) => setSelectedPrintTypes({ ...selectedPrintTypes, [type]: e.target.checked })} className="rounded bg-slate-900 border-slate-800 text-indigo-600 mr-1" />
                              {type}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k tejto položke</label>
                        <textarea rows={6} value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} placeholder="Napr. Pantone 286C, mesh podpazušie, číslovanie 1-10..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div className="space-y-4">
                        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2"><Package className="h-4 w-4 text-indigo-400" /> Materiálové Vrstvy</h3>
                        {selectedProduct?.layer1 && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primárna látka: {calculateLayerConsumption(selectedProduct, selectedGender, 'layer1', itemQty)} m</label>
                            <select value={selectedLayer1Mat} onChange={(e) => setSelectedLayer1Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs">
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.color})</option>)}
                            </select>
                          </div>
                        )}
                        {selectedProduct?.layer2 && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sekundárna látka: {calculateLayerConsumption(selectedProduct, selectedGender, 'layer2', itemQty)} m</label>
                            <select value={selectedLayer2Mat} onChange={(e) => setSelectedLayer2Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs">
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.color})</option>)}
                            </select>
                          </div>
                        )}
                        {selectedProduct?.layer3 && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Terciárna látka: {calculateLayerConsumption(selectedProduct, selectedGender, 'layer3', itemQty)} m</label>
                            <select value={selectedLayer3Mat} onChange={(e) => setSelectedLayer3Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs">
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.color})</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={handleAddPendingItem} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Pridať položku do zoznamu</button>
                    </div>
                  </div>
                </div>

                {pendingItems.length > 0 && (
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardList className="text-indigo-400 h-5 w-5" /> 3. Položky v tejto zákazke ({pendingItems.length})</h2>
                      <span className="text-xs text-slate-400">Spolu kusov: <strong className="text-white">{pendingTotalQty}</strong></span>
                    </div>
                    <div className="space-y-2">
                      {pendingItems.map((item, idx) => (
                        <div key={item.tempId} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-400 font-bold">#{idx + 1}</span>
                              <span className="font-bold text-white">{item.productName}</span>
                              <span className="text-slate-400">({item.qualityTier} • {genderLabel(item.gender)} • {item.qty}ks)</span>
                            </div>
                            {item.printTypes.length > 0 && (<div className="flex gap-1">{item.printTypes.map(pt => <span key={pt} className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] text-indigo-300 uppercase">{pt}</span>)}</div>)}
                            {item.notes && <p className="text-[10px] text-slate-500 italic max-w-xl">{item.notes}</p>}
                          </div>
                          <button onClick={() => handleRemovePendingItem(item.tempId)} className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded shrink-0"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleGenerateOrder} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl">
                  <Printer className="h-5 w-5" /> Vytvoriť zákazku so všetkými položkami ({pendingItems.length})
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2"><Tag className="text-indigo-400 h-5 w-5" /> Správa Katalógu Modelov</h2>
              <p className="text-xs text-slate-400 mb-6">Katalóg môže obsahovať akékoľvek modely - dresy, tréningovky, mikiny, tepláky a pod.</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">{editingProduct ? `Upraviť model: ${editingProduct.name}` : 'Vytvoriť nový model'}</h3>
                  <form onSubmit={handleSaveModel} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Vlastný Kód Modelu</label>
                        <input type="text" required value={editingProduct ? editingProduct.customCode : newModelCode} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, customCode: e.target.value }) : setNewModelCode(e.target.value)} placeholder="napr. TRENIRKA-01" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Názov Modelu</label>
                        <input type="text" required value={editingProduct ? editingProduct.name : newModelName} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewModelName(e.target.value)} placeholder="napr. Tréningová súprava Pro" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Kompatibilné Športy</label>
                        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-2 rounded border border-slate-800 max-h-[90px] overflow-y-auto">
                          {sports.map(s => {
                            const isChecked = editingProduct ? editingProduct.sports?.includes(s) : newModelSports.includes(s);
                            return (
                              <label key={s} className="flex items-center gap-1 cursor-pointer text-[10px]">
                                <input type="checkbox" checked={isChecked} onChange={() => {
                                    if (editingProduct) {
                                      const curr = editingProduct.sports || [];
                                      setEditingProduct({ ...editingProduct, sports: curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s] });
                                    } else {
                                      setNewModelSports(newModelSports.includes(s) ? newModelSports.filter(x => x !== s) : [...newModelSports, s]);
                                    }
                                  }} className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0 mr-1" />
                                {s}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Látka 1 (Primárna)</label>
                        <select value={editingProduct ? editingProduct.layer1?.materialId : newModelPrimary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer1: { ...editingProduct.layer1, materialId: e.target.value } });
                            else setNewModelPrimary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Látka 2 (Sekundárna)</label>
                        <select value={editingProduct ? (editingProduct.layer2?.materialId || '') : newModelSecondary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer2: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: { men: { lt5: 0.25, ge5: 0.20 }, women: { lt5: 0.20, ge5: 0.15 }, children: { lt5: 0.15, ge5: 0.10 } } } : null });
                            else setNewModelSecondary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna --</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Látka 3 (Terciárna)</label>
                        <select value={editingProduct ? (editingProduct.layer3?.materialId || '') : newModelTertiary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer3: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: { men: { lt5: 1.35, ge5: 1.15 }, women: { lt5: 1.20, ge5: 1.00 }, children: { lt5: 0.90, ge5: 0.75 } } } : null });
                            else setNewModelTertiary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna --</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg uppercase">{editingProduct ? 'Uložiť Zmeny Modelu' : 'Pridať Model do Katalógu'}</button>
                    {editingProduct && <button type="button" onClick={() => setEditingProduct(null)} className="ml-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg">Zrušiť</button>}
                  </form>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">{editingTier ? `Upraviť rad: ${editingTier.name}` : 'Kvalitatívne rady'}</h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {qualityTiers.map(q => (
                      <div key={q.id} className="bg-slate-950 p-2.5 rounded border border-slate-850 text-xs flex justify-between items-start gap-2">
                        <div><strong className="text-indigo-400 block">{q.name}</strong><p className="text-slate-400 mt-1">{q.fit} • {q.ventilation}</p></div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setEditingTier({ ...q })} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-indigo-400"><Edit2 className="h-3 w-3" /></button>
                          <button onClick={() => handleDeleteTier(q.id)} className="p-1 bg-slate-800 hover:bg-rose-900 rounded text-rose-400"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSaveTier} className="space-y-2 text-xs border-t border-slate-850 pt-3">
                    <input type="text" required placeholder="Názov (napr. Pro)" value={editingTier ? editingTier.name : newTierName} onChange={(e) => editingTier ? setEditingTier({ ...editingTier, name: e.target.value }) : setNewTierName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                    <input type="text" placeholder="Strih (napr. Slim Fit)" value={editingTier ? editingTier.fit : newTierFit} onChange={(e) => editingTier ? setEditingTier({ ...editingTier, fit: e.target.value }) : setNewTierFit(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                    <input type="text" placeholder="Vetranie" value={editingTier ? editingTier.ventilation : newTierVent} onChange={(e) => editingTier ? setEditingTier({ ...editingTier, ventilation: e.target.value }) : setNewTierVent(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                    <textarea rows={2} placeholder="Popis" value={editingTier ? editingTier.desc : newTierDesc} onChange={(e) => editingTier ? setEditingTier({ ...editingTier, desc: e.target.value }) : setNewTierDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded uppercase">{editingTier ? 'Uložiť' : 'Pridať rad'}</button>
                      {editingTier && <button type="button" onClick={() => setEditingTier(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 rounded">Zrušiť</button>}
                    </div>
                  </form>
                </div>
              </div>

              <div className="mt-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">Zoznam Športov</h3>
                <div className="flex flex-wrap gap-2">
                  {sports.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                      {editingSportIndex === idx ? (
                        <>
                          <input type="text" value={editingSportValue} onChange={(e) => setEditingSportValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEditSport(idx)} autoFocus className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white w-24" />
                          <button onClick={() => handleSaveEditSport(idx)} className="text-emerald-400 p-0.5"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingSportIndex(null)} className="text-slate-500 p-0.5"><X className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-slate-200 font-semibold">{s}</span>
                          <button onClick={() => handleStartEditSport(idx)} className="text-indigo-400 p-0.5"><Edit2 className="h-3 w-3" /></button>
                          <button onClick={() => handleDeleteSport(idx)} className="text-rose-400 p-0.5"><Trash2 className="h-3 w-3" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <input type="text" placeholder="Nový šport" value={newSportInput} onChange={(e) => setNewSportInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSport()} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                  <button onClick={handleAddSport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 rounded-lg flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Pridať</button>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-800 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="font-bold text-base text-white">Register modelov v katalógu</h3>
                    <p className="text-xs text-slate-400">Kliknutím na "Upraviť" môžete meniť zloženie aj vlastný kód.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 font-bold">Filtrovať Šport:</span>
                    <select value={catalogSportFilter} onChange={(e) => setCatalogSportFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white">
                      <option value="vsetko">Všetky Športy</option>
                      {sports.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalogFilteredProducts.map(p => (
                    <div key={p.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <div><span className="font-mono text-indigo-400 text-[10px] font-bold block">{p.id}</span><span className="font-mono text-slate-300 font-bold text-xs">{p.customCode}</span></div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingProduct(p)} className="bg-slate-800 hover:bg-slate-750 text-indigo-400 p-1.5 rounded transition-all flex items-center gap-1 font-bold text-[10px]"><FileEdit className="h-3.5 w-3.5" /> Upraviť</button>
                          <button onClick={() => handleDeleteModel(p.id)} className="bg-slate-800 hover:bg-rose-900 text-rose-400 p-1.5 rounded transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <h4 className="font-extrabold text-slate-100 text-sm">{p.name}</h4>
                      <div>
                        <span className="font-bold text-slate-400 block text-[10px] uppercase mb-1">Vhodné pre športy:</span>
                        <div className="flex flex-wrap gap-1">{p.sports?.map(s => <span key={s} className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-indigo-300 font-semibold">{s}</span>)}</div>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded space-y-1.5 text-[11px]">
                        <span className="font-bold text-slate-300 block border-b border-slate-850 pb-1">Materiálové zloženie:</span>
                        <p>Látka 1: <strong>{materials.find(m => m.id === p.layer1?.materialId)?.name}</strong></p>
                        {p.layer2 && <p>Látka 2: <strong>{materials.find(m => m.id === p.layer2?.materialId)?.name}</strong></p>}
                        {p.layer3 && <p>Látka 3: <strong>{materials.find(m => m.id === p.layer3?.materialId)?.name}</strong></p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'isolated-station' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><Sliders className="text-indigo-400 h-5 w-5" /> Výrobný filter pre jednotlivé dielne</h2></div>
                <div className="flex flex-wrap gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  {Object.keys(STATION_CONFIGS).map(sid => {
                    const active = activeStationFilter === sid;
                    return (<button key={sid} onClick={() => setActiveStationFilter(sid)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{STATION_CONFIGS[sid].name}</button>);
                  })}
                </div>
              </div>
              <div className="space-y-4">
                {allItems.filter(it => it.stationStatuses[activeStationFilter] !== 'neaktivne').length === 0 ? (
                  <div className="py-12 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">Aktuálne nečakajú na tejto stanici žiadne položky na spracovanie.</div>
                ) : (
                  allItems.filter(it => it.stationStatuses[activeStationFilter] !== 'neaktivne').sort((a, b) => a.priority - b.priority).map((item, index) => {
                    const config = STATION_CONFIGS[activeStationFilter];
                    const currentStatusId = item.stationStatuses[activeStationFilter] || 'priprava';
                    return (
                      <div key={item.itemId} className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-indigo-600/20 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/30">Priorita #{index + 1}</span>
                            <span className="font-mono text-xs font-semibold text-slate-500">ID: {item.itemId}</span>
                          </div>
                          <h3 className="font-extrabold text-base text-slate-100">{item.customer} ({item.qty} ks)</h3>
                          <p className="text-xs text-indigo-400 font-bold">{item.productName} - <span className="text-slate-100 uppercase">{item.qualityTier}</span></p>
                        </div>
                        <div className="flex flex-col sm:flex-row md:flex-col justify-between items-end gap-3 min-w-[220px]">
                          <div className="w-full text-right space-y-1.5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Stav procesu:</span>
                            <div className="grid grid-cols-2 gap-1">
                              {config.statuses.map(st => {
                                const isSelected = currentStatusId === st.id;
                                return (<button key={st.id} onClick={() => updateStationStatus(item.orderId, item.itemId, activeStationFilter, st.id)} className={`px-2 py-1.5 rounded text-[10px] font-bold transition-all text-center truncate ${isSelected ? `${st.color} ring-2 ring-indigo-500` : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{st.label}</button>);
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><Scale className="text-indigo-400 h-5 w-5" /> Automatická kalkulačka prepočtu hmotnosti (kg) a metráže (m)</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Šírka roly (cm)</label><input type="number" value={calcWidth} onChange={(e) => setCalcWidth(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-right text-white" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gramáž (g/m²)</label><input type="number" value={calcWeight} onChange={(e) => setCalcWeight(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-right text-white" /></div>
                <div className="bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/20"><label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Bežné Metre (m)</label><input type="number" value={calcLength} onChange={(e) => handleCalcLengthChange(e.target.value)} className="w-full bg-slate-950 border border-indigo-500 rounded p-2 text-xs font-mono text-right text-white" /></div>
                <div className="bg-purple-950/20 p-2 rounded-lg border border-purple-500/20"><label className="block text-[10px] font-bold text-purple-400 uppercase mb-1">Hmotnosť balíka (kg)</label><input type="number" value={calcKg} onChange={(e) => handleCalcKgChange(e.target.value)} className="w-full bg-slate-950 border border-purple-500 rounded p-2 text-xs font-mono text-right text-white" /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package className="text-indigo-400 h-5 w-5" /> Skladové zásoby</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                      <tr><th className="px-4 py-3">Názov položky</th><th className="px-3 py-3 text-center">Šírka</th><th className="px-3 py-3 text-center">Gramáž</th><th className="px-3 py-3 text-center">Cena / m bez DPH</th><th className="px-3 py-3 text-center">Zostatok</th><th className="px-4 py-3 text-center">Karta</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {materials.map(item => {
                        const isLow = item.qty <= item.minQty;
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3"><span className="font-bold text-white block">{item.name}</span><span className="text-[10px] text-slate-400 font-mono">#{item.id} • {item.color}</span></td>
                            <td className="px-3 py-3 text-center font-bold">{item.width} cm</td>
                            <td className="px-3 py-3 text-center text-slate-400">{item.weight} g/m²</td>
                            <td className="px-3 py-3 text-center text-indigo-300 font-bold">{item.pricePerM?.toFixed(2)} €</td>
                            <td className="px-3 py-3 text-center font-bold"><span className={isLow ? 'text-rose-400' : 'text-emerald-400'}>{item.qty} m</span></td>
                            <td className="px-4 py-3 text-center"><button onClick={() => setSelectedMaterialForDetail(item)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors">Detail / História</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="font-bold text-md text-white flex items-center gap-1.5"><Plus className="text-indigo-400 h-5 w-5" /> Zaradiť novú položku do skladu</h3>
                <form onSubmit={handleAddNewMaterial} className="space-y-3 text-xs">
                  <div><label className="text-slate-400 block mb-0.5">Názov materiálu</label><input type="text" required value={newMatName} onChange={(e) => setNewMatName(e.target.value)} placeholder="Polyester Ripstop" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-slate-400 block mb-0.5">Farba</label><input type="text" value={newMatColor} onChange={(e) => setNewMatColor(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-0.5">Cena bez DPH (€/m)</label><input type="number" step="0.01" value={newMatPrice} onChange={(e) => setNewMatPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-slate-400 block mb-0.5">Šírka (cm)</label><input type="number" value={newMatWidth} onChange={(e) => setNewMatWidth(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-0.5">Gramáž (g/m²)</label><input type="number" value={newMatWeight} onChange={(e) => setNewMatWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-0.5">Dĺžka (m)</label><input type="number" value={newMatQty} onChange={(e) => setNewMatQty(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded">Zaevidovať položku do skladu</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {selectedMaterialForDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-xl shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="font-mono text-xs text-indigo-400 font-bold block mb-1">Karta položky #{selectedMaterialForDetail.id}</span>
                  <h3 className="text-lg font-bold text-white">{selectedMaterialForDetail.name} ({selectedMaterialForDetail.color})</h3>
                  <p className="text-xs text-slate-400">Gramáž: {selectedMaterialForDetail.weight} g/m² • Šírka: {selectedMaterialForDetail.width} cm • Cena: {selectedMaterialForDetail.pricePerM?.toFixed(2)} €/m bez DPH</p>
                </div>
                <button onClick={() => setSelectedMaterialForDetail(null)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 mb-6">
                <span className="font-bold text-xs text-slate-200 block">Manuálna korekcia zásoby</span>
                <form onSubmit={handleApplyStockAdjustment} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><label className="text-[10px] text-slate-500 block mb-0.5">Zmena množstva (m)</label><input type="number" step="0.01" required placeholder="napr. -12.5" value={stockCorrectionQty} onChange={(e) => setStockCorrectionQty(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" /></div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Dôvod korekcie</label>
                    <select value={stockCorrectionType} onChange={(e) => setStockCorrectionType(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-300">
                      <option value="Pridanie na sklad">Pridanie na sklad</option>
                      <option value="Kazová položka">Kazová položka (Odpísanie)</option>
                      <option value="Reklamácia">Reklamácia</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end"><button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded text-xs">Uložiť zmenu</button></div>
                </form>
                <div><label className="text-[10px] text-slate-500 block mb-0.5">Poznámka k zásahu</label><input type="text" placeholder="Dopísať poznámku k úprave" value={stockCorrectionNote} onChange={(e) => setStockCorrectionNote(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" /></div>
              </div>
              <div className="space-y-2">
                <span className="font-bold text-xs text-slate-400 block uppercase">História pohybov a zápisov</span>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {selectedMaterialForDetail.history?.map((h, i) => (
                    <div key={i} className="bg-slate-950 p-2.5 rounded border border-slate-850 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-200 block">{h.action} <span className={h.change < 0 ? 'text-rose-400' : 'text-emerald-400'}>{h.change > 0 ? `+${h.change}` : h.change} m</span></span>
                        <p className="text-[10px] text-slate-500">{h.date} • Zadal: {h.user}</p>
                        {h.note && <p className="text-[10px] text-slate-400 italic mt-0.5">Poznámka: {h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="font-bold text-md text-white flex items-center gap-2"><Users className="text-indigo-400 h-5 w-5" /> Zoznam Zamestnancov & Sviatky</h3>
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {employees.map(emp => (
                    <div key={emp.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-100">{emp.firstName} {emp.lastName}</h4>
                          <span className="bg-slate-800 text-indigo-400 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase border border-slate-700">{emp.role}</span>
                        </div>
                        <p className="text-xs text-slate-400">Pozícia: <strong className="text-slate-300">{emp.position || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Dátum nástupu: <strong className="text-slate-400">{emp.entryDate || '—'}</strong></p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="bg-indigo-950/40 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-900/20 flex items-center gap-1 font-bold"><CalendarDays className="h-3.5 w-3.5" /> Narodeniny: {emp.birthday || '—'}</span>
                          <span className="bg-purple-950/40 text-purple-300 text-[10px] px-2 py-0.5 rounded border border-purple-900/20 flex items-center gap-1 font-bold"><Gift className="h-3.5 w-3.5" /> Meniny: {emp.nameday || '—'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleStartEditEmployee(emp)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 bg-slate-800 hover:bg-rose-900 text-rose-400 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-850 pt-4 space-y-3">
                  <span className="text-xs font-bold text-slate-300 block uppercase">{editingEmployee ? `Upraviť zamestnanca: ${editingEmployee.firstName} ${editingEmployee.lastName}` : 'Zaevidovať zamestnanca:'}</span>
                  <form onSubmit={handleSubmitEmployee} className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Meno</label><input type="text" placeholder="Meno" required value={editingEmployee ? editingEmployee.firstName : newEmpFirstName} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, firstName: e.target.value }) : setNewEmpFirstName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div><label className="text-slate-400 block mb-0.5">Priezvisko</label><input type="text" placeholder="Priezvisko" required value={editingEmployee ? editingEmployee.lastName : newEmpLastName} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, lastName: e.target.value }) : setNewEmpLastName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Pozícia</label><input type="text" placeholder="napr. Operátor laseru" value={editingEmployee ? editingEmployee.position : newEmpPosition} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, position: e.target.value }) : setNewEmpPosition(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Rola / Úroveň prístupu</label>
                        <select value={editingEmployee ? editingEmployee.role : newEmpRole} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, role: e.target.value }) : setNewEmpRole(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white">
                          <option value="master">Master</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="sales">Obchodník</option>
                          <option value="employee">Zamestnanec</option>
                        </select>
                      </div>
                    </div>
                    <div><label className="text-slate-400 block mb-0.5">Dátum nástupu</label><input type="date" value={editingEmployee ? editingEmployee.entryDate : newEmpEntryDate} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, entryDate: e.target.value }) : setNewEmpEntryDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Dátum narodenia (deň a mesiac)</label><input type="text" placeholder="napr. 15. Máj" value={editingEmployee ? editingEmployee.birthday : newEmpBirthday} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, birthday: e.target.value }) : setNewEmpBirthday(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div><label className="text-slate-400 block mb-0.5">Meniny (deň a mesiac)</label><input type="text" placeholder="napr. 24. Jún" value={editingEmployee ? editingEmployee.nameday : newEmpNameday} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, nameday: e.target.value }) : setNewEmpNameday(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded">{editingEmployee ? 'Uložiť zmeny' : 'Pridať Zamestnanca'}</button>
                      {editingEmployee && <button type="button" onClick={handleCancelEditEmployee} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded">Zrušiť</button>}
                    </div>
                  </form>
                </div>
              </div>

              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="font-bold text-md text-white flex items-center gap-2"><Lock className="text-indigo-400 h-5 w-5" /> Globálne Oprávnenia (ACL)</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-850">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr><th className="px-4 py-3">Akcia</th><th className="px-3 py-3 text-center">Master</th><th className="px-3 py-3 text-center">Superv.</th><th className="px-3 py-3 text-center">Obchod.</th><th className="px-3 py-3 text-center">Zames.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {[
                        { key: 'create_order', label: 'Vytvoriť zákazku' },
                        { key: 'delete_order', label: 'Zmazať zákazku' },
                        { key: 'edit_priority', label: 'Meniť priority' },
                        { key: 'scan_qr', label: 'Skenovať čítačkou' },
                        { key: 'update_status', label: 'Meniť stavy staníc' },
                        { key: 'manage_profiles', label: 'Spravovať profily' },
                        { key: 'edit_stock', label: 'Korigovať sklad' },
                        { key: 'manage_catalog', label: 'Spravovať katalóg' }
                      ].map(action => (
                        <tr key={action.key} className="hover:bg-slate-900/40">
                          <td className="px-4 py-3 font-semibold text-slate-200">{action.label}</td>
                          {['master', 'supervisor', 'sales', 'employee'].map(role => (
                            <td key={role} className="px-3 py-3 text-center"><input type="checkbox" checked={acl[action.key][role]} onChange={() => handleToggleAcl(action.key, role)} disabled={currentUser.role !== 'master' || role === 'master'} className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0" /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'qr-terminal' && (
          <div className="max-w-3xl mx-auto space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-pink-500"></div>
              <div className="flex items-center gap-3 mb-6"><QrCode className="h-6 w-6 text-indigo-400" /><h2 className="text-xl font-bold text-white">Dielenská čítačka QR kódov</h2></div>
              {!hasPermission('scan_qr') ? (
                <div className="bg-rose-950/30 border border-rose-900/40 p-6 rounded-xl text-center space-y-3">
                  <Lock className="h-10 w-10 text-rose-500 mx-auto" />
                  <h4 className="font-bold text-rose-300">Prístup zamietnutý</h4>
                  <p className="text-xs text-rose-400">Vaša rola nemá povolenie na skenovanie QR kódov.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-slate-900 p-4 rounded-xl border border-slate-850 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1 uppercase">Vaša Stanica</label>
                      <select value={selectedTerminalStation} onChange={(e) => setSelectedTerminalStation(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100">
                        {Object.keys(STATION_CONFIGS).map(sid => (<option key={sid} value={sid}>{STATION_CONFIGS[sid].name}</option>))}
                      </select>
                    </div>
                    <div className="flex flex-col justify-end"><p className="text-slate-400">Skenuje:</p><strong className="text-white font-bold text-sm">{currentUser.firstName} {currentUser.lastName}</strong></div>
                  </div>
                  <div className="bg-indigo-950/20 border border-indigo-500/30 p-5 rounded-xl space-y-4">
                    <input ref={qrInputRef} type="text" value={manualQrInput} onChange={(e) => setManualQrInput(e.target.value)} placeholder="Sem pípnite kód položky zo sprievodky..." className="w-full bg-slate-900 border-2 border-slate-700 focus:border-indigo-500 text-slate-100 font-mono text-center tracking-wider text-md rounded-xl px-4 py-3 focus:outline-none" />
                    <button onClick={() => handleQrScan(manualQrInput)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-lg mt-3">Potvrdiť Sken manuálne</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedOrderDetails && (
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6 print:bg-white print:text-black print:border-none print:p-0 mt-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 print:hidden">
              <div className="flex items-center gap-2"><FileText className="text-indigo-400 h-5 w-5" /><h3 className="text-lg font-bold">Sprievodka pre: <span className="font-mono text-indigo-400">{selectedOrderDetails.id}</span></h3></div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť (A4)</button>
                <button onClick={() => setSelectedOrderDetails(null)} className="bg-slate-800 hover:bg-slate-750 text-slate-400 px-3 py-2 rounded-lg text-xs">Zatvoriť</button>
              </div>
            </div>
            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-800 print:bg-white print:text-black print:p-0 print:border-none">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-800 pb-6 print:border-b-2 print:border-black">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-1 rounded print:bg-black print:text-white font-mono">SPRIEVODNÝ LIST VÝROBY</span>
                    <span className="font-mono text-sm font-bold text-slate-400 print:text-black">ID: {selectedOrderDetails.id}</span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white print:text-black">{selectedOrderDetails.customer}</h1>
                  <p className="text-sm text-slate-400 print:text-black">Vytvorené: <strong className="text-white print:text-black">{selectedOrderDetails.createdAt}</strong> • Deň vyhotovenia: <strong className="text-indigo-400 print:text-black">{selectedOrderDetails.scheduledDay}</strong></p>
                  {selectedOrderDetails.notes && <p className="text-sm text-slate-400 print:text-black">Poznámka: <strong className="text-white print:text-black">{selectedOrderDetails.notes}</strong></p>}
                </div>
              </div>

              {selectedOrderDetails.items.map((item, itemIdx) => (
                <div key={item.itemId} className="py-6 border-b border-slate-800 print:border-black space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <span className="font-mono text-xs text-indigo-400 font-bold block">Položka #{itemIdx + 1} • {item.itemId}</span>
                      <h2 className="text-lg font-extrabold text-white print:text-black">{item.productName} [{item.customCode}]</h2>
                      <p className="text-sm text-slate-400 print:text-black">Vyhotovenie: <strong className="text-indigo-400 print:text-black uppercase">{item.qualityTier}</strong> • {genderLabel(item.gender)} • <strong className="text-white print:text-black">{item.qty} ks</strong></p>
                      {item.notes && <p className="text-xs text-slate-400 italic print:text-black mt-1">Poznámka: {item.notes}</p>}
                    </div>
                    <div className="bg-white p-3 rounded-xl flex flex-col items-center border border-slate-300 shadow-sm shrink-0">
                      <QrCode className="h-20 w-24 text-black" />
                      <span className="font-mono text-[9px] text-black font-extrabold mt-1">{item.itemId}</span>
                    </div>
                  </div>

                  <div className="print:hidden space-y-2">
                    <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400">Aktívne dielne & Nastavenie stavu:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.keys(STATION_CONFIGS).map(stationId => {
                        const cfg = STATION_CONFIGS[stationId];
                        const activeStatus = item.stationStatuses?.[stationId] || 'neaktivne';
                        const activeCfg = cfg.statuses.find(s => s.id === activeStatus) || cfg.statuses[0];
                        return (
                          <div key={stationId} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex items-center justify-between">
                            <div className="flex items-center gap-2"><cfg.icon className="h-4 w-4 text-indigo-400" /><span className="text-xs font-bold text-slate-300">{cfg.name}</span></div>
                            <select value={activeStatus} onChange={(e) => updateStationStatus(selectedOrderDetails.id, item.itemId, stationId, e.target.value)} className={`text-[10px] font-bold rounded p-1 text-slate-100 ${activeCfg.color} focus:outline-none`} disabled={!hasPermission('update_status')}>
                              {cfg.statuses.map(st => (<option key={st.id} value={st.id} className="bg-slate-900 text-slate-300">{st.label}</option>))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      {item.materialsNeeded?.map((n, idx) => {
                        const mat = materials.find(m => m.id === n.materialId);
                        return (<div key={idx} className="bg-slate-950 p-2.5 rounded flex justify-between text-xs print:bg-white print:border print:border-black"><span><strong>{n.layerName}:</strong> {mat?.name} ({mat?.color})</span><span className="font-extrabold">{n.qtyNeeded} m</span></div>);
                      })}
                    </div>
                    <div className="bg-slate-950 p-3 rounded text-xs space-y-1 print:bg-white print:border print:border-black">
                      <div className="flex justify-between"><span>Šijacie nite:</span><strong className="text-white print:text-black">{item.threadQtyM} m</strong></div>
                      <div className="flex justify-between"><span>Materiál odpísaný zo skladu:</span><strong className="text-emerald-400 print:text-black">{item.materialDeducted ? 'Áno, odpočítané' : 'Nie, čaká na prvý dielenský sken'}</strong></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-center text-xs text-slate-500 print:hidden">
        <p>© 2026 TEX-MASTER ERP Platform v6.0. Všetky práva vyhradené.</p>
      </footer>
    </div>
  );
}