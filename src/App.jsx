import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ClipboardList, Package, Cpu, QrCode, Plus, User, Clock, Layers, Search, Check, X, Calendar,
  Palette, Scissors, Printer, Sliders, Sparkles, ZoomIn, ZoomOut, FileText, PlusCircle, Table,
  Shield, Users, Lock, Edit2, Trash2, Tag, Scale, CalendarDays, FileEdit, Gift, Loader2, AlertTriangle,
  Shirt, Box, Banknote, GripVertical, Download, Upload, ArrowUp, ArrowDown
} from 'lucide-react';

// ============================================================
// PRIPOJENIE NA SUPABASE
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// --- KONFIGURÁCIA VÝROBNÝCH STANÍC/DIELNÍ ---
const STATION_CONFIGS = {
  grafik: { name: 'Grafika', icon: Printer, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'export', label: 'Export dát a tlač', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  strihanie: { name: 'Strihanie & Kompletáž', icon: Scissors, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'strihanie', label: 'Strihá & kompletuje sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  transfer: { name: 'Transfer tlač', icon: Layers, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sietotlac: { name: 'Sieťotlač', icon: Palette, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  laser: { name: 'Laser', icon: Cpu, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'rezanie', label: 'Rezanie', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sublimacia: { name: 'Sublimácia', icon: Sparkles, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sitie: { name: 'Šitie', icon: Shirt, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'sije', label: 'Šije sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  balenie: { name: 'Balenie', icon: Box, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'priprava', label: 'Príprava', color: 'bg-amber-600 text-white' },
    { id: 'prebieha', label: 'Balí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]}
};
const UNIT_OPTIONS = [
  { value: 'm', label: 'm (meter — látky)' },
  { value: 'bm', label: 'bm (bežný meter — papier, fólia)' },
  { value: 'ks', label: 'ks (kusy — gombíky, gumičky)' },
  { value: 'ml', label: 'ml (mililitre — farby)' },
  { value: 'g', label: 'g (gramy — lepidlo, prášok)' },
  { value: 'kg', label: 'kg (kilogramy)' }
];
const STATION_ORDER = Object.keys(STATION_CONFIGS);

// Bežná paleta farieb textilu pre rýchly výber pri zaraďovaní do skladu
const COLOR_PALETTE = [
  { name: 'Biela', hex: '#FFFFFF' },
  { name: 'Čierna', hex: '#111111' },
  { name: 'Sivá', hex: '#9CA3AF' },
  { name: 'Červená', hex: '#DC2626' },
  { name: 'Bordová', hex: '#7F1D1D' },
  { name: 'Oranžová', hex: '#EA580C' },
  { name: 'Žltá', hex: '#EAB308' },
  { name: 'Neónová žltá', hex: '#D9F99D' },
  { name: 'Zelená', hex: '#16A34A' },
  { name: 'Neónová zelená', hex: '#84CC16' },
  { name: 'Tyrkysová', hex: '#06B6D4' },
  { name: 'Modrá', hex: '#2563EB' },
  { name: 'Tmavo modrá', hex: '#1E3A8A' },
  { name: 'Fialová', hex: '#7C3AED' },
  { name: 'Ružová', hex: '#EC4899' },
  { name: 'Hnedá', hex: '#78350F' },
  { name: 'Béžová', hex: '#D6C7A1' }
];

const ORDER_COLOR_PALETTE = [
  { border: 'border-orange-500', tag: 'bg-orange-500/20 text-orange-300' },
  { border: 'border-sky-500', tag: 'bg-sky-500/20 text-sky-300' },
  { border: 'border-emerald-500', tag: 'bg-emerald-500/20 text-emerald-300' },
  { border: 'border-fuchsia-500', tag: 'bg-fuchsia-500/20 text-fuchsia-300' },
  { border: 'border-amber-500', tag: 'bg-amber-500/20 text-amber-300' },
  { border: 'border-cyan-500', tag: 'bg-cyan-500/20 text-cyan-300' },
  { border: 'border-rose-500', tag: 'bg-rose-500/20 text-rose-300' },
  { border: 'border-lime-500', tag: 'bg-lime-500/20 text-lime-300' }
];
function colorForOrder(orderId) {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  return ORDER_COLOR_PALETTE[hash % ORDER_COLOR_PALETTE.length];
}

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

const mapMaterialFromDb = (r) => ({ id: r.id, name: r.name, color: r.color, colorHex: r.color_hex || '', width: r.width, weight: r.weight, pricePerM: r.price_per_m, qty: r.qty, unit: r.unit, minQty: r.min_qty, warehouseId: r.warehouse_id || 'sklad-1', history: r.history || [] });
const mapMaterialToDb = (m) => ({ id: m.id, name: m.name, color: m.color, color_hex: m.colorHex || null, width: m.width, weight: m.weight, price_per_m: m.pricePerM, qty: m.qty, unit: m.unit, min_qty: m.minQty, warehouse_id: m.warehouseId, history: m.history });

const mapProductFromDb = (r) => ({ id: r.id, customCode: r.custom_code, name: r.name, sports: r.sports || [], layer1: r.layer1, layer2: r.layer2, layer3: r.layer3, threadM: r.thread_m });
const mapProductToDb = (p) => ({ id: p.id, custom_code: p.customCode, name: p.name, sports: p.sports, layer1: p.layer1, layer2: p.layer2, layer3: p.layer3, thread_m: p.threadM });

const mapTierFromDb = (r) => ({ id: r.id, name: r.name, fit: r.fit, ventilation: r.ventilation, desc: r.description });
const mapTierToDb = (t) => ({ id: t.id, name: t.name, fit: t.fit, ventilation: t.ventilation, description: t.desc });

const mapEmployeeFromDb = (r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, birthday: r.birthday, nameday: r.nameday, entryDate: r.entry_date, role: r.role, position: r.position, passwordHash: r.password_hash || '', phone: r.phone || '', email: r.email || '' });
const mapEmployeeToDb = (e) => ({ id: e.id, first_name: e.firstName, last_name: e.lastName, birthday: e.birthday, nameday: e.nameday, entry_date: e.entryDate, role: e.role, position: e.position, password_hash: e.passwordHash || null, phone: e.phone || null, email: e.email || null });

const mapOrderFromDb = (r) => ({ id: r.id, customer: r.customer, createdAt: r.created_at, deliveryDate: r.scheduled_day, driveLink: r.drive_link, notes: r.notes, paymentType: r.payment_type || 'faktura', items: r.items || [] });
const mapOrderToDb = (o) => ({ id: o.id, customer: o.customer, created_at: o.createdAt, scheduled_day: o.deliveryDate, drive_link: o.driveLink, notes: o.notes, payment_type: o.paymentType, items: o.items });

function applyRealtimeChange(setter, payload, mapFn) {
  setter(prev => {
    if (payload.eventType === 'DELETE') return prev.filter(x => x.id !== payload.old.id);
    const mapped = mapFn(payload.new);
    const exists = prev.some(x => x.id === mapped.id);
    return exists ? prev.map(x => (x.id === mapped.id ? mapped : x)) : [...prev, mapped];
  });
}

// Jednoduché hashovanie hesla (SHA-256) — heslo sa nikde neukladá v čitateľnej podobe.
// Pozor: toto NIE JE plnohodnotné bezpečnostné riešenie ako napr. Supabase Auth (chýba napr. "salt"),
// je to primerané pre interný nástroj na dielenských tabletoch, nie pre appku vystavenú verejne na internete.
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function flattenOrderItems(ordersList) {
  const flat = [];
  ordersList.forEach(order => {
    (order.items || []).forEach(item => {
      flat.push({ ...item, orderId: order.id, customer: order.customer, deliveryDate: order.deliveryDate, createdAt: order.createdAt, driveLink: order.driveLink, orderNotes: order.notes, paymentType: order.paymentType });
    });
  });
  return flat;
}

function currentStageLabel(item) {
  const entries = Object.entries(item.stationStatuses || {});
  if (entries.length === 0) return { label: '—', done: false };
  const allDone = entries.every(([, v]) => v === 'hotove');
  if (allDone) return { label: 'Hotové', done: true };
  const activeEntry = entries.find(([, v]) => v !== 'hotove' && v !== 'neaktivne');
  if (activeEntry) {
    const [sid, statusId] = activeEntry;
    const stationCfg = STATION_CONFIGS[sid];
    const statusCfg = stationCfg?.statuses.find(s => s.id === statusId);
    return { label: `${stationCfg?.name || sid}: ${statusCfg?.label || statusId}`, done: false };
  }
  return { label: 'Hotové', done: true };
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState('');
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [editingWarehouseName, setEditingWarehouseName] = useState('');
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [products, setProducts] = useState([]);
  const [qualityTiers, setQualityTiers] = useState([]);
  const [sports, setSports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [acl, setAcl] = useState(FALLBACK_ACL);

  const [activeTab, setActiveTab] = useState('planner'); 
  const [activeStationFilter, setActiveStationFilter] = useState('grafik'); 
  const [addMissingItemId, setAddMissingItemId] = useState('');
  const [zoomLevel, setZoomLevel] = useState(85);
  const [plannerViewMode, setPlannerViewMode] = useState('matrix');

  const [currentUser, setCurrentUser] = useState(null); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginSelectedId, setLoginSelectedId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showMasterSwitcher, setShowMasterSwitcher] = useState(false);
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');

  const [rowSearch, setRowSearch] = useState('');
  const [rowDateFilter, setRowDateFilter] = useState('vsetko');
  const [draggedRowItem, setDraggedRowItem] = useState(null);

  const [catalogSportFilter, setCatalogSportFilter] = useState('vsetko');

  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [newOrderPaymentType, setNewOrderPaymentType] = useState('faktura');
  const [orderDriveLink, setOrderDriveLink] = useState('https://drive.google.com/');
  const [orderNotes, setOrderNotes] = useState('');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQualityTier, setSelectedProductTier] = useState(null);
  const [selectedGender, setSelectedGender] = useState('men');
  const [itemQty, setItemQty] = useState(10);
  const [selectedLayer1Mat, setSelectedLayer1Mat] = useState('');
  const [selectedLayer2Mat, setSelectedLayer2Mat] = useState('');
  const [selectedLayer3Mat, setSelectedLayer3Mat] = useState('');
  const [selectedStations, setSelectedStations] = useState({});
  const [itemNotes, setItemNotes] = useState('');
  const [itemImageFile, setItemImageFile] = useState(null);
  const [itemImagePreview, setItemImagePreview] = useState('');
  const [isUploadingItemImage, setIsUploadingItemImage] = useState(false);

  const [pendingItems, setPendingItems] = useState([]);

  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState(null);
  const [stockCorrectionQty, setStockCorrectionQty] = useState('');
  const [stockCorrectionType, setStockCorrectionType] = useState('Pridanie na sklad');
  const [stockCorrectionNote, setStockCorrectionNote] = useState('');
  const [editingHistoryIndex, setEditingHistoryIndex] = useState(null);
  const [editingHistoryChange, setEditingHistoryChange] = useState('');
  const [editingHistoryReason, setEditingHistoryReason] = useState('');

  const [calcWidth, setCalcWidth] = useState(160);
  const [calcWeight, setCalcWeight] = useState(140);
  const [calcLength, setCalcLength] = useState(100);
  const [calcKg, setCalcKg] = useState(22.4);

  const [newMatName, setNewMatName] = useState('');
  const [newMatColor, setNewMatColor] = useState('Biela');
  const [newMatColorHex, setNewMatColorHex] = useState('#FFFFFF');
  const [newMatUnit, setNewMatUnit] = useState('m');
  const [newMatWarehouseId, setNewMatWarehouseId] = useState('');
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
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [orderEditDraft, setOrderEditDraft] = useState(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [addItemProductId, setAddItemProductId] = useState('');
  const [addItemTierId, setAddItemTierId] = useState('');
  const [addItemGender, setAddItemGender] = useState('men');
  const [addItemQty, setAddItemQty] = useState(10);
  const [addItemStations, setAddItemStations] = useState({});
  const [addItemNotes, setAddItemNotes] = useState('');
  const [addItemLayer1Mat, setAddItemLayer1Mat] = useState('');
  const [addItemLayer2Mat, setAddItemLayer2Mat] = useState('');
  const [addItemLayer3Mat, setAddItemLayer3Mat] = useState('');
  const [addItemImageFile, setAddItemImageFile] = useState(null);
  const [addItemImagePreview, setAddItemImagePreview] = useState('');

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [newEmpFirstName, setNewEmpFirstName] = useState('');
  const [newEmpLastName, setNewEmpLastName] = useState('');
  const [newEmpBirthday, setNewEmpBirthday] = useState('');
  const [newEmpNameday, setNewEmpNameday] = useState('');
  const [newEmpEntryDate, setNewEmpEntryDate] = useState('2026-07-24');
  const [newEmpRole, setNewEmpRole] = useState('employee');
  const [newEmpPosition, setNewEmpPosition] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');

  const qrInputRef = useRef(null);
  const importFileInputRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setLoadError('Appka nie je pripojená na Supabase. Skontroluj .env súbor (VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY) - pozri SETUP.md.');
      setIsLoading(false);
      return;
    }
    async function loadAll() {
      try {
        const [matRes, prodRes, tierRes, sportRes, empRes, aclRes, orderRes, whRes] = await Promise.all([
          supabase.from('materials').select('*').order('name'),
          supabase.from('products').select('*'),
          supabase.from('quality_tiers').select('*'),
          supabase.from('sports').select('*').order('name'),
          supabase.from('employees').select('*'),
          supabase.from('acl_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('warehouses').select('*').order('name')
        ]);
        const firstErr = [matRes, prodRes, tierRes, sportRes, empRes, orderRes, whRes].find(r => r.error);
        if (firstErr) throw firstErr.error;

        const loadedMaterials = (matRes.data || []).map(mapMaterialFromDb);
        const loadedProducts = (prodRes.data || []).map(mapProductFromDb);
        const loadedTiers = (tierRes.data || []).map(mapTierFromDb);
        const loadedEmployees = (empRes.data || []).map(mapEmployeeFromDb);
        const loadedWarehouses = whRes.data || [];

        setMaterials(loadedMaterials);
        setProducts(loadedProducts);
        setQualityTiers(loadedTiers);
        setSports((sportRes.data || []).map(r => r.name));
        setEmployees(loadedEmployees);
        setAcl(aclRes.data ? aclRes.data.rules : FALLBACK_ACL);
        setOrders((orderRes.data || []).map(mapOrderFromDb));
        setWarehouses(loadedWarehouses);

        if (loadedWarehouses.length > 0) {
          setActiveWarehouseId(loadedWarehouses[0].id);
          setNewMatWarehouseId(loadedWarehouses[0].id);
        }
        // Poznámka: currentUser sa už nenastavuje automaticky — čaká sa na prihlásenie cez prihlasovaciu obrazovku.
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

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('tex-master-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, (payload) => applyRealtimeChange(setMaterials, payload, mapMaterialFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, (payload) => applyRealtimeChange(setWarehouses, payload, (r) => ({ id: r.id, name: r.name })))
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

  // --- PRIHLÁSENIE / ODHLÁSENIE ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const emp = employees.find(x => x.id === loginSelectedId);
    if (!emp) { setLoginError('Vyberte svoje meno zo zoznamu.'); return; }
    if (!emp.passwordHash) { setLoginError('Tento profil ešte nemá nastavené heslo. Požiadajte Mastra, nech vám ho nastaví.'); return; }
    if (!loginPassword) { setLoginError('Zadajte heslo.'); return; }
    setIsLoggingIn(true);
    const enteredHash = await hashPassword(loginPassword);
    setIsLoggingIn(false);
    if (enteredHash !== emp.passwordHash) { setLoginError('Nesprávne heslo.'); return; }
    setCurrentUser(emp);
    setIsAuthenticated(true);
    setLoginPassword('');
    setLoginError('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginSelectedId('');
    setLoginPassword('');
    setShowMasterSwitcher(false);
  };

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

  const formatDeliveryDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  const isUrgentDate = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target.getTime())) return false;
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    return diffDays === 0 || diffDays === 1;
  };

  const calculateKg = (length, width, grammage) => parseFloat(((parseFloat(length || 0) * (parseFloat(width || 0) / 100) * parseFloat(grammage || 0)) / 1000).toFixed(3));
  const calculateMeters = (kg, width, grammage) => {
    const factor = (parseFloat(width || 0) / 100) * parseFloat(grammage || 0);
    if (factor === 0) return 0;
    return parseFloat(((parseFloat(kg || 0) * 1000) / factor).toFixed(2));
  };
  const handleCalcLengthChange = (val) => { setCalcLength(val); setCalcKg(calculateKg(val, calcWidth, calcWeight)); };
  const handleCalcKgChange = (val) => { setCalcKg(val); setCalcLength(calculateMeters(val, calcWidth, calcWeight)); };

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

  // --- OPRAVA UŽ EXISTUJÚCEHO ZÁZNAMU V HISTÓRII (vyžaduje povinný dôvod) ---
  const handleStartEditHistory = (index) => {
    setEditingHistoryIndex(index);
    setEditingHistoryChange(String(selectedMaterialForDetail.history[index].change));
    setEditingHistoryReason('');
  };

  const handleCancelEditHistory = () => {
    setEditingHistoryIndex(null);
    setEditingHistoryChange('');
    setEditingHistoryReason('');
  };

  const handleSaveEditHistory = async () => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup na opravu histórie skladu.'); return; }
    const newChange = parseFloat(editingHistoryChange);
    if (isNaN(newChange)) { alert('Zadajte platnú hodnotu.'); return; }
    if (!editingHistoryReason.trim()) { alert('Musíte napísať dôvod opravy — bez dôvodu sa záznam nedá zmeniť.'); return; }

    const now = getFormattedDateTime();
    const oldEntry = selectedMaterialForDetail.history[editingHistoryIndex];
    const diff = parseFloat((newChange - oldEntry.change).toFixed(3));
    const newQty = Math.max(0, parseFloat((selectedMaterialForDetail.qty + diff).toFixed(2)));

    const newHistory = selectedMaterialForDetail.history.map((h, i) => i === editingHistoryIndex
      ? {
          ...h,
          change: newChange,
          corrected: true,
          correctedBy: `${currentUser.firstName} ${currentUser.lastName}`,
          correctedAt: now,
          correctionReason: editingHistoryReason.trim(),
          originalChange: h.originalChange !== undefined ? h.originalChange : h.change
        }
      : h);

    const { error } = await supabase.from('materials').update({ qty: newQty, history: newHistory }).eq('id', selectedMaterialForDetail.id);
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    setSelectedMaterialForDetail({ ...selectedMaterialForDetail, qty: newQty, history: newHistory });
    handleCancelEditHistory();
    triggerNotification('success', 'Záznam v histórii bol opravený.');
  };

  const handleAddNewMaterial = async (e) => {
    e.preventDefault();
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    if (!newMatWarehouseId) { alert('Vyberte sklad, do ktorého sa má položka zaradiť.'); return; }
    const now = getFormattedDateTime();
    const created = {
      id: `tex-${Date.now()}`, name: newMatName, color: newMatColor, colorHex: newMatColorHex, width: parseInt(newMatWidth) || null, weight: parseInt(newMatWeight) || null,
      pricePerM: parseFloat(newMatPrice), qty: parseFloat(newMatQty), unit: newMatUnit, minQty: 50, warehouseId: newMatWarehouseId,
      history: [{ date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Pridanie na sklad', change: parseFloat(newMatQty), note: 'Prvotný príjem novej položky' }]
    };
    const { error } = await supabase.from('materials').insert(mapMaterialToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    setNewMatName('');
    triggerNotification('success', `Položka "${created.name}" bola naskladnená.`);
  };

  // --- SPRÁVA SKLADOV (Sklad 1, Sklad 2, Sklad 3, Sklad PBT...) ---
  const handleAddWarehouse = async () => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    const name = newWarehouseName.trim();
    if (!name) return;
    const id = `sklad-${Date.now()}`;
    const { error } = await supabase.from('warehouses').insert({ id, name });
    if (error) { triggerNotification('error', error.message); return; }
    setNewWarehouseName('');
    setActiveWarehouseId(id);
    triggerNotification('success', `Sklad "${name}" bol vytvorený.`);
  };

  const handleStartEditWarehouse = (wh) => { setEditingWarehouseId(wh.id); setEditingWarehouseName(wh.name); };

  const handleSaveEditWarehouse = async () => {
    const name = editingWarehouseName.trim();
    if (!name) { setEditingWarehouseId(null); return; }
    const { error } = await supabase.from('warehouses').update({ name }).eq('id', editingWarehouseId);
    if (error) { triggerNotification('error', error.message); return; }
    setEditingWarehouseId(null);
    setEditingWarehouseName('');
  };

  const handleDeleteWarehouse = async (wh) => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    const itemsInside = materials.filter(m => m.warehouseId === wh.id).length;
    if (itemsInside > 0) {
      alert(`Sklad "${wh.name}" obsahuje ${itemsInside} položiek. Najprv ich presuň do iného skladu alebo vymaž, potom môžeš sklad zmazať.`);
      return;
    }
    if (!window.confirm(`Naozaj vymazať sklad "${wh.name}"?`)) return;
    const { error } = await supabase.from('warehouses').delete().eq('id', wh.id);
    if (error) { triggerNotification('error', error.message); return; }
    if (activeWarehouseId === wh.id && warehouses.length > 1) {
      setActiveWarehouseId(warehouses.find(w => w.id !== wh.id)?.id || '');
    }
  };

  const handleMoveMaterialToWarehouse = async (materialId, newWarehouseId) => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    const { error } = await supabase.from('materials').update({ warehouse_id: newWarehouseId }).eq('id', materialId);
    if (error) { triggerNotification('error', error.message); return; }
    triggerNotification('success', 'Položka bola presunutá do iného skladu.');
  };

  // --- EXPORT / IMPORT SKLADU DO EXCELU ---
  const buildMaterialRow = (m, includeWarehouse) => ({
    Nazov: m.name,
    Farba: m.color,
    Farba_hex: m.colorHex || '',
    Sirka_cm: m.width || '',
    Gramaz_gm2: m.weight || '',
    Jednotka: m.unit,
    Cena_bez_DPH: m.pricePerM,
    Mnozstvo: m.qty,
    Min_mnozstvo: m.minQty,
    ...(includeWarehouse ? { Sklad: warehouses.find(w => w.id === m.warehouseId)?.name || '' } : {})
  });

  const buildHistoryRows = (items) => {
    const rows = [];
    items.forEach(m => {
      (m.history || []).forEach(h => {
        rows.push({
          ID_materialu: m.id, Nazov: m.name, Datum: h.date, Zadal: h.user, Akcia: h.action,
          Zmena: h.change, Poznamka: h.note || '', Opravene: h.corrected ? 'Ano' : '', Dovod_opravy: h.correctionReason || ''
        });
      });
    });
    return rows;
  };

  const exportMaterialsToExcel = (items, fileNameBase, includeWarehouse) => {
    const wb = XLSX.utils.book_new();
    const wsMain = XLSX.utils.json_to_sheet(items.map(m => buildMaterialRow(m, includeWarehouse)));
    XLSX.utils.book_append_sheet(wb, wsMain, 'Sklad');
    const wsHistory = XLSX.utils.json_to_sheet(buildHistoryRows(items));
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Historia');
    XLSX.writeFile(wb, `${fileNameBase}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportActiveWarehouse = () => {
    const items = materials.filter(m => m.warehouseId === activeWarehouseId);
    const whName = warehouses.find(w => w.id === activeWarehouseId)?.name || 'Sklad';
    exportMaterialsToExcel(items, whName.replace(/\s+/g, '_'), false);
  };

  const handleExportAllWarehouses = () => {
    exportMaterialsToExcel(materials, 'Vsetky_sklady', true);
  };

  const handleDownloadImportTemplate = () => {
    const sample = [{
      Nazov: 'Polyester Interlock', Farba: 'Biela', Farba_hex: '#FFFFFF', Sirka_cm: 160, Gramaz_gm2: 140,
      Jednotka: 'm', Cena_bez_DPH: 4.5, Mnozstvo: 100, Min_mnozstvo: 20, Sklad: warehouses[0]?.name || 'Sklad 1'
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), 'Sablona');
    XLSX.writeFile(wb, 'sklad_sablona.xlsx');
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup na import do skladu.'); e.target.value = ''; return; }
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheetName = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      if (rows.length === 0) { triggerNotification('error', 'Súbor neobsahuje žiadne riadky.'); e.target.value = ''; return; }

      const now = getFormattedDateTime();
      const toInsert = [];
      let skipped = 0;
      rows.forEach((row, idx) => {
        const name = row.Nazov || row['Názov'];
        if (!name) { skipped++; return; }
        const warehouseName = row.Sklad;
        const matchedWarehouse = warehouseName ? warehouses.find(w => w.name.toLowerCase() === String(warehouseName).toLowerCase()) : null;
        const targetWarehouseId = matchedWarehouse?.id || activeWarehouseId;
        const qty = parseFloat(row.Mnozstvo || row['Množstvo'] || 0) || 0;
        toInsert.push(mapMaterialToDb({
          id: `tex-${Date.now()}-${idx}`,
          name: String(name),
          color: row.Farba || row['Farba'] || '',
          colorHex: row.Farba_hex || '',
          width: row.Sirka_cm ? parseInt(row.Sirka_cm) : null,
          weight: row.Gramaz_gm2 ? parseInt(row.Gramaz_gm2) : null,
          unit: row.Jednotka || 'm',
          pricePerM: parseFloat(row.Cena_bez_DPH || 0) || 0,
          qty,
          minQty: parseFloat(row.Min_mnozstvo || 0) || 0,
          warehouseId: targetWarehouseId,
          history: [{ date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Import z Excelu', change: qty, note: `Hromadný import zo súboru "${file.name}"` }]
        }));
      });

      if (toInsert.length === 0) { triggerNotification('error', 'V súbore sa nenašiel žiadny platný riadok (chýba stĺpec "Nazov").'); e.target.value = ''; return; }

      const { error } = await supabase.from('materials').insert(toInsert);
      if (error) { triggerNotification('error', `Chyba pri importe: ${error.message}`); e.target.value = ''; return; }

      triggerNotification('success', `Import dokončený: naskladnených ${toInsert.length} položiek${skipped > 0 ? `, preskočených ${skipped} neplatných riadkov` : ''}.`);
    } catch (err) {
      triggerNotification('error', `Chyba pri čítaní súboru: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const calculateLayerConsumption = (product, gender, layerKey, qty) => {
    if (!product || !product[layerKey]) return 0;
    const rates = product[layerKey].consumption[gender];
    const rate = qty >= 5 ? rates.ge5 : rates.lt5;
    return parseFloat((rate * qty).toFixed(2));
  };

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
        layer1: newModelPrimary ? { materialId: newModelPrimary, alternativeIds: [], consumption: { men: { lt5: 1.30, ge5: 1.10 }, women: { lt5: 1.15, ge5: 0.95 }, children: { lt5: 0.85, ge5: 0.70 } } } : null,
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

  const handleAddPendingItem = async () => {
    if (!selectedProduct) return;
    const qtyNum = parseInt(itemQty);
    if (!qtyNum || qtyNum < 1) { alert('Zadajte platné množstvo (aspoň 1 ks).'); return; }
    const activeStations = Object.keys(selectedStations).filter(k => selectedStations[k]);
    if (activeStations.length === 0) {
      alert('Zaškrtnite aspoň jednu výrobnú stanicu, cez ktorú má táto položka ísť.');
      return;
    }
    const neededList = [];
    if (selectedProduct.layer1) neededList.push({ layerName: 'Primárna látka', materialId: selectedLayer1Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer1', qtyNum) });
    if (selectedProduct.layer2 && selectedLayer2Mat) neededList.push({ layerName: 'Sekundárna látka', materialId: selectedLayer2Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer2', qtyNum) });
    if (selectedProduct.layer3 && selectedLayer3Mat) neededList.push({ layerName: 'Terciárna látka', materialId: selectedLayer3Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer3', qtyNum) });

    let imageUrl = '';
    if (itemImageFile) {
      setIsUploadingItemImage(true);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${itemImageFile.name}`;
      const { error: upErr } = await supabase.storage.from('item-images').upload(path, itemImageFile);
      setIsUploadingItemImage(false);
      if (upErr) { triggerNotification('error', `Chyba pri nahrávaní obrázka: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }

    const newItem = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: selectedProduct.id, productName: selectedProduct.name, customCode: selectedProduct.customCode,
      qualityTier: selectedQualityTier.name, gender: selectedGender, qty: qtyNum, activeStations,
      notes: itemNotes, materialsNeeded: neededList, threadQtyM: selectedProduct.threadM * qtyNum, imageUrl
    };
    setPendingItems([...pendingItems, newItem]);
    setItemQty(10);
    setItemNotes('');
    setItemImageFile(null);
    setItemImagePreview('');
    triggerNotification('success', `Položka "${selectedProduct.name}" pridaná do zoznamu zákazky.`);
  };

  const handleRemovePendingItem = (tempId) => setPendingItems(pendingItems.filter(i => i.tempId !== tempId));

  const handleGenerateOrder = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Chyba: Vaša úroveň nemá právo na zadávanie zákaziek.'); return; }
    if (!newOrderCustomer.trim()) { alert('Vyplňte odberateľa.'); return; }
    if (!newOrderDeliveryDate) { alert('Vyplňte termín dodania.'); return; }
    if (pendingItems.length === 0) { alert('Pridajte aspoň jednu položku (produkt) do zákazky.'); return; }

    const orderId = `ZAK-${Date.now()}`;
    const allExistingItems = flattenOrderItems(orders);
    const sameDayCount = allExistingItems.length;
    const now = getFormattedDateTime();

    // Okamžitý odpočet materiálu zo skladu pri vytvorení zákazky (pre všetky vrstvy: primárnu, sekundárnu, terciárnu)
    const materialUpdates = [];
    pendingItems.forEach(item => {
      (item.materialsNeeded || []).forEach(needed => {
        const mat = materials.find(m => m.id === needed.materialId);
        if (!mat) return;
        const existingUpdate = materialUpdates.find(u => u.id === mat.id);
        const baseQty = existingUpdate ? existingUpdate.qty : mat.qty;
        const baseHistory = existingUpdate ? existingUpdate.history : (mat.history || []);
        const newQty = Math.max(0, parseFloat((baseQty - needed.qtyNeeded).toFixed(2)));
        const newHist = [...baseHistory, {
          date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Odpísanie pre výrobu',
          change: -needed.qtyNeeded, note: `Zákazka ${orderId} • ${item.productName} (${needed.layerName})`
        }];
        if (existingUpdate) { existingUpdate.qty = newQty; existingUpdate.history = newHist; }
        else materialUpdates.push({ id: mat.id, qty: newQty, history: newHist });
      });
    });

    const itemsWithMeta = pendingItems.map((item, idx) => {
      const itemId = `${orderId}-${idx + 1}`;
      const initialStatuses = {};
      item.activeStations.forEach(sid => { initialStatuses[sid] = 'caka'; });
      return {
        itemId, productId: item.productId, productName: item.productName, customCode: item.customCode,
        qualityTier: item.qualityTier, gender: item.gender, qty: item.qty, notes: item.notes, imageUrl: item.imageUrl || '',
        materialsNeeded: item.materialsNeeded, threadQtyM: item.threadQtyM, priority: sameDayCount + idx + 1,
        stationStatuses: initialStatuses, materialDeducted: (item.materialsNeeded || []).length > 0
      };
    });

    const created = { id: orderId, customer: newOrderCustomer, createdAt: now, deliveryDate: newOrderDeliveryDate, driveLink: orderDriveLink, notes: orderNotes, paymentType: newOrderPaymentType, items: itemsWithMeta };
    const { error } = await supabase.from('orders').insert(mapOrderToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }

    for (const mu of materialUpdates) {
      await supabase.from('materials').update({ qty: mu.qty, history: mu.history }).eq('id', mu.id);
    }

    setSelectedOrderDetails(created);
    setActiveTab('planner');
    setNewOrderCustomer('');
    setOrderNotes('');
    setOrderDriveLink('https://drive.google.com/');
    setNewOrderPaymentType('faktura');
    setPendingItems([]);
    triggerNotification('success', `Zákazka ${orderId} bola zaradená do výroby (${itemsWithMeta.length} položiek) a materiál bol odpočítaný zo skladu.`);
  };

  const handleMovePriority = async (item, direction) => {
    if (!hasPermission('edit_priority')) { triggerNotification('error', 'Nemáte oprávnenie meniť priority.'); return; }
    const group = allItems.slice().sort((a, b) => a.priority - b.priority);
    const currentIndex = group.findIndex(i => i.itemId === item.itemId);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.length) return;

    const reordered = [...group];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    const withNewPriority = reordered.map((it, idx) => ({ itemId: it.itemId, orderId: it.orderId, priority: idx + 1 }));

    const byOrder = {};
    withNewPriority.forEach(r => { (byOrder[r.orderId] = byOrder[r.orderId] || []).push(r); });

    for (const orderId of Object.keys(byOrder)) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;
      const updates = byOrder[orderId];
      const newItems = order.items.map(it => {
        const upd = updates.find(u => u.itemId === it.itemId);
        return upd ? { ...it, priority: upd.priority } : it;
      });
      await supabase.from('orders').update({ items: newItems }).eq('id', orderId);
    }
    triggerNotification('success', 'Poradie priorít bolo upravené.');
  };

  const openOrderDetails = (order) => {
    setIsEditingOrder(false);
    setOrderEditDraft(null);
    setSelectedOrderDetails(order);
  };

  const findItemByItemId = (itemId) => {
    for (const order of orders) {
      const item = (order.items || []).find(i => i.itemId.toUpperCase() === itemId.toUpperCase());
      if (item) return { order, item };
    }
    return null;
  };

  // --- ÚPRAVA A MAZANIE EXISTUJÚCEJ ZÁKAZKY (oprava chýb, zrušenie) ---
  const handleStartEditOrder = () => {
    setOrderEditDraft(JSON.parse(JSON.stringify(selectedOrderDetails)));
    setIsEditingOrder(true);
  };

  const handleCancelEditOrder = () => {
    setIsEditingOrder(false);
    setOrderEditDraft(null);
  };

  const handleDraftItemQtyChange = (itemId, newQtyRaw) => {
    setOrderEditDraft(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.itemId !== itemId) return it;
        const newQty = parseInt(newQtyRaw);
        if (!newQty || newQty < 1) return { ...it, qty: newQtyRaw };
        const product = products.find(p => p.id === it.productId);
        if (!product) return { ...it, qty: newQty };
        const layerMap = [
          { key: 'layer1', label: 'Primárna látka' },
          { key: 'layer2', label: 'Sekundárna látka' },
          { key: 'layer3', label: 'Terciárna látka' }
        ];
        const updatedMaterials = (it.materialsNeeded || []).map(m => {
          const layerInfo = layerMap.find(l => l.label === m.layerName);
          if (!layerInfo || !product[layerInfo.key]) return m;
          return { ...m, qtyNeeded: calculateLayerConsumption(product, it.gender, layerInfo.key, newQty) };
        });
        return { ...it, qty: newQty, materialsNeeded: updatedMaterials, threadQtyM: product.threadM * newQty };
      })
    }));
  };

  const handleDraftItemNotesChange = (itemId, newNotes) => {
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.map(it => it.itemId === itemId ? { ...it, notes: newNotes } : it) }));
  };

  const handleDraftItemImageChange = async (itemId, file) => {
    if (!file) return;
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
    const { error } = await supabase.storage.from('item-images').upload(path, file);
    if (error) { triggerNotification('error', `Chyba pri nahrávaní obrázka: ${error.message}`); return; }
    const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path);
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.map(it => it.itemId === itemId ? { ...it, imageUrl: pub.publicUrl } : it) }));
  };

  const handleDraftItemImageRemove = (itemId) => {
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.map(it => it.itemId === itemId ? { ...it, imageUrl: '' } : it) }));
  };

  const handleRemoveDraftItem = (itemId) => {
    if (!window.confirm('Odstrániť túto položku zo zákazky? (Zmena sa uloží až po kliknutí na "Uložiť zmeny")')) return;
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.filter(it => it.itemId !== itemId) }));
  };

  const handleAddItemToExistingOrder = async () => {
    if (!orderEditDraft) return;
    const product = products.find(p => p.id === addItemProductId);
    if (!product) { alert('Vyberte produkt.'); return; }
    const tier = qualityTiers.find(t => t.id === addItemTierId);
    const qtyNum = parseInt(addItemQty);
    if (!qtyNum || qtyNum < 1) { alert('Zadajte platné množstvo (aspoň 1 ks).'); return; }
    const activeStations = Object.keys(addItemStations).filter(k => addItemStations[k]);
    if (activeStations.length === 0) { alert('Zaškrtnite aspoň jednu výrobnú stanicu.'); return; }

    const neededList = [];
    if (product.layer1) neededList.push({ layerName: 'Primárna látka', materialId: addItemLayer1Mat, qtyNeeded: calculateLayerConsumption(product, addItemGender, 'layer1', qtyNum) });
    if (product.layer2 && addItemLayer2Mat) neededList.push({ layerName: 'Sekundárna látka', materialId: addItemLayer2Mat, qtyNeeded: calculateLayerConsumption(product, addItemGender, 'layer2', qtyNum) });
    if (product.layer3 && addItemLayer3Mat) neededList.push({ layerName: 'Terciárna látka', materialId: addItemLayer3Mat, qtyNeeded: calculateLayerConsumption(product, addItemGender, 'layer3', qtyNum) });

    let imageUrl = '';
    if (addItemImageFile) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${addItemImageFile.name}`;
      const { error: upErr } = await supabase.storage.from('item-images').upload(path, addItemImageFile);
      if (upErr) { triggerNotification('error', `Chyba pri nahrávaní obrázka: ${upErr.message}`); return; }
      const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }

    const newItemId = `${orderEditDraft.id}-x${Date.now().toString().slice(-6)}`;
    const initialStatuses = {};
    activeStations.forEach(sid => { initialStatuses[sid] = 'caka'; });

    const newItem = {
      itemId: newItemId, productId: product.id, productName: product.name, customCode: product.customCode,
      qualityTier: tier?.name || '', gender: addItemGender, qty: qtyNum, notes: addItemNotes, imageUrl,
      materialsNeeded: neededList, threadQtyM: product.threadM * qtyNum, priority: allItems.length + 1,
      stationStatuses: initialStatuses, materialDeducted: false
    };

    setOrderEditDraft(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setAddItemProductId(''); setAddItemQty(10); setAddItemNotes(''); setAddItemImageFile(null); setAddItemImagePreview(''); setAddItemStations({});
    setShowAddItemForm(false);
    triggerNotification('success', `Položka "${product.name}" bola pridaná do zákazky. Nezabudni kliknúť na "Uložiť zmeny", inak sa pridanie neuloží.`);
  };

  const handleSaveEditOrder = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte prístup na úpravu zákaziek.'); return; }
    if (!orderEditDraft.customer.trim()) { alert('Vyplňte odberateľa.'); return; }
    if (!orderEditDraft.deliveryDate) { alert('Vyplňte termín dodania.'); return; }

    const originalItemIds = new Set((selectedOrderDetails.items || []).map(it => it.itemId));
    const now = getFormattedDateTime();
    const materialUpdates = [];

    const cleanedItems = orderEditDraft.items.map(it => {
      const cleanQty = parseInt(it.qty) && parseInt(it.qty) >= 1 ? parseInt(it.qty) : 1;
      const isNewItem = !originalItemIds.has(it.itemId);
      if (isNewItem && !it.materialDeducted && (it.materialsNeeded || []).length > 0) {
        it.materialsNeeded.forEach(needed => {
          const mat = materials.find(m => m.id === needed.materialId);
          if (mat) {
            const alreadyQueued = materialUpdates.find(u => u.id === mat.id);
            const baseQty = alreadyQueued ? alreadyQueued.qty : mat.qty;
            const baseHistory = alreadyQueued ? alreadyQueued.history : (mat.history || []);
            const newQty = Math.max(0, parseFloat((baseQty - needed.qtyNeeded).toFixed(2)));
            const newHist = [...baseHistory, { date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Odpísanie pre výrobu', change: -needed.qtyNeeded, note: `Zákazka ${orderEditDraft.id} • Dodatočne pridaná položka • ${it.productName} (${needed.layerName})` }];
            if (alreadyQueued) { alreadyQueued.qty = newQty; alreadyQueued.history = newHist; }
            else materialUpdates.push({ id: mat.id, qty: newQty, history: newHist });
          }
        });
        return { ...it, qty: cleanQty, materialDeducted: true };
      }
      return { ...it, qty: cleanQty };
    });

    const finalDraft = { ...orderEditDraft, items: cleanedItems };
    const { error } = await supabase.from('orders').update(mapOrderToDb(finalDraft)).eq('id', finalDraft.id);
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }

    for (const mu of materialUpdates) {
      await supabase.from('materials').update({ qty: mu.qty, history: mu.history }).eq('id', mu.id);
    }

    setSelectedOrderDetails(finalDraft);
    setIsEditingOrder(false);
    setOrderEditDraft(null);
    triggerNotification('success', 'Zákazka bola upravená.');
  };

  const handleDeleteOrder = async () => {
    if (!hasPermission('delete_order')) { triggerNotification('error', 'Nemáte prístup na mazanie zákaziek.'); return; }
    if (!window.confirm(`Naozaj natrvalo vymazať zákazku ${selectedOrderDetails.id}? Táto akcia sa nedá vrátiť späť.`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', selectedOrderDetails.id);
    if (error) { triggerNotification('error', error.message); return; }
    setSelectedOrderDetails(null);
    setIsEditingOrder(false);
    setOrderEditDraft(null);
    triggerNotification('success', 'Zákazka bola vymazaná.');
  };

  const handleQrScan = (scannedCode) => {
    if (!hasPermission('scan_qr')) { triggerNotification('error', 'Prístup zamietnutý na skenovanie.'); return; }
    if (!scannedCode.trim()) return;
    const code = scannedCode.trim();
    const found = findItemByItemId(code);
    if (!found) { triggerNotification('error', `Položka ${code} nebola nájdená.`); setManualQrInput(''); return; }
    const { order, item } = found;

    if (!(selectedTerminalStation in (item.stationStatuses || {}))) {
      triggerNotification('error', `Položka ${item.itemId} nie je zaradená na stanicu "${STATION_CONFIGS[selectedTerminalStation].name}".`);
      setManualQrInput('');
      return;
    }

    const currentStatus = item.stationStatuses[selectedTerminalStation] || 'neaktivne';
    if (currentStatus === 'neaktivne' || currentStatus === 'caka' || currentStatus === 'priprava') {
      let targetStatus = 'hotove';
      if (selectedTerminalStation === 'grafik') targetStatus = 'export';
      else if (selectedTerminalStation === 'laser') targetStatus = 'rezanie';
      else if (selectedTerminalStation === 'strihanie') targetStatus = 'strihanie';
      else if (selectedTerminalStation === 'sitie') targetStatus = 'sije';
      else if (selectedTerminalStation === 'balenie') targetStatus = 'prebieha';
      else if (['transfer', 'sietotlac', 'sublimacia'].includes(selectedTerminalStation)) targetStatus = 'tlac';
      updateStationStatus(order.id, item.itemId, selectedTerminalStation, targetStatus);
      triggerNotification('success', `VSTUP naskenovaný: Položka ${item.itemId} (${item.productName}) je v práci.`);
    } else {
      updateStationStatus(order.id, item.itemId, selectedTerminalStation, 'hotove');
      triggerNotification('success', `VÝSTUP naskenovaný: Práca na položke ${item.itemId} ukončená.`);
    }
    setManualQrInput('');
  };

  const updateStationStatus = async (orderId, itemId, stationId, statusId) => {
    if (!hasPermission('update_status')) { triggerNotification('error', 'Nemáte oprávnenie meniť stavy staníc.'); return; }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const now = getFormattedDateTime();
    const materialUpdates = [];

    const updatedItems = order.items.map(item => {
      if (item.itemId !== itemId) return item;
      let isDeductedNow = item.materialDeducted;
      if ((stationId === 'strihanie' || stationId === 'laser') && statusId !== 'neaktivne' && statusId !== 'caka' && statusId !== 'priprava' && !item.materialDeducted) {
        item.materialsNeeded.forEach(needed => {
          const mat = materials.find(m => m.id === needed.materialId);
          if (mat) {
            const newQty = Math.max(0, parseFloat((mat.qty - needed.qtyNeeded).toFixed(2)));
            const newHist = [...(mat.history || []), { date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Odpísanie pre výrobu', change: -needed.qtyNeeded, note: `Zákazka ${orderId} • Položka ${itemId} • ${item.productName}` }];
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

  // Doplnenie stanice, ktorá pri položke chýba (napr. omylom nezaškrtnutá alebo náhodne odstránená)
  const handleAddStationToItem = async (orderId, itemId, stationId) => {
    if (!hasPermission('update_status')) { triggerNotification('error', 'Nemáte oprávnenie meniť stavy staníc.'); return; }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = order.items.map(item => item.itemId === itemId
      ? { ...item, stationStatuses: { ...item.stationStatuses, [stationId]: 'caka' } }
      : item);
    const { error } = await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);
    if (error) { triggerNotification('error', error.message); return; }
    if (selectedOrderDetails?.id === orderId) setSelectedOrderDetails({ ...order, items: updatedItems });
    triggerNotification('success', `Stanica "${STATION_CONFIGS[stationId].name}" bola doplnená k položke ${itemId}.`);
  };

  const handleSubmitEmployee = async (e) => {
    e.preventDefault();
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte prístup do správy profilov.'); return; }
    if (editingEmployee) {
      let passwordHash = editingEmployee.passwordHash;
      if (editEmpPassword.trim()) passwordHash = await hashPassword(editEmpPassword.trim());
      const updated = { ...editingEmployee, passwordHash };
      const { error } = await supabase.from('employees').update(mapEmployeeToDb(updated)).eq('id', updated.id);
      if (error) { triggerNotification('error', error.message); return; }
      if (currentUser.id === updated.id) setCurrentUser(updated);
      setEditingEmployee(null);
      setEditEmpPassword('');
      triggerNotification('success', 'Zamestnanec bol upravený.');
    } else {
      if (!newEmpFirstName.trim() || !newEmpLastName.trim()) { alert('Zadajte meno a priezvisko.'); return; }
      if (!newEmpPassword.trim()) { alert('Nastavte zamestnancovi prihlasovacie heslo.'); return; }
      const passwordHash = await hashPassword(newEmpPassword.trim());
      const created = { id: `emp-${Date.now()}`, firstName: newEmpFirstName, lastName: newEmpLastName, birthday: newEmpBirthday, nameday: newEmpNameday, entryDate: newEmpEntryDate, role: newEmpRole, position: newEmpPosition, phone: newEmpPhone, email: newEmpEmail, passwordHash };
      const { error } = await supabase.from('employees').insert(mapEmployeeToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewEmpFirstName(''); setNewEmpLastName(''); setNewEmpBirthday(''); setNewEmpNameday(''); setNewEmpPosition(''); setNewEmpPhone(''); setNewEmpEmail(''); setNewEmpPassword('');
      triggerNotification('success', `Zamestnanec "${created.firstName}" bol pridaný.`);
    }
  };

  const handleStartEditEmployee = (emp) => { setEditingEmployee({ ...emp }); setEditEmpPassword(''); };
  const handleCancelEditEmployee = () => { setEditingEmployee(null); setEditEmpPassword(''); };

  const handleDeleteEmployee = async (id) => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte prístup do správy profilov.'); return; }
    if (!window.confirm('Naozaj vymazať tohto zamestnanca?')) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { triggerNotification('error', error.message); return; }
    if (currentUser.id === id) {
      handleLogout();
      return;
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

  const distinctDeliveryDates = Array.from(new Set(allItems.map(i => i.deliveryDate).filter(Boolean))).sort();

  const getPlannerDates = () => {
    const set = new Set();
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      set.add(d.toISOString().slice(0, 10));
    }
    allItems.forEach(it => { if (it.deliveryDate) set.add(it.deliveryDate); });
    return Array.from(set).sort();
  };
  const plannerDates = getPlannerDates();

  const sortedRows = allItems.filter(item => {
    const matchesSearch = item.customer.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.orderId.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.itemId.toLowerCase().includes(rowSearch.toLowerCase()) ||
      item.productName.toLowerCase().includes(rowSearch.toLowerCase());
    const matchesDate = rowDateFilter === 'vsetko' || item.deliveryDate === rowDateFilter;
    return matchesSearch && matchesDate;
  });

  const catalogFilteredProducts = products.filter(p => catalogSportFilter === 'vsetko' ? true : p.sports?.includes(catalogSportFilter));
  const pendingTotalQty = pendingItems.reduce((sum, i) => sum + i.qty, 0);
  const genderLabel = (g) => g === 'men' ? 'Muži' : g === 'women' ? 'Ženy' : 'Deti';

  const CashBadge = ({ paymentType, size = 'normal' }) => {
    if (paymentType !== 'hotovost') return null;
    const cls = size === 'small' ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-xs';
    return (
      <span className={`inline-flex items-center justify-center ${cls} bg-rose-600 text-white font-extrabold rounded shrink-0`} title="Platba v hotovosti">$</span>
    );
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
          <span className="text-sm text-slate-400">Načítavam dáta zo servera...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <img src="/logo-atak-pbt.png" alt="ATAK x PBT" className="h-10 w-auto brightness-0 invert mx-auto mb-2" />
            <h1 className="text-lg font-extrabold text-white">TEX-MASTER ERP</h1>
            <p className="text-xs text-slate-500">Prihláste sa svojím menom a heslom</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Meno</label>
              <select value={loginSelectedId} onChange={(e) => { setLoginSelectedId(e.target.value); setLoginError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white">
                <option value="">-- Vyber svoje meno --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Heslo</label>
              <input type="password" value={loginPassword} onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" autoFocus />
            </div>
            {loginError && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{loginError}</p>}
            <button type="submit" disabled={isLoggingIn} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Prihlásiť sa
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased">
      
      <div className="bg-slate-950 border-b border-indigo-950 px-4 py-2 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-slate-300 print:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" />
          <span className="font-bold">Prihlásený: {currentUser.firstName} {currentUser.lastName} ({currentUser.role.toUpperCase()})</span>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {currentUser.role === 'master' && (
            <button onClick={() => setShowMasterSwitcher(s => !s)} className="px-3 py-1 rounded-md font-bold border bg-slate-900 text-indigo-400 border-slate-800 hover:text-white">
              {showMasterSwitcher ? 'Skryť testovací prepínač' : 'Testovať ako iný profil'}
            </button>
          )}
          <button onClick={handleLogout} className="px-3 py-1 rounded-md font-bold border bg-rose-950/40 text-rose-400 border-rose-900/40 hover:bg-rose-900/40">Odhlásiť sa</button>
        </div>
      </div>

      {currentUser.role === 'master' && showMasterSwitcher && (
        <div className="bg-amber-950/20 border-b border-amber-900/40 px-4 py-2 flex flex-wrap gap-1.5 items-center text-xs print:hidden">
          <span className="text-amber-400 font-bold shrink-0">⚠ Testovací režim — vidíš appku očami iného profilu:</span>
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
      )}

      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-start shrink-0">
              <img src="/logo-atak-pbt.png" alt="ATAK x PBT" className="h-8 w-auto brightness-0 invert mb-1.5" />
              <span className="font-extrabold text-md tracking-wider text-white block">TEX-MASTER ERP v7.0</span>
              <span className="text-[10px] text-indigo-400 block -mt-1 font-semibold">Živé dáta • Supabase</span>
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
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="text-indigo-400 h-5 w-5" /> Plánovací Panel podľa termínu dodania</h2>
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
                    <span className="text-[10px] italic">Farba rámčeka = položky patriace k rovnakej zákazke</span>
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                    <table className="w-full text-left border-collapse" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${100 / (zoomLevel / 100)}%` }}>
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-40 border-r border-slate-850">Stanica</th>
                          {plannerDates.map(date => (<th key={date} className={`p-3 text-xs font-bold uppercase tracking-wider text-center border-r border-slate-850 ${isUrgentDate(date) ? 'bg-rose-900/50 text-rose-300' : 'text-slate-300'}`}>{formatDeliveryDate(date)}</th>))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {STATION_ORDER.map(stationId => {
                          const config = STATION_CONFIGS[stationId];
                          return (
                            <tr key={stationId} className="hover:bg-slate-900/10">
                              <td className="p-3 font-bold text-xs text-slate-200 bg-slate-900/40 border-r border-slate-850">
                                <div className="flex items-center gap-1.5"><config.icon className="h-4 w-4 text-indigo-400 shrink-0" /><span>{config.name}</span></div>
                              </td>
                              {plannerDates.map(date => {
                                const dayItems = allItems.filter(it => it.deliveryDate === date && it.stationStatuses[stationId] && it.stationStatuses[stationId] !== 'neaktivne').sort((a, b) => a.priority - b.priority);
                                return (
                                  <td key={date} className="p-1 border-r border-slate-850 align-top min-h-[110px] bg-slate-950/15">
                                    <div className="grid grid-cols-1 gap-1">
                                      {dayItems.map(item => {
                                        const statusId = item.stationStatuses[stationId];
                                        const statusCfg = config.statuses.find(s => s.id === statusId) || config.statuses[0];
                                        const orderColor = colorForOrder(item.orderId);
                                        return (
                                          <div 
                                            key={item.itemId} 
                                            onClick={() => openOrderDetails(orders.find(o => o.id === item.orderId))} 
                                            className={`bg-slate-900 hover:bg-slate-800 border-l-4 ${orderColor.border} border-t border-r border-b border-slate-750 p-2 rounded cursor-pointer transition-all flex flex-col justify-between text-[10px] space-y-1 shadow hover:scale-[1.02] transform`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-mono font-bold text-indigo-400">#{item.priority} • {item.itemId}</span>
                                              <div className="flex items-center gap-1">
                                                <CashBadge paymentType={item.paymentType} size="small" />
                                                <span className="text-slate-400 font-bold">{item.qty}ks</span>
                                              </div>
                                            </div>
                                            <p className="font-extrabold text-slate-100 truncate">{item.customer}</p>
                                            <p className="text-[9px] text-slate-300 truncate">{item.productName} ({item.qualityTier})</p>
                                            <select
                                              value={statusId}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => updateStationStatus(item.orderId, item.itemId, stationId, e.target.value)}
                                              disabled={!hasPermission('update_status')}
                                              className={`text-[9px] px-1 py-0.5 rounded text-center font-bold ${statusCfg.color} truncate w-full focus:outline-none`}
                                            >
                                              {config.statuses.filter(s => s.id !== 'neaktivne').map(st => (
                                                <option key={st.id} value={st.id} className="bg-slate-900 text-slate-300">{st.label}</option>
                                              ))}
                                            </select>
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
                      <select value={rowDateFilter} onChange={(e) => setRowDateFilter(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100">
                        <option value="vsetko">Všetky termíny</option>
                        {distinctDeliveryDates.map(d => <option key={d} value={d}>{formatDeliveryDate(d)}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-end text-slate-400 text-[11px]"><span>Záznamov: <strong className="text-white font-bold">{sortedRows.length}</strong></span></div>
                  </div>
                  {hasPermission('edit_priority') && (
                    <p className="text-[10px] text-slate-500 italic">Poradie priority zmeníš šípkami ↑↓ pri čísle poradia — posúva sa naprieč celým zoznamom, bez ohľadu na termín dodania.</p>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/20">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-[11px] text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 w-12">Poradie</th>
                          <th className="px-4 py-3">Položka</th>
                          <th className="px-4 py-3">Zákazka</th>
                          <th className="px-4 py-3">Odberateľ</th>
                          <th className="px-4 py-3">Produkt (Vyhotovenie)</th>
                          <th className="px-4 py-3 text-center">Ks</th>
                          <th className="px-4 py-3 text-center">Termín</th>
                          <th className="px-4 py-3 text-center">Aktuálne štádium</th>
                          <th className="px-4 py-3 text-center">Akcie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {sortedRows
                          .slice()
                          .sort((a, b) => a.priority - b.priority)
                          .map(item => {
                          const stage = currentStageLabel(item);
                          const orderColor = colorForOrder(item.orderId);
                          const canReorder = hasPermission('edit_priority');
                          return (
                            <tr 
                              key={item.itemId} 
                              className={`hover:bg-slate-800/40 border-l-4 ${orderColor.border}`}
                            >
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  {canReorder && (
                                    <div className="flex flex-col gap-0.5">
                                      <button onClick={() => handleMovePriority(item, -1)} className="p-0.5 bg-slate-800 hover:bg-indigo-700 rounded text-slate-400 hover:text-white"><ArrowUp className="h-3 w-3" /></button>
                                      <button onClick={() => handleMovePriority(item, 1)} className="p-0.5 bg-slate-800 hover:bg-indigo-700 rounded text-slate-400 hover:text-white"><ArrowDown className="h-3 w-3" /></button>
                                    </div>
                                  )}
                                  <span className="font-mono font-bold text-indigo-300">#{item.priority}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-indigo-400">{item.itemId}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{item.orderId}</td>
                              <td className="px-4 py-3 font-bold text-white flex items-center gap-1.5"><CashBadge paymentType={item.paymentType} size="small" /> {item.customer}</td>
                              <td className="px-4 py-3 text-slate-300">{item.productName} (<span className="text-indigo-400">{item.qualityTier}</span>)</td>
                              <td className="px-4 py-3 text-center font-bold text-white">{item.qty}</td>
                              <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded font-bold ${isUrgentDate(item.deliveryDate) ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800'}`}>{formatDeliveryDate(item.deliveryDate)}</span></td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded font-bold ${stage.done ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>{stage.label}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => openOrderDetails(orders.find(o => o.id === item.orderId))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1 rounded">Sprievodka</button>
                              </td>
                            </tr>
                          );
                        })}
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Termín dodania</label>
                      <input type="date" value={newOrderDeliveryDate} onChange={(e) => setNewOrderDeliveryDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Spôsob platby</label>
                      <div className="grid grid-cols-2 gap-1">
                        <button type="button" onClick={() => setNewOrderPaymentType('faktura')} className={`py-2 text-center text-xs font-bold rounded transition-colors ${newOrderPaymentType === 'faktura' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>Faktúra</button>
                        <button type="button" onClick={() => setNewOrderPaymentType('hotovost')} className={`py-2 text-center text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 ${newOrderPaymentType === 'hotovost' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}><Banknote className="h-3.5 w-3.5" /> Hotovosť ($)</button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Odkaz na podklady (Google Drive, Uschovňa, WeTransfer... hocijaký odkaz)</label>
                      <input type="text" value={orderDriveLink} onChange={(e) => setOrderDriveLink(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-400" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k celej zákazke (napr. spôsob dopravy)</label>
                    <textarea rows={2} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Poznámka pre celú zákazku..." className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><PlusCircle className="text-indigo-400 h-5 w-5" /> 2. Pridať položku (produkt) do zákazky</h2>
                  <p className="text-xs text-slate-400 mb-4">Jedna zákazka môže obsahovať viacero rôznych produktov. Pri každej položke zaškrtni len tie výrobné stanice, cez ktoré má reálne ísť.</p>
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
                        <input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} onBlur={(e) => { const n = parseInt(e.target.value); setItemQty(n && n >= 1 ? n : 1); }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-white" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2"><Sliders className="h-4 w-4 text-indigo-400" /> Výrobné stanice pre túto položku</h3>
                      <div className="grid grid-cols-2 gap-1.5">
                        {STATION_ORDER.map(sid => {
                          const cfg = STATION_CONFIGS[sid];
                          const checked = !!selectedStations[sid];
                          return (
                            <label key={sid} className={`flex items-center gap-1.5 p-2 rounded cursor-pointer text-[11px] font-bold border ${checked ? 'bg-indigo-950/40 border-indigo-600 text-indigo-300' : 'bg-slate-950 border-slate-850 text-slate-400'}`}>
                              <input type="checkbox" checked={checked} onChange={(e) => setSelectedStations({ ...selectedStations, [sid]: e.target.checked })} className="rounded bg-slate-900 border-slate-800 text-indigo-600 mr-1" />
                              <cfg.icon className="h-3.5 w-3.5 shrink-0" /> {cfg.name}
                            </label>
                          );
                        })}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k tejto položke</label>
                        <textarea rows={5} value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} placeholder="Napr. Pantone 286C, mesh podpazušie, číslovanie 1-10..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Náhľadový obrázok (voliteľné) — zobrazí sa na sprievodke</label>
                        {itemImagePreview ? (
                          <div className="relative">
                            <img src={itemImagePreview} alt="Náhľad" className="w-full h-32 object-cover rounded-lg border border-slate-800" />
                            <button type="button" onClick={() => { setItemImageFile(null); setItemImagePreview(''); }} className="absolute top-1 right-1 bg-rose-700 hover:bg-rose-800 text-white p-1 rounded-full"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-800 rounded-lg py-4 cursor-pointer hover:border-indigo-600 transition-colors">
                            <Upload className="h-5 w-5 text-slate-500" />
                            <span className="text-[10px] text-slate-500">Klikni a vyber obrázok (JPG/PNG)</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setItemImageFile(file);
                              setItemImagePreview(URL.createObjectURL(file));
                            }} />
                          </label>
                        )}
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
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sekundárna látka: {selectedLayer2Mat ? `${calculateLayerConsumption(selectedProduct, selectedGender, 'layer2', itemQty)} m` : 'nepoužije sa'}</label>
                            <select value={selectedLayer2Mat} onChange={(e) => setSelectedLayer2Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs">
                              <option value="">-- Nepoužiť túto vrstvu --</option>
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.color})</option>)}
                            </select>
                          </div>
                        )}
                        {selectedProduct?.layer3 && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Terciárna látka: {selectedLayer3Mat ? `${calculateLayerConsumption(selectedProduct, selectedGender, 'layer3', itemQty)} m` : 'nepoužije sa'}</label>
                            <select value={selectedLayer3Mat} onChange={(e) => setSelectedLayer3Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs">
                              <option value="">-- Nepoužiť túto vrstvu --</option>
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.color})</option>)}
                            </select>
                          </div>
                        )}
                        {!selectedProduct?.layer1 && !selectedProduct?.layer2 && !selectedProduct?.layer3 && (
                          <p className="text-[11px] text-slate-500 italic">Tento model nemá priradenú žiadnu látku zo skladu (napr. tričko/mikina len na dotlač).</p>
                        )}
                      </div>
                      <button type="button" onClick={handleAddPendingItem} disabled={isUploadingItemImage} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5">{isUploadingItemImage ? (<><Loader2 className="h-4 w-4 animate-spin" /> Nahrávam obrázok...</>) : (<><Plus className="h-4 w-4" /> Pridať položku do zoznamu</>)}</button>
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
                          <div className="flex items-center gap-3">
                            {item.imageUrl && <img src={item.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0" />}
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-indigo-400 font-bold">#{idx + 1}</span>
                                <span className="font-bold text-white">{item.productName}</span>
                                <span className="text-slate-400">({item.qualityTier} • {genderLabel(item.gender)} • {item.qty}ks)</span>
                              </div>
                              <div className="flex flex-wrap gap-1">{item.activeStations.map(sid => <span key={sid} className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] text-indigo-300">{STATION_CONFIGS[sid].name}</span>)}</div>
                              {item.notes && <p className="text-[10px] text-slate-500 italic max-w-xl">{item.notes}</p>}
                            </div>
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
              <p className="text-xs text-slate-400 mb-6">Katalóg môže obsahovať akékoľvek modely - dresy, tréningovky, mikiny, tepláky, ale aj napr. tričká na dotlač bez priradenej látky.</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">{editingProduct ? `Upraviť model: ${editingProduct.name}` : 'Vytvoriť nový model'}</h3>
                  <form onSubmit={handleSaveModel} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Vlastný Kód Modelu</label>
                        <input type="text" required value={editingProduct ? editingProduct.customCode : newModelCode} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, customCode: e.target.value }) : setNewModelCode(e.target.value)} placeholder="napr. TRICKO-BAV-190" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Názov Modelu</label>
                        <input type="text" required value={editingProduct ? editingProduct.name : newModelName} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewModelName(e.target.value)} placeholder="napr. Tričko bavlna 190g" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
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
                        <label className="block text-slate-400 font-semibold mb-1">Látka 1 (Primárna) — voliteľné</label>
                        <select value={editingProduct ? (editingProduct.layer1?.materialId || '') : newModelPrimary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer1: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: { men: { lt5: 1.30, ge5: 1.10 }, women: { lt5: 1.15, ge5: 0.95 }, children: { lt5: 0.85, ge5: 0.70 } } } : null });
                            else setNewModelPrimary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna (len dotlač) --</option>
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
                        {p.layer1 ? <p>Látka 1: <strong>{materials.find(m => m.id === p.layer1?.materialId)?.name}</strong></p> : <p className="italic text-slate-500">Bez látky (len dotlač)</p>}
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
                  {STATION_ORDER.map(sid => {
                    const active = activeStationFilter === sid;
                    return (<button key={sid} onClick={() => setActiveStationFilter(sid)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{STATION_CONFIGS[sid].name}</button>);
                  })}
                </div>
              </div>

              {hasPermission('update_status') && (
                <div className="bg-slate-900/60 border border-dashed border-indigo-800/40 p-4 rounded-xl mb-4 flex flex-col sm:flex-row items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">Chýba tu položka, ktorá by mala byť na tejto stanici (napr. omylom vynechaná)?</span>
                  <select value={addMissingItemId} onChange={(e) => setAddMissingItemId(e.target.value)} className="flex-1 w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                    <option value="">-- Vyber položku --</option>
                    {allItems.filter(it => !it.stationStatuses[activeStationFilter] || it.stationStatuses[activeStationFilter] === 'neaktivne').map(it => (
                      <option key={it.itemId} value={it.itemId}>{it.itemId} • {it.customer} • {it.productName}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const target = allItems.find(it => it.itemId === addMissingItemId);
                      if (!target) return;
                      handleAddStationToItem(target.orderId, target.itemId, activeStationFilter);
                      setAddMissingItemId('');
                    }}
                    disabled={!addMissingItemId}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Pridať na stanicu
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {allItems.filter(it => it.stationStatuses[activeStationFilter] && it.stationStatuses[activeStationFilter] !== 'neaktivne').length === 0 ? (
                  <div className="py-12 text-center text-slate-500 italic border border-dashed border-slate-800 rounded-xl">Aktuálne nečakajú na tejto stanici žiadne položky na spracovanie.</div>
                ) : (
                  allItems.filter(it => it.stationStatuses[activeStationFilter] && it.stationStatuses[activeStationFilter] !== 'neaktivne').sort((a, b) => a.priority - b.priority).map((item, index) => {
                    const config = STATION_CONFIGS[activeStationFilter];
                    const currentStatusId = item.stationStatuses[activeStationFilter] || 'caka';
                    const orderColor = colorForOrder(item.orderId);
                    return (
                      <div key={item.itemId} className={`bg-slate-900/80 border-l-4 ${orderColor.border} border-t border-r border-b border-slate-800 p-5 rounded-xl flex flex-col md:flex-row justify-between gap-4`}>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-indigo-600/20 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/30">Priorita #{index + 1}</span>
                            <span className="font-mono text-xs font-semibold text-slate-500">ID: {item.itemId}</span>
                            <CashBadge paymentType={item.paymentType} size="small" />
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

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex flex-wrap items-center gap-2">
                {warehouses.map(wh => (
                  <div key={wh.id} className="flex items-center">
                    {editingWarehouseId === wh.id ? (
                      <div className="flex items-center gap-1 bg-slate-900 border border-indigo-600 rounded-lg px-2 py-1.5">
                        <input type="text" value={editingWarehouseName} onChange={(e) => setEditingWarehouseName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEditWarehouse()} autoFocus className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white w-28" />
                        <button onClick={handleSaveEditWarehouse} className="text-emerald-400 p-0.5"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingWarehouseId(null)} className="text-slate-500 p-0.5"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveWarehouseId(wh.id)}
                        onDoubleClick={() => hasPermission('edit_stock') && handleStartEditWarehouse(wh)}
                        className={`px-4 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeWarehouseId === wh.id ? 'bg-slate-900 border-indigo-500 text-white' : 'bg-slate-900/40 border-transparent text-slate-400 hover:text-slate-200'}`}
                        title="Dvojklik premenuje sklad"
                      >
                        <Package className="h-3.5 w-3.5" /> {wh.name}
                        <span className="text-[9px] text-slate-500 font-normal">({materials.filter(m => m.warehouseId === wh.id).length})</span>
                        {hasPermission('edit_stock') && (
                          <Trash2 className="h-3 w-3 text-slate-600 hover:text-rose-400" onClick={(e) => { e.stopPropagation(); handleDeleteWarehouse(wh); }} />
                        )}
                      </button>
                    )}
                  </div>
                ))}
                {hasPermission('edit_stock') && (
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5">
                    <input type="text" placeholder="Nový sklad (napr. Sklad Fólie)" value={newWarehouseName} onChange={(e) => setNewWarehouseName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddWarehouse()} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white w-40" />
                    <button onClick={handleAddWarehouse} className="text-indigo-400 hover:text-indigo-300"><Plus className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package className="text-indigo-400 h-5 w-5" /> Skladové zásoby — {warehouses.find(w => w.id === activeWarehouseId)?.name || ''}</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportActiveWarehouse} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export tohto skladu</button>
                    <button onClick={handleExportAllWarehouses} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export všetkých skladov</button>
                    {hasPermission('edit_stock') && (
                      <>
                        <button onClick={() => importFileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Import z Excelu</button>
                        <input ref={importFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFileChange} className="hidden" />
                        <button onClick={handleDownloadImportTemplate} className="bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Stiahnuť šablónu</button>
                      </>
                    )}
                  </div>
                </div>
                {hasPermission('edit_stock') && (
                  <p className="text-[10px] text-slate-500 italic">Import naskladní každý riadok zo súboru ako novú položku do aktuálne otvoreného skladu ({warehouses.find(w => w.id === activeWarehouseId)?.name || ''}) — ak riadok obsahuje stĺpec "Sklad" so zhodným názvom existujúceho skladu, položka sa zaradí tam.</p>
                )}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                      <tr><th className="px-4 py-3">Názov položky</th><th className="px-3 py-3 text-center">Šírka</th><th className="px-3 py-3 text-center">Gramáž</th><th className="px-3 py-3 text-center">Cena / jedn. bez DPH</th><th className="px-3 py-3 text-center">Zostatok</th><th className="px-3 py-3 text-center">Presunúť do</th><th className="px-4 py-3 text-center">Karta</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {materials.filter(m => m.warehouseId === activeWarehouseId).length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">V tomto sklade zatiaľ nie sú žiadne položky.</td></tr>
                      )}
                      {materials.filter(m => m.warehouseId === activeWarehouseId).map(item => {
                        const isLow = item.qty <= item.minQty;
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-4 h-4 rounded-full border border-slate-600 shrink-0" style={{ backgroundColor: item.colorHex || '#475569' }} title={item.color}></span>
                                <div><span className="font-bold text-white block">{item.name}</span><span className="text-[10px] text-slate-400 font-mono">#{item.id} • {item.color}</span></div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold">{item.width ? `${item.width} cm` : '—'}</td>
                            <td className="px-3 py-3 text-center text-slate-400">{item.weight ? `${item.weight} g/m²` : '—'}</td>
                            <td className="px-3 py-3 text-center text-indigo-300 font-bold">{item.pricePerM?.toFixed(2)} € / {item.unit}</td>
                            <td className="px-3 py-3 text-center font-bold"><span className={isLow ? 'text-rose-400' : 'text-emerald-400'}>{item.qty} {item.unit}</span></td>
                            <td className="px-3 py-3 text-center">
                              <select value={item.warehouseId} onChange={(e) => handleMoveMaterialToWarehouse(item.id, e.target.value)} disabled={!hasPermission('edit_stock')} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-300">
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </td>
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
                  <div><label className="text-slate-400 block mb-0.5">Názov materiálu</label><input type="text" required value={newMatName} onChange={(e) => setNewMatName(e.target.value)} placeholder="Polyester Ripstop / Gombík 12mm / Farba čierna" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-0.5">Do skladu</label>
                      <select value={newMatWarehouseId} onChange={(e) => setNewMatWarehouseId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">Jednotka</label>
                      <select value={newMatUnit} onChange={(e) => setNewMatUnit(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white">
                        {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Farba</label>
                    <div className="flex flex-wrap gap-1.5 bg-slate-900 border border-slate-800 rounded p-2 mb-2">
                      {COLOR_PALETTE.map(c => (
                        <button
                          type="button"
                          key={c.hex}
                          title={c.name}
                          onClick={() => { setNewMatColor(c.name); setNewMatColorHex(c.hex); }}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${newMatColorHex === c.hex ? 'border-indigo-400 scale-110' : 'border-slate-700 hover:border-slate-500'}`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" required value={newMatColor} onChange={(e) => setNewMatColor(e.target.value)} placeholder="Názov farby (napr. Cyklamén)" className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                      <input type="color" value={newMatColorHex} onChange={(e) => setNewMatColorHex(e.target.value)} title="Vlastný odtieň" className="w-10 h-9 bg-slate-900 border border-slate-800 rounded cursor-pointer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-slate-400 block mb-0.5">Cena bez DPH (€ / {newMatUnit})</label><input type="number" step="0.01" value={newMatPrice} onChange={(e) => setNewMatPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-0.5">Množstvo ({newMatUnit})</label><input type="number" value={newMatQty} onChange={(e) => setNewMatQty(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  </div>
                  {(newMatUnit === 'm' || newMatUnit === 'bm') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Šírka (cm) — voliteľné</label><input type="number" value={newMatWidth} onChange={(e) => setNewMatWidth(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div><label className="text-slate-400 block mb-0.5">Gramáž (g/m²) — voliteľné</label><input type="number" value={newMatWeight} onChange={(e) => setNewMatWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    </div>
                  )}
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
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border border-slate-600 shrink-0" style={{ backgroundColor: selectedMaterialForDetail.colorHex || '#475569' }}></span>
                    {selectedMaterialForDetail.name} ({selectedMaterialForDetail.color})
                  </h3>
                  <p className="text-xs text-slate-400">{selectedMaterialForDetail.width ? `Gramáž: ${selectedMaterialForDetail.weight} g/m² • Šírka: ${selectedMaterialForDetail.width} cm • ` : ''}Cena: {selectedMaterialForDetail.pricePerM?.toFixed(2)} € / {selectedMaterialForDetail.unit} bez DPH • Sklad: {warehouses.find(w => w.id === selectedMaterialForDetail.warehouseId)?.name || '—'}</p>
                </div>
                <button onClick={() => { setSelectedMaterialForDetail(null); handleCancelEditHistory(); }} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 mb-6">
                <span className="font-bold text-xs text-slate-200 block">Manuálna korekcia zásoby</span>
                <form onSubmit={handleApplyStockAdjustment} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><label className="text-[10px] text-slate-500 block mb-0.5">Zmena množstva ({selectedMaterialForDetail.unit})</label><input type="number" step="0.01" required placeholder="napr. -12.5" value={stockCorrectionQty} onChange={(e) => setStockCorrectionQty(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" /></div>
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
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {selectedMaterialForDetail.history?.map((h, i) => (
                    <div key={i} className={`bg-slate-950 p-2.5 rounded border text-xs ${h.corrected ? 'border-rose-700/60' : 'border-slate-850'}`}>
                      {editingHistoryIndex === i ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{h.action}</span>
                            <span className="text-[10px] text-slate-500">{h.date} • Zadal: {h.user}</span>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Nová hodnota zmeny ({selectedMaterialForDetail.unit})</label>
                            <input type="number" step="0.01" value={editingHistoryChange} onChange={(e) => setEditingHistoryChange(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-rose-400 font-bold block mb-0.5">Dôvod opravy (povinné)</label>
                            <input type="text" required placeholder="napr. Preklep, správna hodnota bola -8, nie -18" value={editingHistoryReason} onChange={(e) => setEditingHistoryReason(e.target.value)} className="w-full bg-slate-900 border border-rose-800/50 rounded p-1.5 text-xs text-white" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSaveEditHistory} className="flex-1 bg-rose-700 hover:bg-rose-800 text-white font-bold py-1.5 rounded text-xs">Uložiť opravu</button>
                            <button onClick={handleCancelEditHistory} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 rounded text-xs">Zrušiť</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-slate-200 block">{h.action} <span className={h.change < 0 ? 'text-rose-400' : 'text-emerald-400'}>{h.change > 0 ? `+${h.change}` : h.change} {selectedMaterialForDetail.unit}</span></span>
                            <p className="text-[10px] text-slate-500">{h.date} • Zadal: {h.user}</p>
                            {h.note && <p className="text-[10px] text-slate-400 italic mt-0.5">Poznámka: {h.note}</p>}
                            {h.corrected && (
                              <p className="text-[10px] text-rose-400 font-bold mt-1">
                                ⚠ OPRAVENÉ ({h.correctedAt} • {h.correctedBy}) — pôvodná hodnota: {h.originalChange > 0 ? `+${h.originalChange}` : h.originalChange} {selectedMaterialForDetail.unit}. Dôvod: {h.correctionReason}
                              </p>
                            )}
                          </div>
                          {hasPermission('edit_stock') && (
                            <button onClick={() => handleStartEditHistory(i)} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-indigo-400 shrink-0"><Edit2 className="h-3 w-3" /></button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            {!hasPermission('manage_profiles') ? (
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="bg-rose-950/40 border border-rose-800 p-6 rounded-2xl text-center space-y-3">
                  <Lock className="h-12 w-12 text-rose-500 mx-auto" />
                  <h3 className="text-lg font-bold text-rose-300">Prístup zamietnutý</h3>
                  <p className="text-xs text-rose-400">Zoznam zamestnancov a ich kontaktné údaje vidí len osoba s právom na správu profilov.</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <h4 className="font-bold text-sm text-white mb-2">Tvoj profil</h4>
                  <p className="text-xs text-slate-400">Meno: <strong className="text-white">{currentUser.firstName} {currentUser.lastName}</strong></p>
                  <p className="text-xs text-slate-400">Pozícia: <strong className="text-white">{currentUser.position || '—'}</strong></p>
                  <p className="text-xs text-slate-400">Rola: <strong className="text-white">{currentUser.role}</strong></p>
                </div>
              </div>
            ) : (
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
                        <p className="text-[10px] text-slate-500">Telefón: <strong className="text-slate-400">{emp.phone || '—'}</strong> • Email: <strong className="text-slate-400">{emp.email || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Heslo: <strong className={emp.passwordHash ? 'text-emerald-400' : 'text-rose-400'}>{emp.passwordHash ? 'Nastavené' : 'Nenastavené — nemôže sa prihlásiť'}</strong></p>
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
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Telefón</label><input type="tel" placeholder="napr. 0900 123 456" value={editingEmployee ? (editingEmployee.phone || '') : newEmpPhone} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, phone: e.target.value }) : setNewEmpPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div><label className="text-slate-400 block mb-0.5">Email</label><input type="email" placeholder="meno@firma.sk" value={editingEmployee ? (editingEmployee.email || '') : newEmpEmail} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, email: e.target.value }) : setNewEmpEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">{editingEmployee ? 'Nové heslo (nechaj prázdne, ak nemeníš)' : 'Prihlasovacie heslo'}</label>
                      <input type="password" placeholder={editingEmployee ? '••••••' : 'Zvoľ heslo pre prihlásenie'} required={!editingEmployee} value={editingEmployee ? editEmpPassword : newEmpPassword} onChange={(e) => editingEmployee ? setEditEmpPassword(e.target.value) : setNewEmpPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
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
            )}
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
                        {STATION_ORDER.map(sid => (<option key={sid} value={sid}>{STATION_CONFIGS[sid].name}</option>))}
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
                {!isEditingOrder && hasPermission('create_order') && (
                  <button onClick={handleStartEditOrder} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Edit2 className="h-4 w-4" /> Upraviť zákazku</button>
                )}
                {hasPermission('delete_order') && (
                  <button onClick={handleDeleteOrder} className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> Zmazať zákazku</button>
                )}
                <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť (A4)</button>
                <button onClick={() => openOrderDetails(null)} className="bg-slate-800 hover:bg-slate-750 text-slate-400 px-3 py-2 rounded-lg text-xs">Zatvoriť</button>
              </div>
            </div>

            {isEditingOrder && orderEditDraft && (
              <div className="bg-amber-950/20 border border-amber-800/40 p-6 rounded-xl space-y-4 print:hidden">
                <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2"><Edit2 className="h-4 w-4" /> Úprava zákazky {orderEditDraft.id}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Odberateľ (Klub / Firma)</label>
                    <input type="text" value={orderEditDraft.customer} onChange={(e) => setOrderEditDraft({ ...orderEditDraft, customer: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Termín dodania</label>
                    <input type="date" value={orderEditDraft.deliveryDate} onChange={(e) => setOrderEditDraft({ ...orderEditDraft, deliveryDate: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Spôsob platby</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button type="button" onClick={() => setOrderEditDraft({ ...orderEditDraft, paymentType: 'faktura' })} className={`py-2 text-center text-xs font-bold rounded transition-colors ${orderEditDraft.paymentType === 'faktura' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>Faktúra</button>
                      <button type="button" onClick={() => setOrderEditDraft({ ...orderEditDraft, paymentType: 'hotovost' })} className={`py-2 text-center text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 ${orderEditDraft.paymentType === 'hotovost' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}><Banknote className="h-3.5 w-3.5" /> Hotovosť ($)</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Odkaz na podklady (Google Drive, Uschovňa, WeTransfer... hocijaký odkaz)</label>
                    <input type="text" value={orderEditDraft.driveLink || ''} onChange={(e) => setOrderEditDraft({ ...orderEditDraft, driveLink: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k celej zákazke</label>
                  <textarea rows={2} value={orderEditDraft.notes || ''} onChange={(e) => setOrderEditDraft({ ...orderEditDraft, notes: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                </div>

                <div className="space-y-3 pt-2 border-t border-amber-900/30">
                  <span className="text-xs font-bold text-amber-300 uppercase block">Položky v zákazke</span>
                  {orderEditDraft.items.map((item, idx) => (
                    <div key={item.itemId} className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-indigo-400 font-bold">#{idx + 1} • {item.itemId}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-bold">{item.productName}</span>
                          <button type="button" onClick={() => handleRemoveDraftItem(item.itemId)} className="p-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Množstvo (ks)</label>
                          {item.materialDeducted ? (
                            <div className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-xs text-slate-500">{item.qty} ks (uzamknuté — materiál už bol odpísaný)</div>
                          ) : (
                            <input type="number" min="1" value={item.qty} onChange={(e) => handleDraftItemQtyChange(item.itemId, e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Poznámka k položke</label>
                          <input type="text" value={item.notes || ''} onChange={(e) => handleDraftItemNotesChange(item.itemId, e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Náhľadový obrázok</label>
                        {item.imageUrl ? (
                          <div className="flex items-center gap-2">
                            <img src={item.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-800" />
                            <button type="button" onClick={() => handleDraftItemImageRemove(item.itemId)} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded text-[10px] font-bold">Odstrániť obrázok</button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-500">
                            <Upload className="h-3.5 w-3.5" /> Nahrať obrázok
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDraftItemImageChange(item.itemId, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}

                  {!showAddItemForm ? (
                    <button type="button" onClick={() => setShowAddItemForm(true)} className="w-full border-2 border-dashed border-indigo-800/50 hover:border-indigo-600 text-indigo-400 font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Pridať novú položku do tejto zákazky</button>
                  ) : (
                    <div className="bg-slate-900 border border-indigo-800/40 rounded-lg p-3 space-y-3">
                      <span className="text-xs font-bold text-indigo-300 uppercase block">Nová položka</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Produkt z katalógu</label>
                          <select value={addItemProductId} onChange={(e) => {
                              setAddItemProductId(e.target.value);
                              const prod = products.find(p => p.id === e.target.value);
                              if (prod) { setAddItemLayer1Mat(prod.layer1?.materialId || ''); setAddItemLayer2Mat(prod.layer2?.materialId || ''); setAddItemLayer3Mat(prod.layer3?.materialId || ''); }
                            }} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                            <option value="">-- Vyber produkt --</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} [{p.customCode}]</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Úroveň vyhotovenia</label>
                          <select value={addItemTierId} onChange={(e) => setAddItemTierId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                            <option value="">-- Vyber --</option>
                            {qualityTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="grid grid-cols-3 gap-1">
                          {['men', 'women', 'children'].map(g => (
                            <button type="button" key={g} onClick={() => setAddItemGender(g)} className={`py-1.5 text-center text-[10px] font-bold rounded ${addItemGender === g ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400'}`}>{genderLabel(g)}</button>
                          ))}
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Množstvo (ks)</label>
                          <input type="number" min="1" value={addItemQty} onChange={(e) => setAddItemQty(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-slate-500 mb-0.5">Poznámka</label>
                          <input type="text" value={addItemNotes} onChange={(e) => setAddItemNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        </div>
                      </div>
                      {(() => {
                        const prod = products.find(p => p.id === addItemProductId);
                        if (!prod) return null;
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {prod.layer1 && (
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">Primárna látka</label>
                                <select value={addItemLayer1Mat} onChange={(e) => setAddItemLayer1Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </div>
                            )}
                            {prod.layer2 && (
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">Sekundárna látka</label>
                                <select value={addItemLayer2Mat} onChange={(e) => setAddItemLayer2Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                                  <option value="">-- Nepoužiť --</option>
                                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </div>
                            )}
                            {prod.layer3 && (
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">Terciárna látka</label>
                                <select value={addItemLayer3Mat} onChange={(e) => setAddItemLayer3Mat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                                  <option value="">-- Nepoužiť --</option>
                                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Výrobné stanice</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                          {STATION_ORDER.map(sid => {
                            const cfg = STATION_CONFIGS[sid];
                            const checked = !!addItemStations[sid];
                            return (
                              <label key={sid} className={`flex items-center gap-1 p-1.5 rounded cursor-pointer text-[10px] font-bold border ${checked ? 'bg-indigo-950/40 border-indigo-600 text-indigo-300' : 'bg-slate-950 border-slate-850 text-slate-400'}`}>
                                <input type="checkbox" checked={checked} onChange={(e) => setAddItemStations({ ...addItemStations, [sid]: e.target.checked })} className="rounded bg-slate-900 border-slate-800 text-indigo-600" />
                                {cfg.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Náhľadový obrázok</label>
                        {addItemImagePreview ? (
                          <div className="flex items-center gap-2">
                            <img src={addItemImagePreview} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-800" />
                            <button type="button" onClick={() => { setAddItemImageFile(null); setAddItemImagePreview(''); }} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded text-[10px] font-bold">Odstrániť</button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-500">
                            <Upload className="h-3.5 w-3.5" /> Nahrať obrázok
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setAddItemImageFile(f); setAddItemImagePreview(URL.createObjectURL(f)); } }} />
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleAddItemToExistingOrder} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs uppercase">Pridať položku</button>
                        <button type="button" onClick={() => setShowAddItemForm(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded text-xs">Zrušiť</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveEditOrder} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> Uložiť zmeny</button>
                  <button onClick={handleCancelEditOrder} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 rounded-lg text-xs font-bold">Zrušiť</button>
                </div>
              </div>
            )}
            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-800 print:bg-white print:text-black print:p-0 print:border-none">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-800 pb-6 print:border-b-2 print:border-black">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-1 rounded print:bg-black print:text-white font-mono">SPRIEVODNÝ LIST VÝROBY</span>
                    <span className="font-mono text-sm font-bold text-slate-400 print:text-black">ID: {selectedOrderDetails.id}</span>
                    <CashBadge paymentType={selectedOrderDetails.paymentType} />
                  </div>
                  <h1 className="text-2xl font-extrabold text-white print:text-black">{selectedOrderDetails.customer}</h1>
                  <p className="text-sm text-slate-400 print:text-black">Vytvorené: <strong className="text-white print:text-black">{selectedOrderDetails.createdAt}</strong> • Termín dodania: <strong className={isUrgentDate(selectedOrderDetails.deliveryDate) ? 'text-rose-400 print:text-black bg-rose-950/50 px-1.5 py-0.5 rounded print:bg-transparent' : 'text-indigo-400 print:text-black'}>{formatDeliveryDate(selectedOrderDetails.deliveryDate)}</strong></p>
                  <p className="text-sm text-slate-400 print:text-black">Platba: <strong className="text-white print:text-black">{selectedOrderDetails.paymentType === 'hotovost' ? 'Hotovosť' : 'Faktúra'}</strong></p>
                  {selectedOrderDetails.notes && <p className="text-sm text-slate-400 print:text-black">Poznámka: <strong className="text-white print:text-black">{selectedOrderDetails.notes}</strong></p>}
                  {selectedOrderDetails.driveLink && (
                    <p className="text-sm text-slate-400 print:text-black">
                      Podklady: <a href={selectedOrderDetails.driveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 print:text-black underline break-all">{selectedOrderDetails.driveLink}</a>
                    </p>
                  )}
                </div>
              </div>

              {selectedOrderDetails.items.map((item, itemIdx) => (
                <div key={item.itemId} className="py-6 border-b border-slate-800 print:border-black space-y-4" style={itemIdx > 0 ? { breakBefore: 'page' } : {}}>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full sm:w-48 h-48 object-cover rounded-xl border border-slate-300 shrink-0 order-first sm:order-none" />
                    ) : (
                      <div className="w-full sm:w-48 h-48 rounded-xl border border-dashed border-slate-700 print:border-slate-400 flex items-center justify-center text-slate-600 print:text-slate-400 text-xs italic shrink-0 order-first sm:order-none">Bez obrázka</div>
                    )}
                    <div className="flex-1">
                      <span className="font-mono text-xs text-indigo-400 font-bold block">Položka #{itemIdx + 1} • {item.itemId}</span>
                      <h2 className="text-lg font-extrabold text-white print:text-black">{item.productName} [{item.customCode}]</h2>
                      <p className="text-sm text-slate-400 print:text-black">Vyhotovenie: <strong className="text-indigo-400 print:text-black uppercase">{item.qualityTier}</strong>{qualityTiers.find(t => t.name === item.qualityTier)?.desc && <span className="text-xs text-slate-500 italic print:text-black"> ({qualityTiers.find(t => t.name === item.qualityTier).desc})</span>} • {genderLabel(item.gender)} • <strong className="text-white print:text-black">{item.qty} ks</strong></p>
                      {item.notes && <p className="text-xs text-slate-400 italic print:text-black mt-1">Poznámka: {item.notes}</p>}
                    </div>
                    <div className="bg-white p-3 rounded-xl flex flex-col items-center border border-slate-300 shadow-sm shrink-0">
                      <QRCodeSVG value={item.itemId} size={88} level="M" />
                      <span className="font-mono text-[9px] text-black font-extrabold mt-1">{item.itemId}</span>
                    </div>
                  </div>

                  <div className="print:hidden space-y-2">
                    <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400">Aktívne dielne & Nastavenie stavu:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {STATION_ORDER.filter(sid => sid in (item.stationStatuses || {})).map(stationId => {
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Táto položka spotrebovala zo skladu:</span>
                      {item.materialsNeeded?.map((n, idx) => {
                        const mat = materials.find(m => m.id === n.materialId);
                        return (<div key={idx} className="bg-slate-950 p-2.5 rounded flex justify-between text-xs print:bg-white print:border print:border-black"><span><strong>{n.layerName}:</strong> {mat?.name} ({mat?.color})</span><span className="font-extrabold">{n.qtyNeeded} {mat?.unit || 'm'}</span></div>);
                      })}
                      {(!item.materialsNeeded || item.materialsNeeded.length === 0) && (
                        <div className="bg-slate-950 p-2.5 rounded text-xs italic text-slate-500 print:bg-white print:border print:border-black">Bez látky (len dotlač)</div>
                      )}
                    </div>
                    <div className="bg-slate-950 p-3 rounded text-xs space-y-1 print:bg-white print:border print:border-black">
                      <div className="flex justify-between"><span>Šijacie nite:</span><strong className="text-white print:text-black">{item.threadQtyM} m</strong></div>
                      <div className="flex justify-between"><span>Odpočet zo skladu:</span><strong className="text-emerald-400 print:text-black">{item.materialDeducted ? 'Vykonaný pri vytvorení zákazky' : 'Bez látky — nič sa neodpočítalo'}</strong></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-center text-xs text-slate-500 print:hidden">
        <p>© 2026 TEX-MASTER ERP Platform v7.0. Všetky práva vyhradené.</p>
      </footer>
    </div>
  );
}
