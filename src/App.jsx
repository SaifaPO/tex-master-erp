import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { encode as encodeBySquare, CurrencyCode, PaymentOptions } from 'bysquare/pay';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ClipboardList, Package, Cpu, QrCode, Plus, User, Clock, Layers, Search, Check, X, Calendar,
  Palette, Scissors, Printer, Sliders, Sparkles, ZoomIn, ZoomOut, FileText, PlusCircle, Table,
  Shield, Users, Lock, Edit2, Trash2, Tag, Scale, CalendarDays, FileEdit, Gift, Loader2, AlertTriangle,
  Shirt, Box, Banknote, GripVertical, Download, Upload, ArrowUp, ArrowDown, BarChart3, Camera, Bot, Zap
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
    { id: 'strihanie', label: 'Strihá & kompletuje sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  transfer: { name: 'Transfer tlač', icon: Layers, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sietotlac: { name: 'Sieťotlač', icon: Palette, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  laser: { name: 'Laser', icon: Cpu, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'rezanie', label: 'Rezanie', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sublimacia: { name: 'Sublimácia', icon: Sparkles, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'tlac', label: 'Tlačí sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  sitie: { name: 'Šitie', icon: Shirt, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
    { id: 'sije', label: 'Šije sa', color: 'bg-sky-600 text-white' },
    { id: 'hotove', label: 'Hotové', color: 'bg-emerald-600 text-white' }
  ]},
  balenie: { name: 'Balenie', icon: Box, statuses: [
    { id: 'neaktivne', label: 'Neaktívne', color: 'bg-slate-700 text-slate-300' },
    { id: 'caka', label: 'Čaká sa', color: 'bg-slate-600 text-slate-200' },
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
const STATION_ORDER = ['grafik', 'strihanie', 'laser', 'sublimacia', 'transfer', 'sietotlac', 'sitie', 'balenie'];

// "Potlač" preset — ide len cez tieto stanice (bez laseru, strihania/kompletáže, sublimácie, šitia)
const PRINT_ONLY_STATIONS = ['grafik', 'transfer', 'sietotlac', 'balenie'];
function buildAllStationsPreset() {
  const obj = {};
  STATION_ORDER.forEach(sid => { obj[sid] = true; });
  return obj;
}
function buildPrintOnlyPreset() {
  const obj = {};
  STATION_ORDER.forEach(sid => { obj[sid] = PRINT_ONLY_STATIONS.includes(sid); });
  return obj;
}

// Zistí, či aktuálny výber staníc presne zodpovedá danému presetu (Výroba/Len potlač), aby sa dalo správne zvýrazniť tlačidlo
function matchesStationPreset(current, preset) {
  return STATION_ORDER.every(sid => !!current[sid] === !!preset[sid]);
}

// Bežná paleta farieb textilu pre rýchly výber pri zaraďovaní do skladu
// Emotikony na výber profilu zamestnanca (podobne ako v messenger appkách)
const AVATAR_EMOJI_OPTIONS = [
  '😀', '😎', '🤓', '🧑‍🎨', '👨‍🎨', '👩‍🎨', '🦸', '🦸‍♀️', '🧙', '🧑‍🔧', '👨‍🔧', '👩‍🔧',
  '🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🐺', '🦉', '🐸', '🐵',
  '🔥', '⚡', '🚀', '🎯', '⭐', '💪', '🎨', '✂️', '🧵', '📦', '🖨️', '🧢'
];

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
  manage_catalog: { master: true, supervisor: true, sales: false, employee: false },
  view_reports: { master: true, supervisor: true, sales: false, employee: false }
};

const mapMaterialFromDb = (r) => ({ id: r.id, name: r.name, color: r.color, colorHex: r.color_hex || '', width: r.width, weight: r.weight, pricePerM: r.price_per_m, qty: r.qty, unit: r.unit, minQty: r.min_qty, warehouseId: r.warehouse_id || 'sklad-1', manufacturer: r.manufacturer || '', productType: r.product_type || '', deliveryNoteNumber: r.delivery_note_number || '', deliveryNoteDate: r.delivery_note_date || '', history: r.history || [] });
const mapMaterialToDb = (m) => ({ id: m.id, name: m.name, color: m.color, color_hex: m.colorHex || null, width: m.width, weight: m.weight, price_per_m: m.pricePerM, qty: m.qty, unit: m.unit, min_qty: m.minQty, warehouse_id: m.warehouseId, manufacturer: m.manufacturer || null, product_type: m.productType || null, delivery_note_number: m.deliveryNoteNumber || null, delivery_note_date: m.deliveryNoteDate || null, history: m.history });

const mapProductFromDb = (r) => ({ id: r.id, customCode: r.custom_code, name: r.name, sports: r.sports || [], layer1: r.layer1, layer2: r.layer2, layer3: r.layer3, threadM: r.thread_m, womenRatioPercent: r.women_ratio_percent ?? 90, childrenRatioPercent: r.children_ratio_percent ?? 65 });
const mapProductToDb = (p) => ({ id: p.id, custom_code: p.customCode, name: p.name, sports: p.sports, layer1: p.layer1, layer2: p.layer2, layer3: p.layer3, thread_m: p.threadM, women_ratio_percent: p.womenRatioPercent, children_ratio_percent: p.childrenRatioPercent });

const mapTierFromDb = (r) => ({ id: r.id, name: r.name, fit: r.fit, ventilation: r.ventilation, desc: r.description });
const mapTierToDb = (t) => ({ id: t.id, name: t.name, fit: t.fit, ventilation: t.ventilation, description: t.desc });

const mapEmployeeFromDb = (r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, birthday: r.birthday, nameday: r.nameday, entryDate: r.entry_date, role: r.role, position: r.position, passwordHash: r.password_hash || '', phone: r.phone || '', email: r.email || '', avatar: r.avatar || '', pinHash: r.pin_hash || '', authUserId: r.auth_user_id || '' });
const mapEmployeeToDb = (e) => ({ id: e.id, first_name: e.firstName, last_name: e.lastName, birthday: e.birthday, nameday: e.nameday, entry_date: e.entryDate, role: e.role, position: e.position, password_hash: e.passwordHash || null, phone: e.phone || null, email: e.email || null, avatar: e.avatar || null, pin_hash: e.pinHash || null, auth_user_id: e.authUserId || null });

const mapOrderFromDb = (r) => ({ id: r.id, customer: r.customer, createdAt: r.created_at, deliveryDate: r.scheduled_day, driveLink: r.drive_link, notes: r.notes, paymentType: r.payment_type || 'faktura', items: r.items || [], orderLog: r.order_log || [], legacyOrderNumber: r.legacy_order_number || '', companyBrand: r.company_brand || 'ATAK', orderNumber: r.order_number || '', accountingStatus: r.accounting_status || null });
const mapOrderToDb = (o) => ({ id: o.id, customer: o.customer, created_at: o.createdAt, scheduled_day: o.deliveryDate, drive_link: o.driveLink, notes: o.notes, payment_type: o.paymentType, items: o.items, order_log: o.orderLog || [], legacy_order_number: o.legacyOrderNumber || null, company_brand: o.companyBrand || 'ATAK', order_number: o.orderNumber || null, accounting_status: o.accountingStatus || null });

function applyRealtimeChange(setter, payload, mapFn, keyField = 'id') {
  setter(prev => {
    if (payload.eventType === 'DELETE') {
      const deletedKey = mapFn(payload.old)[keyField];
      return prev.filter(x => x[keyField] !== deletedKey);
    }
    const mapped = mapFn(payload.new);
    const exists = prev.some(x => x[keyField] === mapped[keyField]);
    return exists ? prev.map(x => (x[keyField] === mapped[keyField] ? mapped : x)) : [...prev, mapped];
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

// --- TOTP (RFC 6238) — dvojfaktorové overenie kompatibilné s Google Authenticator / Authy / Microsoft Authenticator ---
// Implementované priamo cez vstavané Web Crypto API prehliadača, žiadna externá knižnica.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateBase32Secret(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let secret = '';
  for (let i = 0; i < length; i++) secret += BASE32_ALPHABET[array[i] % 32];
  return secret;
}

function base32ToBytes(base32) {
  const clean = base32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return new Uint8Array(bytes);
}

async function generateTotpCode(secretBase32, timeOffsetSteps = 0) {
  const keyBytes = base32ToBytes(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30) + timeOffsetSteps;
  const counterBuf = new ArrayBuffer(8);
  new DataView(counterBuf).setUint32(4, counter, false);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuf));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (binCode % 1000000).toString().padStart(6, '0');
}

async function verifyTotpCode(enteredCode, secretBase32) {
  const clean = enteredCode.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  // Toleruje +/- 30 sekúnd posun hodín na telefóne
  for (let offset = -1; offset <= 1; offset++) {
    if ((await generateTotpCode(secretBase32, offset)) === clean) return true;
  }
  return false;
}

function buildOtpAuthUri(secretBase32, accountLabel) {
  const issuer = 'TEX-MASTER ERP';
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function flattenOrderItems(ordersList) {
  const flat = [];
  ordersList.forEach(order => {
    (order.items || []).forEach(item => {
      flat.push({ ...item, orderId: order.id, orderNumber: order.orderNumber, companyBrand: order.companyBrand, customer: order.customer, deliveryDate: order.deliveryDate, productionDate: item.productionDate || order.deliveryDate, createdAt: order.createdAt, driveLink: order.driveLink, orderNotes: order.notes, paymentType: order.paymentType });
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

// Parsuje formát "YYYY-MM-DD HH:MM" (getFormattedDateTime) späť na Date objekt
function parseFormattedDateTime(str) {
  if (!str) return null;
  const [datePart, timePart] = str.split(' ');
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function formatDurationMinutes(mins) {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${m} min`;
}

// Vráti pole 7 dátumov (YYYY-MM-DD) pre týždeň (Po-Ne), ktorý obsahuje daný dátum. weekOffset posúva o celé týždne.
function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = pondelok
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const WEEKDAY_LABELS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa'];

const mapCostRateFromDb = (r) => ({ stationId: r.station_id, rate: r.rate, unit: r.unit || '', note: r.note || '' });
const mapAssignmentFromDb = (r) => ({ id: r.id, employeeId: r.employee_id, stationId: r.station_id, date: r.assignment_date });
const mapProblemFromDb = (r) => ({ id: r.id, orderId: r.order_id, itemId: r.item_id, stationId: r.station_id, employeeId: r.employee_id, employeeName: r.employee_name, category: r.category, description: r.description, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at, resolvedBy: r.resolved_by, resolutionNote: r.resolution_note });

const mapCompanySettingsFromDb = (r) => ({ companyName: r.company_name || '', address: r.address || '', ico: r.ico || '', dic: r.dic || '', icDph: r.ic_dph || '', iban: r.iban || '', bankName: r.bank_name || '', defaultVatRate: r.default_vat_rate ?? 20, nextInvoiceNumber: r.next_invoice_number ?? 1, invoiceNumberPrefix: r.invoice_number_prefix || '', nextPpdNumber: r.next_ppd_number ?? 1, nextVpdNumber: r.next_vpd_number ?? 1 });
const mapInvoiceFromDb = (r) => ({ id: r.id, invoiceNumber: r.invoice_number, orderId: r.order_id, customerName: r.customer_name || '', customerAddress: r.customer_address || '', customerIco: r.customer_ico || '', customerDic: r.customer_dic || '', customerIcDph: r.customer_ic_dph || '', issueDate: r.issue_date, deliveryDate: r.delivery_date, dueDate: r.due_date, variableSymbol: r.variable_symbol || '', items: r.items || [], subtotal: r.subtotal || 0, vatTotal: r.vat_total || 0, total: r.total || 0, status: r.status, paidAt: r.paid_at, notes: r.notes || '', createdBy: r.created_by || '', createdAt: r.created_at, corrections: r.corrections || [], customerType: r.customer_type || 'sk_platca' });
const mapInvoiceToDb = (inv) => ({ id: inv.id, invoice_number: inv.invoiceNumber, order_id: inv.orderId || null, customer_name: inv.customerName, customer_address: inv.customerAddress, customer_ico: inv.customerIco, customer_dic: inv.customerDic, customer_ic_dph: inv.customerIcDph, issue_date: inv.issueDate, delivery_date: inv.deliveryDate, due_date: inv.dueDate, variable_symbol: inv.variableSymbol, items: inv.items, subtotal: inv.subtotal, vat_total: inv.vatTotal, total: inv.total, status: inv.status, notes: inv.notes, created_by: inv.createdBy, corrections: inv.corrections || [], customer_type: inv.customerType || 'sk_platca' });

const PROBLEM_CATEGORIES = ['Chýba materiál', 'Chyba vo výrobe/tlači', 'Poškodený materiál', 'Nesúhlasí rozmer/farba', 'Porucha stroja', 'Iné'];

const BLANK_GOODS_TYPES = ['Tričko', 'Polokošeľa', 'Mikina', 'Tepláky', 'Šiltovka', 'Ponožky', 'Vlajka', 'Iné'];

const SK_MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

// Slovenský meninový kalendár (bežné mená) — pre automatický návrh menín podľa krstného mena
const SK_NAMEDAY_CALENDAR = {
  'Alžbeta': '5. Marec', 'Kazimír': '4. Marec', 'Bohumil': '9. Marec', 'Gregor': '12. Marec', 'Vladimír': '15. Marec', 'Jozef': '19. Marec', 'Marián': '22. Marec',
  'Miroslava': '23. Marec', 'Kvetoslava': '27. Marec', 'Ľudovít': '29. Marec', 'Hugo': '1. Apríl', 'Richard': '3. Apríl', 'Irena': '5. Apríl', 'Miroslav': '7. Apríl',
  'Ctibor': '9. Apríl', 'Július': '12. Apríl', 'Justína': '14. Apríl', 'Rudolf': '17. Apríl', 'Jela': '20. Apríl', 'Ervín': '23. Apríl', 'Juraj': '24. Apríl',
  'Marek': '25. Apríl', 'Jaroslava': '26. Apríl', 'Anastázia': '28. Apríl', 'Zita': '27. Apríl', 'Filip': '1. Máj', 'Žigmund': '2. Máj', 'Galina': '3. Máj',
  'Florián': '4. Máj', 'Lesana': '5. Máj', 'Hermína': '6. Máj', 'Monika': '7. Máj', 'Ida': '8. Máj', 'Roland': '9. Máj', 'Viktória': '10. Máj', 'Blažena': '11. Máj',
  'Pankrác': '12. Máj', 'Servác': '13. Máj', 'Bonifác': '14. Máj', 'Žofia': '15. Máj', 'Svetlana': '16. Máj', 'Gizela': '17. Máj', 'Viola': '18. Máj', 'Gertrúda': '19. Máj',
  'Bernard': '20. Máj', 'Zina': '21. Máj', 'Júlia': '22. Máj', 'Želmíra': '23. Máj', 'Ela': '24. Máj', 'Urban': '25. Máj', 'Dušan': '26. Máj', 'Iveta': '27. Máj',
  'Viliam': '28. Máj', 'Vilma': '28. Máj', 'Petra': '29. Máj', 'Ferdinand': '30. Máj', 'Petronela': '31. Máj', 'Žaneta': '1. Jún', 'Xénia': '2. Jún', 'Karolína': '3. Jún',
  'Laura': '4. Jún', 'Laura': '4. Jún', 'Norbert': '6. Jún', 'Róbert': '7. Jún', 'Medard': '8. Jún', 'Stanislava': '9. Jún', 'Margaréta': '10. Jún', 'Dobroslava': '11. Jún',
  'Zlatko': '12. Jún', 'Anton': '13. Jún', 'Vasil': '14. Jún', 'Vít': '15. Jún', 'Blanka': '16. Jún', 'Adolf': '17. Jún', 'Vratislav': '18. Jún', 'Alfréd': '19. Jún',
  'Valéria': '20. Jún', 'Alojz': '21. Jún', 'Paulína': '22. Jún', 'Sidónia': '23. Jún', 'Ján': '24. Jún', 'Tadeáš': '25. Jún', 'Adriána': '26. Jún', 'Ladislav': '27. Jún',
  'Beáta': '28. Jún', 'Peter': '29. Jún', 'Pavol': '29. Jún', 'Melánia': '30. Jún', 'Diana': '1. Júl', 'Berta': '2. Júl', 'Miloslav': '3. Júl', 'Prokop': '4. Júl',
  'Cyril': '5. Júl', 'Metod': '5. Júl', 'Patrik': '6. Júl', 'Oliver': '7. Júl', 'Ivan': '8. Júl', 'Lujza': '9. Júl', 'Amália': '10. Júl', 'Milota': '11. Júl',
  'Nina': '12. Júl', 'Margita': '13. Júl', 'Kamil': '14. Júl', 'Henrich': '15. Júl', 'Drahomíra': '16. Júl', 'Bohuslav': '17. Júl', 'Kamila': '18. Júl', 'Dušana': '19. Júl',
  'Iľja': '20. Júl', 'Daniel': '21. Júl', 'Magdaléna': '22. Júl', 'Oľga': '23. Júl', 'Vladmíra': '24. Júl', 'Jakub': '25. Júl', 'Anna': '26. Júl', 'Božena': '27. Júl',
  'Krištof': '28. Júl', 'Marta': '29. Júl', 'Libuša': '30. Júl', 'Ignác': '31. Júl', 'Gustáv': '1. August', 'Vasilisa': '2. August', 'Jerguš': '3. August',
  'Dominik': '4. August', 'Hortenzia': '5. August', 'Oskar': '6. August', 'Štefánia': '7. August', 'Oswald': '8. August', 'Ľubomíra': '9. August', 'Vavrinec': '10. August',
  'Zuzana': '11. August', 'Darina': '12. August', 'Ľubomír': '13. August', 'Mojmír': '14. August', 'Marcela': '15. August', 'Leonard': '16. August', 'Milica': '17. August',
  'Elena': '18. August', 'Lýdia': '19. August', 'Anabela': '20. August', 'Jana': '21. August', 'Tichomír': '22. August', 'Filip': '23. August', 'Bartolomej': '24. August',
  'Ľudovít': '25. August', 'Samuel': '26. August', 'Silvia': '27. August', 'Augustín': '28. August', 'Nikola': '29. August', 'Ružena': '30. August', 'Nora': '31. August',
  'Drahoslava': '1. September', 'Linda': '2. September', 'Belo': '3. September', 'Rozália': '4. September', 'Regína': '5. September', 'Alica': '6. September', 'Marianna': '7. September',
  'Miriam': '8. September', 'Martina': '9. September', 'Oleg': '10. September', 'Bystrík': '11. September', 'Mária': '12. September', 'Ctibor': '13. September', 'Ľudomil': '14. September',
  'Jolana': '15. September', 'Ľudmila': '16. September', 'Olympia': '17. September', 'Eugénia': '18. September', 'Konštantín': '19. September', 'Ľuboslava': '20. September',
  'Matúš': '21. September', 'Móric': '22. September', 'Zdenka': '23. September', 'Ľuboš': '24. September', 'Vladislav': '25. September', 'Edita': '26. September', 'Cyprián': '27. September',
  'Václav': '28. September', 'Michal': '29. September', 'Jarolím': '30. September', 'Arnold': '1. Október', 'Levoslav': '2. Október', 'Stela': '3. Október', 'František': '4. Október',
  'Viera': '5. Október', 'Natália': '6. Október', 'Eliška': '7. Október', 'Brigita': '8. Október', 'Dionýz': '9. Október', 'Slavomíra': '10. Október', 'Valentína': '11. Október',
  'Maximilián': '12. Október', 'Koloman': '13. Október', 'Boris': '14. Október', 'Terézia': '15. Október', 'Vladimíra': '16. Október', 'Hedviga': '17. Október', 'Lukáš': '18. Október',
  'Kristián': '19. Október', 'Vendelín': '20. Október', 'Uršuľa': '21. Október', 'Sergej': '22. Október', 'Alojzia': '23. Október', 'Kvetoslav': '24. Október', 'Aurel': '25. Október',
  'Demeter': '26. Október', 'Sabína': '27. Október', 'Dobromila': '28. Október', 'Klára': '29. Október', 'Simona': '30. Október', 'Sergej': '31. Október', 'Denisa': '1. November',
  'Pribina': '2. November', 'Hubert': '3. November', 'Karol': '4. November', 'Imrich': '5. November', 'Renáta': '6. November', 'René': '7. November', 'Bohumír': '8. November',
  'Teodor': '9. November', 'Tibor': '10. November', 'Martin': '11. November', 'Svätopluk': '12. November', 'Stanislav': '13. November', 'Irma': '14. November', 'Leopold': '15. November',
  'Agnesa': '16. November', 'Klaudia': '17. November', 'Eugen': '18. November', 'Alžbeta': '19. November', 'Félix': '20. November', 'Elvíra': '21. November', 'Cecília': '22. November',
  'Klement': '23. November', 'Emília': '24. November', 'Katarína': '25. November', 'Kornel': '26. November', 'Milan': '27. November', 'Henrieta': '28. November', 'Vratko': '29. November',
  'Ondrej': '30. November', 'Edmund': '1. December', 'Bibiána': '2. December', 'Oldrich': '3. December', 'Barbora': '4. December', 'Oto': '5. December', 'Mikuláš': '6. December',
  'Ambróz': '7. December', 'Marína': '8. December', 'Izabela': '9. December', 'Radúz': '10. December', 'Hilda': '11. December', 'Otília': '12. December', 'Lucia': '13. December',
  'Branislava': '14. December', 'Ivica': '15. December', 'Albína': '16. December', 'Kornélia': '17. December', 'Sláva': '18. December', 'Judita': '19. December', 'Dagmara': '20. December',
  'Bohdana': '21. December', 'Adela': '22. December', 'Nadežda': '23. December', 'Adam': '24. December', 'Eva': '24. December', 'Silvester': '31. December',
};

function suggestNameday(firstName) {
  if (!firstName) return '';
  const key = firstName.trim();
  return SK_NAMEDAY_CALENDAR[key] || '';
}

// Pípnutie cez Web Audio API — bez potreby zvukového súboru
function playAlertBeep(times = 1, freq = 880) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
      t += 0.38;
    }
  } catch (e) { /* Web Audio nedostupné (napr. veľmi starý prehliadač) */ }
}

function showDesktopNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/logo-atak-pbt.png' }); } catch (e) { /* ignorovať */ }
  }
}

// Spoľahlivé stiahnutie súboru (Save As) — bežný <a href> odkaz na cudziu doménu (Supabase Storage)
// vie prehliadač namiesto stiahnutia len otvoriť, preto súbor stiahneme cez fetch a spustíme download z blobu.
async function downloadFile(url, filename, onError) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Súbor sa nepodarilo načítať.');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'subor';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    if (onError) onError(e);
    else window.open(url, '_blank');
  }
}

// Vytlačiť / uložiť ako PDF s navrhovaným názvom súboru podľa čísla zákazky/faktúry
// (väčšina prehliadačov — najmä Chrome/Edge — použije aktuálny document.title ako predvyplnený názov v dialógu "Uložiť ako PDF")
function printWithFilename(suggestedName) {
  const originalTitle = document.title;
  const safeName = (suggestedName || 'dokument').replace(/[\\/:*?"<>|]/g, '-');
  document.title = safeName;
  const restoreTitle = () => { document.title = originalTitle; window.removeEventListener('afterprint', restoreTitle); };
  window.addEventListener('afterprint', restoreTitle);
  window.print();
  setTimeout(restoreTitle, 3000); // záložné obnovenie, keby prehliadač nevyvolal afterprint
}

const mapMismatchFromDb = (r) => ({ id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, stationId: r.station_id, date: r.assignment_date, createdAt: r.created_at });

const mapBankTxFromDb = (r) => ({ id: r.id, date: r.tx_date, sender: r.sender || '', amount: r.amount || 0, variableSymbol: r.variable_symbol || '', matched: !!r.matched, invoiceId: r.invoice_id || null, importedAt: r.imported_at });
const mapJournalFromDb = (r) => ({ id: r.id, date: r.entry_date, description: r.description, mdAccount: r.md_account, dalAccount: r.dal_account, amount: r.amount || 0, invoiceId: r.invoice_id || null, createdAt: r.created_at });

const mapTaxDeadlineFromDb = (r) => ({ id: r.id, title: r.title, dueDate: r.due_date, note: r.note || '', createdBy: r.created_by || '' });
const mapCashDocFromDb = (r) => ({ id: r.id, docNumber: r.doc_number, docType: r.doc_type, date: r.doc_date, description: r.description || '', amount: r.amount || 0, category: r.category || '', createdBy: r.created_by || '', createdAt: r.created_at });

// Zákazka je "kompletne hotová" ak je hotová každá aktívna stanica na každej položke
// Dátum výroby pre konkrétnu stanicu — každá stanica môže mať iný deň (napr. strihanie v pondelok, potlač v utorok)
function getItemStationDate(item, stationId) {
  return item.stationDates?.[stationId] || item.productionDate || item.deliveryDate;
}

// Kedy položka "prišla" (prvé naskenovanie/rozbehnutie akejkoľvek stanice) a "odišla" (dokončenie poslednej aktívnej stanice)
function getArrivalDeparture(item) {
  const metaEntries = Object.entries(item.stationMeta || {}).filter(([sid]) => item.stationStatuses?.[sid] && item.stationStatuses[sid] !== 'neaktivne');
  let arrival = null;
  metaEntries.forEach(([, meta]) => {
    if (meta.startedAt && (!arrival || meta.startedAt < arrival.at)) arrival = { at: meta.startedAt, by: meta.assignedEmployeeName };
  });
  const allDone = metaEntries.length > 0 && Object.entries(item.stationStatuses).filter(([sid]) => item.stationStatuses[sid] && item.stationStatuses[sid] !== 'neaktivne').every(([, v]) => v === 'hotove');
  let departure = null;
  if (allDone) {
    metaEntries.forEach(([, meta]) => {
      if (meta.completedAt && (!departure || meta.completedAt > departure.at)) departure = { at: meta.completedAt, by: meta.assignedEmployeeName };
    });
  }
  return { arrival, departure };
}

const mapCapacityConfigFromDb = (r) => ({ stationId: r.station_id, mode: r.mode || 'per_product', rateValue: r.rate_value ?? null, dailyMinutes: r.daily_minutes ?? 480, machineCount: r.machine_count ?? 1 });
const mapProductTimeFromDb = (r) => ({ id: r.id, stationId: r.station_id, label: r.label, minutesPerUnit: r.minutes_per_unit, unit: r.unit || 'ks' });

// Stanice, ktoré majú jednoduchú sadzbu (m/hod alebo ks/min) namiesto tabuľky produktov
const RATE_BASED_STATIONS = ['sublimacia', 'sietotlac'];

// Odhad, koľko minút zaberie táto položka na danej stanici, podľa nastavenej kapacity
function estimateItemStationMinutes(item, stationId, capacityByStation, productTimesByStation) {
  const cfg = capacityByStation[stationId];
  if (!cfg) return 0;
  if (RATE_BASED_STATIONS.includes(stationId)) {
    if (!cfg.rateValue || cfg.rateValue <= 0) return 0;
    if (stationId === 'sublimacia') {
      const meters = (item.materialsNeeded || []).reduce((s, m) => s + (m.qtyNeeded || 0), 0);
      return (meters / cfg.rateValue) * 60; // m/hod -> minúty
    }
    if (stationId === 'sietotlac') {
      return item.qty / cfg.rateValue; // ks/min
    }
    return 0;
  }
  const entries = productTimesByStation[stationId] || [];
  if (entries.length === 0) return 0;
  const nameLower = (item.productName || '').toLowerCase();
  const match = entries.find(t => nameLower.includes(t.label.toLowerCase()) || t.label.toLowerCase().includes(nameLower));
  const perUnit = match ? match.minutesPerUnit : (entries.reduce((s, t) => s + t.minutesPerUnit, 0) / entries.length);
  return perUnit * item.qty;
}

// Vyťaženie stanice v daný deň (súčet minút / dostupná kapacita) v percentách
function computeStationLoad(date, stationId, allItems, capacityByStation, productTimesByStation) {
  const cfg = capacityByStation[stationId];
  if (!cfg) return null;
  const dayItems = allItems.filter(it => getItemStationDate(it, stationId) === date && it.stationStatuses?.[stationId] && it.stationStatuses[stationId] !== 'neaktivne' && it.stationStatuses[stationId] !== 'hotove');
  const usedMinutes = dayItems.reduce((s, it) => s + estimateItemStationMinutes(it, stationId, capacityByStation, productTimesByStation), 0);
  const capacityMinutes = (cfg.dailyMinutes || 480) * (cfg.machineCount || 1);
  const percent = capacityMinutes > 0 ? (usedMinutes / capacityMinutes) * 100 : 0;
  return { usedMinutes, capacityMinutes, percent };
}

function loadBarColor(percent) {
  if (percent >= 100) return 'bg-rose-600';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-600';
}

function companyBrandBadgeClass(brand, variant = 'soft') {
  const map = {
    PBT: { soft: 'bg-purple-950/50 text-purple-300', solid: 'bg-purple-600 text-white' },
    ADY: { soft: 'bg-amber-950/50 text-amber-300', solid: 'bg-amber-600 text-white' },
    ATAK: { soft: 'bg-emerald-950/50 text-emerald-300', solid: 'bg-emerald-600 text-white' },
  };
  return (map[brand] || map.ATAK)[variant];
}

function isOrderFullyComplete(order) {
  if (!order.items || order.items.length === 0) return false;
  return order.items.every(item => {
    const entries = Object.values(item.stationStatuses || {});
    return entries.length > 0 && entries.every(v => v === 'hotove');
  });
}

// Zisti, či navrhovaná spotreba materiálu (needList) prekračuje dostupnú zásobu na sklade,
// alebo by po odpočítaní zostalo menej než minimálne množstvo (na tesno — treba doobjednať).
// reservedMap = koľko z daného materiálu už "rezervujú" ostatné rozpracované položky v tej istej zákazke.
function computeStockWarnings(neededList, materialsList, reservedMap = {}) {
  const warnings = [];
  (neededList || []).forEach(needed => {
    if (!needed.materialId) return;
    const mat = materialsList.find(m => m.id === needed.materialId);
    if (!mat) return;
    const alreadyReserved = reservedMap[needed.materialId] || 0;
    const availableNow = mat.qty - alreadyReserved;
    const afterThisItem = parseFloat((availableNow - needed.qtyNeeded).toFixed(2));
    if (afterThisItem < 0) {
      warnings.push({ materialId: mat.id, name: `${mat.name} (${mat.color})`, unit: mat.unit, needed: needed.qtyNeeded, available: availableNow, status: 'insufficient', shortBy: Math.abs(afterThisItem) });
    } else if (afterThisItem <= (mat.minQty || 0)) {
      warnings.push({ materialId: mat.id, name: `${mat.name} (${mat.color})`, unit: mat.unit, needed: needed.qtyNeeded, available: availableNow, status: 'low', remaining: afterThisItem });
    }
  });
  return warnings;
}

const mapCostRateToDb = (r) => ({ station_id: r.stationId, rate: r.rate, unit: r.unit, note: r.note });

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [costRates, setCostRates] = useState([]);
  const [stationAssignments, setStationAssignments] = useState([]);
  const [loginMismatches, setLoginMismatches] = useState([]);
  const [problemReports, setProblemReports] = useState([]);
  const [reportingProblemForItem, setReportingProblemForItem] = useState(null); // item object | null
  const [problemCategory, setProblemCategory] = useState(PROBLEM_CATEGORIES[0]);
  const [problemDescription, setProblemDescription] = useState('');
  const [showResolvedProblems, setShowResolvedProblems] = useState(false);
  const [resolvingProblem, setResolvingProblem] = useState(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');
  const [companySettings, setCompanySettings] = useState({ companyName: '', address: '', ico: '', dic: '', icDph: '', iban: '', bankName: '', defaultVatRate: 20, nextInvoiceNumber: 1, invoiceNumberPrefix: '' });
  const [companySettingsDraft, setCompanySettingsDraft] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState(null);
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false);
  const [newInvoiceOrderId, setNewInvoiceOrderId] = useState('');
  const [newInvoiceCustomerName, setNewInvoiceCustomerName] = useState('');
  const [newInvoiceCustomerAddress, setNewInvoiceCustomerAddress] = useState('');
  const [newInvoiceCustomerIco, setNewInvoiceCustomerIco] = useState('');
  const [newInvoiceCustomerDic, setNewInvoiceCustomerDic] = useState('');
  const [newInvoiceCustomerIcDph, setNewInvoiceCustomerIcDph] = useState('');
  const [newInvoiceCustomerType, setNewInvoiceCustomerType] = useState('sk_platca');
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('');
  const [newInvoiceNotes, setNewInvoiceNotes] = useState('');
  const [newInvoiceItems, setNewInvoiceItems] = useState([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [bankTransactions, setBankTransactions] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [isImportingBankStatement, setIsImportingBankStatement] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [aiChat, setAiChat] = useState([{ sender: 'bot', text: 'Ahoj! Som tvoj AI účtovný asistent. Mám prístup k tvojim aktuálnym faktúram a platbám. S čím ti dnes pomôžem?' }]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [financeSubTab, setFinanceSubTab] = useState('overview');
  const [taxDeadlines, setTaxDeadlines] = useState([]);
  const [newDeadlineTitle, setNewDeadlineTitle] = useState('');
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [newDeadlineNote, setNewDeadlineNote] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [cashDocuments, setCashDocuments] = useState([]);
  const [showCashDocForm, setShowCashDocForm] = useState(false);
  const [newCashDocType, setNewCashDocType] = useState('prijem');
  const [newCashDocDate, setNewCashDocDate] = useState('');
  const [newCashDocDescription, setNewCashDocDescription] = useState('');
  const [newCashDocAmount, setNewCashDocAmount] = useState('');
  const [newCashDocCategory, setNewCashDocCategory] = useState('');
  const [correctingInvoice, setCorrectingInvoice] = useState(null);
  const [correctionDraft, setCorrectionDraft] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [manualMatchingTx, setManualMatchingTx] = useState(null);
  const [showDeliveryNoteScanner, setShowDeliveryNoteScanner] = useState(false);
  const [deliveryNoteImageFile, setDeliveryNoteImageFile] = useState(null);
  const [deliveryNoteImagePreview, setDeliveryNoteImagePreview] = useState('');
  const [isParsingDeliveryNote, setIsParsingDeliveryNote] = useState(false);
  const [parsedDeliveryItems, setParsedDeliveryItems] = useState([]);
  const [deliveryNoteError, setDeliveryNoteError] = useState('');
  const [deliveryNoteWarehouseId, setDeliveryNoteWarehouseId] = useState('');
  const [isImportingDeliveryItems, setIsImportingDeliveryItems] = useState(false);
  const [newMatProductType, setNewMatProductType] = useState('');
  const [newMatDeliveryNumber, setNewMatDeliveryNumber] = useState('');
  const [newMatDeliveryDate, setNewMatDeliveryDate] = useState('');
  const [staffingWeekOffset, setStaffingWeekOffset] = useState(0);
  const [staffingPickerCell, setStaffingPickerCell] = useState(null); // { date, stationId } | null
  const [recentlyMovedItemId, setRecentlyMovedItemId] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('month');
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
  const [pendingScanCode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('scan'); } catch { return null; }
  });
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [stationLoginParam] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('station'); } catch { return null; }
  });
  const stationQrGridRef = useRef(null);
  const [activeStationContext, setActiveStationContext] = useState(null);
  const [pinDigits, setPinDigits] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState(null);
  const [pinLockCountdown, setPinLockCountdown] = useState(0);
  const [newEmpPin, setNewEmpPin] = useState('');
  const [editEmpPin, setEditEmpPin] = useState('');
  const html5QrCodeRef = useRef(null);
  const [loginSelectedId, setLoginSelectedId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStep, setLoginStep] = useState('credentials');
  const [pendingTotpEmployee, setPendingTotpEmployee] = useState(null);
  const [loginTotpCode, setLoginTotpCode] = useState('');
  const [loginTotpError, setLoginTotpError] = useState('');
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupCode, setTotpSetupCode] = useState('');
  const [totpSetupError, setTotpSetupError] = useState('');
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  // --- Supabase Auth (Master/Supervisor/Obchodník) ---
  const [authScreenMode, setAuthScreenMode] = useState('login'); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSignupPassword2, setAuthSignupPassword2] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authSession, setAuthSession] = useState(null);
  const [mfaStep, setMfaStep] = useState(null); // null | { factorId, challengeId }
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [enrolledMfaFactor, setEnrolledMfaFactor] = useState(null);
  const [mfaEnrollData, setMfaEnrollData] = useState(null);
  const [mfaEnrollCode, setMfaEnrollCode] = useState('');
  const [mfaEnrollError, setMfaEnrollError] = useState('');
  const [showMasterSwitcher, setShowMasterSwitcher] = useState(false);
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');

  const [rowSearch, setRowSearch] = useState('');
  const [rowDateFilter, setRowDateFilter] = useState('vsetko');
  const [draggedRowItem, setDraggedRowItem] = useState(null);
  const [draggedMatrixCard, setDraggedMatrixCard] = useState(null);
  const [dragOverMatrixCell, setDragOverMatrixCell] = useState(null); // { date, stationId } | null
  const [showExpressDotlackovka, setShowExpressDotlackovka] = useState(false);
  const [expressCustomerName, setExpressCustomerName] = useState('');
  const [expressNeededDate, setExpressNeededDate] = useState('');
  const [expressCreatedBy, setExpressCreatedBy] = useState('');
  const [expressPaymentType, setExpressPaymentType] = useState('faktura');
  const [expressListokFile, setExpressListokFile] = useState(null);
  const [expressListokPreview, setExpressListokPreview] = useState('');
  const [expressTovarFile, setExpressTovarFile] = useState(null);
  const [expressTovarPreview, setExpressTovarPreview] = useState('');
  const [isSubmittingExpress, setIsSubmittingExpress] = useState(false);
  const [capacityConfigs, setCapacityConfigs] = useState([]);
  const [stationProductTimes, setStationProductTimes] = useState([]);
  const [showCapacitySettings, setShowCapacitySettings] = useState(false);
  const [capacityDraft, setCapacityDraft] = useState(null);
  const [productTimesDraft, setProductTimesDraft] = useState(null);
  const [newProductTimeLabel, setNewProductTimeLabel] = useState({});
  const [newProductTimeMinutes, setNewProductTimeMinutes] = useState({});
  const [showCapacityBars, setShowCapacityBars] = useState(true);

  const [catalogSportFilter, setCatalogSportFilter] = useState('vsetko');

  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [newOrderPaymentType, setNewOrderPaymentType] = useState('faktura');
  const [orderDriveLink, setOrderDriveLink] = useState('https://drive.google.com/');
  const [newOrderLegacyNumber, setNewOrderLegacyNumber] = useState('');
  const [newOrderCompany, setNewOrderCompany] = useState('ATAK');
  const [newOrderLogEntry, setNewOrderLogEntry] = useState('');
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQualityTier, setSelectedProductTier] = useState(null);
  const [selectedGender, setSelectedGender] = useState('men');
  const [itemQty, setItemQty] = useState(10);
  const [selectedLayer1Mat, setSelectedLayer1Mat] = useState('');
  const [selectedLayer2Mat, setSelectedLayer2Mat] = useState('');
  const [selectedLayer3Mat, setSelectedLayer3Mat] = useState('');
  const [selectedStations, setSelectedStations] = useState(buildAllStationsPreset());
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemImageFile, setItemImageFile] = useState(null);
  const [itemImagePreview, setItemImagePreview] = useState('');
  const [isUploadingItemImage, setIsUploadingItemImage] = useState(false);
  const [itemRozpisFile, setItemRozpisFile] = useState(null);

  const [pendingItems, setPendingItems] = useState([]);

  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState(null);
  const [isEditingMaterialDetails, setIsEditingMaterialDetails] = useState(false);
  const [materialEditDraft, setMaterialEditDraft] = useState(null);
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
  const [newMatManufacturer, setNewMatManufacturer] = useState('');

  const [editingProduct, setEditingProduct] = useState(null);
  const [newModelCode, setNewModelCode] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelSports, setNewModelSports] = useState([]);
  const [newModelPrimary, setNewModelPrimary] = useState('');
  const [newModelSecondary, setNewModelSecondary] = useState('');
  const [newModelTertiary, setNewModelTertiary] = useState('');
  const [newModelLayer1Lt5, setNewModelLayer1Lt5] = useState('');
  const [newModelLayer1Ge5, setNewModelLayer1Ge5] = useState('');
  const [newModelLayer2Lt5, setNewModelLayer2Lt5] = useState('');
  const [newModelLayer2Ge5, setNewModelLayer2Ge5] = useState('');
  const [newModelLayer3Lt5, setNewModelLayer3Lt5] = useState('');
  const [newModelLayer3Ge5, setNewModelLayer3Ge5] = useState('');
  const [newModelWomenRatio, setNewModelWomenRatio] = useState(90);
  const [newModelChildrenRatio, setNewModelChildrenRatio] = useState(65);

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
  const [addItemStations, setAddItemStations] = useState(buildAllStationsPreset());
  const [addItemDesignerId, setAddItemDesignerId] = useState('');
  const [addItemNotes, setAddItemNotes] = useState('');
  const [addItemLayer1Mat, setAddItemLayer1Mat] = useState('');
  const [addItemLayer2Mat, setAddItemLayer2Mat] = useState('');
  const [addItemLayer3Mat, setAddItemLayer3Mat] = useState('');
  const [addItemImageFile, setAddItemImageFile] = useState(null);
  const [addItemImagePreview, setAddItemImagePreview] = useState('');
  const [addItemRozpisFile, setAddItemRozpisFile] = useState(null);

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
  const [newEmpAvatar, setNewEmpAvatar] = useState('');

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
        const [matRes, prodRes, tierRes, sportRes, empRes, aclRes, orderRes, whRes, rateRes, assignRes, mismatchRes, problemRes, companyRes, invoiceRes, bankRes, journalRes, deadlineRes, cashDocRes, capacityRes, productTimesRes] = await Promise.all([
          supabase.from('materials').select('*').order('name'),
          supabase.from('products').select('*'),
          supabase.from('quality_tiers').select('*'),
          supabase.from('sports').select('*').order('name'),
          supabase.from('employees').select('*'),
          supabase.from('acl_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('warehouses').select('*').order('name'),
          supabase.from('cost_rates').select('*'),
          supabase.from('station_assignments').select('*'),
          supabase.from('login_mismatches').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('problem_reports').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('invoices').select('*').order('created_at', { ascending: false }),
          supabase.from('bank_transactions').select('*').order('imported_at', { ascending: false }),
          supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }),
          supabase.from('tax_deadlines').select('*').order('due_date'),
          supabase.from('cash_documents').select('*').order('doc_date', { ascending: false }),
          supabase.from('station_capacity_config').select('*'),
          supabase.from('station_product_times').select('*')
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
        setAcl(aclRes.data ? { ...FALLBACK_ACL, ...aclRes.data.rules } : FALLBACK_ACL);
        setOrders((orderRes.data || []).map(mapOrderFromDb));
        setWarehouses(loadedWarehouses);
        setCostRates(rateRes.error ? [] : (rateRes.data || []).map(mapCostRateFromDb));
        setStationAssignments(assignRes.error ? [] : (assignRes.data || []).map(mapAssignmentFromDb));
        setLoginMismatches(mismatchRes.error ? [] : (mismatchRes.data || []).map(mapMismatchFromDb));
        setProblemReports(problemRes.error ? [] : (problemRes.data || []).map(mapProblemFromDb));
        if (companyRes.data) setCompanySettings(mapCompanySettingsFromDb(companyRes.data));
        setInvoices(invoiceRes.error ? [] : (invoiceRes.data || []).map(mapInvoiceFromDb));
        setBankTransactions(bankRes.error ? [] : (bankRes.data || []).map(mapBankTxFromDb));
        setJournalEntries(journalRes.error ? [] : (journalRes.data || []).map(mapJournalFromDb));
        setTaxDeadlines(deadlineRes.error ? [] : (deadlineRes.data || []).map(mapTaxDeadlineFromDb));
        setCashDocuments(cashDocRes.error ? [] : (cashDocRes.data || []).map(mapCashDocFromDb));
        setCapacityConfigs(capacityRes.error ? [] : (capacityRes.data || []).map(mapCapacityConfigFromDb));
        setStationProductTimes(productTimesRes.error ? [] : (productTimesRes.data || []).map(mapProductTimeFromDb));

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_rates' }, (payload) => {
        setCostRates(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(x => x.stationId !== payload.old.station_id);
          const mapped = mapCostRateFromDb(payload.new);
          const exists = prev.some(x => x.stationId === mapped.stationId);
          return exists ? prev.map(x => (x.stationId === mapped.stationId ? mapped : x)) : [...prev, mapped];
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_assignments' }, (payload) => applyRealtimeChange(setStationAssignments, payload, mapAssignmentFromDb))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_mismatches' }, (payload) => setLoginMismatches(prev => [mapMismatchFromDb(payload.new), ...prev].slice(0, 50)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'problem_reports' }, (payload) => {
        applyRealtimeChange(setProblemReports, payload, mapProblemFromDb);
        if (payload.eventType === 'INSERT') {
          const p = mapProblemFromDb(payload.new);
          playAlertBeep(2, 880);
          showDesktopNotification('⚠️ Nový problém nahlásený', `${p.category}: ${p.description}`);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, (payload) => applyRealtimeChange(setInvoices, payload, mapInvoiceFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transactions' }, (payload) => applyRealtimeChange(setBankTransactions, payload, mapBankTxFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, (payload) => applyRealtimeChange(setJournalEntries, payload, mapJournalFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_deadlines' }, (payload) => applyRealtimeChange(setTaxDeadlines, payload, mapTaxDeadlineFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_documents' }, (payload) => applyRealtimeChange(setCashDocuments, payload, mapCashDocFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_capacity_config' }, (payload) => applyRealtimeChange(setCapacityConfigs, payload, mapCapacityConfigFromDb, 'stationId'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_product_times' }, (payload) => applyRealtimeChange(setStationProductTimes, payload, mapProductTimeFromDb))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, (payload) => { if (payload.new) setCompanySettings(mapCompanySettingsFromDb(payload.new)); })
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

  const employeesRef = useRef(employees);
  useEffect(() => { employeesRef.current = employees; }, [employees]);

  const problemReportsRef = useRef(problemReports);
  useEffect(() => { problemReportsRef.current = problemReports; }, [problemReports]);

  // Požiadať o povolenie desktop notifikácií, keď sa prihlási niekto, kto rieši problémy
  useEffect(() => {
    if (currentUser && hasPermission('view_reports') && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  // Eskalujúce pripomienky nevyriešených problémov — čím dlhšie otvorené, tým častejšie a otravnejšie (ako pripomienka bezpečnostného pásu v aute)
  const lastReminderRef = useRef(0);
  useEffect(() => {
    if (!currentUser || !hasPermission('view_reports')) return;
    const interval = setInterval(() => {
      const openProbs = problemReportsRef.current.filter(p => p.status === 'open');
      if (openProbs.length === 0) return;
      const now = Date.now();
      const oldestMinutes = Math.max(...openProbs.map(p => (now - new Date(p.createdAt).getTime()) / 60000));
      if (oldestMinutes >= 120) {
        // Naliehavé (viac ako 2h) — otravná pripomienka každú 1 minútu
        if (now - lastReminderRef.current >= 60000) {
          playAlertBeep(4, 660);
          showDesktopNotification('🚨 NALIEHAVÉ — nevyriešený problém', `${openProbs.length} problém(ov) čaká viac ako 2 hodiny na vyriešenie!`);
          lastReminderRef.current = now;
        }
      } else if (oldestMinutes >= 30) {
        // Čaká dlhšie (30min-2h) — jemnejšia pripomienka každých 5 minút
        if (now - lastReminderRef.current >= 300000) {
          playAlertBeep(1, 880);
          lastReminderRef.current = now;
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Obnovenie sedenia Supabase Auth pri načítaní appky + reakcia na prihlásenie/odhlásenie/MFA
  useEffect(() => {
    if (isLoading) return;

    const handleSessionUser = async (session) => {
      if (!session) { setAuthSession(null); return; }
      setAuthSession(session);
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactor = factorsData?.totp?.[0];
        if (totpFactor) {
          const { data: challengeData } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
          setMfaStep({ factorId: totpFactor.id, challengeId: challengeData.id });
          return;
        }
      }
      const emp = employeesRef.current.find(x => x.authUserId === session.user.id);
      if (emp) {
        setCurrentUser(emp);
        setIsAuthenticated(true);
        const { data: factorsData2 } = await supabase.auth.mfa.listFactors();
        const verified = factorsData2?.totp?.find(f => f.status === 'verified');
        setEnrolledMfaFactor(verified ? verified.id : null);
      }
    };

    supabase.auth.getSession().then(({ data }) => handleSessionUser(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => handleSessionUser(session));
    return () => listener.subscription.unsubscribe();
  }, [isLoading]);

  useEffect(() => {
    if (activeTab === 'qr-terminal' && qrInputRef.current) qrInputRef.current.focus();
    if (activeTab !== 'qr-terminal' && html5QrCodeRef.current) { stopCameraScan(); }
  }, [activeTab]);

  // Ak appku otvorili cez QR kód s odkazom (?scan=...), automaticky prepnúť na Čítačku QR a predvyplniť kód
  useEffect(() => {
    if (isAuthenticated && pendingScanCode) {
      setActiveTab('qr-terminal');
      setManualQrInput(pendingScanCode);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAuthenticated]);

  // Ak appku otvorili cez QR kód stanice (?station=...), nastaviť kontext stanice pre PIN prihlásenie
  useEffect(() => {
    if (stationLoginParam && STATION_CONFIGS[stationLoginParam]) {
      setActiveStationContext(stationLoginParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Odpočítavanie zámky pri opakovane nesprávnom PIN-e
  useEffect(() => {
    if (!pinLockedUntil) { setPinLockCountdown(0); return; }
    const tick = () => {
      const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setPinLockedUntil(null); setPinLockCountdown(0); setPinAttempts(0); }
      else setPinLockCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pinLockedUntil]);

  const hasPermission = (action) => acl[action] ? acl[action][currentUser?.role] : false;

  // --- PRIHLÁSENIE / ODHLÁSENIE ---
  // --- SUPABASE AUTH: registrácia, prihlásenie a MFA pre Master/Supervisor/Obchodníka ---
  const handleAuthSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim()) { setAuthError('Zadaj email.'); return; }
    const matchingEmployee = employees.find(x => x.email && x.email.toLowerCase() === authEmail.trim().toLowerCase() && ['master', 'supervisor', 'sales'].includes(x.role));
    if (!matchingEmployee) { setAuthError('Tento email nepatrí žiadnemu profilu s prístupom (Master/Supervisor/Obchodník). Over si ho v Zamestnanci & Práva, alebo požiadaj Mastra, nech ho tam doplní.'); return; }
    if (matchingEmployee.authUserId) { setAuthError('Tento profil už má vytvorený účet — použi prihlásenie, nie registráciu.'); return; }
    if (authPassword.length < 8) { setAuthError('Heslo musí mať aspoň 8 znakov.'); return; }
    if (authPassword !== authSignupPassword2) { setAuthError('Heslá sa nezhodujú.'); return; }
    setIsAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
    if (error) { setIsAuthBusy(false); setAuthError(error.message); return; }
    if (!data.user) { setIsAuthBusy(false); setAuthError('Účet bol vytvorený, ale je potrebné potvrdenie emailom. Over si schránku, alebo požiadaj Mastra o vypnutie potvrdzovania v Supabase.'); return; }
    await supabase.from('employees').update({ auth_user_id: data.user.id }).eq('id', matchingEmployee.id);
    setIsAuthBusy(false);
    setAuthPassword(''); setAuthSignupPassword2('');
    triggerNotification('success', 'Účet bol vytvorený a prepojený s profilom. Prihlasujem...');
  };

  const handleAuthLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail.trim() || !authPassword) { setAuthError('Zadaj email aj heslo.'); return; }
    setIsAuthBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    if (error) { setIsAuthBusy(false); setAuthError(error.message === 'Invalid login credentials' ? 'Nesprávny email alebo heslo.' : error.message); return; }
    setIsAuthBusy(false);
    setAuthPassword('');
    // onAuthStateChange (nižšie) sa postará o zvyšok — nájde profil, prípadne vyžiada MFA kód
  };

  const handleMfaVerify = async () => {
    if (!mfaStep) return;
    setMfaError('');
    setIsAuthBusy(true);
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaStep.factorId, challengeId: mfaStep.challengeId, code: mfaCode.trim() });
    setIsAuthBusy(false);
    if (error) { setMfaError('Nesprávny alebo expirovaný kód. Skús nový kód z appky.'); setMfaCode(''); return; }
    setMfaStep(null);
    setMfaCode('');
  };

  const handleAuthLogout = async () => {
    await supabase.auth.signOut();
    setAuthSession(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setMfaStep(null);
    setActiveStationContext(null);
  };

  // MFA (2FA) nastavenie vo vlastnom profile — cez Supabase Auth (bezpečné, tajný kľúč nikdy neopustí server)
  const handleBeginAuthMfaEnroll = async () => {
    setMfaEnrollError('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) { setMfaEnrollError(error.message); return; }
    setMfaEnrollData(data);
  };

  const handleConfirmAuthMfaEnroll = async () => {
    if (!mfaEnrollData) return;
    setMfaEnrollError('');
    const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id });
    if (challengeErr) { setMfaEnrollError(challengeErr.message); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaEnrollData.id, challengeId: challengeData.id, code: mfaEnrollCode.trim() });
    if (error) { setMfaEnrollError('Kód nesedí. Skontroluj čas na telefóne a skús znova.'); return; }
    setEnrolledMfaFactor(mfaEnrollData.id);
    setMfaEnrollData(null);
    setMfaEnrollCode('');
    triggerNotification('success', '2FA bolo zapnuté.');
  };

  const handleDisableAuthMfa = async () => {
    if (!enrolledMfaFactor) return;
    if (!window.confirm('Naozaj vypnúť dvojfaktorové overenie?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledMfaFactor });
    if (error) { triggerNotification('error', error.message); return; }
    setEnrolledMfaFactor(null);
    triggerNotification('success', '2FA bolo vypnuté.');
  };


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
    setLoginPassword('');
    setLoginError('');
    if (emp.totpEnabled && emp.totpSecret) {
      setPendingTotpEmployee(emp);
      setLoginStep('totp');
      return;
    }
    setCurrentUser(emp);
    setIsAuthenticated(true);
  };

  const handleVerifyLoginTotp = async () => {
    if (!pendingTotpEmployee) return;
    setIsVerifyingTotp(true);
    const ok = await verifyTotpCode(loginTotpCode, pendingTotpEmployee.totpSecret);
    setIsVerifyingTotp(false);
    if (!ok) { setLoginTotpError('Nesprávny alebo expirovaný kód. Skús nový kód z appky (mení sa každých 30 sekúnd).'); setLoginTotpCode(''); return; }
    setCurrentUser(pendingTotpEmployee);
    setIsAuthenticated(true);
    setLoginStep('credentials');
    setPendingTotpEmployee(null);
    setLoginTotpCode('');
    setLoginTotpError('');
  };

  const handleCancelTotpLogin = () => {
    setLoginStep('credentials');
    setPendingTotpEmployee(null);
    setLoginTotpCode('');
    setLoginTotpError('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginSelectedId('');
    setLoginPassword('');
    setShowMasterSwitcher(false);
    setActiveStationContext(null);
    setPinDigits('');
    setPinError('');
    setLoginStep('credentials');
    setPendingTotpEmployee(null);
    setLoginTotpCode('');
  };

  // Odhlásenie, ktoré NEOPÚŠŤA kontext stanice - hneď sa ukáže PIN obrazovka pre ďalšieho pracovníka
  const handleQuickStationLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setPinDigits('');
    setPinError('');
  };

  const handlePinDigitPress = (digit) => {
    if (pinLockedUntil) return;
    if (pinDigits.length >= 4) return;
    const next = pinDigits + digit;
    setPinDigits(next);
    setPinError('');
    if (next.length === 4) handlePinLogin(next);
  };

  const handlePinBackspace = () => setPinDigits(pinDigits.slice(0, -1));

  const handlePinLogin = async (pin) => {
    if (pinLockedUntil) return;
    const enteredHash = await hashPassword(pin);
    const emp = employees.find(x => x.pinHash && x.pinHash === enteredHash);
    if (!emp) {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      setPinDigits('');
      if (attempts >= 5) {
        setPinLockedUntil(Date.now() + 60000);
        setPinError('Príliš veľa nesprávnych pokusov. Skús to znova o minútu.');
      } else {
        setPinError(`Nesprávny PIN (pokus ${attempts}/5).`);
      }
      return;
    }
    setCurrentUser(emp);
    setIsAuthenticated(true);
    setPinDigits('');
    setPinError('');
    setPinAttempts(0);
    setActiveTab('isolated-station');
    setActiveStationFilter(activeStationContext);

    // Mäkká kontrola: je zamestnanec dnes priradený na túto stanicu? Ak nie, len sa to zaznamená (nič neblokuje).
    const today = new Date().toISOString().slice(0, 10);
    const isAssigned = stationAssignments.some(a => a.date === today && a.stationId === activeStationContext && a.employeeId === emp.id);
    if (!isAssigned) {
      await supabase.from('login_mismatches').insert({
        id: `mm-${Date.now()}`, employee_id: emp.id, employee_name: `${emp.firstName} ${emp.lastName}`,
        station_id: activeStationContext, assignment_date: today
      });
    }
  };

  // --- ROZVRH ZAMESTNANCOV NA STANICE (týždenná matica) ---
  // --- HLÁSENIE PROBLÉMOV NA STANICIACH ---
  const handleSubmitProblem = async () => {
    if (!reportingProblemForItem) return;
    if (!problemDescription.trim()) { alert('Napíš krátky popis problému.'); return; }
    const item = reportingProblemForItem;
    const { error } = await supabase.from('problem_reports').insert({
      id: `pr-${Date.now()}`, order_id: item.orderId, item_id: item.itemId, station_id: activeStationFilter || activeStationContext || '',
      employee_id: currentUser.id, employee_name: `${currentUser.firstName} ${currentUser.lastName}`,
      category: problemCategory, description: problemDescription.trim(), status: 'open'
    });
    if (error) { triggerNotification('error', error.message); return; }
    setReportingProblemForItem(null);
    setProblemDescription('');
    setProblemCategory(PROBLEM_CATEGORIES[0]);
    triggerNotification('success', 'Problém bol nahlásený. Master/Supervisor to uvidí.');
  };

  const handleResolveProblem = async () => {
    if (!resolvingProblem) return;
    const { error } = await supabase.from('problem_reports').update({
      status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: `${currentUser.firstName} ${currentUser.lastName}`, resolution_note: resolutionNoteInput.trim()
    }).eq('id', resolvingProblem.id);
    if (error) { triggerNotification('error', error.message); return; }
    setResolvingProblem(null);
    setResolutionNoteInput('');
    triggerNotification('success', 'Problém označený ako vyriešený.');
  };

  // Naliehavosť podľa toho, ako dlho je problém nevyriešený
  const getProblemUrgency = (createdAt) => {
    const minutesOpen = (Date.now() - new Date(createdAt).getTime()) / 60000;
    if (minutesOpen >= 120) return { label: 'NALIEHAVÉ', color: 'bg-rose-600 text-white border-rose-500', pulse: true };
    if (minutesOpen >= 30) return { label: 'Čaká dlhšie', color: 'bg-amber-600 text-white border-amber-500', pulse: false };
    return { label: 'Nové', color: 'bg-sky-700 text-white border-sky-600', pulse: false };
  };

  const handleAssignEmployee = async (date, stationId, employeeId) => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte oprávnenie upravovať rozvrh.'); return; }
    const already = stationAssignments.some(a => a.date === date && a.stationId === stationId && a.employeeId === employeeId);
    if (already) { setStaffingPickerCell(null); return; }
    const { error } = await supabase.from('station_assignments').insert({ id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, employee_id: employeeId, station_id: stationId, assignment_date: date });
    if (error) { triggerNotification('error', error.message); return; }
    setStaffingPickerCell(null);
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte oprávnenie upravovať rozvrh.'); return; }
    await supabase.from('station_assignments').delete().eq('id', assignmentId);
  };

  const handleCopyPreviousWeek = async () => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte oprávnenie upravovať rozvrh.'); return; }
    const thisWeek = getWeekDates(staffingWeekOffset);
    const prevWeek = getWeekDates(staffingWeekOffset - 1);
    const prevAssignments = stationAssignments.filter(a => prevWeek.includes(a.date));
    if (prevAssignments.length === 0) { triggerNotification('error', 'Predchádzajúci týždeň nemá žiadne priradenia na skopírovanie.'); return; }
    const toInsert = [];
    prevAssignments.forEach(a => {
      const dayIndex = prevWeek.indexOf(a.date);
      const targetDate = thisWeek[dayIndex];
      const exists = stationAssignments.some(x => x.date === targetDate && x.stationId === a.stationId && x.employeeId === a.employeeId);
      if (!exists) toInsert.push({ id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${dayIndex}`, employee_id: a.employeeId, station_id: a.stationId, assignment_date: targetDate });
    });
    if (toInsert.length === 0) { triggerNotification('error', 'Tento týždeň je už rovnako obsadený.'); return; }
    const { error } = await supabase.from('station_assignments').insert(toInsert);
    if (error) { triggerNotification('error', error.message); return; }
    triggerNotification('success', `Skopírovaných ${toInsert.length} priradení z minulého týždňa.`);
  };

  const handlePrintStationCodes = () => {
    if (!stationQrGridRef.current) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { triggerNotification('error', 'Prehliadač zablokoval otvorenie okna na tlač. Povoľ vyskakovacie okná pre túto appku.'); return; }
    printWindow.document.write(`
      <html><head><title>QR kódy staníc</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: white; }
        .qr-grid { display: flex; flex-wrap: wrap; gap: 16px; }
        .qr-item { display: inline-flex; flex-direction: column; align-items: center; text-align: center; padding: 14px; border: 1px solid #ccc; border-radius: 12px; }
        .qr-item span { display: block; font-weight: bold; margin-top: 8px; font-size: 13px; color: #000; }
      </style>
      </head><body><div class="qr-grid">${stationQrGridRef.current.innerHTML}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
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

  // --- AI ROZPOZNÁVANIE DODACÍCH LISTOV ---
  const handleDeliveryNoteFileSelect = (file) => {
    if (!file) return;
    setDeliveryNoteImageFile(file);
    setDeliveryNoteImagePreview(URL.createObjectURL(file));
    setParsedDeliveryItems([]);
    setDeliveryNoteError('');
  };

  const handleParseDeliveryNote = async () => {
    if (!deliveryNoteImageFile) return;
    setIsParsingDeliveryNote(true);
    setDeliveryNoteError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(deliveryNoteImageFile);
      });
      const { data, error } = await supabase.functions.invoke('parse-delivery-note', {
        body: { imageBase64: base64, mimeType: deliveryNoteImageFile.type || 'image/jpeg' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const items = (data?.items || []).map((it, idx) => ({
        tempId: `dn-${idx}`, name: it.name || '', type: it.type || '', color: it.color || '', quantity: parseFloat(it.quantity) || 0, unit: it.unit || 'm'
      }));
      if (items.length === 0) { setDeliveryNoteError('AI na fotke nenašla žiadne rozpoznateľné položky. Skús jasnejšiu fotku.'); }
      setParsedDeliveryItems(items);
      if (data?.deliveryNoteNumber) setNewMatDeliveryNumber(data.deliveryNoteNumber);
      if (data?.deliveryNoteDate) setNewMatDeliveryDate(data.deliveryNoteDate);
    } catch (err) {
      setDeliveryNoteError(`Chyba pri rozpoznávaní: ${err.message}`);
    } finally {
      setIsParsingDeliveryNote(false);
    }
  };

  const handleUpdateParsedItem = (tempId, field, value) => {
    setParsedDeliveryItems(prev => prev.map(it => it.tempId === tempId ? { ...it, [field]: value } : it));
  };

  const handleRemoveParsedItem = (tempId) => {
    setParsedDeliveryItems(prev => prev.filter(it => it.tempId !== tempId));
  };

  const handleAddManualParsedRow = () => {
    setParsedDeliveryItems(prev => [...prev, { tempId: `dn-manual-${Date.now()}`, name: '', type: '', color: '', quantity: 0, unit: 'm' }]);
  };

  const handleConfirmDeliveryImport = async () => {
    if (!deliveryNoteWarehouseId) { alert('Vyber sklad, do ktorého sa má tovar naskladniť.'); return; }
    const validItems = parsedDeliveryItems.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) { alert('Nie je čo naskladniť — skontroluj názvy a množstvá.'); return; }
    setIsImportingDeliveryItems(true);
    const now = getFormattedDateTime();
    const toInsert = validItems.map((it, idx) => mapMaterialToDb({
      id: `tex-${Date.now()}-${idx}`, name: it.name.trim(), color: it.color.trim() || 'Neuvedená', colorHex: '',
      width: null, weight: null, pricePerM: 0, qty: it.quantity, unit: it.unit, minQty: 0, warehouseId: deliveryNoteWarehouseId,
      productType: it.type || '', deliveryNoteNumber: newMatDeliveryNumber.trim(), deliveryNoteDate: newMatDeliveryDate,
      history: [{ date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Príjem z dodacieho listu (AI)', change: it.quantity, note: newMatDeliveryNumber.trim() ? `Dodací list č. ${newMatDeliveryNumber.trim()} — automaticky rozpoznané, skontroluj správnosť.` : 'Automaticky rozpoznané z fotky dodacieho listu — skontroluj správnosť.' }]
    }));
    const { error } = await supabase.from('materials').insert(toInsert);
    setIsImportingDeliveryItems(false);
    if (error) { triggerNotification('error', error.message); return; }
    triggerNotification('success', `Naskladnených ${toInsert.length} položiek z dodacieho listu.`);
    setShowDeliveryNoteScanner(false);
    setDeliveryNoteImageFile(null);
    setDeliveryNoteImagePreview('');
    setParsedDeliveryItems([]);
    setNewMatDeliveryNumber('');
    setNewMatDeliveryDate('');
  };


  // --- FAKTURAČNÝ MODUL ---
  const handleStartEditCompanySettings = () => setCompanySettingsDraft({ ...companySettings });
  const handleCancelEditCompanySettings = () => setCompanySettingsDraft(null);

  const handleSaveCompanySettings = async () => {
    if (!hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte oprávnenie na túto úpravu.'); return; }
    const { error } = await supabase.from('company_settings').update({
      company_name: companySettingsDraft.companyName, address: companySettingsDraft.address, ico: companySettingsDraft.ico,
      dic: companySettingsDraft.dic, ic_dph: companySettingsDraft.icDph, iban: companySettingsDraft.iban, bank_name: companySettingsDraft.bankName,
      default_vat_rate: parseFloat(companySettingsDraft.defaultVatRate) || 0, invoice_number_prefix: companySettingsDraft.invoiceNumberPrefix
    }).eq('id', 1);
    if (error) { triggerNotification('error', error.message); return; }
    setCompanySettings(companySettingsDraft);
    setCompanySettingsDraft(null);
    triggerNotification('success', 'Nastavenia firmy boli uložené.');
  };

  const handleStartNewInvoice = (order) => {
    setShowNewInvoiceForm(true);
    if (order) {
      setNewInvoiceOrderId(order.id);
      setNewInvoiceCustomerName(order.customer);
      setNewInvoiceItems(order.items.map(it => ({ tempId: it.itemId, description: `${it.productName} (${it.qualityTier}, ${genderLabel(it.gender)})`, qty: it.qty, unitPrice: 0, vatRate: companySettings.defaultVatRate })));
    } else {
      setNewInvoiceOrderId('');
      setNewInvoiceCustomerName('');
      setNewInvoiceItems([{ tempId: `li-${Date.now()}`, description: '', qty: 1, unitPrice: 0, vatRate: companySettings.defaultVatRate }]);
    }
    setNewInvoiceCustomerAddress(''); setNewInvoiceCustomerIco(''); setNewInvoiceCustomerDic(''); setNewInvoiceCustomerIcDph(''); setNewInvoiceCustomerType('sk_platca');
    const due = new Date(); due.setDate(due.getDate() + 14);
    setNewInvoiceDueDate(due.toISOString().slice(0, 10));
    setNewInvoiceNotes('');
  };

  const handleAddInvoiceLineItem = () => setNewInvoiceItems(prev => [...prev, { tempId: `li-${Date.now()}`, description: '', qty: 1, unitPrice: 0, vatRate: companySettings.defaultVatRate }]);
  const handleUpdateInvoiceLineItem = (tempId, field, value) => setNewInvoiceItems(prev => prev.map(it => it.tempId === tempId ? { ...it, [field]: value } : it));
  const handleRemoveInvoiceLineItem = (tempId) => setNewInvoiceItems(prev => prev.filter(it => it.tempId !== tempId));

  const calcInvoiceTotals = (items) => {
    let subtotal = 0, vatTotal = 0;
    items.forEach(it => {
      const lineBase = (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0);
      subtotal += lineBase;
      vatTotal += lineBase * ((parseFloat(it.vatRate) || 0) / 100);
    });
    return { subtotal: parseFloat(subtotal.toFixed(2)), vatTotal: parseFloat(vatTotal.toFixed(2)), total: parseFloat((subtotal + vatTotal).toFixed(2)) };
  };

  const handleConfirmNewInvoice = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie vystavovať faktúry.'); return; }
    if (!newInvoiceCustomerName.trim()) { alert('Zadajte odberateľa.'); return; }
    const validItems = newInvoiceItems.filter(it => it.description.trim() && parseFloat(it.qty) > 0);
    if (validItems.length === 0) { alert('Pridajte aspoň jednu položku s popisom a množstvom.'); return; }

    const year = new Date().getFullYear();
    const seq = companySettings.nextInvoiceNumber;
    const invoiceNumber = `${companySettings.invoiceNumberPrefix || year}${String(seq).padStart(4, '0')}`;
    const totals = calcInvoiceTotals(validItems);
    const now = new Date();
    const created = {
      id: `inv-${Date.now()}`, invoiceNumber, orderId: newInvoiceOrderId || null,
      customerName: newInvoiceCustomerName.trim(), customerAddress: newInvoiceCustomerAddress.trim(), customerIco: newInvoiceCustomerIco.trim(),
      customerDic: newInvoiceCustomerDic.trim(), customerIcDph: newInvoiceCustomerIcDph.trim(), customerType: newInvoiceCustomerType,
      issueDate: now.toISOString().slice(0, 10), deliveryDate: now.toISOString().slice(0, 10), dueDate: newInvoiceDueDate,
      variableSymbol: invoiceNumber.replace(/\D/g, '').slice(-10),
      items: validItems.map(it => ({ description: it.description, qty: parseFloat(it.qty), unitPrice: parseFloat(it.unitPrice) || 0, vatRate: parseFloat(it.vatRate) || 0 })),
      ...totals, status: 'issued', notes: newInvoiceNotes.trim(), createdBy: `${currentUser.firstName} ${currentUser.lastName}`, corrections: []
    };
    const { error } = await supabase.from('invoices').insert(mapInvoiceToDb(created));
    if (error) { triggerNotification('error', error.message); return; }
    await supabase.from('company_settings').update({ next_invoice_number: seq + 1 }).eq('id', 1);
    await supabase.from('journal_entries').insert({
      id: `j-${Date.now()}`, entry_date: created.issueDate, description: `Vystavená faktúra ${invoiceNumber} — ${created.customerName}`,
      md_account: '311 - Odberatelia', dal_account: '601 - Tržby z predaja', amount: created.total, invoice_id: created.id
    });
    if (newInvoiceOrderId) {
      await supabase.from('orders').update({ accounting_status: 'invoiced' }).eq('id', newInvoiceOrderId);
    }
    setShowNewInvoiceForm(false);
    setSelectedInvoiceForDetail(created);
    triggerNotification('success', `Faktúra č. ${invoiceNumber} bola vystavená.`);
  };

  const handleMarkInvoicePaid = async (invoice) => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie na túto úpravu.'); return; }
    const { error } = await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice.id);
    if (error) { triggerNotification('error', error.message); return; }
    await supabase.from('journal_entries').insert({
      id: `j-${Date.now()}`, entry_date: new Date().toISOString().slice(0, 10), description: `Úhrada faktúry ${invoice.invoiceNumber} — ${invoice.customerName}`,
      md_account: '221 - Bankové účty', dal_account: '311 - Odberatelia', amount: invoice.total, invoice_id: invoice.id
    });
    setSelectedInvoiceForDetail(prev => prev && prev.id === invoice.id ? { ...prev, status: 'paid', paidAt: new Date().toISOString() } : prev);
    triggerNotification('success', 'Faktúra označená ako uhradená.');
  };

  const generateBySquareQr = (invoice) => {
    if (!companySettings.iban) return null;
    try {
      return encodeBySquare({
        payments: [{
          type: PaymentOptions.PaymentOrder,
          amount: invoice.total,
          variableSymbol: invoice.variableSymbol,
          currencyCode: CurrencyCode.EUR,
          beneficiary: { name: companySettings.companyName || 'Odberateľ' },
          bankAccounts: [{ iban: companySettings.iban }],
        }],
      });
    } catch (e) {
      return null;
    }
  };

  // --- FRONTA PRE ÚČTOVNÍKA ---
  const handleSwitchOrderToCash = async (order) => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie na túto úpravu.'); return; }
    if (!window.confirm(`Prehodiť zákazku ${order.orderNumber || order.id} na platbu v hotovosti? Faktúra sa pre ňu už nebude vystavovať.`)) return;
    const { error } = await supabase.from('orders').update({ payment_type: 'hotovost', accounting_status: 'resolved_cash' }).eq('id', order.id);
    if (error) { triggerNotification('error', error.message); return; }
    triggerNotification('success', 'Zákazka bola prehodená na hotovosť.');
  };

  const handleDismissFromAccountingQueue = async (order) => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie na túto úpravu.'); return; }
    const { error } = await supabase.from('orders').update({ accounting_status: 'resolved_other' }).eq('id', order.id);
    if (error) { triggerNotification('error', error.message); return; }
  };

  // --- BANKOVÝ VÝPIS A AUTOMATICKÉ PÁROVANIE PLATIEB ---
  const handleImportBankStatement = async (file) => {
    if (!file) return;
    setIsImportingBankStatement(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (rows.length === 0) { triggerNotification('error', 'Súbor neobsahuje žiadne riadky.'); return; }

      const findCol = (row, keywords) => {
        const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
        return key ? row[key] : '';
      };

      const toInsert = rows.map((row, idx) => {
        const dateRaw = findCol(row, ['dátum', 'datum', 'date']);
        const amountRaw = findCol(row, ['suma', 'amount', 'čiastka', 'ciastka']);
        const vsRaw = findCol(row, ['variab', 'vs', 'symbol']);
        const senderRaw = findCol(row, ['odosielateľ', 'odosielatel', 'sender', 'popis', 'description', 'názov', 'nazov']);
        let dateVal = dateRaw;
        if (dateRaw instanceof Date) dateVal = dateRaw.toISOString().slice(0, 10);
        return {
          id: `btx-${Date.now()}-${idx}`, tx_date: dateVal || null, sender: String(senderRaw || '').trim(),
          amount: parseFloat(String(amountRaw).replace(',', '.').replace(/[^\d.-]/g, '')) || 0,
          variable_symbol: String(vsRaw || '').trim(), matched: false, invoice_id: null
        };
      }).filter(r => r.amount > 0);

      if (toInsert.length === 0) { triggerNotification('error', 'Nepodarilo sa rozpoznať žiadne platné riadky (skontroluj, či výpis má stĺpce Dátum, Suma, Variabilný symbol).'); return; }
      const { error } = await supabase.from('bank_transactions').insert(toInsert);
      if (error) { triggerNotification('error', error.message); return; }
      triggerNotification('success', `Naimportovaných ${toInsert.length} bankových transakcií.`);
    } catch (err) {
      triggerNotification('error', `Chyba pri čítaní súboru: ${err.message}`);
    } finally {
      setIsImportingBankStatement(false);
    }
  };

  const handleAutoMatchPayments = async () => {
    setIsAutoMatching(true);
    let matchedCount = 0;
    for (const tx of bankTransactions.filter(t => !t.matched)) {
      const found = invoices.find(inv => inv.status !== 'paid' && inv.variableSymbol === tx.variableSymbol && Math.abs(inv.total - tx.amount) < 0.01);
      if (found) {
        await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', found.id);
        await supabase.from('bank_transactions').update({ matched: true, invoice_id: found.id }).eq('id', tx.id);
        await supabase.from('journal_entries').insert({
          id: `j-${Date.now()}-${matchedCount}`, entry_date: tx.date || new Date().toISOString().slice(0, 10), description: `Úhrada faktúry ${found.invoiceNumber} — spárované z bankového výpisu`,
          md_account: '221 - Bankové účty', dal_account: '311 - Odberatelia', amount: found.total, invoice_id: found.id
        });
        matchedCount++;
      }
    }
    setIsAutoMatching(false);
    triggerNotification(matchedCount > 0 ? 'success' : 'error', matchedCount > 0 ? `Spárovaných ${matchedCount} platieb s faktúrami.` : 'Nenašli sa žiadne nové zhody (skontroluj variabilné symboly a sumy).');
  };

  // --- AI ÚČTOVNÝ ASISTENT ---
  const handleAskAiAccountant = async (question) => {
    if (!question.trim()) return;
    const newChat = [...aiChat, { sender: 'user', text: question }];
    setAiChat(newChat);
    setAiPrompt('');
    setIsAiLoading(true);

    const unpaidTotal = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0);
    const vatTotal = invoices.reduce((s, i) => s + i.vatTotal, 0);
    const context = `Firma: ${companySettings.companyName || 'neuvedené'}. Celkový počet faktúr: ${invoices.length}. Neuhradené faktúry v hodnote: ${unpaidTotal.toFixed(2)} €. Súčet DPH za všetky faktúry: ${vatTotal.toFixed(2)} €. Zoznam posledných faktúr: ${JSON.stringify(invoices.slice(0, 15).map(i => ({ cislo: i.invoiceNumber, odberateľ: i.customerName, suma: i.total, stav: i.status, splatnosť: i.dueDate })))}`;

    try {
      const { data, error } = await supabase.functions.invoke('ai-accountant', { body: { question, context } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiChat([...newChat, { sender: 'bot', text: data.answer }]);
    } catch (err) {
      setAiChat([...newChat, { sender: 'bot', text: `Prepáč, nastala chyba: ${err.message}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- DAŇOVÉ TERMÍNY (vlastné, editovateľné) ---
  const handleAddTaxDeadline = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie.'); return; }
    if (!newDeadlineTitle.trim() || !newDeadlineDate) { alert('Vyplňte názov aj dátum termínu.'); return; }
    const { error } = await supabase.from('tax_deadlines').insert({ id: `td-${Date.now()}`, title: newDeadlineTitle.trim(), due_date: newDeadlineDate, note: newDeadlineNote.trim(), created_by: `${currentUser.firstName} ${currentUser.lastName}` });
    if (error) { triggerNotification('error', error.message); return; }
    setNewDeadlineTitle(''); setNewDeadlineDate(''); setNewDeadlineNote('');
    triggerNotification('success', 'Termín bol pridaný.');
  };

  const handleSaveEditDeadline = async () => {
    if (!editingDeadline) return;
    const { error } = await supabase.from('tax_deadlines').update({ title: editingDeadline.title, due_date: editingDeadline.dueDate, note: editingDeadline.note }).eq('id', editingDeadline.id);
    if (error) { triggerNotification('error', error.message); return; }
    setEditingDeadline(null);
    triggerNotification('success', 'Termín bol upravený.');
  };

  const handleDeleteTaxDeadline = async (id) => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie.'); return; }
    if (!window.confirm('Naozaj vymazať tento termín?')) return;
    await supabase.from('tax_deadlines').delete().eq('id', id);
  };

  // --- POKLADNIČNÉ DOKLADY (PPD/VPD) ---
  const handleAddCashDocument = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie.'); return; }
    const amount = parseFloat(newCashDocAmount);
    if (!newCashDocDate || !amount || amount <= 0) { alert('Vyplňte dátum a kladnú sumu.'); return; }
    const isPrijem = newCashDocType === 'prijem';
    const seq = isPrijem ? companySettings.nextPpdNumber : companySettings.nextVpdNumber;
    const docNumber = `${isPrijem ? 'PPD' : 'VPD'}-${String(seq).padStart(4, '0')}`;
    const created = { id: `cd-${Date.now()}`, doc_number: docNumber, doc_type: newCashDocType, doc_date: newCashDocDate, description: newCashDocDescription.trim(), amount, category: newCashDocCategory.trim(), created_by: `${currentUser.firstName} ${currentUser.lastName}` };
    const { error } = await supabase.from('cash_documents').insert(created);
    if (error) { triggerNotification('error', error.message); return; }
    await supabase.from('company_settings').update(isPrijem ? { next_ppd_number: seq + 1 } : { next_vpd_number: seq + 1 }).eq('id', 1);
    await supabase.from('journal_entries').insert({
      id: `j-${Date.now()}`, entry_date: newCashDocDate, description: `${docNumber} — ${newCashDocDescription.trim()}`,
      md_account: isPrijem ? '211 - Pokladňa' : '5xx - Náklady', dal_account: isPrijem ? '6xx - Výnosy' : '211 - Pokladňa', amount
    });
    setShowCashDocForm(false);
    setNewCashDocDate(''); setNewCashDocDescription(''); setNewCashDocAmount(''); setNewCashDocCategory('');
    triggerNotification('success', `Doklad ${docNumber} bol vytvorený.`);
  };

  // --- OPRAVA FAKTÚRY (s povinným dôvodom, auditný záznam) ---
  const handleStartCorrectInvoice = (invoice) => { setCorrectingInvoice(invoice); setCorrectionDraft({ ...invoice }); setCorrectionReason(''); };
  const handleCancelCorrectInvoice = () => { setCorrectingInvoice(null); setCorrectionDraft(null); setCorrectionReason(''); };

  const handleSaveInvoiceCorrection = async () => {
    if (!hasPermission('create_order')) { triggerNotification('error', 'Nemáte oprávnenie.'); return; }
    if (!correctionReason.trim()) { alert('Musíš napísať dôvod opravy — bez dôvodu sa faktúra nedá upraviť.'); return; }
    const totals = calcInvoiceTotals(correctionDraft.items);
    const finalDraft = { ...correctionDraft, ...totals };
    const correctionEntry = {
      date: getFormattedDateTime(), author: `${currentUser.firstName} ${currentUser.lastName}`, reason: correctionReason.trim(),
      before: { customerName: correctingInvoice.customerName, customerIco: correctingInvoice.customerIco, total: correctingInvoice.total, items: correctingInvoice.items },
      after: { customerName: finalDraft.customerName, customerIco: finalDraft.customerIco, total: finalDraft.total, items: finalDraft.items }
    };
    finalDraft.corrections = [...(correctingInvoice.corrections || []), correctionEntry];
    const { error } = await supabase.from('invoices').update(mapInvoiceToDb(finalDraft)).eq('id', finalDraft.id);
    if (error) { triggerNotification('error', error.message); return; }
    setSelectedInvoiceForDetail(finalDraft);
    handleCancelCorrectInvoice();
    triggerNotification('success', 'Faktúra bola opravená, zmena je zaznamenaná v histórii.');
  };

  // --- MANUÁLNE PÁROVANIE PLATBY ---
  const handleManualMatchPayment = async (tx, invoiceId) => {
    if (!invoiceId) return;
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId);
    await supabase.from('bank_transactions').update({ matched: true, invoice_id: invoiceId }).eq('id', tx.id);
    await supabase.from('journal_entries').insert({
      id: `j-${Date.now()}`, entry_date: tx.date || new Date().toISOString().slice(0, 10), description: `Úhrada faktúry ${invoice.invoiceNumber} — ručne spárované`,
      md_account: '221 - Bankové účty', dal_account: '311 - Odberatelia', amount: invoice.total, invoice_id: invoice.id
    });
    setManualMatchingTx(null);
    triggerNotification('success', `Platba spárovaná s faktúrou ${invoice.invoiceNumber}.`);
  };

  const handleAddNewMaterial = async (e) => {
    e.preventDefault();
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    if (!newMatWarehouseId) { alert('Vyberte sklad, do ktorého sa má položka zaradiť.'); return; }
    const now = getFormattedDateTime();
    const created = {
      id: `tex-${Date.now()}`, name: newMatName, color: newMatColor, colorHex: newMatColorHex, width: parseInt(newMatWidth) || null, weight: parseInt(newMatWeight) || null,
      pricePerM: parseFloat(newMatPrice), qty: parseFloat(newMatQty), unit: newMatUnit, minQty: 50, warehouseId: newMatWarehouseId, manufacturer: newMatManufacturer,
      productType: newMatProductType, deliveryNoteNumber: newMatDeliveryNumber.trim(), deliveryNoteDate: newMatDeliveryDate,
      history: [{ date: now, user: `${currentUser.firstName} ${currentUser.lastName}`, action: 'Pridanie na sklad', change: parseFloat(newMatQty), note: newMatDeliveryNumber.trim() ? `Dodací list č. ${newMatDeliveryNumber.trim()}` : 'Prvotný príjem novej položky' }]
    };
    const { error } = await supabase.from('materials').insert(mapMaterialToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    setNewMatName('');
    setNewMatManufacturer('');
    setNewMatProductType('');
    setNewMatDeliveryNumber('');
    setNewMatDeliveryDate('');
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

  const handleStartEditMaterialDetails = () => {
    setMaterialEditDraft({ ...selectedMaterialForDetail });
    setIsEditingMaterialDetails(true);
  };

  const handleCancelEditMaterialDetails = () => {
    setIsEditingMaterialDetails(false);
    setMaterialEditDraft(null);
  };

  const handleSaveMaterialDetails = async () => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    if (!materialEditDraft.name.trim()) { alert('Zadajte názov materiálu.'); return; }
    const { error } = await supabase.from('materials').update({
      name: materialEditDraft.name,
      color: materialEditDraft.color,
      color_hex: materialEditDraft.colorHex || null,
      width: materialEditDraft.width ? parseInt(materialEditDraft.width) : null,
      weight: materialEditDraft.weight ? parseInt(materialEditDraft.weight) : null,
      unit: materialEditDraft.unit,
      price_per_m: parseFloat(materialEditDraft.pricePerM) || 0,
      min_qty: parseFloat(materialEditDraft.minQty) || 0,
      manufacturer: materialEditDraft.manufacturer || null,
      product_type: materialEditDraft.productType || null,
      delivery_note_number: materialEditDraft.deliveryNoteNumber || null,
      delivery_note_date: materialEditDraft.deliveryNoteDate || null
    }).eq('id', materialEditDraft.id);
    if (error) { triggerNotification('error', error.message); return; }
    setSelectedMaterialForDetail(materialEditDraft);
    setIsEditingMaterialDetails(false);
    setMaterialEditDraft(null);
    triggerNotification('success', 'Údaje o položke boli upravené.');
  };

  const handleDeleteMaterial = async () => {
    if (!hasPermission('edit_stock')) { triggerNotification('error', 'Nemáte prístup ku správe skladu.'); return; }
    if (!window.confirm(`Naozaj natrvalo vymazať položku "${selectedMaterialForDetail.name}" zo skladu? Táto akcia zmaže aj celú jej históriu pohybov a nedá sa vrátiť späť.`)) return;
    const { error } = await supabase.from('materials').delete().eq('id', selectedMaterialForDetail.id);
    if (error) { triggerNotification('error', error.message); return; }
    setSelectedMaterialForDetail(null);
    setIsEditingMaterialDetails(false);
    setMaterialEditDraft(null);
    triggerNotification('success', 'Položka bola vymazaná zo skladu.');
  };

  // --- SADZBY (náčrt na budúce sledovanie nákladov) ---
  const handleUpdateCostRate = async (stationId, field, value) => {
    if (!hasPermission('view_reports')) return;
    const existing = costRates.find(r => r.stationId === stationId) || { stationId, rate: 0, unit: '', note: '' };
    const updated = { ...existing, [field]: field === 'rate' ? (parseFloat(value) || 0) : value };
    const { error } = await supabase.from('cost_rates').upsert(mapCostRateToDb(updated));
    if (error) triggerNotification('error', error.message);
  };

  // --- EXPORT / IMPORT SKLADU DO EXCELU ---
  const buildMaterialRow = (m, includeWarehouse) => ({
    Nazov: m.name,
    Vyrobca: m.manufacturer || '',
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
      Nazov: 'Polyester Interlock', Vyrobca: 'Sinterama', Farba: 'Biela', Farba_hex: '#FFFFFF', Sirka_cm: 160, Gramaz_gm2: 140,
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
          manufacturer: row.Vyrobca || row['Výrobca'] || '',
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
    const consumption = product[layerKey].consumption;
    if (consumption.men) {
      // starší formát - pre každé pohlavie zvlášť zadaná spotreba
      const rates = consumption[gender] || consumption.men;
      const rate = qty >= 5 ? rates.ge5 : rates.lt5;
      return parseFloat((rate * qty).toFixed(2));
    }
    // nový formát - základná (pánska) spotreba + percentuálny pomer pre dámsky/detský strih
    const baseRate = qty >= 5 ? (consumption.ge5 || 0) : (consumption.lt5 || 0);
    let ratio = 1;
    if (gender === 'women') ratio = (product.womenRatioPercent ?? 90) / 100;
    if (gender === 'children') ratio = (product.childrenRatioPercent ?? 65) / 100;
    return parseFloat((baseRate * ratio * qty).toFixed(2));
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
        layer1: newModelPrimary ? { materialId: newModelPrimary, alternativeIds: [], consumption: { lt5: parseFloat(newModelLayer1Lt5) || 0, ge5: parseFloat(newModelLayer1Ge5) || 0 } } : null,
        layer2: newModelSecondary ? { materialId: newModelSecondary, alternativeIds: [], consumption: { lt5: parseFloat(newModelLayer2Lt5) || 0, ge5: parseFloat(newModelLayer2Ge5) || 0 } } : null,
        layer3: newModelTertiary ? { materialId: newModelTertiary, alternativeIds: [], consumption: { lt5: parseFloat(newModelLayer3Lt5) || 0, ge5: parseFloat(newModelLayer3Ge5) || 0 } } : null,
        womenRatioPercent: parseFloat(newModelWomenRatio) || 90,
        childrenRatioPercent: parseFloat(newModelChildrenRatio) || 65,
        threadM: 15
      };
      const { error } = await supabase.from('products').insert(mapProductToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewModelCode(''); setNewModelName('');
      setNewModelLayer1Lt5(''); setNewModelLayer1Ge5(''); setNewModelLayer2Lt5(''); setNewModelLayer2Ge5(''); setNewModelLayer3Lt5(''); setNewModelLayer3Ge5('');
      setNewModelWomenRatio(90); setNewModelChildrenRatio(65);
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

  const uploadRozpisFile = async (file) => {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
    const { error } = await supabase.storage.from('item-attachments').upload(path, file);
    if (error) throw error;
    const { data: pub } = supabase.storage.from('item-attachments').getPublicUrl(path);
    return { rozpisUrl: pub.publicUrl, rozpisFileName: file.name, rozpisMimeType: file.type || '' };
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
    let rozpisData = { rozpisUrl: '', rozpisFileName: '', rozpisMimeType: '' };
    if (itemRozpisFile) {
      try {
        setIsUploadingItemImage(true);
        rozpisData = await uploadRozpisFile(itemRozpisFile);
        setIsUploadingItemImage(false);
      } catch (err) {
        setIsUploadingItemImage(false);
        triggerNotification('error', `Chyba pri nahrávaní rozpisu: ${err.message}`);
        return;
      }
    }

    const newItem = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: selectedProduct.id, productName: selectedProduct.name, customCode: selectedProduct.customCode,
      qualityTier: selectedQualityTier.name, gender: selectedGender, qty: qtyNum, activeStations,
      notes: itemNotes, materialsNeeded: neededList, threadQtyM: selectedProduct.threadM * qtyNum, imageUrl, assignedDesignerId: selectedDesignerId, ...rozpisData
    };
    setPendingItems([...pendingItems, newItem]);
    setItemQty(10);
    setItemNotes('');
    setItemImageFile(null);
    setItemImagePreview('');
    setItemRozpisFile(null);
    setSelectedStations(buildAllStationsPreset());
    setSelectedDesignerId('');
    triggerNotification('success', `Položka "${selectedProduct.name}" pridaná do zoznamu zákazky.`);
  };

  const handleRemovePendingItem = (tempId) => setPendingItems(pendingItems.filter(i => i.tempId !== tempId));

  // --- EXPRESNÉ PRIDANIE DOTLAČOVEJ ZÁKAZKY (firma ADY) ---
  // --- KAPACITA VÝROBY ---
  const handleOpenCapacitySettings = () => {
    const draft = {};
    STATION_ORDER.forEach(sid => {
      const existing = capacityConfigs.find(c => c.stationId === sid);
      draft[sid] = existing || { stationId: sid, mode: RATE_BASED_STATIONS.includes(sid) ? 'rate' : 'per_product', rateValue: null, dailyMinutes: 480, machineCount: 1 };
    });
    setCapacityDraft(draft);
    const timesDraft = {};
    STATION_ORDER.forEach(sid => { timesDraft[sid] = stationProductTimes.filter(t => t.stationId === sid); });
    setProductTimesDraft(timesDraft);
    setShowCapacitySettings(true);
  };

  const handleSaveCapacitySettings = async () => {
    if (!hasPermission('manage_catalog')) { triggerNotification('error', 'Nemáte oprávnenie.'); return; }
    for (const sid of STATION_ORDER) {
      const cfg = capacityDraft[sid];
      await supabase.from('station_capacity_config').upsert({
        station_id: sid, mode: cfg.mode, rate_value: cfg.rateValue ? parseFloat(cfg.rateValue) : null,
        daily_minutes: parseFloat(cfg.dailyMinutes) || 480, machine_count: parseInt(cfg.machineCount) || 1
      });
    }
    setShowCapacitySettings(false);
    triggerNotification('success', 'Kapacitné nastavenia boli uložené.');
  };

  const handleAddProductTime = async (stationId) => {
    const label = (newProductTimeLabel[stationId] || '').trim();
    const minutes = parseFloat(newProductTimeMinutes[stationId]);
    if (!label || !minutes || minutes <= 0) { alert('Zadaj názov položky a kladný čas v minútach.'); return; }
    const newRow = { id: `spt-${Date.now()}`, stationId, label, minutesPerUnit: minutes, unit: 'ks' };
    setProductTimesDraft(prev => ({ ...prev, [stationId]: [...(prev[stationId] || []), newRow] }));
    setNewProductTimeLabel(prev => ({ ...prev, [stationId]: '' }));
    setNewProductTimeMinutes(prev => ({ ...prev, [stationId]: '' }));
    await supabase.from('station_product_times').insert({ id: newRow.id, station_id: stationId, label, minutes_per_unit: minutes, unit: 'ks' });
  };

  const handleRemoveProductTime = async (stationId, rowId) => {
    setProductTimesDraft(prev => ({ ...prev, [stationId]: (prev[stationId] || []).filter(r => r.id !== rowId) }));
    await supabase.from('station_product_times').delete().eq('id', rowId);
  };

  const handleSubmitExpressDotlackovka = async () => {
    if (!expressCustomerName.trim()) { alert('Zadaj meno zákazníka.'); return; }
    if (!expressNeededDate) { alert('Zadaj dátum, kedy to zákazník potrebuje.'); return; }
    setIsSubmittingExpress(true);
    try {
      let tovarUrl = '';
      if (expressTovarFile) {
        const path = `${Date.now()}-tovar-${expressTovarFile.name}`;
        const { error: upErr } = await supabase.storage.from('item-images').upload(path, expressTovarFile);
        if (upErr) throw new Error(`Fotka tovaru: ${upErr.message}`);
        tovarUrl = supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl;
      }
      let listokData = { rozpisUrl: '', rozpisFileName: '', rozpisMimeType: '' };
      if (expressListokFile) {
        listokData = await uploadRozpisFile(expressListokFile);
      }

      const now = getFormattedDateTime();
      const orderId = `ZAK-${Date.now()}`;
      const fullYear = new Date().getFullYear();
      const shortYear = String(fullYear).slice(-2);
      const { data: counterData } = await supabase.from('order_number_counters').select('*').eq('company', 'ADY').eq('year', fullYear).maybeSingle();
      const nextNum = counterData?.next_number || 1;
      const orderNumber = `ADY-${shortYear}-${String(nextNum).padStart(4, '0')}`;

      const today = new Date().toISOString().slice(0, 10);
      const activeStations = ['grafik', 'transfer', 'balenie'];
      const initialStatuses = {}; const initialStationDates = {};
      activeStations.forEach(sid => { initialStatuses[sid] = 'caka'; initialStationDates[sid] = today; });
      const maxPriority = allItems.length > 0 ? Math.max(...allItems.map(i => i.priority || 0)) : 0;

      const newItem = {
        itemId: `${orderId}-1`, productId: null, productName: 'Dotlačovka', customCode: '', qualityTier: '', gender: 'neutral', qty: 1,
        notes: '', imageUrl: tovarUrl, assignedDesignerId: '', ...listokData,
        materialsNeeded: [], threadQtyM: 0, priority: maxPriority + 1, productionDate: today, stationDates: initialStationDates,
        stationStatuses: initialStatuses, materialDeducted: false
      };

      const createdBy = expressCreatedBy.trim() || `${currentUser.firstName} ${currentUser.lastName}`;
      const created = {
        id: orderId, customer: expressCustomerName.trim(), createdAt: now, deliveryDate: expressNeededDate, driveLink: '', notes: '',
        paymentType: expressPaymentType, items: [newItem], orderLog: [{ date: now, author: createdBy, text: 'Dotlačová zákazka zaevidovaná cez expresný formulár.' }],
        legacyOrderNumber: '', companyBrand: 'ADY', orderNumber, accountingStatus: null
      };

      const { error } = await supabase.from('orders').insert(mapOrderToDb(created));
      if (error) throw error;
      await supabase.from('order_number_counters').upsert({ company: 'ADY', year: fullYear, next_number: nextNum + 1 }, { onConflict: 'company,year' });

      setShowExpressDotlackovka(false);
      setExpressCustomerName(''); setExpressNeededDate(''); setExpressCreatedBy(''); setExpressListokFile(null); setExpressListokPreview(''); setExpressTovarFile(null); setExpressTovarPreview('');
      triggerNotification('success', `Dotlačová zákazka ${orderNumber} bola zaevidovaná a zaradená na dnešný deň (Grafika/Transfer/Balenie).`);
    } catch (err) {
      triggerNotification('error', `Chyba: ${err.message}`);
    } finally {
      setIsSubmittingExpress(false);
    }
  };

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
      const initialStationDates = {};
      item.activeStations.forEach(sid => { initialStatuses[sid] = 'caka'; initialStationDates[sid] = newOrderDeliveryDate; });
      return {
        itemId, productId: item.productId, productName: item.productName, customCode: item.customCode,
        qualityTier: item.qualityTier, gender: item.gender, qty: item.qty, notes: item.notes, imageUrl: item.imageUrl || '', assignedDesignerId: item.assignedDesignerId || '',
        rozpisUrl: item.rozpisUrl || '', rozpisFileName: item.rozpisFileName || '', rozpisMimeType: item.rozpisMimeType || '',
        materialsNeeded: item.materialsNeeded, threadQtyM: item.threadQtyM, priority: sameDayCount + idx + 1, productionDate: newOrderDeliveryDate, stationDates: initialStationDates,
        stationStatuses: initialStatuses, materialDeducted: (item.materialsNeeded || []).length > 0
      };
    });

    const fullYear = new Date().getFullYear();
    const shortYear = String(fullYear).slice(-2);
    const { data: counterData } = await supabase.from('order_number_counters').select('*').eq('company', newOrderCompany).eq('year', fullYear).maybeSingle();
    const nextNum = counterData?.next_number || 1;
    const orderNumber = `${newOrderCompany}-${shortYear}-${String(nextNum).padStart(4, '0')}`;

    const created = { id: orderId, customer: newOrderCustomer, createdAt: now, deliveryDate: newOrderDeliveryDate, driveLink: orderDriveLink, notes: orderNotes, paymentType: newOrderPaymentType, items: itemsWithMeta, orderLog: [], legacyOrderNumber: newOrderLegacyNumber.trim(), companyBrand: newOrderCompany, orderNumber };
    const { error } = await supabase.from('orders').insert(mapOrderToDb(created));
    if (error) { triggerNotification('error', `Chyba: ${error.message}`); return; }
    await supabase.from('order_number_counters').upsert({ company: newOrderCompany, year: fullYear, next_number: nextNum + 1 }, { onConflict: 'company,year' });

    for (const mu of materialUpdates) {
      await supabase.from('materials').update({ qty: mu.qty, history: mu.history }).eq('id', mu.id);
    }

    setSelectedOrderDetails(created);
    setActiveTab('planner');
    setNewOrderCustomer('');
    setOrderNotes('');
    setOrderDriveLink('https://drive.google.com/');
    setNewOrderLegacyNumber('');
    setNewOrderPaymentType('faktura');
    setNewOrderCompany('ATAK');
    setPendingItems([]);
    triggerNotification('success', `Zákazka ${orderNumber} bola zaradená do výroby (${itemsWithMeta.length} položiek) a materiál bol odpočítaný zo skladu.`);
  };

  const handleMovePriority = async (item, direction) => {
    if (!hasPermission('edit_priority')) { triggerNotification('error', 'Nemáte oprávnenie meniť priority.'); return; }
    const group = allItems.slice().sort((a, b) => a.priority - b.priority);
    const currentIndex = group.findIndex(i => i.itemId === item.itemId);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.length) return;

    setRecentlyMovedItemId(item.itemId);
    setTimeout(() => setRecentlyMovedItemId(prev => (prev === item.itemId ? null : prev)), 600);

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
  };

  // Presun myšou (drag & drop) — funguje popri šípkach, hodí sa hlavne na počítači/myš.
  // Na dotykových tabletoch je spoľahlivejšie použiť šípky ↑↓.
  const handleDragDropReorder = async (draggedItem, targetItem) => {
    if (!hasPermission('edit_priority')) { triggerNotification('error', 'Nemáte oprávnenie meniť priority.'); return; }
    if (!draggedItem || draggedItem.itemId === targetItem.itemId) return;
    const group = allItems.slice().sort((a, b) => a.priority - b.priority);
    const withoutDragged = group.filter(i => i.itemId !== draggedItem.itemId);
    const targetIndex = withoutDragged.findIndex(i => i.itemId === targetItem.itemId);
    withoutDragged.splice(targetIndex, 0, draggedItem);
    const withNewPriority = withoutDragged.map((it, idx) => ({ itemId: it.itemId, orderId: it.orderId, priority: idx + 1 }));

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

  const handleDraftItemRozpisChange = async (itemId, file) => {
    if (!file) return;
    try {
      const rozpisData = await uploadRozpisFile(file);
      setOrderEditDraft(prev => ({ ...prev, items: prev.items.map(it => it.itemId === itemId ? { ...it, ...rozpisData } : it) }));
    } catch (err) {
      triggerNotification('error', `Chyba pri nahrávaní rozpisu: ${err.message}`);
    }
  };

  const handleDraftItemRozpisRemove = (itemId) => {
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.map(it => it.itemId === itemId ? { ...it, rozpisUrl: '', rozpisFileName: '', rozpisMimeType: '' } : it) }));
  };

  const handleRemoveDraftItem = (itemId) => {
    if (!window.confirm('Odstrániť túto položku zo zákazky? (Zmena sa uloží až po kliknutí na "Uložiť zmeny")')) return;
    setOrderEditDraft(prev => ({ ...prev, items: prev.items.filter(it => it.itemId !== itemId) }));
  };

  // --- TRVALÝ DENNÍK ZÁKAZKY (append-only, nedá sa mazať ani upravovať) ---
  const handleAddOrderLogEntry = async (order, text) => {
    if (!text.trim()) return;
    const now = getFormattedDateTime();
    const newLog = [...(order.orderLog || []), { date: now, author: `${currentUser.firstName} ${currentUser.lastName}`, text: text.trim() }];
    const { error } = await supabase.from('orders').update({ order_log: newLog }).eq('id', order.id);
    if (error) { triggerNotification('error', error.message); return; }
    if (selectedOrderDetails?.id === order.id) setSelectedOrderDetails({ ...order, orderLog: newLog });
    setNewOrderLogEntry('');
    triggerNotification('success', 'Poznámka bola pridaná do denníka zákazky.');
  };

  const handleMoveProductionDate = async (orderId, itemId, stationId, newDate) => {
    if (!hasPermission('edit_priority')) { triggerNotification('error', 'Nemáte oprávnenie meniť plán výroby.'); return; }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = order.items.map(item => {
      if (item.itemId !== itemId) return item;
      const currentDates = item.stationDates || {};
      let newDates;
      if (stationId) {
        // Zmena len pre jednu konkrétnu stanicu
        newDates = { ...currentDates, [stationId]: newDate };
      } else {
        // Hromadná zmena — nastaví rovnaký deň pre všetky aktívne stanice (z riadkového zoznamu)
        newDates = { ...currentDates };
        Object.keys(item.stationStatuses || {}).forEach(sid => {
          if (item.stationStatuses[sid] && item.stationStatuses[sid] !== 'neaktivne') newDates[sid] = newDate;
        });
      }
      return stationId
        ? { ...item, stationDates: newDates }
        : { ...item, stationDates: newDates, productionDate: newDate };
    });
    const { error } = await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);
    if (error) { triggerNotification('error', error.message); return; }
    if (selectedOrderDetails?.id === orderId) setSelectedOrderDetails({ ...order, items: updatedItems });
  };

  const handleReassignDesigner = async (orderId, itemId, newDesignerId) => {
    if (!hasPermission('update_status') && !hasPermission('manage_profiles')) { triggerNotification('error', 'Nemáte oprávnenie meniť priradenie.'); return; }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = order.items.map(item => item.itemId === itemId ? { ...item, assignedDesignerId: newDesignerId } : item);
    const { error } = await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);
    if (error) { triggerNotification('error', error.message); return; }
    if (selectedOrderDetails?.id === orderId) setSelectedOrderDetails({ ...order, items: updatedItems });
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
    let rozpisData = { rozpisUrl: '', rozpisFileName: '', rozpisMimeType: '' };
    if (addItemRozpisFile) {
      try { rozpisData = await uploadRozpisFile(addItemRozpisFile); }
      catch (err) { triggerNotification('error', `Chyba pri nahrávaní rozpisu: ${err.message}`); return; }
    }

    const newItemId = `${orderEditDraft.id}-x${Date.now().toString().slice(-6)}`;
    const initialStatuses = {};
    const initialStationDates = {};
    activeStations.forEach(sid => { initialStatuses[sid] = 'caka'; initialStationDates[sid] = orderEditDraft.deliveryDate; });

    const newItem = {
      itemId: newItemId, productId: product.id, productName: product.name, customCode: product.customCode,
      qualityTier: tier?.name || '', gender: addItemGender, qty: qtyNum, notes: addItemNotes, imageUrl, assignedDesignerId: addItemDesignerId, ...rozpisData,
      materialsNeeded: neededList, threadQtyM: product.threadM * qtyNum, priority: allItems.length + 1, productionDate: orderEditDraft.deliveryDate, stationDates: initialStationDates,
      stationStatuses: initialStatuses, materialDeducted: false
    };

    setOrderEditDraft(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setAddItemProductId(''); setAddItemQty(10); setAddItemNotes(''); setAddItemImageFile(null); setAddItemImagePreview(''); setAddItemStations({}); setAddItemDesignerId(''); setAddItemRozpisFile(null);
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
    let code = scannedCode.trim();
    // Ak sa naskenoval celý odkaz (URL v QR kóde), vytiahnuť z neho len kód položky
    const scanParamMatch = code.match(/[?&]scan=([^&]+)/);
    if (scanParamMatch) code = decodeURIComponent(scanParamMatch[1]);
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

  // --- SKENOVANIE KAMEROU (priamo v appke, netreba samostatný fotoaparát) ---
  const startCameraScan = () => {
    setIsCameraScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-camera-region');
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decodedText) => {
            handleQrScan(decodedText);
            stopCameraScan();
          },
          () => { /* ignorovať priebežné neúspešné pokusy o dekódovanie jednotlivých snímok */ }
        );
      } catch (err) {
        triggerNotification('error', `Nepodarilo sa spustiť kameru: ${err?.message || err}. Skontroluj, či appka má povolený prístup ku kamere.`);
        setIsCameraScanning(false);
      }
    }, 150);
  };

  const stopCameraScan = async () => {
    if (html5QrCodeRef.current) {
      try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch (e) { /* kamera už mohla byť zastavená */ }
      html5QrCodeRef.current = null;
    }
    setIsCameraScanning(false);
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

      // Sledovanie, kto na stanici pracuje a koľko to trvalo (od prvého odkliknutia z "Čaká sa" po "Hotové")
      const existingMeta = item.stationMeta?.[stationId] || {};
      let newMeta = { ...existingMeta };
      if (statusId !== 'neaktivne' && statusId !== 'caka' && !existingMeta.startedAt) {
        newMeta = { ...newMeta, startedAt: now, assignedEmployeeId: currentUser.id, assignedEmployeeName: currentUser.firstName, assignedEmployeeAvatar: currentUser.avatar || '' };
      }
      if (statusId !== 'neaktivne' && statusId !== 'caka') {
        newMeta = { ...newMeta, assignedEmployeeId: currentUser.id, assignedEmployeeName: currentUser.firstName, assignedEmployeeAvatar: currentUser.avatar || '' };
      }
      if (statusId === 'hotove' && !existingMeta.completedAt) {
        const started = parseFormattedDateTime(newMeta.startedAt || existingMeta.startedAt);
        const durationMinutes = started ? Math.max(0, Math.round((parseFormattedDateTime(now) - started) / 60000)) : null;
        newMeta = { ...newMeta, completedAt: now, durationMinutes };
      }

      return { ...item, stationStatuses: { ...item.stationStatuses, [stationId]: statusId }, stationMeta: { ...item.stationMeta, [stationId]: newMeta }, materialDeducted: isDeductedNow };
    });

    const updatePayload = { items: updatedItems };
    if (order.paymentType === 'faktura' && !order.accountingStatus && isOrderFullyComplete({ ...order, items: updatedItems })) {
      updatePayload.accounting_status = 'pending_review';
    }
    const { error: orderErr } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
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
      let pinHash = editingEmployee.pinHash;
      if (editEmpPin.trim()) {
        if (!/^\d{4}$/.test(editEmpPin.trim())) { alert('PIN musí mať presne 4 číslice.'); return; }
        pinHash = await hashPassword(editEmpPin.trim());
        if (employees.some(x => x.id !== editingEmployee.id && x.pinHash === pinHash)) { alert('Tento PIN už používa iný zamestnanec. Zvoľte iný.'); return; }
      }
      const updated = { ...editingEmployee, passwordHash, pinHash };
      const { error } = await supabase.from('employees').update(mapEmployeeToDb(updated)).eq('id', updated.id);
      if (error) { triggerNotification('error', error.message); return; }
      if (currentUser.id === updated.id) setCurrentUser(updated);
      setEditingEmployee(null);
      setEditEmpPassword('');
      setEditEmpPin('');
      triggerNotification('success', 'Zamestnanec bol upravený.');
    } else {
      if (!newEmpFirstName.trim() || !newEmpLastName.trim()) { alert('Zadajte meno a priezvisko.'); return; }
      if (['master', 'supervisor', 'sales'].includes(newEmpRole) && !newEmpEmail.trim()) { alert('Pre túto rolu zadajte email — zamestnanec si podľa neho vytvorí prihlasovací účet.'); return; }
      let pinHash = '';
      if (newEmpPin.trim()) {
        if (!/^\d{4}$/.test(newEmpPin.trim())) { alert('PIN musí mať presne 4 číslice.'); return; }
        pinHash = await hashPassword(newEmpPin.trim());
        if (employees.some(x => x.pinHash === pinHash)) { alert('Tento PIN už používa iný zamestnanec. Zvoľte iný.'); return; }
      }
      const passwordHash = newEmpPassword.trim() ? await hashPassword(newEmpPassword.trim()) : '';
      const created = { id: `emp-${Date.now()}`, firstName: newEmpFirstName, lastName: newEmpLastName, birthday: newEmpBirthday, nameday: newEmpNameday, entryDate: newEmpEntryDate, role: newEmpRole, position: newEmpPosition, phone: newEmpPhone, email: newEmpEmail, avatar: newEmpAvatar, passwordHash, pinHash };
      const { error } = await supabase.from('employees').insert(mapEmployeeToDb(created));
      if (error) { triggerNotification('error', error.message); return; }
      setNewEmpFirstName(''); setNewEmpLastName(''); setNewEmpBirthday(''); setNewEmpNameday(''); setNewEmpPosition(''); setNewEmpPhone(''); setNewEmpEmail(''); setNewEmpPassword(''); setNewEmpAvatar(''); setNewEmpPin('');
      triggerNotification('success', `Zamestnanec "${created.firstName}" bol pridaný.`);
    }
  };

  const handleStartEditEmployee = (emp) => { setEditingEmployee({ ...emp }); setEditEmpPassword(''); setEditEmpPin(''); };

  const handleCancelEditEmployee = () => { setEditingEmployee(null); setEditEmpPassword(''); setEditEmpPin(''); };

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

  const getSportStats = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const filtered = allItems.filter(it => {
      if (!it.deliveryDate) return false;
      const d = new Date(it.deliveryDate + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      if (reportPeriod === 'year') return d.getFullYear() === currentYear;
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
    const stats = {};
    filtered.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const sportsForItem = (product?.sports && product.sports.length > 0) ? product.sports : ['Nezaradené'];
      const itemMeters = (item.materialsNeeded || []).reduce((s, m) => s + (m.qtyNeeded || 0), 0);
      const itemMinutes = STATION_ORDER.reduce((s, sid) => s + (item.stationMeta?.[sid]?.durationMinutes || 0), 0);
      sportsForItem.forEach(sport => {
        if (!stats[sport]) stats[sport] = { orderIds: new Set(), qty: 0, meters: 0, minutes: 0 };
        stats[sport].orderIds.add(item.orderId);
        stats[sport].qty += item.qty;
        stats[sport].meters += itemMeters;
        stats[sport].minutes += itemMinutes;
      });
    });
    return Object.entries(stats).map(([sport, s]) => ({ sport, orders: s.orderIds.size, qty: s.qty, meters: parseFloat(s.meters.toFixed(2)), minutes: s.minutes })).sort((a, b) => b.qty - a.qty);
  };
  const sportStats = getSportStats();

  const distinctDeliveryDates = Array.from(new Set(allItems.map(i => i.deliveryDate).filter(Boolean))).sort();

  const getPlannerDates = () => {
    const set = new Set();
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      set.add(d.toISOString().slice(0, 10));
    }
    allItems.forEach(it => {
      if (it.stationDates) Object.values(it.stationDates).forEach(d => { if (d) set.add(d); });
      else if (it.productionDate) set.add(it.productionDate);
    });
    return Array.from(set).sort();
  };
  const plannerDates = getPlannerDates();
  const capacityByStation = {};
  capacityConfigs.forEach(c => { capacityByStation[c.stationId] = c; });
  const productTimesByStation = {};
  stationProductTimes.forEach(t => { (productTimesByStation[t.stationId] = productTimesByStation[t.stationId] || []).push(t); });

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
  const genderLabel = (g) => g === 'men' ? 'Muži' : g === 'women' ? 'Ženy' : g === 'children' ? 'Deti' : 'Neutrálne';

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
    if (loginStep === 'totp' && pendingTotpEmployee) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="space-y-1">
              <div className="bg-gradient-to-br from-indigo-500 to-pink-500 p-3 rounded-xl text-white inline-flex mb-1"><Lock className="h-6 w-6" /></div>
              <h1 className="text-lg font-extrabold text-white">Dvojfaktorové overenie</h1>
              <p className="text-xs text-slate-500">Zadaj 6-miestny kód z appky Google Authenticator / Authy pre {pendingTotpEmployee.firstName}</p>
            </div>
            <input
              type="text" inputMode="numeric" maxLength={6} autoFocus
              value={loginTotpCode}
              onChange={(e) => { setLoginTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setLoginTotpError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyLoginTotp()}
              className="w-full bg-slate-900 border-2 border-slate-700 focus:border-indigo-500 text-white text-2xl font-mono text-center tracking-[0.5em] rounded-xl px-4 py-3"
              placeholder="000000"
            />
            {loginTotpError && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{loginTotpError}</p>}
            <button onClick={handleVerifyLoginTotp} disabled={isVerifyingTotp || loginTotpCode.length !== 6} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
              {isVerifyingTotp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Potvrdiť
            </button>
            <button onClick={handleCancelTotpLogin} className="text-[10px] text-slate-600 hover:text-slate-400 underline">Späť na prihlásenie</button>
          </div>
        </div>
      );
    }
    if (activeStationContext) {
      const stationCfg = STATION_CONFIGS[activeStationContext];
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="space-y-1">
              <div className="bg-gradient-to-br from-indigo-500 to-pink-500 p-3 rounded-xl text-white inline-flex mb-1">
                {stationCfg && <stationCfg.icon className="h-6 w-6" />}
              </div>
              <h1 className="text-lg font-extrabold text-white">{stationCfg?.name || activeStationContext}</h1>
              <p className="text-xs text-slate-500">Zadaj svoj 4-miestny PIN</p>
            </div>

            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 ${pinDigits.length > i ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'}`}></div>
              ))}
            </div>

            {pinLockedUntil ? (
              <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">Zamknuté, skús znova o {pinLockCountdown}s</p>
            ) : pinError ? (
              <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{pinError}</p>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button key={d} onClick={() => handlePinDigitPress(d)} disabled={!!pinLockedUntil} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xl font-bold rounded-xl py-4">{d}</button>
              ))}
              <button onClick={() => setActiveStationContext(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl py-4">Zrušiť</button>
              <button onClick={() => handlePinDigitPress('0')} disabled={!!pinLockedUntil} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xl font-bold rounded-xl py-4">0</button>
              <button onClick={handlePinBackspace} disabled={!!pinLockedUntil} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-xl py-4">⌫</button>
            </div>

            <button onClick={() => setActiveStationContext(null)} className="text-[10px] text-slate-600 hover:text-slate-400 underline">Prihlásiť sa menom a heslom namiesto toho</button>
          </div>
        </div>
      );
    }

    if (mfaStep) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="space-y-1">
              <div className="bg-gradient-to-br from-indigo-500 to-pink-500 p-3 rounded-xl text-white inline-flex mb-1"><Lock className="h-6 w-6" /></div>
              <h1 className="text-lg font-extrabold text-white">Dvojfaktorové overenie</h1>
              <p className="text-xs text-slate-500">Zadaj 6-miestny kód z appky Google Authenticator / Authy</p>
            </div>
            <input
              type="text" inputMode="numeric" maxLength={6} autoFocus
              value={mfaCode}
              onChange={(e) => { setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setMfaError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleMfaVerify()}
              className="w-full bg-slate-900 border-2 border-slate-700 focus:border-indigo-500 text-white text-2xl font-mono text-center tracking-[0.5em] rounded-xl px-4 py-3"
              placeholder="000000"
            />
            {mfaError && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{mfaError}</p>}
            <button onClick={handleMfaVerify} disabled={isAuthBusy || mfaCode.length !== 6} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
              {isAuthBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Potvrdiť
            </button>
            <button onClick={handleAuthLogout} className="text-[10px] text-slate-600 hover:text-slate-400 underline">Späť na prihlásenie</button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <img src="/logo-atak-pbt.png" alt="ATAK x PBT" className="h-10 w-auto brightness-0 invert mx-auto mb-2" />
            <h1 className="text-lg font-extrabold text-white">TEX-MASTER ERP</h1>
            <p className="text-xs text-slate-500">{authScreenMode === 'login' ? 'Prihlásenie pre Master / Supervisor / Obchodníka' : 'Vytvorenie prihlasovacieho účtu'}</p>
          </div>
          <form onSubmit={authScreenMode === 'login' ? handleAuthLogin : handleAuthSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
              <input type="email" value={authEmail} onChange={(e) => { setAuthEmail(e.target.value); setAuthError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Heslo</label>
              <input type="password" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
            </div>
            {authScreenMode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Zopakuj heslo</label>
                <input type="password" value={authSignupPassword2} onChange={(e) => { setAuthSignupPassword2(e.target.value); setAuthError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
              </div>
            )}
            {authError && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{authError}</p>}
            <button type="submit" disabled={isAuthBusy} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
              {isAuthBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {authScreenMode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet'}
            </button>
          </form>
          <button onClick={() => { setAuthScreenMode(authScreenMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 underline">
            {authScreenMode === 'login' ? 'Ešte nemáš účet? Vytvor si ho' : 'Už máš účet? Prihlásiť sa'}
          </button>
          <p className="text-center text-[10px] text-slate-600">Bežný zamestnanec na stanici sa prihlasuje naskenovaním QR kódu na stroji a zadaním PIN-u.</p>
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
          {problemReports.filter(p => p.status === 'open').length > 0 && hasPermission('view_reports') && (
            <button onClick={() => setActiveTab('problems')} className="px-3 py-1 rounded-md font-bold border bg-rose-600 text-white border-rose-500 animate-pulse flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {problemReports.filter(p => p.status === 'open').length} nevyriešených problémov
            </button>
          )}
          {currentUser.role === 'master' && (
            <button onClick={() => setShowMasterSwitcher(s => !s)} className="px-3 py-1 rounded-md font-bold border bg-slate-900 text-indigo-400 border-slate-800 hover:text-white">
              {showMasterSwitcher ? 'Skryť testovací prepínač' : 'Testovať ako iný profil'}
            </button>
          )}
          {activeStationContext ? (
            <button onClick={handleQuickStationLogout} className="px-3 py-1 rounded-md font-bold border bg-rose-950/40 text-rose-400 border-rose-900/40 hover:bg-rose-900/40">Odhlásiť sa (ďalší pracovník)</button>
          ) : (
            <button onClick={authSession ? handleAuthLogout : handleLogout} className="px-3 py-1 rounded-md font-bold border bg-rose-950/40 text-rose-400 border-rose-900/40 hover:bg-rose-900/40">Odhlásiť sa</button>
          )}
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
              {hasPermission('view_reports') && (
                <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><BarChart3 className="h-3.5 w-3.5" /> Prehľady</button>
              )}
              <button onClick={() => setActiveTab('designers')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'designers' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Palette className="h-3.5 w-3.5" /> Dashboard Grafikov</button>
              {hasPermission('view_reports') && (
                <button onClick={() => setActiveTab('problems')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'problems' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><AlertTriangle className="h-3.5 w-3.5" /> Problémy</button>
              )}
              {hasPermission('create_order') && (
                <button onClick={() => setActiveTab('invoices')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'invoices' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><FileEdit className="h-3.5 w-3.5" /> Financie{orders.filter(o => o.accountingStatus === 'pending_review').length > 0 && <span className="bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">{orders.filter(o => o.accountingStatus === 'pending_review').length}</span>}</button>
              )}
              <button onClick={() => setActiveTab('archive')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'archive' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Search className="h-3.5 w-3.5" /> História Zákaziek</button>
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
                  {hasPermission('manage_profiles') && (
                    <button onClick={() => setPlannerViewMode('staffing')} className={`flex-1 md:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${plannerViewMode === 'staffing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><CalendarDays className="h-3.5 w-3.5" /> Rozvrh Zamestnancov</button>
                  )}
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
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={showCapacityBars} onChange={(e) => setShowCapacityBars(e.target.checked)} className="accent-indigo-600" /> Zobraziť vyťaženie
                      </label>
                      {hasPermission('manage_catalog') && (
                        <button onClick={handleOpenCapacitySettings} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Sliders className="h-3.5 w-3.5" /> Kapacita výroby</button>
                      )}
                      <span className="text-[10px] italic hidden lg:inline">Farba rámčeka = zákazka</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                    <table className="w-full text-left border-collapse" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${100 / (zoomLevel / 100)}%` }}>
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-32 border-r border-slate-850 sticky left-0 bg-slate-900 z-10">Dátum</th>
                          {STATION_ORDER.map(stationId => {
                            const config = STATION_CONFIGS[stationId];
                            return (
                              <th key={stationId} className="p-3 text-xs font-bold text-slate-300 uppercase tracking-wider text-center border-r border-slate-850">
                                <div className="flex items-center justify-center gap-1.5"><config.icon className="h-4 w-4 text-indigo-400 shrink-0" /><span>{config.name}</span></div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {plannerDates.map(date => (
                          <tr key={date} className="hover:bg-slate-900/10">
                            <td className={`p-3 font-bold text-xs bg-slate-900/40 border-r border-slate-850 sticky left-0 z-10 ${isUrgentDate(date) ? 'bg-rose-900/50 text-rose-300' : 'text-slate-200'}`}>
                              {formatDeliveryDate(date)}
                            </td>
                            {STATION_ORDER.map(stationId => {
                              const config = STATION_CONFIGS[stationId];
                              const dayItems = allItems.filter(it => getItemStationDate(it, stationId) === date && it.stationStatuses[stationId] && it.stationStatuses[stationId] !== 'neaktivne').sort((a, b) => a.priority - b.priority);
                              const load = showCapacityBars ? computeStationLoad(date, stationId, allItems, capacityByStation, productTimesByStation) : null;
                              return (
                                <td
                                  key={stationId}
                                  onDragEnter={(e) => { if (hasPermission('edit_priority') && draggedMatrixCard?.stationId === stationId) { e.preventDefault(); setDragOverMatrixCell({ date, stationId }); } }}
                                  onDragOver={(e) => {
                                    if (!hasPermission('edit_priority') || draggedMatrixCard?.stationId !== stationId) return;
                                    e.preventDefault();
                                    setDragOverMatrixCell(prev => (prev && prev.date === date && prev.stationId === stationId ? prev : { date, stationId }));
                                  }}
                                  onDragLeave={(e) => {
                                    // Prehliadač vie vyvolať "leave" aj pri prechode nad vnoreným prvkom vnútri tej istej bunky (napr. keď sa objaví/zmizne rámček) — to ignorujeme, aby to neblikalo
                                    if (e.currentTarget.contains(e.relatedTarget)) return;
                                    setDragOverMatrixCell(prev => (prev && prev.date === date && prev.stationId === stationId ? null : prev));
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverMatrixCell(null);
                                    if (!hasPermission('edit_priority') || !draggedMatrixCard) return;
                                    if (draggedMatrixCard.stationId !== stationId) return; // presun len v rámci rovnakého stĺpca (stanice)
                                    handleMoveProductionDate(draggedMatrixCard.orderId, draggedMatrixCard.itemId, stationId, date);
                                    setDraggedMatrixCard(null);
                                  }}
                                  className={`p-1 border-r border-slate-850 align-top min-h-[110px] transition-all duration-150 ${
                                    dragOverMatrixCell?.date === date && dragOverMatrixCell?.stationId === stationId
                                      ? 'bg-indigo-950/50 ring-2 ring-inset ring-indigo-500'
                                      : draggedMatrixCard?.stationId === stationId ? 'bg-slate-950/40 outline outline-1 outline-dashed outline-indigo-700/40' : 'bg-slate-950/15'
                                  }`}
                                >
                                  {dragOverMatrixCell?.date === date && dragOverMatrixCell?.stationId === stationId && draggedMatrixCard && (
                                    <div className="h-8 mb-1 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-500/10 flex items-center justify-center animate-pulse pointer-events-none">
                                      <span className="text-[9px] text-indigo-300 font-bold">⬇ Sem sa presunie</span>
                                    </div>
                                  )}
                                  {load && load.capacityMinutes > 0 && (
                                    <div className="mb-1 px-0.5" title={`Vyťaženie: ${Math.round(load.percent)}% (${Math.round(load.usedMinutes)} / ${Math.round(load.capacityMinutes)} min)`}>
                                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full ${loadBarColor(load.percent)} transition-all`} style={{ width: `${Math.min(100, load.percent)}%` }} />
                                      </div>
                                      <span className="text-[8px] text-slate-500 font-bold">{Math.round(load.percent)}%</span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 gap-1">
                                    {dayItems.map(item => {
                                      const statusId = item.stationStatuses[stationId];
                                      const statusCfg = config.statuses.find(s => s.id === statusId) || config.statuses[0];
                                      const orderColor = colorForOrder(item.orderId);
                                      const isBeingDragged = draggedMatrixCard?.itemId === item.itemId && draggedMatrixCard?.stationId === stationId;
                                      return (
                                        <div 
                                          key={item.itemId} 
                                          style={isBeingDragged ? { opacity: 0.35 } : undefined}
                                          draggable={hasPermission('edit_priority')}
                                          onDragStart={() => setDraggedMatrixCard({ orderId: item.orderId, itemId: item.itemId, stationId })}
                                          onDragEnd={() => { setDraggedMatrixCard(null); setDragOverMatrixCell(null); }}
                                          onClick={() => openOrderDetails(orders.find(o => o.id === item.orderId))} 
                                          className={`bg-slate-900 hover:bg-slate-800 border-l-4 ${orderColor.border} border-t border-r border-b border-slate-750 p-2 rounded cursor-pointer transition-all flex flex-col justify-between text-[10px] space-y-1 shadow hover:scale-[1.02] transform ${hasPermission('edit_priority') ? 'active:cursor-grabbing' : ''}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-mono font-bold text-indigo-400">#{item.priority} • {item.itemId}</span>
                                            <div className="flex items-center gap-1">
                                              {item.stationMeta?.[stationId]?.assignedEmployeeAvatar && (
                                                <span title={item.stationMeta[stationId].assignedEmployeeName} className="text-sm leading-none cursor-help">{item.stationMeta[stationId].assignedEmployeeAvatar}</span>
                                              )}
                                              <CashBadge paymentType={item.paymentType} size="small" />
                                              <span className="text-slate-400 font-bold">{item.qty}ks</span>
                                            </div>
                                          </div>
                                          <p className="font-extrabold text-slate-100 truncate">{item.customer}</p>
                                          <p className="text-[9px] text-slate-300 truncate">{item.productName} ({item.qualityTier})</p>
                                          <div className={`text-[8px] px-1 py-0.5 rounded ${isUrgentDate(item.deliveryDate) ? 'bg-rose-950/60 text-rose-300 font-bold' : 'bg-slate-950/60 text-slate-500'}`}>
                                            Termín: {formatDeliveryDate(item.deliveryDate)}
                                          </div>
                                          {hasPermission('edit_priority') && (
                                            <input
                                              type="date"
                                              value={getItemStationDate(item, stationId) || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => handleMoveProductionDate(item.orderId, item.itemId, stationId, e.target.value)}
                                              className="text-[8px] bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-400 w-full"
                                              title="Presunúť túto stanicu na iný deň (alebo pretiahni kartu do iného riadku)"
                                            />
                                          )}
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
                        ))}
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
                          <th className="px-4 py-3 text-center">Termín (deadline)</th>
                          <th className="px-4 py-3 text-center">Deň výroby (všetky st.)</th>
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
                          const justMoved = recentlyMovedItemId === item.itemId;
                          return (
                            <tr 
                              key={item.itemId} 
                              draggable={canReorder}
                              onDragStart={() => setDraggedRowItem(item)}
                              onDragOver={(e) => { if (canReorder) e.preventDefault(); }}
                              onDrop={() => canReorder && handleDragDropReorder(draggedRowItem, item)}
                              className={`transition-colors duration-500 ${justMoved ? 'bg-indigo-600/30' : 'hover:bg-slate-800/40'} border-l-4 ${orderColor.border} ${canReorder ? 'cursor-move' : ''}`}
                            >
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  {canReorder && (
                                    <>
                                      <GripVertical className="h-3.5 w-3.5 text-slate-600 shrink-0 hidden sm:block" />
                                      <div className="flex flex-col gap-1">
                                        <button onClick={() => handleMovePriority(item, -1)} className="p-1.5 bg-slate-800 hover:bg-indigo-700 active:bg-indigo-500 active:scale-90 rounded text-slate-400 hover:text-white transition-transform duration-100 touch-manipulation"><ArrowUp className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleMovePriority(item, 1)} className="p-1.5 bg-slate-800 hover:bg-indigo-700 active:bg-indigo-500 active:scale-90 rounded text-slate-400 hover:text-white transition-transform duration-100 touch-manipulation"><ArrowDown className="h-3.5 w-3.5" /></button>
                                      </div>
                                    </>
                                  )}
                                  <span className="font-mono font-bold text-indigo-300">#{item.priority}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-indigo-400">{item.itemId}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{item.orderNumber || item.orderId} <span className={`ml-1 text-[9px] font-extrabold px-1 py-0.5 rounded ${companyBrandBadgeClass(item.companyBrand)}`}>{item.companyBrand || 'ATAK'}</span></td>
                              <td className="px-4 py-3 font-bold text-white flex items-center gap-1.5"><CashBadge paymentType={item.paymentType} size="small" /> {item.customer}</td>
                              <td className="px-4 py-3 text-slate-300">{item.productName} (<span className="text-indigo-400">{item.qualityTier}</span>)</td>
                              <td className="px-4 py-3 text-center font-bold text-white">{item.qty}</td>
                              <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded font-bold ${isUrgentDate(item.deliveryDate) ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800'}`}>{formatDeliveryDate(item.deliveryDate)}</span></td>
                              <td className="px-4 py-3 text-center">
                                {hasPermission('edit_priority') ? (
                                  <input type="date" value={item.productionDate || ''} onChange={(e) => handleMoveProductionDate(item.orderId, item.itemId, null, e.target.value)} title="Nastaví rovnaký deň pre všetky stanice tejto položky. Pre jednotlivé stanice zvlášť použi Plánovaciu Maticu." className={`bg-slate-950 border rounded px-1.5 py-1 text-[11px] ${isUrgentDate(item.productionDate) ? 'border-indigo-500 text-indigo-300 font-bold' : 'border-slate-800 text-slate-400'}`} />
                                ) : (
                                  <span className="text-slate-400">{formatDeliveryDate(item.productionDate)}</span>
                                )}
                              </td>
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

              {plannerViewMode === 'staffing' && (() => {
                const weekDates = getWeekDates(staffingWeekOffset);
                const todayStr = new Date().toISOString().slice(0, 10);
                const conflictSet = new Set(); // "date|employeeId" ak je priradený na 2+ staniciach
                const perDayEmp = {};
                stationAssignments.filter(a => weekDates.includes(a.date)).forEach(a => {
                  const key = `${a.date}|${a.employeeId}`;
                  perDayEmp[key] = (perDayEmp[key] || 0) + 1;
                  if (perDayEmp[key] > 1) conflictSet.add(key);
                });
                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setStaffingWeekOffset(o => o - 1)} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300"><ArrowUp className="h-4 w-4 -rotate-90" /></button>
                        <span className="text-sm font-bold text-white px-2">{staffingWeekOffset === 0 ? 'Tento týždeň' : staffingWeekOffset === -1 ? 'Minulý týždeň' : staffingWeekOffset === 1 ? 'Budúci týždeň' : `${weekDates[0]} — ${weekDates[6]}`}</span>
                        <button onClick={() => setStaffingWeekOffset(o => o + 1)} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300"><ArrowDown className="h-4 w-4 -rotate-90" /></button>
                      </div>
                      <button onClick={handleCopyPreviousWeek} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Kopírovať z minulého týždňa</button>
                    </div>

                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-800">
                            <th className="p-3 text-xs font-bold text-slate-400 uppercase w-28 border-r border-slate-850 sticky left-0 bg-slate-900 z-10">Deň</th>
                            {STATION_ORDER.map(sid => {
                              const cfg = STATION_CONFIGS[sid];
                              return (
                                <th key={sid} className="p-3 text-xs font-bold text-slate-300 uppercase text-center border-r border-slate-850">
                                  <div className="flex items-center justify-center gap-1.5"><cfg.icon className="h-4 w-4 text-indigo-400 shrink-0" />{cfg.name}</div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {weekDates.map((date, idx) => (
                            <tr key={date} className={date === todayStr ? 'bg-indigo-950/10' : ''}>
                              <td className={`p-3 text-xs font-bold border-r border-slate-850 sticky left-0 z-10 ${date === todayStr ? 'bg-indigo-950/30 text-indigo-300' : 'bg-slate-900/40 text-slate-200'}`}>
                                {WEEKDAY_LABELS[idx]}<br /><span className="text-[10px] text-slate-500 font-normal">{formatDeliveryDate(date)}</span>
                              </td>
                              {STATION_ORDER.map(sid => {
                                const cellAssignments = stationAssignments.filter(a => a.date === date && a.stationId === sid);
                                const isUnstaffedToday = date === todayStr && cellAssignments.length === 0;
                                const isPickerOpen = staffingPickerCell && staffingPickerCell.date === date && staffingPickerCell.stationId === sid;
                                return (
                                  <td key={sid} className={`p-2 border-r border-slate-850 align-top min-w-[140px] ${isUnstaffedToday ? 'bg-rose-950/20' : ''}`}>
                                    <div className="flex flex-col gap-1">
                                      {cellAssignments.map(a => {
                                        const emp = employees.find(e => e.id === a.employeeId);
                                        const hasConflict = conflictSet.has(`${date}|${a.employeeId}`);
                                        return (
                                          <div key={a.id} className={`flex items-center justify-between gap-1 px-2 py-1 rounded-md text-[11px] font-bold ${hasConflict ? 'bg-amber-950/40 border border-amber-700/40 text-amber-300' : 'bg-slate-800 text-slate-200'}`}>
                                            <span className="flex items-center gap-1 truncate">{emp?.avatar} {emp?.firstName || '?'}{hasConflict && <span title="Priradený aj na inej stanici v tento deň">⚠️</span>}</span>
                                            <button onClick={() => handleRemoveAssignment(a.id)} className="text-slate-500 hover:text-rose-400 shrink-0"><X className="h-3 w-3" /></button>
                                          </div>
                                        );
                                      })}
                                      {isPickerOpen ? (
                                        <select autoFocus onChange={(e) => e.target.value && handleAssignEmployee(date, sid, e.target.value)} onBlur={() => setStaffingPickerCell(null)} className="w-full bg-slate-950 border border-indigo-600 rounded p-1 text-[10px] text-white">
                                          <option value="">-- Vyber zamestnanca --</option>
                                          {employees.filter(e => !cellAssignments.some(a => a.employeeId === e.id)).map(e => <option key={e.id} value={e.id}>{e.avatar} {e.firstName} {e.lastName}</option>)}
                                        </select>
                                      ) : (
                                        <button onClick={() => setStaffingPickerCell({ date, stationId: sid })} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 px-1"><Plus className="h-3 w-3" /> Priradiť</button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Červené podfarbenie = dnes na tejto stanici nie je nikto priradený. ⚠️ = zamestnanec je v ten deň priradený na viac staníc naraz.</p>

                    {loginMismatches.length > 0 && (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-amber-900/30">
                        <h4 className="font-bold text-xs text-amber-300 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Nezhody prihlásenia (posledných {loginMismatches.length})</h4>
                        <p className="text-[10px] text-slate-500 mb-2">Zamestnanec sa prihlásil PIN-om na stanicu, kde v ten deň nebol priradený. Nič to neblokovalo, je to len na kontrolu.</p>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {loginMismatches.map(m => (
                            <div key={m.id} className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded flex justify-between">
                              <span><strong className="text-slate-200">{m.employeeName}</strong> → {STATION_CONFIGS[m.stationId]?.name || m.stationId}</span>
                              <span className="text-slate-600">{formatDeliveryDate(m.date)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                <div className="flex justify-end">
                  <button onClick={() => { setShowExpressDotlackovka(true); setExpressCreatedBy(`${currentUser.firstName} ${currentUser.lastName}`); setExpressNeededDate(new Date().toISOString().slice(0, 10)); }} className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-lg"><Zap className="h-4 w-4" /> Expresné pridanie dotlačovej zákazky</button>
                </div>
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
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Firma</label>
                      <div className="grid grid-cols-2 gap-1">
                        <button type="button" onClick={() => setNewOrderCompany('ATAK')} className={`py-2 text-center text-xs font-bold rounded transition-colors ${newOrderCompany === 'ATAK' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>ATAK</button>
                        <button type="button" onClick={() => setNewOrderCompany('PBT')} className={`py-2 text-center text-xs font-bold rounded transition-colors ${newOrderCompany === 'PBT' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>PBT</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Spôsob platby</label>
                      <div className="grid grid-cols-2 gap-1">
                        <button type="button" onClick={() => setNewOrderPaymentType('faktura')} className={`py-2 text-center text-xs font-bold rounded transition-colors ${newOrderPaymentType === 'faktura' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>Faktúra</button>
                        <button type="button" onClick={() => setNewOrderPaymentType('hotovost')} className={`py-2 text-center text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 ${newOrderPaymentType === 'hotovost' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}><Banknote className="h-3.5 w-3.5" /> Hotovosť ($)</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Staré číslo zákazky (voliteľné, ak je to opakovanie)</label>
                      <input type="text" value={newOrderLegacyNumber} onChange={(e) => setNewOrderLegacyNumber(e.target.value)} placeholder="napr. ZAK-2024-0087" className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
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
                        <div className="grid grid-cols-2 gap-1">
                          {['men', 'women', 'children', 'neutral'].map(g => (
                            <button type="button" key={g} onClick={() => setSelectedGender(g)} className={`py-1.5 text-center text-xs font-bold rounded transition-colors ${selectedGender === g ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}>{genderLabel(g)}</button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 italic">"Neutrálne" použi napr. pre vlajky a iné produkty bez veľkostnej kategórie.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Množstvo (ks)</label>
                        <input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} onBlur={(e) => { const n = parseInt(e.target.value); setItemQty(n && n >= 1 ? n : 1); }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-white" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2"><Sliders className="h-4 w-4 text-indigo-400" /> Výrobné stanice pre túto položku</h3>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => setSelectedStations(buildAllStationsPreset())} className={`py-1.5 text-center text-[11px] font-bold rounded transition-colors ${matchesStationPreset(selectedStations, buildAllStationsPreset()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>Výroba (všetko)</button>
                        <button type="button" onClick={() => setSelectedStations(buildPrintOnlyPreset())} className={`py-1.5 text-center text-[11px] font-bold rounded transition-colors ${matchesStationPreset(selectedStations, buildPrintOnlyPreset()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>Len potlač</button>
                      </div>
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
                      {selectedStations.grafik && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Priradený grafik (voliteľné)</label>
                          <select value={selectedDesignerId} onChange={(e) => setSelectedDesignerId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                            <option value="">-- Nepriradený (uvidí ktokoľvek na Grafike) --</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.avatar} {e.firstName} {e.lastName}</option>)}
                          </select>
                        </div>
                      )}
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
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Rozpis (voliteľné) — veľkosti, špecifikácie a pod., zobrazí sa na 2. strane sprievodky</label>
                        {itemRozpisFile ? (
                          <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                            <span className="text-xs text-slate-300 truncate">📎 {itemRozpisFile.name}</span>
                            <button type="button" onClick={() => setItemRozpisFile(null)} className="text-rose-400 hover:text-rose-300 shrink-0"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-800 rounded-lg py-4 cursor-pointer hover:border-indigo-600 transition-colors">
                            <Upload className="h-5 w-5 text-slate-500" />
                            <span className="text-[10px] text-slate-500">Klikni a vyber súbor (obrázok, PDF, Excel...)</span>
                            <input type="file" accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) setItemRozpisFile(file); }} />
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
                      {(() => {
                        if (!selectedProduct) return null;
                        const qtyNum = parseInt(itemQty) || 0;
                        const livePreview = [
                          selectedProduct.layer1 ? { layerName: 'Primárna látka', materialId: selectedLayer1Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer1', qtyNum) } : null,
                          selectedProduct.layer2 && selectedLayer2Mat ? { layerName: 'Sekundárna látka', materialId: selectedLayer2Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer2', qtyNum) } : null,
                          selectedProduct.layer3 && selectedLayer3Mat ? { layerName: 'Terciárna látka', materialId: selectedLayer3Mat, qtyNeeded: calculateLayerConsumption(selectedProduct, selectedGender, 'layer3', qtyNum) } : null,
                        ].filter(Boolean);
                        const reservedMap = {};
                        pendingItems.forEach(pi => (pi.materialsNeeded || []).forEach(n => { reservedMap[n.materialId] = (reservedMap[n.materialId] || 0) + n.qtyNeeded; }));
                        const warnings = computeStockWarnings(livePreview, materials, reservedMap);
                        if (warnings.length === 0) return null;
                        return (
                          <div className="bg-rose-950/40 border-2 border-rose-600 rounded-xl p-3 space-y-1.5 animate-in fade-in">
                            <p className="text-xs font-extrabold text-rose-300 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Pozor — nedostatok materiálu na sklade!</p>
                            {warnings.map(w => (
                              <p key={w.materialId} className="text-[11px] text-rose-200">
                                <strong>{w.name}</strong>: {w.status === 'insufficient'
                                  ? <>potrebné {w.needed} {w.unit}, na sklade je len {w.available} {w.unit} (chýba {w.shortBy} {w.unit})</>
                                  : <>po tejto zákazke ostane už len {w.remaining} {w.unit} — na tesno, treba doobjednať</>}
                              </p>
                            ))}
                            <p className="text-[10px] text-rose-400 italic">Treba doobjednať materiál, alebo vybrať alternatívnu látku vyššie.</p>
                          </div>
                        );
                      })()}
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
                      <div className="space-y-2">
                        <label className="block text-slate-400 font-semibold mb-1">Látka 1 (Primárna) — voliteľné</label>
                        <select value={editingProduct ? (editingProduct.layer1?.materialId || '') : newModelPrimary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer1: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: editingProduct.layer1?.consumption?.men ? { lt5: 0, ge5: 0 } : (editingProduct.layer1?.consumption || { lt5: 0, ge5: 0 }) } : null });
                            else setNewModelPrimary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna (len dotlač) --</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {(editingProduct ? editingProduct.layer1 : newModelPrimary) && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 1-4 ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer1?.consumption?.lt5 ?? '') : newModelLayer1Lt5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer1: { ...editingProduct.layer1, consumption: { ...editingProduct.layer1.consumption, lt5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer1Lt5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 5+ ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer1?.consumption?.ge5 ?? '') : newModelLayer1Ge5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer1: { ...editingProduct.layer1, consumption: { ...editingProduct.layer1.consumption, ge5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer1Ge5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-slate-400 font-semibold mb-1">Látka 2 (Sekundárna)</label>
                        <select value={editingProduct ? (editingProduct.layer2?.materialId || '') : newModelSecondary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer2: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: editingProduct.layer2?.consumption?.men ? { lt5: 0, ge5: 0 } : (editingProduct.layer2?.consumption || { lt5: 0, ge5: 0 }) } : null });
                            else setNewModelSecondary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna --</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {(editingProduct ? editingProduct.layer2 : newModelSecondary) && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 1-4 ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer2?.consumption?.lt5 ?? '') : newModelLayer2Lt5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer2: { ...editingProduct.layer2, consumption: { ...editingProduct.layer2.consumption, lt5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer2Lt5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 5+ ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer2?.consumption?.ge5 ?? '') : newModelLayer2Ge5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer2: { ...editingProduct.layer2, consumption: { ...editingProduct.layer2.consumption, ge5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer2Ge5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-slate-400 font-semibold mb-1">Látka 3 (Terciárna)</label>
                        <select value={editingProduct ? (editingProduct.layer3?.materialId || '') : newModelTertiary} onChange={(e) => {
                            if (editingProduct) setEditingProduct({ ...editingProduct, layer3: e.target.value ? { materialId: e.target.value, alternativeIds: [], consumption: editingProduct.layer3?.consumption?.men ? { lt5: 0, ge5: 0 } : (editingProduct.layer3?.consumption || { lt5: 0, ge5: 0 }) } : null });
                            else setNewModelTertiary(e.target.value);
                          }} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">
                          <option value="">-- Žiadna --</option>
                          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {(editingProduct ? editingProduct.layer3 : newModelTertiary) && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 1-4 ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer3?.consumption?.lt5 ?? '') : newModelLayer3Lt5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer3: { ...editingProduct.layer3, consumption: { ...editingProduct.layer3.consumption, lt5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer3Lt5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Spotreba 5+ ks (m)</label>
                              <input type="number" step="0.01" value={editingProduct ? (editingProduct.layer3?.consumption?.ge5 ?? '') : newModelLayer3Ge5} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, layer3: { ...editingProduct.layer3, consumption: { ...editingProduct.layer3.consumption, ge5: parseFloat(e.target.value) || 0 } } }) : setNewModelLayer3Ge5(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Dámsky strih (% z pánskeho)</label>
                        <input type="number" step="1" value={editingProduct ? (editingProduct.womenRatioPercent ?? 90) : newModelWomenRatio} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, womenRatioPercent: parseFloat(e.target.value) || 0 }) : setNewModelWomenRatio(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                        <p className="text-[10px] text-slate-500 mt-0.5">napr. 90 = dámsky strih spotrebuje 90% pánskej spotreby</p>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Detský strih (% z pánskeho)</label>
                        <input type="number" step="1" value={editingProduct ? (editingProduct.childrenRatioPercent ?? 65) : newModelChildrenRatio} onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, childrenRatioPercent: parseFloat(e.target.value) || 0 }) : setNewModelChildrenRatio(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                        <p className="text-[10px] text-slate-500 mt-0.5">napr. 65 = detský strih spotrebuje 65% pánskej spotreby</p>
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
                    const itemOpenProblems = problemReports.filter(p => p.itemId === item.itemId && p.status === 'open');
                    return (
                      <div key={item.itemId} className={`bg-slate-900/80 border-l-4 ${orderColor.border} border-t border-r border-b border-slate-800 p-5 rounded-xl flex flex-col md:flex-row justify-between gap-4`}>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold bg-indigo-600/20 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/30">Priorita #{index + 1}</span>
                            <span className="font-mono text-xs font-semibold text-slate-500">ID: {item.itemId}</span>
                            <CashBadge paymentType={item.paymentType} size="small" />
                            {item.stationMeta?.[activeStationFilter]?.assignedEmployeeAvatar && (
                              <span className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full pl-1 pr-2 py-0.5 text-[10px] text-slate-300 font-bold">
                                <span className="text-sm leading-none">{item.stationMeta[activeStationFilter].assignedEmployeeAvatar}</span>
                                {item.stationMeta[activeStationFilter].assignedEmployeeName}
                              </span>
                            )}
                            {itemOpenProblems.length > 0 && (
                              <span className="flex items-center gap-1 bg-rose-950/50 border border-rose-700/50 rounded-full px-2 py-0.5 text-[10px] text-rose-300 font-bold"><AlertTriangle className="h-3 w-3" /> Nahlásený problém</span>
                            )}
                            <button onClick={() => { setReportingProblemForItem(item); setProblemCategory(PROBLEM_CATEGORIES[0]); setProblemDescription(''); }} className="ml-auto text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Nahlásiť problém</button>
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
                        <button onClick={() => { setShowDeliveryNoteScanner(true); setDeliveryNoteWarehouseId(activeWarehouseId); }} className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Naskladniť podľa dodacieho listu</button>
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
                                <div><span className="font-bold text-white block">{item.name}{item.productType ? <span className="ml-1.5 bg-purple-950/40 text-purple-300 text-[9px] px-1.5 py-0.5 rounded-full border border-purple-800/40">{item.productType}</span> : ''}</span><span className="text-[10px] text-slate-400 font-mono">#{item.id} • {item.color}{item.manufacturer ? ` • ${item.manufacturer}` : ''}{item.deliveryNoteNumber ? ` • DL č. ${item.deliveryNoteNumber}` : ''}</span></div>
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
                  <div><label className="text-slate-400 block mb-0.5">Výrobca (voliteľné)</label><input type="text" value={newMatManufacturer} onChange={(e) => setNewMatManufacturer(e.target.value)} placeholder="napr. Sinterama, Coats, Gütermann..." className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Typ produktu (voliteľné — pre hotové výrobky ako tričká, šiltovky...)</label>
                    <input type="text" list="blank-goods-types-list" value={newMatProductType} onChange={(e) => setNewMatProductType(e.target.value)} placeholder="napr. Tričko, Šiltovka, Polokošeľa..." className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                    <datalist id="blank-goods-types-list">
                      {BLANK_GOODS_TYPES.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-slate-400 block mb-0.5">Číslo dodacieho listu (voliteľné)</label><input type="text" value={newMatDeliveryNumber} onChange={(e) => setNewMatDeliveryNumber(e.target.value)} placeholder="napr. DL-2026-045" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-0.5">Dátum dodacieho listu</label><input type="date" value={newMatDeliveryDate} onChange={(e) => setNewMatDeliveryDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                  </div>
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

        {showCapacitySettings && capacityDraft && productTimesDraft && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sliders className="h-5 w-5 text-indigo-400" /> Kapacita výroby</h3>
                  <p className="text-xs text-slate-500">Orientačné nastavenie výkonu strojov/staníc — appka podľa toho vypočíta % vyťaženia v pláne.</p>
                </div>
                <button onClick={() => setShowCapacitySettings(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                {STATION_ORDER.map(sid => {
                  const cfg = capacityDraft[sid];
                  const config = STATION_CONFIGS[sid];
                  const isRateBased = RATE_BASED_STATIONS.includes(sid);
                  const rows = productTimesDraft[sid] || [];
                  const avg = rows.length > 0 ? (rows.reduce((s, r) => s + r.minutesPerUnit, 0) / rows.length) : 0;
                  return (
                    <div key={sid} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <h4 className="font-bold text-sm text-white flex items-center gap-2"><config.icon className="h-4 w-4 text-indigo-400" /> {config.name}</h4>

                      {isRateBased ? (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-slate-400 block mb-0.5">{sid === 'sublimacia' ? 'Rýchlosť (metrov / hodinu)' : 'Rýchlosť (ks / minútu, predpoklad 2 vrstvy)'}</label>
                            <input type="number" step="0.1" value={cfg.rateValue ?? ''} onChange={(e) => setCapacityDraft(prev => ({ ...prev, [sid]: { ...prev[sid], rateValue: e.target.value } }))} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                          </div>
                          <div>
                            <label className="text-slate-400 block mb-0.5">Dostupné minúty / deň</label>
                            <input type="number" value={cfg.dailyMinutes ?? ''} onChange={(e) => setCapacityDraft(prev => ({ ...prev, [sid]: { ...prev[sid], dailyMinutes: e.target.value } }))} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-slate-400 block mb-0.5">Dostupné minúty / deň</label>
                              <input type="number" value={cfg.dailyMinutes ?? ''} onChange={(e) => setCapacityDraft(prev => ({ ...prev, [sid]: { ...prev[sid], dailyMinutes: e.target.value } }))} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                            </div>
                            {sid === 'transfer' && (
                              <div>
                                <label className="text-slate-400 block mb-0.5">Počet strojov (znásobí kapacitu)</label>
                                <div className="grid grid-cols-3 gap-1">
                                  {[1, 2, 3].map(n => (
                                    <button key={n} type="button" onClick={() => setCapacityDraft(prev => ({ ...prev, [sid]: { ...prev[sid], machineCount: n } }))} className={`py-2 rounded font-bold ${cfg.machineCount === n ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>{n}×</button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Orientačný čas na kus podľa typu produktu {rows.length > 0 && `(priemer: ${avg.toFixed(1)} min/ks)`}</span>
                            {rows.map(r => (
                              <div key={r.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                                <span className="flex-1 text-xs text-white font-bold">{r.label}</span>
                                <span className="text-xs text-indigo-400 font-mono">{r.minutesPerUnit} min/{r.unit}</span>
                                <button onClick={() => handleRemoveProductTime(sid, r.id)} className="text-rose-400 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <input type="text" placeholder="napr. Cyklodres" value={newProductTimeLabel[sid] || ''} onChange={(e) => setNewProductTimeLabel(prev => ({ ...prev, [sid]: e.target.value }))} className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white" />
                              <input type="number" step="0.1" placeholder="min/ks" value={newProductTimeMinutes[sid] || ''} onChange={(e) => setNewProductTimeMinutes(prev => ({ ...prev, [sid]: e.target.value }))} className="w-24 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white" />
                              <button onClick={() => handleAddProductTime(sid)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded text-xs shrink-0">Pridať</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={handleSaveCapacitySettings} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Uložiť kapacitné nastavenia</button>
            </div>
          </div>
        )}

        {showExpressDotlackovka && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-amber-700/50 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Zap className="h-5 w-5 text-amber-400" /> Expresné pridanie dotlačovej zákazky</h3>
                  <p className="text-xs text-slate-500">Firma ADY • zaradí sa rovno na dnešný deň do Grafika / Transfer / Balenie</p>
                </div>
                <button onClick={() => setShowExpressDotlackovka(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">Zadáva</label>
                  <input type="text" value={expressCreatedBy} onChange={(e) => setExpressCreatedBy(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                  <p className="text-[9px] text-slate-600 mt-0.5">Uprav, ak to zadávaš v mene niekoho iného.</p>
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Zadané do systému</label>
                  <input type="text" disabled value={getFormattedDateTime()} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-500" />
                </div>
              </div>

              <div><label className="text-xs text-slate-400 block mb-0.5">Meno zákazníka</label><input type="text" value={expressCustomerName} onChange={(e) => setExpressCustomerName(e.target.value)} placeholder="Kto to nesie/objednáva" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" autoFocus /></div>
              <div><label className="text-xs text-slate-400 block mb-0.5">Zákazník to potrebuje do</label><input type="date" value={expressNeededDate} onChange={(e) => setExpressNeededDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" /></div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Spôsob platby</label>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => setExpressPaymentType('faktura')} className={`py-2 text-xs font-bold rounded ${expressPaymentType === 'faktura' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Faktúra</button>
                  <button type="button" onClick={() => setExpressPaymentType('hotovost')} className={`py-2 text-xs font-bold rounded flex items-center justify-center gap-1 ${expressPaymentType === 'hotovost' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Banknote className="h-3.5 w-3.5" /> Hotovosť</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">📄 Dotlačový listok</label>
                  {expressListokPreview ? (
                    <div className="relative">
                      <img src={expressListokPreview} className="w-full h-24 object-cover rounded-lg border border-slate-800" alt="" />
                      <button onClick={() => { setExpressListokFile(null); setExpressListokPreview(''); }} className="absolute top-1 right-1 bg-slate-950/80 text-rose-400 rounded p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-800 rounded-lg py-4 cursor-pointer hover:border-amber-600">
                      <Camera className="h-5 w-5 text-slate-500" />
                      <span className="text-[9px] text-slate-500">Odfotiť listok</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setExpressListokFile(f); setExpressListokPreview(URL.createObjectURL(f)); } }} />
                    </label>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">👕 Fotka tovaru</label>
                  {expressTovarPreview ? (
                    <div className="relative">
                      <img src={expressTovarPreview} className="w-full h-24 object-cover rounded-lg border border-slate-800" alt="" />
                      <button onClick={() => { setExpressTovarFile(null); setExpressTovarPreview(''); }} className="absolute top-1 right-1 bg-slate-950/80 text-rose-400 rounded p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-800 rounded-lg py-4 cursor-pointer hover:border-amber-600">
                      <Camera className="h-5 w-5 text-slate-500" />
                      <span className="text-[9px] text-slate-500">Odfotiť tovar</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setExpressTovarFile(f); setExpressTovarPreview(URL.createObjectURL(f)); } }} />
                    </label>
                  )}
                </div>
              </div>

              <button onClick={handleSubmitExpressDotlackovka} disabled={isSubmittingExpress} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-lg uppercase text-xs flex items-center justify-center gap-2">
                {isSubmittingExpress ? <><Loader2 className="h-4 w-4 animate-spin" /> Ukladám...</> : <><Zap className="h-4 w-4" /> Odoslať a zaradiť do plánu</>}
              </button>
            </div>
          </div>
        )}

        {showDeliveryNoteScanner && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-purple-800/40 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Camera className="h-5 w-5 text-purple-400" /> Naskladniť podľa dodacieho listu (AI)</h3>
                <button onClick={() => { setShowDeliveryNoteScanner(false); setParsedDeliveryItems([]); setDeliveryNoteImageFile(null); setDeliveryNoteImagePreview(''); }} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>

              {!deliveryNoteImagePreview ? (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-800 rounded-xl py-10 cursor-pointer hover:border-purple-600 transition-colors">
                  <Camera className="h-8 w-8 text-slate-500" />
                  <span className="text-sm text-slate-400 font-bold">Klikni a nahraj/odfoť dodací list</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleDeliveryNoteFileSelect(e.target.files[0])} />
                </label>
              ) : (
                <div className="space-y-3">
                  {deliveryNoteImageFile?.type === 'application/pdf' ? (
                    <div className="w-full bg-slate-950 border border-slate-700 rounded-xl p-6 flex items-center gap-3">
                      <FileText className="h-8 w-8 text-rose-400 shrink-0" />
                      <span className="text-sm text-slate-300 truncate">{deliveryNoteImageFile.name}</span>
                    </div>
                  ) : (
                    <img src={deliveryNoteImagePreview} alt="Dodací list" className="w-full max-h-64 object-contain bg-white rounded-xl border border-slate-700" />
                  )}
                  {parsedDeliveryItems.length === 0 && (
                    <div className="flex gap-2">
                      <button onClick={handleParseDeliveryNote} disabled={isParsingDeliveryNote} className="flex-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                        {isParsingDeliveryNote ? <><Loader2 className="h-4 w-4 animate-spin" /> AI číta dodací list...</> : <>🤖 Rozpoznať položky</>}
                      </button>
                      <button onClick={() => { setDeliveryNoteImageFile(null); setDeliveryNoteImagePreview(''); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded-lg text-xs font-bold">Iná fotka</button>
                    </div>
                  )}
                </div>
              )}

              {deliveryNoteError && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{deliveryNoteError}</p>}

              {parsedDeliveryItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase">Skontroluj rozpoznané položky pred naskladnením:</span>
                    <button onClick={handleAddManualParsedRow} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Pridať riadok ručne</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Naskladniť do skladu</label>
                      <select value={deliveryNoteWarehouseId} onChange={(e) => setDeliveryNoteWarehouseId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Číslo dodacieho listu</label>
                      <input type="text" value={newMatDeliveryNumber} onChange={(e) => setNewMatDeliveryNumber(e.target.value)} placeholder="ak AI nerozpoznala, doplň" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Dátum dodacieho listu</label>
                      <input type="date" value={newMatDeliveryDate} onChange={(e) => setNewMatDeliveryDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {parsedDeliveryItems.map(it => (
                      <div key={it.tempId} className="grid grid-cols-12 gap-1.5 items-center bg-slate-950 border border-slate-800 rounded-lg p-2">
                        <input type="text" placeholder="Názov" value={it.name} onChange={(e) => handleUpdateParsedItem(it.tempId, 'name', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        <input type="text" list="blank-goods-types-list" placeholder="Typ (voliteľné)" value={it.type} onChange={(e) => handleUpdateParsedItem(it.tempId, 'type', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        <input type="text" placeholder="Farba" value={it.color} onChange={(e) => handleUpdateParsedItem(it.tempId, 'color', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        <input type="number" step="0.01" value={it.quantity} onChange={(e) => handleUpdateParsedItem(it.tempId, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                        <select value={it.unit} onChange={(e) => handleUpdateParsedItem(it.tempId, 'unit', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white">
                          {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                        </select>
                        <button onClick={() => handleRemoveParsedItem(it.tempId)} className="col-span-1 text-rose-400 hover:text-rose-300"><X className="h-4 w-4 mx-auto" /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleConfirmDeliveryImport} disabled={isImportingDeliveryItems} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg uppercase text-xs">
                    {isImportingDeliveryItems ? 'Naskladňujem...' : `Potvrdiť a naskladniť (${parsedDeliveryItems.filter(it => it.name.trim() && it.quantity > 0).length} položiek)`}
                  </button>
                  <p className="text-[10px] text-slate-600 italic">AI odhad môže byť nepresný — skontroluj názvy, farby aj množstvá pred potvrdením.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {reportingProblemForItem && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-rose-800/40 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /> Nahlásiť problém</h3>
                  <p className="text-xs text-slate-500 font-mono">{reportingProblemForItem.itemId} • {reportingProblemForItem.customer}</p>
                </div>
                <button onClick={() => setReportingProblemForItem(null)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Kategória problému</label>
                <select value={problemCategory} onChange={(e) => setProblemCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                  {PROBLEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Popis problému</label>
                <textarea rows={4} value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} placeholder="Čo presne sa deje?" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmitProblem} className="flex-1 bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Nahlásiť</button>
                <button onClick={() => setReportingProblemForItem(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 rounded-lg text-xs font-bold">Zrušiť</button>
              </div>
            </div>
          </div>
        )}

        {selectedMaterialForDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="font-mono text-xs text-indigo-400 font-bold block mb-1">Karta položky #{selectedMaterialForDetail.id}</span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border border-slate-600 shrink-0" style={{ backgroundColor: selectedMaterialForDetail.colorHex || '#475569' }}></span>
                    {selectedMaterialForDetail.name} ({selectedMaterialForDetail.color})
                  </h3>
                  <p className="text-xs text-slate-400">{selectedMaterialForDetail.width ? `Gramáž: ${selectedMaterialForDetail.weight} g/m² • Šírka: ${selectedMaterialForDetail.width} cm • ` : ''}Cena: {selectedMaterialForDetail.pricePerM?.toFixed(2)} € / {selectedMaterialForDetail.unit} bez DPH • Sklad: {warehouses.find(w => w.id === selectedMaterialForDetail.warehouseId)?.name || '—'}{selectedMaterialForDetail.manufacturer ? ` • Výrobca: ${selectedMaterialForDetail.manufacturer}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isEditingMaterialDetails && hasPermission('edit_stock') && (
                    <>
                      <button onClick={handleStartEditMaterialDetails} className="p-1.5 rounded bg-slate-800 text-indigo-400 hover:text-white hover:bg-indigo-700" title="Upraviť údaje o položke"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={handleDeleteMaterial} className="p-1.5 rounded bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-700" title="Zmazať položku zo skladu"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                  <button onClick={() => { setSelectedMaterialForDetail(null); handleCancelEditHistory(); handleCancelEditMaterialDetails(); }} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
              </div>

              {isEditingMaterialDetails && materialEditDraft && (
                <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-xl space-y-3 mb-6">
                  <span className="font-bold text-xs text-amber-300 block uppercase">Upraviť údaje o položke</span>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Názov materiálu</label>
                    <input type="text" value={materialEditDraft.name} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, name: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Výrobca</label>
                    <input type="text" value={materialEditDraft.manufacturer || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, manufacturer: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Typ produktu (pre hotové výrobky)</label>
                    <input type="text" list="blank-goods-types-list-edit" value={materialEditDraft.productType || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, productType: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    <datalist id="blank-goods-types-list-edit">
                      {BLANK_GOODS_TYPES.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Číslo dodacieho listu</label>
                      <input type="text" value={materialEditDraft.deliveryNoteNumber || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, deliveryNoteNumber: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Dátum dodacieho listu</label>
                      <input type="date" value={materialEditDraft.deliveryNoteDate || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, deliveryNoteDate: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Farba (názov)</label>
                      <input type="text" value={materialEditDraft.color} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, color: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Farba (odtieň)</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={materialEditDraft.colorHex || '#888888'} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, colorHex: e.target.value })} className="w-9 h-8 bg-slate-900 border border-slate-800 rounded cursor-pointer" />
                        <span className="text-[10px] text-slate-500">{materialEditDraft.colorHex}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Cena bez DPH (€)</label>
                      <input type="number" step="0.01" value={materialEditDraft.pricePerM} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, pricePerM: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Jednotka</label>
                      <select value={materialEditDraft.unit} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, unit: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white">
                        {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">Min. množstvo</label>
                      <input type="number" step="0.01" value={materialEditDraft.minQty} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, minQty: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    </div>
                  </div>
                  {(materialEditDraft.unit === 'm' || materialEditDraft.unit === 'bm') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Šírka (cm)</label>
                        <input type="number" value={materialEditDraft.width || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, width: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Gramáž (g/m²)</label>
                        <input type="number" value={materialEditDraft.weight || ''} onChange={(e) => setMaterialEditDraft({ ...materialEditDraft, weight: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSaveMaterialDetails} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs uppercase">Uložiť zmeny</button>
                    <button onClick={handleCancelEditMaterialDetails} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded text-xs">Zrušiť</button>
                  </div>
                </div>
              )}

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
                          {emp.avatar && <span className="text-lg">{emp.avatar}</span>}
                          <h4 className="font-extrabold text-sm text-slate-100">{emp.firstName} {emp.lastName}</h4>
                          <span className="bg-slate-800 text-indigo-400 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase border border-slate-700">{emp.role}</span>
                        </div>
                        <p className="text-xs text-slate-400">Pozícia: <strong className="text-slate-300">{emp.position || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Dátum nástupu: <strong className="text-slate-400">{emp.entryDate || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Telefón: <strong className="text-slate-400">{emp.phone || '—'}</strong> • Email: <strong className="text-slate-400">{emp.email || '—'}</strong></p>
                        <p className="text-[10px] text-slate-500">Heslo: <strong className={emp.passwordHash ? 'text-emerald-400' : 'text-rose-400'}>{emp.passwordHash ? 'Nastavené' : 'Nenastavené — nemôže sa prihlásiť'}</strong> • PIN: <strong className={emp.pinHash ? 'text-emerald-400' : 'text-slate-500'}>{emp.pinHash ? 'Nastavený' : 'Nenastavený'}</strong></p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="bg-indigo-950/40 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-900/20 flex items-center gap-1 font-bold"><CalendarDays className="h-3.5 w-3.5" /> Narodeniny: {emp.birthday ? formatDeliveryDate(emp.birthday) : '—'}</span>
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
                      <div><label className="text-slate-400 block mb-0.5">Meno</label><input type="text" placeholder="Meno" required value={editingEmployee ? editingEmployee.firstName : newEmpFirstName} onChange={(e) => {
                          const val = e.target.value;
                          if (editingEmployee) setEditingEmployee({ ...editingEmployee, firstName: val });
                          else { setNewEmpFirstName(val); if (!newEmpNameday) { const suggestion = suggestNameday(val); if (suggestion) setNewEmpNameday(suggestion); } }
                        }} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
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
                      <div>
                        <label className="text-slate-400 block mb-0.5">Dátum narodenia</label>
                        <input type="date" value={editingEmployee ? (editingEmployee.birthday || '') : newEmpBirthday} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, birthday: e.target.value }) : setNewEmpBirthday(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Meniny (deň a mesiac){!editingEmployee && suggestNameday(newEmpFirstName) && <span className="text-emerald-400 normal-case"> — navrhnuté podľa mena</span>}</label>
                        <div className="grid grid-cols-2 gap-1">
                          {(() => {
                            const current = editingEmployee ? editingEmployee.nameday : newEmpNameday;
                            const parts = (current || '').match(/^(\d{1,2})\.\s*(\S+)/);
                            const curDay = parts ? parts[1] : '';
                            const curMonth = parts ? parts[2] : '';
                            const setNameday = (day, month) => {
                              const val = day && month ? `${day}. ${month}` : '';
                              if (editingEmployee) setEditingEmployee({ ...editingEmployee, nameday: val });
                              else setNewEmpNameday(val);
                            };
                            return (
                              <>
                                <select value={curDay} onChange={(e) => setNameday(e.target.value, curMonth || SK_MONTHS[0])} className="bg-slate-900 border border-slate-800 rounded p-2 text-white">
                                  <option value="">Deň</option>
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select value={curMonth} onChange={(e) => setNameday(curDay || '1', e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-2 text-white">
                                  <option value="">Mesiac</option>
                                  {SK_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-slate-400 block mb-0.5">Telefón</label><input type="tel" placeholder="napr. 0900 123 456" value={editingEmployee ? (editingEmployee.phone || '') : newEmpPhone} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, phone: e.target.value }) : setNewEmpPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                      <div><label className="text-slate-400 block mb-0.5">Email</label><input type="email" placeholder="meno@firma.sk" value={editingEmployee ? (editingEmployee.email || '') : newEmpEmail} onChange={(e) => editingEmployee ? setEditingEmployee({ ...editingEmployee, email: e.target.value }) : setNewEmpEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" /></div>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Emotikon profilu</label>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-2xl bg-slate-900 border border-slate-800 rounded-lg w-10 h-10 flex items-center justify-center">{(editingEmployee ? editingEmployee.avatar : newEmpAvatar) || '❓'}</span>
                        <span className="text-[10px] text-slate-500">Vyber jeden nižšie</span>
                      </div>
                      <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 bg-slate-900 border border-slate-800 rounded-lg p-2 max-h-[110px] overflow-y-auto">
                        {AVATAR_EMOJI_OPTIONS.map(em => (
                          <button
                            type="button"
                            key={em}
                            onClick={() => editingEmployee ? setEditingEmployee({ ...editingEmployee, avatar: em }) : setNewEmpAvatar(em)}
                            className={`text-lg rounded p-1 hover:bg-slate-800 ${(editingEmployee ? editingEmployee.avatar : newEmpAvatar) === em ? 'bg-indigo-600' : ''}`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">Staré heslo (nepoužíva sa — Master/Superv./Obchodník sa prihlasujú emailom, nechaj prázdne)</label>
                      <input type="password" placeholder="nepoužívané" value={editingEmployee ? editEmpPassword : newEmpPassword} onChange={(e) => editingEmployee ? setEditEmpPassword(e.target.value) : setNewEmpPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white opacity-60" />
                      {editingEmployee && ['master', 'supervisor', 'sales'].includes(editingEmployee.role) && (
                        <p className="text-[10px] text-slate-500 mt-1">{editingEmployee.authUserId ? '✅ Prihlasovací účet (email) je vytvorený a prepojený.' : '⚠️ Prihlasovací účet ešte nie je vytvorený — zamestnanec si ho vytvorí sám na prihlasovacej obrazovke tlačidlom "Vytvor si ho" (podľa emailu vyššie).'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-0.5">PIN pre rýchle prihlásenie na stanici (4 číslice, voliteľné)</label>
                      <input type="text" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder={editingEmployee ? (editingEmployee.pinHash ? '••••' : 'napr. 1234') : 'napr. 1234'} value={editingEmployee ? editEmpPin : newEmpPin} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); editingEmployee ? setEditEmpPin(v) : setNewEmpPin(v); }} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white" />
                      {editingEmployee && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{editingEmployee.pinHash ? 'PIN je nastavený — nechaj prázdne, ak ho nemeníš.' : 'PIN zatiaľ nie je nastavený.'}</p>
                      )}
                    </div>
                    {editingEmployee && editingEmployee.id === currentUser.id && authSession && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                        <span className="text-slate-300 font-bold block">Dvojfaktorové overenie (2FA)</span>
                        <p className="text-[10px] text-slate-500">Toto vieš nastaviť len pre svoj vlastný účet, po prihlásení — Supabase Auth to takto vyžaduje kvôli bezpečnosti (tajný kľúč nikdy neopustí server).</p>
                        {enrolledMfaFactor ? (
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">✅ Zapnuté</span>
                            <button type="button" onClick={handleDisableAuthMfa} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded text-[10px] font-bold">Vypnúť 2FA</button>
                          </div>
                        ) : !mfaEnrollData ? (
                          <button type="button" onClick={handleBeginAuthMfaEnroll} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-[11px] font-bold">Nastaviť 2FA</button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-400">Naskenuj tento QR appkou Google Authenticator / Authy:</p>
                            <div className="bg-white p-2 rounded-lg inline-block" dangerouslySetInnerHTML={{ __html: mfaEnrollData.totp.qr_code }} />
                            <p className="text-[9px] text-slate-500 font-mono break-all">Ručný kľúč (ak sa QR nedá naskenovať): {mfaEnrollData.totp.secret}</p>
                            <input type="text" inputMode="numeric" maxLength={6} placeholder="Zadaj 6-miestny kód z appky" value={mfaEnrollCode} onChange={(e) => { setMfaEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setMfaEnrollError(''); }} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white font-mono tracking-widest text-center" />
                            {mfaEnrollError && <p className="text-[10px] text-rose-400">{mfaEnrollError}</p>}
                            <div className="flex gap-2">
                              <button type="button" onClick={handleConfirmAuthMfaEnroll} disabled={mfaEnrollCode.length !== 6} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1.5 rounded text-[11px]">Potvrdiť a zapnúť</button>
                              <button type="button" onClick={() => setMfaEnrollData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 rounded text-[11px]">Zrušiť</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {editingEmployee && !(editingEmployee.id === currentUser.id && authSession) && ['master', 'supervisor', 'sales'].includes(editingEmployee.role) && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-300 font-bold block mb-1">Dvojfaktorové overenie (2FA)</span>
                        <p className="text-[10px] text-slate-500">{editingEmployee.authUserId ? 'Tento zamestnanec má vytvorený prihlasovací účet — 2FA si nastaví sám po prihlásení, vo svojom profile.' : 'Tento zamestnanec si ešte musí vytvoriť prihlasovací účet (email + heslo) na prihlasovacej obrazovke — potom si tam môže zapnúť aj 2FA.'}</p>
                      </div>
                    )}
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

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl print:hidden">
              <h3 className="font-bold text-md text-white flex items-center gap-2 mb-2"><QrCode className="text-indigo-400 h-5 w-5" /> QR kódy staníc na vytlačenie</h3>
              <p className="text-xs text-slate-400 mb-4">Vytlač a nalep na príslušný stroj/stanicu. Zamestnanec ho naskenuje fotoaparátom a zadá svoj 4-miestny PIN — appka ho rovno prihlási a otvorí frontu tejto stanice.</p>
              <div ref={stationQrGridRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {STATION_ORDER.map(sid => (
                  <div key={sid} className="qr-item bg-white p-3 rounded-xl flex flex-col items-center border border-slate-300">
                    <QRCodeSVG value={`${window.location.origin}${window.location.pathname}?station=${sid}`} size={100} level="M" />
                    <span className="text-black text-[11px] font-extrabold mt-2 text-center">{STATION_CONFIGS[sid].name}</span>
                  </div>
                ))}
              </div>
              <button onClick={handlePrintStationCodes} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Vytlačiť QR kódy staníc</button>
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
                        {STATION_ORDER.map(sid => (<option key={sid} value={sid}>{STATION_CONFIGS[sid].name}</option>))}
                      </select>
                    </div>
                    <div className="flex flex-col justify-end"><p className="text-slate-400">Skenuje:</p><strong className="text-white font-bold text-sm">{currentUser.firstName} {currentUser.lastName}</strong></div>
                  </div>
                  <div className="bg-indigo-950/20 border border-indigo-500/30 p-5 rounded-xl space-y-4">
                    {!isCameraScanning ? (
                      <button onClick={startCameraScan} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2">
                        <Camera className="h-5 w-5" /> Skenovať kamerou
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div id="qr-camera-region" className="w-full rounded-xl overflow-hidden border-2 border-emerald-500"></div>
                        <button onClick={stopCameraScan} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2 rounded-lg">Zrušiť skenovanie kamerou</button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold">
                      <div className="flex-1 h-px bg-slate-800"></div> alebo zadaj ručne <div className="flex-1 h-px bg-slate-800"></div>
                    </div>
                    <input ref={qrInputRef} type="text" value={manualQrInput} onChange={(e) => setManualQrInput(e.target.value)} placeholder="Sem pípnite kód položky zo sprievodky..." className="w-full bg-slate-900 border-2 border-slate-700 focus:border-indigo-500 text-slate-100 font-mono text-center tracking-wider text-md rounded-xl px-4 py-3 focus:outline-none" />
                    <button onClick={() => handleQrScan(manualQrInput)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-lg mt-3">Potvrdiť Sken manuálne</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && hasPermission('view_reports') && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-150">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="text-indigo-400 h-5 w-5" /> Prehľad podľa športu / kategórie</h2>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  <button onClick={() => setReportPeriod('month')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Tento mesiac</button>
                  <button onClick={() => setReportPeriod('year')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'year' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Tento rok</button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4">Podľa termínu dodania zákazky. Peňažný prehľad (fakturácia) doplníme neskôr.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3">Šport / Kategória</th>
                      <th className="px-3 py-3 text-center">Počet zákaziek</th>
                      <th className="px-3 py-3 text-center">Kusov oblečenia</th>
                      <th className="px-3 py-3 text-center">Metrov materiálu spolu</th>
                      <th className="px-3 py-3 text-center">Čas práce spolu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sportStats.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">Za toto obdobie zatiaľ nie sú žiadne zákazky.</td></tr>
                    )}
                    {sportStats.map(s => (
                      <tr key={s.sport} className="hover:bg-slate-800/40">
                        <td className="px-3 py-3 font-bold text-white">{s.sport}</td>
                        <td className="px-3 py-3 text-center text-indigo-300 font-bold">{s.orders}</td>
                        <td className="px-3 py-3 text-center">{s.qty} ks</td>
                        <td className="px-3 py-3 text-center">{s.meters} m</td>
                        <td className="px-3 py-3 text-center">{formatDurationMinutes(s.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2"><BarChart3 className="text-indigo-400 h-5 w-5" /> Prehľady — čas strávený na jednotlivých staniciach</h2>
              <p className="text-xs text-slate-400 mb-4">Sleduje sa od kliknutia na "Príprava" po "Hotové" na danej stanici. Viditeľné len pre Master/Supervisor.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3">Položka</th>
                      <th className="px-3 py-3">Odberateľ / Produkt</th>
                      {STATION_ORDER.map(sid => <th key={sid} className="px-3 py-3 text-center">{STATION_CONFIGS[sid].name}</th>)}
                      <th className="px-3 py-3 text-center">Spolu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {allItems.length === 0 && (
                      <tr><td colSpan={STATION_ORDER.length + 3} className="px-4 py-8 text-center text-slate-500 italic">Zatiaľ žiadne zákazky.</td></tr>
                    )}
                    {allItems.map(item => {
                      const totalMinutes = STATION_ORDER.reduce((sum, sid) => sum + (item.stationMeta?.[sid]?.durationMinutes || 0), 0);
                      return (
                        <tr key={item.itemId} className="hover:bg-slate-800/40">
                          <td className="px-3 py-3 font-mono font-bold text-indigo-400">{item.itemId}</td>
                          <td className="px-3 py-3"><span className="font-bold text-white block">{item.customer}</span><span className="text-slate-400">{item.productName}</span></td>
                          {STATION_ORDER.map(sid => {
                            const meta = item.stationMeta?.[sid];
                            if (!meta || (!meta.startedAt && !meta.durationMinutes)) return <td key={sid} className="px-3 py-3 text-center text-slate-600">—</td>;
                            const hasDuration = meta.durationMinutes !== undefined && meta.durationMinutes !== null;
                            const isDone = item.stationStatuses?.[sid] === 'hotove';
                            return (
                              <td key={sid} className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  {meta.assignedEmployeeAvatar && <span title={meta.assignedEmployeeName} className="cursor-help">{meta.assignedEmployeeAvatar}</span>}
                                  <span className={hasDuration ? 'text-emerald-400 font-bold' : isDone ? 'text-slate-500 italic' : 'text-amber-400'}>
                                    {hasDuration ? formatDurationMinutes(meta.durationMinutes) : isDone ? 'hotové (bez záznamu)' : 'prebieha...'}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center font-bold text-white">{formatDurationMinutes(totalMinutes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h3 className="font-bold text-md text-white flex items-center gap-2 mb-2"><Banknote className="text-indigo-400 h-5 w-5" /> Sadzby za jednotku práce (náčrt)</h3>
              <p className="text-xs text-slate-400 mb-4">Zatiaľ len na poznačenie orientačných cien — automatický prepočet nákladov na zákazku doplníme neskôr.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                    <tr><th className="px-3 py-3">Stanica</th><th className="px-3 py-3 text-center">Sadzba (€)</th><th className="px-3 py-3 text-center">Jednotka</th><th className="px-3 py-3">Poznámka</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {STATION_ORDER.map(sid => {
                      const rate = costRates.find(r => r.stationId === sid) || { rate: 0, unit: '', note: '' };
                      return (
                        <tr key={sid} className="hover:bg-slate-800/40">
                          <td className="px-3 py-3 font-bold text-white">{STATION_CONFIGS[sid].name}</td>
                          <td className="px-3 py-3 text-center"><input type="number" step="0.01" defaultValue={rate.rate} onBlur={(e) => handleUpdateCostRate(sid, 'rate', e.target.value)} className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-center text-white" /></td>
                          <td className="px-3 py-3 text-center"><input type="text" defaultValue={rate.unit} onBlur={(e) => handleUpdateCostRate(sid, 'unit', e.target.value)} placeholder="napr. za kus" className="w-24 bg-slate-950 border border-slate-800 rounded p-1 text-center text-white" /></td>
                          <td className="px-3 py-3"><input type="text" defaultValue={rate.note} onBlur={(e) => handleUpdateCostRate(sid, 'note', e.target.value)} placeholder="poznámka" className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'designers' && (() => {
          const activeGrafikItems = allItems.filter(it => it.stationStatuses?.grafik && it.stationStatuses.grafik !== 'neaktivne' && it.stationStatuses.grafik !== 'hotove');
          const designerIds = Array.from(new Set(activeGrafikItems.map(it => it.assignedDesignerId).filter(Boolean)));
          const columns = [
            { id: '', label: 'Nepriradené', avatar: '❓' },
            ...designerIds.map(id => {
              const emp = employees.find(e => e.id === id);
              return { id, label: emp ? `${emp.firstName} ${emp.lastName}` : 'Neznámy', avatar: emp?.avatar || '👤' };
            })
          ];
          return (
            <div className="space-y-4 print:hidden animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Palette className="text-indigo-400 h-5 w-5" /> Dashboard Grafikov</h2>
              <p className="text-xs text-slate-400 -mt-2">Zákazky aktuálne rozpracované na Grafike, zoradené podľa priradeného grafika. Priradenie sa nastavuje pri vytváraní/úprave položky.</p>
              {activeGrafikItems.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 italic">Momentálne nie je na Grafike žiadna rozpracovaná zákazka.</div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {columns.map(col => {
                    const colItems = activeGrafikItems.filter(it => (it.assignedDesignerId || '') === col.id);
                    if (colItems.length === 0) return null;
                    return (
                      <div key={col.id || 'unassigned'} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 w-72 shrink-0 space-y-2">
                        <div className="flex items-center gap-2 px-1 pb-2 border-b border-slate-800">
                          <span className="text-xl">{col.avatar}</span>
                          <span className="font-bold text-sm text-white">{col.label}</span>
                          <span className="ml-auto bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{colItems.length}</span>
                        </div>
                        {colItems.sort((a, b) => a.priority - b.priority).map(item => {
                          const orderColor = colorForOrder(item.orderId);
                          const statusCfg = STATION_CONFIGS.grafik.statuses.find(s => s.id === item.stationStatuses.grafik);
                          return (
                            <div key={item.itemId} className={`bg-slate-900 border-l-4 ${orderColor.border} border-t border-r border-b border-slate-800 rounded-lg p-3 space-y-1.5 cursor-pointer hover:bg-slate-850`} onClick={() => openOrderDetails(orders.find(o => o.id === item.orderId))}>
                              {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-20 object-cover rounded" />}
                              <p className="font-mono text-[10px] text-indigo-400 font-bold">#{item.priority} • {item.itemId}</p>
                              <p className="font-bold text-xs text-white truncate">{item.customer}</p>
                              <p className="text-[11px] text-slate-400 truncate">{item.productName} ({item.qty}ks)</p>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${statusCfg?.color || 'bg-slate-700 text-slate-300'}`}>{statusCfg?.label}</span>
                                <select
                                  value={item.assignedDesignerId || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleReassignDesigner(item.orderId, item.itemId, e.target.value)}
                                  className="text-[9px] bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-300"
                                >
                                  <option value="">Nepriradiť</option>
                                  {employees.map(e => <option key={e.id} value={e.id}>{e.avatar} {e.firstName}</option>)}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'problems' && hasPermission('view_reports') && (() => {
          const openProblems = problemReports.filter(p => p.status === 'open').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          const resolvedProblems = problemReports.filter(p => p.status === 'resolved').sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));
          const listToShow = showResolvedProblems ? resolvedProblems : openProblems;
          return (
            <div className="space-y-4 print:hidden animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><AlertTriangle className="text-rose-400 h-5 w-5" /> Nahlásené problémy</h2>
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                  <button onClick={() => setShowResolvedProblems(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!showResolvedProblems ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Otvorené ({openProblems.length})</button>
                  <button onClick={() => setShowResolvedProblems(true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showResolvedProblems ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Vyriešené ({resolvedProblems.length})</button>
                </div>
              </div>

              {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs text-amber-300">🔔 Desktop upozornenia a zvuk sú {Notification.permission === 'denied' ? 'zablokované v prehliadači — povoľ ich v nastaveniach stránky' : 'zatiaľ vypnuté'}. Bez toho ťa appka na nový problém neupozorní, kým nemáš otvorenú túto záložku.</span>
                  {Notification.permission === 'default' && (
                    <button onClick={() => Notification.requestPermission()} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shrink-0">Povoliť upozornenia</button>
                  )}
                </div>
              )}

              {listToShow.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 italic">{showResolvedProblems ? 'Žiadne vyriešené problémy.' : 'Žiadne otvorené problémy — všetko v poriadku! 🎉'}</div>
              ) : (
                <div className="space-y-3">
                  {listToShow.map(p => {
                    const urgency = getProblemUrgency(p.createdAt);
                    const found = findItemByItemId(p.itemId || '');
                    return (
                      <div key={p.id} className={`bg-slate-950 border rounded-xl p-4 ${!showResolvedProblems ? urgency.color.replace('bg-', 'border-').split(' ')[0] : 'border-slate-800'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!showResolvedProblems && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgency.color} ${urgency.pulse ? 'animate-pulse' : ''}`}>{urgency.label}</span>}
                              <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">{p.category}</span>
                              <span className="font-mono text-[10px] text-slate-500">{p.itemId} • {STATION_CONFIGS[p.stationId]?.name || p.stationId}</span>
                            </div>
                            <p className="text-sm text-white">{p.description}</p>
                            {found && <p className="text-[11px] text-slate-500">Zákazka: <strong className="text-slate-300">{found.order.customer}</strong> — {found.item.productName}</p>}
                            <p className="text-[10px] text-slate-500">Nahlásil: <strong className="text-slate-400">{p.employeeName}</strong> • {new Date(p.createdAt).toLocaleString('sk-SK')}</p>
                            {p.status === 'resolved' && (
                              <p className="text-[10px] text-emerald-400 mt-1">✅ Vyriešil {p.resolvedBy} • {new Date(p.resolvedAt).toLocaleString('sk-SK')}{p.resolutionNote ? ` — ${p.resolutionNote}` : ''}</p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {found && <button onClick={() => openOrderDetails(found.order)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg">Otvoriť zákazku</button>}
                            {p.status === 'open' && (
                              <button onClick={() => { setResolvingProblem(p); setResolutionNoteInput(''); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">Vyriešiť</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {resolvingProblem && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-emerald-800/40 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Check className="h-5 w-5 text-emerald-400" /> Označiť ako vyriešené</h3>
              <p className="text-xs text-slate-400">{resolvingProblem.category}: {resolvingProblem.description}</p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka k riešeniu (voliteľné)</label>
                <textarea rows={3} value={resolutionNoteInput} onChange={(e) => setResolutionNoteInput(e.target.value)} placeholder="Ako sa to vyriešilo?" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={handleResolveProblem} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Potvrdiť vyriešené</button>
                <button onClick={() => setResolvingProblem(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 rounded-lg text-xs font-bold">Zrušiť</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && hasPermission('create_order') && (() => {
          const filteredInvoices = invoices.filter(inv => invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter);
          const pendingReviewOrders = orders.filter(o => o.accountingStatus === 'pending_review');
          return (
            <div className="space-y-6 print:hidden animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-emerald-400 h-5 w-5" /> Financie</h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setCompanySettingsDraft({ ...companySettings }); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Nastavenia firmy</button>
                  <button onClick={() => handleStartNewInvoice(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Plus className="h-4 w-4" /> Vystaviť novú faktúru</button>
                </div>
              </div>

              {!companySettings.iban && (
                <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-300">
                  ⚠️ Ešte nemáš vyplnené údaje firmy (IBAN a pod.) — QR platba na faktúrach nebude fungovať, kým to nedoplníš cez "Nastavenia firmy".
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit overflow-x-auto">
                <button onClick={() => setFinanceSubTab('overview')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Prehľad</button>
                <button onClick={() => setFinanceSubTab('queue')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'queue' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Fronta pre účtovníka {pendingReviewOrders.length > 0 && `(${pendingReviewOrders.length})`}</button>
                <button onClick={() => setFinanceSubTab('invoices')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'invoices' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Faktúry</button>
                <button onClick={() => setFinanceSubTab('cash')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'cash' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pokladňa</button>
                <button onClick={() => setFinanceSubTab('bank')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'bank' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Banka</button>
                <button onClick={() => setFinanceSubTab('journal')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${financeSubTab === 'journal' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Účtovný denník</button>
                <button onClick={() => setFinanceSubTab('ai')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 ${financeSubTab === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Bot className="h-3.5 w-3.5" /> AI Asistent</button>
              </div>

              {financeSubTab === 'overview' && (() => {
                const now = new Date();
                const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;
                const sumForMonth = (key) => invoices.filter(i => { const d = new Date(i.issueDate); return `${d.getFullYear()}-${d.getMonth()}` === key; }).reduce((s, i) => s + i.total, 0);
                const thisMonthTotal = sumForMonth(thisMonthKey);
                const lastMonthTotal = sumForMonth(lastMonthKey);
                const monthChange = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null;

                const byYear = {};
                invoices.forEach(inv => {
                  const y = new Date(inv.issueDate).getFullYear();
                  if (!byYear[y]) byYear[y] = { income: 0, vat: 0, count: 0 };
                  byYear[y].income += inv.total;
                  byYear[y].vat += inv.vatTotal;
                  byYear[y].count += 1;
                });
                const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
                const thisYear = now.getFullYear();
                const lastYear = thisYear - 1;
                const yearChange = byYear[lastYear]?.income > 0 ? (((byYear[thisYear]?.income || 0) - byYear[lastYear].income) / byYear[lastYear].income) * 100 : null;

                const avgGrowth = (span) => {
                  const start = thisYear - span;
                  if (!byYear[start] || byYear[start].income === 0 || !byYear[thisYear]) return null;
                  const totalGrowth = ((byYear[thisYear].income - byYear[start].income) / byYear[start].income) * 100;
                  return totalGrowth / span;
                };
                const avg5 = avgGrowth(5);
                const avg10 = avgGrowth(10);

                const byCustomerType = {};
                invoices.forEach(inv => {
                  const t = inv.customerType || 'sk_platca';
                  if (!byCustomerType[t]) byCustomerType[t] = { total: 0, vat: 0, count: 0 };
                  byCustomerType[t].total += inv.total;
                  byCustomerType[t].vat += inv.vatTotal;
                  byCustomerType[t].count += 1;
                });
                const customerTypeLabels = { sk_platca: 'SK — platca DPH', sk_neplatca: 'SK — neplatca DPH', eu_platca: 'EÚ — platca DPH', eu_neplatca: 'EÚ — neplatca DPH', tretia_krajina: 'Tretia krajina' };

                const upcomingDeadlines = taxDeadlines.slice().sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Tento mesiac</span>
                        <p className="text-xl font-bold text-white">{thisMonthTotal.toFixed(2)} €</p>
                        {monthChange !== null && <p className={`text-[11px] font-bold ${monthChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{monthChange >= 0 ? '+' : ''}{monthChange.toFixed(1)}% oproti minulému mesiacu</p>}
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Tento rok</span>
                        <p className="text-xl font-bold text-white">{(byYear[thisYear]?.income || 0).toFixed(2)} €</p>
                        {yearChange !== null && <p className={`text-[11px] font-bold ${yearChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{yearChange >= 0 ? '+' : ''}{yearChange.toFixed(1)}% oproti minulému roku</p>}
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Priemerný rast (5 rokov)</span>
                        <p className="text-xl font-bold text-white">{avg5 !== null ? `${avg5 >= 0 ? '+' : ''}${avg5.toFixed(1)}% ročne` : 'nedostatok histórie'}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Priemerný rast (10 rokov)</span>
                        <p className="text-xl font-bold text-white">{avg10 !== null ? `${avg10 >= 0 ? '+' : ''}${avg10.toFixed(1)}% ročne` : 'nedostatok histórie'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-white mb-3">Príjmy a DPH podľa roka</h3>
                        {years.length === 0 ? <p className="text-xs text-slate-500 italic">Zatiaľ žiadne dáta.</p> : (
                          <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 border-b border-slate-800"><tr><th className="text-left py-1.5">Rok</th><th className="text-right py-1.5">Príjmy</th><th className="text-right py-1.5">DPH</th><th className="text-right py-1.5">Faktúr</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {years.map(y => (
                                <tr key={y}><td className="py-1.5 font-bold text-white">{y}</td><td className="py-1.5 text-right">{byYear[y].income.toFixed(2)} €</td><td className="py-1.5 text-right text-amber-400">{byYear[y].vat.toFixed(2)} €</td><td className="py-1.5 text-right">{byYear[y].count}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-white mb-1">DPH podľa typu odberateľa (orientačné)</h3>
                        <p className="text-[10px] text-slate-500 mb-3">⚠️ Over si presné zaradenie do KV DPH so svojím účtovníkom — pravidlá pre neplatcov a EÚ sa líšia.</p>
                        {Object.keys(byCustomerType).length === 0 ? <p className="text-xs text-slate-500 italic">Zatiaľ žiadne dáta.</p> : (
                          <table className="w-full text-xs text-slate-300">
                            <thead className="text-slate-500 border-b border-slate-800"><tr><th className="text-left py-1.5">Typ</th><th className="text-right py-1.5">Suma</th><th className="text-right py-1.5">DPH</th><th className="text-right py-1.5">Faktúr</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {Object.entries(byCustomerType).map(([type, v]) => (
                                <tr key={type}><td className="py-1.5">{customerTypeLabels[type] || type}</td><td className="py-1.5 text-right font-bold text-white">{v.total.toFixed(2)} €</td><td className="py-1.5 text-right text-amber-400">{v.vat.toFixed(2)} €</td><td className="py-1.5 text-right">{v.count}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white">Daňové termíny</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 bg-slate-900 p-3 rounded-lg">
                        <input type="text" placeholder="Názov termínu" value={newDeadlineTitle} onChange={(e) => setNewDeadlineTitle(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" />
                        <input type="date" value={newDeadlineDate} onChange={(e) => setNewDeadlineDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" />
                        <div className="flex gap-2">
                          <input type="text" placeholder="Poznámka (voliteľné)" value={newDeadlineNote} onChange={(e) => setNewDeadlineNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" />
                          <button onClick={handleAddTaxDeadline} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded text-xs shrink-0">Pridať</button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {upcomingDeadlines.length === 0 && <p className="text-xs text-slate-500 italic">Žiadne termíny pridané.</p>}
                        {upcomingDeadlines.map(d => (
                          <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                            {editingDeadline?.id === d.id ? (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input type="text" value={editingDeadline.title} onChange={(e) => setEditingDeadline({ ...editingDeadline, title: e.target.value })} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                                <input type="date" value={editingDeadline.dueDate} onChange={(e) => setEditingDeadline({ ...editingDeadline, dueDate: e.target.value })} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white" />
                                <div className="flex gap-1">
                                  <button onClick={handleSaveEditDeadline} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px]">Uložiť</button>
                                  <button onClick={() => setEditingDeadline(null)} className="bg-slate-800 text-slate-300 px-2 rounded text-[11px]">Zrušiť</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isUrgentDate(d.dueDate) ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{formatDeliveryDate(d.dueDate)}</span>
                                  <span className="text-xs font-bold text-white">{d.title}</span>
                                  {d.note && <span className="text-[11px] text-slate-500">— {d.note}</span>}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => setEditingDeadline({ ...d })} className="p-1 text-indigo-400 hover:text-indigo-300"><Edit2 className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDeleteTaxDeadline(d.id)} className="p-1 text-rose-400 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {financeSubTab === 'queue' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Zákazky, ktoré sú kompletne hotové na všetkých staniciach a majú byť fakturované. Skontroluj a buď vystav faktúru, alebo prehoď na hotovosť, ak si to zákazník rozmyslel.</p>
                  {pendingReviewOrders.length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 italic">Fronta je prázdna — nič nečaká na spracovanie. 🎉</div>
                  ) : (
                    <div className="space-y-2">
                      {pendingReviewOrders.map(o => (
                        <div key={o.id} className="bg-slate-950 border border-amber-800/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-400">{o.orderNumber || o.id}</span>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${companyBrandBadgeClass(o.companyBrand)}`}>{o.companyBrand}</span>
                            </div>
                            <p className="font-bold text-white text-sm">{o.customer}</p>
                            <p className="text-[11px] text-slate-500">{(o.items || []).map(it => it.productName).join(', ')}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => openOrderDetails(o)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] px-3 py-2 rounded-lg">Otvoriť zákazku</button>
                            <button onClick={() => handleSwitchOrderToCash(o)} className="bg-rose-800 hover:bg-rose-900 text-white font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1"><Banknote className="h-3.5 w-3.5" /> Prehodiť na hotovosť</button>
                            <button onClick={() => handleStartNewInvoice(o)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1"><FileEdit className="h-3.5 w-3.5" /> Vystaviť faktúru</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {financeSubTab === 'invoices' && (
                <>
                  <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
                    <button onClick={() => setInvoiceStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${invoiceStatusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Všetky ({invoices.length})</button>
                    <button onClick={() => setInvoiceStatusFilter('issued')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${invoiceStatusFilter === 'issued' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Neuhradené ({invoices.filter(i => i.status === 'issued').length})</button>
                    <button onClick={() => setInvoiceStatusFilter('paid')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${invoiceStatusFilter === 'paid' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Uhradené ({invoices.filter(i => i.status === 'paid').length})</button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-3 py-3">Číslo faktúry</th><th className="px-3 py-3">Odberateľ</th><th className="px-3 py-3 text-center">Vystavená</th><th className="px-3 py-3 text-center">Splatnosť</th><th className="px-3 py-3 text-center">Suma s DPH</th><th className="px-3 py-3 text-center">Stav</th><th className="px-3 py-3 text-center">Karta</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredInvoices.length === 0 && (<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">Žiadne faktúry.</td></tr>)}
                        {filteredInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-800/40">
                            <td className="px-3 py-3 font-mono font-bold text-indigo-400">{inv.invoiceNumber}</td>
                            <td className="px-3 py-3 font-bold text-white">{inv.customerName}</td>
                            <td className="px-3 py-3 text-center">{formatDeliveryDate(inv.issueDate)}</td>
                            <td className="px-3 py-3 text-center">{formatDeliveryDate(inv.dueDate)}</td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-400">{inv.total.toFixed(2)} €</td>
                            <td className="px-3 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'}`}>{inv.status === 'paid' ? 'Uhradená' : 'Neuhradená'}</span></td>
                            <td className="px-3 py-3 text-center"><button onClick={() => setSelectedInvoiceForDetail(inv)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1 rounded">Detail</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {financeSubTab === 'bank' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Bankový výpis</h3>
                      <p className="text-xs text-slate-400">Nahraj CSV/Excel výpis z banky (musí mať stĺpce s dátumom, sumou a variabilným symbolom) a nechaj appku spárovať platby s faktúrami automaticky.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> {isImportingBankStatement ? 'Nahrávam...' : 'Importovať výpis'}
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={isImportingBankStatement} onChange={(e) => handleImportBankStatement(e.target.files[0])} />
                      </label>
                      <button onClick={handleAutoMatchPayments} disabled={isAutoMatching} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {isAutoMatching ? 'Párujem...' : 'Spustiť párovanie'}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-3 py-3">Dátum</th><th className="px-3 py-3">Odosielateľ</th><th className="px-3 py-3 text-center">Suma</th><th className="px-3 py-3 text-center">VS</th><th className="px-3 py-3 text-center">Stav</th><th className="px-3 py-3 text-center">Akcia</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {bankTransactions.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">Žiadne bankové transakcie zatiaľ neboli nahraté.</td></tr>)}
                        {bankTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-800/40">
                            <td className="px-3 py-3">{tx.date}</td>
                            <td className="px-3 py-3 font-bold text-white">{tx.sender}</td>
                            <td className="px-3 py-3 text-center font-mono">{tx.amount.toFixed(2)} €</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-400">{tx.variableSymbol}</td>
                            <td className="px-3 py-3 text-center">{tx.matched ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-300">Spárované</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300">Nespárované</span>}</td>
                            <td className="px-3 py-3 text-center">
                              {!tx.matched && (
                                manualMatchingTx?.id === tx.id ? (
                                  <select autoFocus onChange={(e) => handleManualMatchPayment(tx, e.target.value)} onBlur={() => setManualMatchingTx(null)} className="bg-slate-950 border border-indigo-600 rounded p-1 text-[10px] text-white">
                                    <option value="">-- Vyber faktúru --</option>
                                    {invoices.filter(i => i.status !== 'paid').map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.customerName} ({i.total.toFixed(2)} €)</option>)}
                                  </select>
                                ) : (
                                  <button onClick={() => setManualMatchingTx(tx)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1 rounded">Spárovať ručne</button>
                                )
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {financeSubTab === 'cash' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-400">Príjmové (PPD) a výdavkové (VPD) pokladničné doklady.</p>
                    <button onClick={() => setShowCashDocForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nový doklad</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                        <tr><th className="px-3 py-3">Doklad</th><th className="px-3 py-3">Dátum</th><th className="px-3 py-3">Popis</th><th className="px-3 py-3">Kategória</th><th className="px-3 py-3 text-right">Suma</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {cashDocuments.length === 0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">Žiadne pokladničné doklady.</td></tr>)}
                        {cashDocuments.map(d => (
                          <tr key={d.id} className="hover:bg-slate-800/40">
                            <td className="px-3 py-3 font-mono font-bold text-indigo-400">{d.docNumber}</td>
                            <td className="px-3 py-3">{d.date}</td>
                            <td className="px-3 py-3 font-bold text-white">{d.description}</td>
                            <td className="px-3 py-3 text-slate-400">{d.category || '—'}</td>
                            <td className={`px-3 py-3 text-right font-bold ${d.docType === 'prijem' ? 'text-emerald-400' : 'text-rose-400'}`}>{d.docType === 'prijem' ? '+' : '-'}{d.amount.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {financeSubTab === 'journal' && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                      <tr><th className="px-3 py-3">Dátum</th><th className="px-3 py-3">Popis</th><th className="px-3 py-3">MD</th><th className="px-3 py-3">Dal</th><th className="px-3 py-3 text-right">Suma</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {journalEntries.length === 0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">Denník je zatiaľ prázdny.</td></tr>)}
                      {journalEntries.map(j => (
                        <tr key={j.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-3">{j.date}</td>
                          <td className="px-3 py-3 font-bold text-white">{j.description}</td>
                          <td className="px-3 py-3 font-mono text-emerald-400">{j.mdAccount}</td>
                          <td className="px-3 py-3 font-mono text-rose-400">{j.dalAccount}</td>
                          <td className="px-3 py-3 text-right font-bold">{j.amount.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {financeSubTab === 'ai' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl h-[560px] flex flex-col overflow-hidden">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white"><Bot className="w-5 h-5" /></div>
                    <div>
                      <h3 className="font-bold text-sm text-white">AI Účtovný Asistent</h3>
                      <p className="text-xs text-slate-400">Pozná tvoje aktuálne faktúry a platby</p>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {aiChat.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>{msg.text}</div>
                      </div>
                    ))}
                    {isAiLoading && (
                      <div className="flex justify-start"><div className="bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl p-3 text-xs flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Premýšľam...</div></div>
                    )}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); handleAskAiAccountant(aiPrompt); }} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
                    <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Opýtaj sa napr. koľko DPH máš zaplatiť..." className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500" />
                    <button type="submit" disabled={isAiLoading || !aiPrompt.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-xs font-semibold">Odoslať</button>
                  </form>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'archive' && (() => {
          const query = archiveSearchQuery.trim().toLowerCase();
          const results = orders.filter(o => {
            if (!query) return true;
            const haystack = [
              o.id, o.orderNumber || '', o.legacyOrderNumber || '', o.customer, o.notes || '', o.companyBrand || '',
              ...(o.items || []).map(it => `${it.productName} ${it.notes || ''} ${it.itemId}`),
              ...(o.orderLog || []).map(e => e.text)
            ].join(' ').toLowerCase();
            return haystack.includes(query);
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return (
            <div className="space-y-4 print:hidden animate-in fade-in duration-150">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Search className="text-indigo-400 h-5 w-5" /> História Zákaziek</h2>
              <p className="text-xs text-slate-400 -mt-2">Vyhľadaj podľa mena odberateľa, čísla zákazky (aj starého), názvu produktu alebo čohokoľvek zapísaného v denníku zákazky.</p>
              <input type="text" value={archiveSearchQuery} onChange={(e) => setArchiveSearchQuery(e.target.value)} placeholder="Hľadať... napr. meno klienta, staré číslo, kľúčové slovo z poznámky" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white" autoFocus />
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                    <tr><th className="px-3 py-3">Číslo</th><th className="px-3 py-3">Firma</th><th className="px-3 py-3">Odberateľ</th><th className="px-3 py-3">Staré č.</th><th className="px-3 py-3">Vytvorená</th><th className="px-3 py-3">Produkty</th><th className="px-3 py-3 text-center">Denník</th><th className="px-3 py-3 text-center">Karta</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {results.length === 0 && (<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 italic">Nič nenájdené.</td></tr>)}
                    {results.map(o => (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="px-3 py-3 font-mono font-bold text-indigo-400">{o.orderNumber || o.id}</td>
                        <td className="px-3 py-3"><span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${companyBrandBadgeClass(o.companyBrand)}`}>{o.companyBrand || 'ATAK'}</span></td>
                        <td className="px-3 py-3 font-bold text-white">{o.customer}</td>
                        <td className="px-3 py-3 text-slate-400">{o.legacyOrderNumber || '—'}</td>
                        <td className="px-3 py-3 text-slate-400">{o.createdAt}</td>
                        <td className="px-3 py-3 text-slate-400">{(o.items || []).map(it => it.productName).join(', ')}</td>
                        <td className="px-3 py-3 text-center">{(o.orderLog || []).length > 0 && <span className="bg-indigo-950/40 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">{o.orderLog.length} zápis(y)</span>}</td>
                        <td className="px-3 py-3 text-center"><button onClick={() => openOrderDetails(o)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1 rounded">Otvoriť</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {companySettingsDraft && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-white">Nastavenia firmy (pre hlavičku faktúr a QR platbu)</h3>
                <button onClick={handleCancelEditCompanySettings} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3 text-xs">
                <div><label className="text-slate-400 block mb-0.5">Názov firmy</label><input type="text" value={companySettingsDraft.companyName} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, companyName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-0.5">Adresa (sídlo)</label><input type="text" value={companySettingsDraft.address} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, address: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-slate-400 block mb-0.5">IČO</label><input type="text" value={companySettingsDraft.ico} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, ico: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">DIČ</label><input type="text" value={companySettingsDraft.dic} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, dic: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">IČ DPH</label><input type="text" value={companySettingsDraft.icDph} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, icDph: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" placeholder="ak si platca DPH" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-slate-400 block mb-0.5">IBAN</label><input type="text" value={companySettingsDraft.iban} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, iban: e.target.value.toUpperCase() })} placeholder="SK.." className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" /></div>
                  <div><label className="text-slate-400 block mb-0.5">Názov banky</label><input type="text" value={companySettingsDraft.bankName} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, bankName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-slate-400 block mb-0.5">Predvolená sadzba DPH (%)</label><input type="number" value={companySettingsDraft.defaultVatRate} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, defaultVatRate: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">Predpona čísla faktúry</label><input type="text" value={companySettingsDraft.invoiceNumberPrefix} onChange={(e) => setCompanySettingsDraft({ ...companySettingsDraft, invoiceNumberPrefix: e.target.value })} placeholder={`napr. ${new Date().getFullYear()}`} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                </div>
                <p className="text-[10px] text-slate-500">Ďalšie číslo faktúry, ktoré sa použije: <strong className="text-slate-300">{companySettingsDraft.invoiceNumberPrefix || new Date().getFullYear()}{String(companySettingsDraft.nextInvoiceNumber).padStart(4, '0')}</strong></p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveCompanySettings} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Uložiť</button>
                <button onClick={handleCancelEditCompanySettings} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 rounded-lg text-xs font-bold">Zrušiť</button>
              </div>
            </div>
          </div>
        )}

        {showCashDocForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-white">Nový pokladničný doklad</h3>
                <button onClick={() => setShowCashDocForm(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button onClick={() => setNewCashDocType('prijem')} className={`py-2 text-xs font-bold rounded ${newCashDocType === 'prijem' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Príjmový (PPD)</button>
                <button onClick={() => setNewCashDocType('vydaj')} className={`py-2 text-xs font-bold rounded ${newCashDocType === 'vydaj' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Výdavkový (VPD)</button>
              </div>
              <div><label className="text-xs text-slate-400 block mb-0.5">Dátum</label><input type="date" value={newCashDocDate} onChange={(e) => setNewCashDocDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" /></div>
              <div><label className="text-xs text-slate-400 block mb-0.5">Popis</label><input type="text" value={newCashDocDescription} onChange={(e) => setNewCashDocDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" /></div>
              <div><label className="text-xs text-slate-400 block mb-0.5">Kategória (voliteľné)</label><input type="text" value={newCashDocCategory} onChange={(e) => setNewCashDocCategory(e.target.value)} placeholder="napr. kancelárske potreby" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" /></div>
              <div><label className="text-xs text-slate-400 block mb-0.5">Suma (€)</label><input type="number" step="0.01" value={newCashDocAmount} onChange={(e) => setNewCashDocAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" /></div>
              <button onClick={handleAddCashDocument} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Vytvoriť doklad</button>
            </div>
          </div>
        )}

        {correctingInvoice && correctionDraft && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-amber-700/50 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Edit2 className="h-5 w-5 text-amber-400" /> Opraviť faktúru {correctingInvoice.invoiceNumber}</h3>
                <button onClick={handleCancelCorrectInvoice} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><label className="text-slate-400 block mb-0.5">Odberateľ</label><input type="text" value={correctionDraft.customerName} onChange={(e) => setCorrectionDraft({ ...correctionDraft, customerName: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-0.5">IČO</label><input type="text" value={correctionDraft.customerIco} onChange={(e) => setCorrectionDraft({ ...correctionDraft, customerIco: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
              </div>
              <div className="space-y-2">
                {correctionDraft.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center bg-slate-950 border border-slate-800 rounded p-2">
                    <input type="text" value={it.description} onChange={(e) => { const items = [...correctionDraft.items]; items[i] = { ...it, description: e.target.value }; setCorrectionDraft({ ...correctionDraft, items }); }} className="col-span-6 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    <input type="number" value={it.qty} onChange={(e) => { const items = [...correctionDraft.items]; items[i] = { ...it, qty: parseFloat(e.target.value) || 0 }; setCorrectionDraft({ ...correctionDraft, items }); }} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                    <input type="number" step="0.01" value={it.unitPrice} onChange={(e) => { const items = [...correctionDraft.items]; items[i] = { ...it, unitPrice: parseFloat(e.target.value) || 0 }; setCorrectionDraft({ ...correctionDraft, items }); }} className="col-span-4 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-0.5">Dôvod opravy (povinné)</label>
                <input type="text" required value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="napr. Zákazník nahlásil zlé IČO" className="w-full bg-slate-950 border border-rose-800/50 rounded p-2 text-xs text-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveInvoiceCorrection} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Uložiť opravu</button>
                <button onClick={handleCancelCorrectInvoice} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 rounded-lg text-xs font-bold">Zrušiť</button>
              </div>
            </div>
          </div>
        )}

        {showNewInvoiceForm && (() => {
          const totals = calcInvoiceTotals(newInvoiceItems);
          return (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900 border border-emerald-800/40 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-white">Nová faktúra{newInvoiceOrderId ? ` — zákazka ${newInvoiceOrderId}` : ''}</h3>
                  <button onClick={() => setShowNewInvoiceForm(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><label className="text-slate-400 block mb-0.5">Odberateľ (názov)</label><input type="text" value={newInvoiceCustomerName} onChange={(e) => setNewInvoiceCustomerName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">Adresa odberateľa</label><input type="text" value={newInvoiceCustomerAddress} onChange={(e) => setNewInvoiceCustomerAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">IČO</label><input type="text" value={newInvoiceCustomerIco} onChange={(e) => setNewInvoiceCustomerIco(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">DIČ</label><input type="text" value={newInvoiceCustomerDic} onChange={(e) => setNewInvoiceCustomerDic(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-0.5">IČ DPH (ak je)</label><input type="text" value={newInvoiceCustomerIcDph} onChange={(e) => setNewInvoiceCustomerIcDph(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Typ odberateľa (pre KV DPH)</label>
                    <select value={newInvoiceCustomerType} onChange={(e) => setNewInvoiceCustomerType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white">
                      <option value="sk_platca">SK — platca DPH</option>
                      <option value="sk_neplatca">SK — neplatca DPH</option>
                      <option value="eu_platca">EÚ — platca DPH (IČ DPH)</option>
                      <option value="eu_neplatca">EÚ — neplatca DPH</option>
                      <option value="tretia_krajina">Tretia krajina (mimo EÚ)</option>
                    </select>
                  </div>
                  <div><label className="text-slate-400 block mb-0.5">Dátum splatnosti</label><input type="date" value={newInvoiceDueDate} onChange={(e) => setNewInvoiceDueDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" /></div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase">Položky faktúry</span>
                    <button onClick={handleAddInvoiceLineItem} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Pridať položku</button>
                  </div>
                  {newInvoiceItems.map(it => (
                    <div key={it.tempId} className="grid grid-cols-12 gap-1.5 items-center bg-slate-950 border border-slate-800 rounded-lg p-2">
                      <input type="text" placeholder="Popis položky" value={it.description} onChange={(e) => handleUpdateInvoiceLineItem(it.tempId, 'description', e.target.value)} className="col-span-5 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                      <input type="number" placeholder="Ks" value={it.qty} onChange={(e) => handleUpdateInvoiceLineItem(it.tempId, 'qty', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                      <input type="number" step="0.01" placeholder="Cena/ks bez DPH" value={it.unitPrice} onChange={(e) => handleUpdateInvoiceLineItem(it.tempId, 'unitPrice', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white" />
                      <select value={it.vatRate} onChange={(e) => handleUpdateInvoiceLineItem(it.tempId, 'vatRate', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white">
                        <option value={20}>20% DPH</option>
                        <option value={10}>10% DPH</option>
                        <option value={0}>0% DPH</option>
                      </select>
                      <button onClick={() => handleRemoveInvoiceLineItem(it.tempId)} className="col-span-1 text-rose-400 hover:text-rose-300"><X className="h-4 w-4 mx-auto" /></button>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-400">Základ bez DPH:</span><strong className="text-white">{totals.subtotal.toFixed(2)} €</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">DPH:</span><strong className="text-white">{totals.vatTotal.toFixed(2)} €</strong></div>
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-800"><span className="text-slate-300 font-bold">Spolu k úhrade:</span><strong className="text-emerald-400">{totals.total.toFixed(2)} €</strong></div>
                </div>

                <div><label className="text-slate-400 block mb-0.5 text-xs">Poznámka (voliteľné)</label><textarea rows={2} value={newInvoiceNotes} onChange={(e) => setNewInvoiceNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white" /></div>

                <button onClick={handleConfirmNewInvoice} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg uppercase text-xs">Vystaviť faktúru</button>
              </div>
            </div>
          );
        })()}

        {selectedInvoiceForDetail && (
          <div className="fixed inset-0 bg-slate-950/95 z-50 overflow-y-auto print:relative print:inset-auto print:bg-white">
            <div className="max-w-3xl mx-auto bg-white text-black p-8 my-6 rounded-xl print:my-0 print:rounded-none print:shadow-none shadow-2xl">
              <div className="flex justify-between items-start mb-6 print:hidden">
                <div className="flex gap-2">
                  {selectedInvoiceForDetail.status !== 'paid' && (
                    <button onClick={() => handleMarkInvoicePaid(selectedInvoiceForDetail)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Check className="h-4 w-4" /> Označiť ako uhradenú</button>
                  )}
                  <button onClick={() => handleStartCorrectInvoice(selectedInvoiceForDetail)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Edit2 className="h-4 w-4" /> Opraviť</button>
                  <button onClick={() => printWithFilename(selectedInvoiceForDetail.invoiceNumber)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť / PDF</button>
                </div>
                <button onClick={() => setSelectedInvoiceForDetail(null)} className="p-1 rounded bg-slate-200 text-slate-600 hover:text-slate-900"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-extrabold">FAKTÚRA</h1>
                  <p className="text-sm text-slate-600">č. {selectedInvoiceForDetail.invoiceNumber}</p>
                  {selectedInvoiceForDetail.status === 'paid' && <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">UHRADENÁ</span>}
                </div>
                <img src="/logo-atak-pbt.png" alt="Logo" className="h-10" />
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Dodávateľ</span>
                  <p className="font-bold">{companySettings.companyName || '—'}</p>
                  <p>{companySettings.address}</p>
                  <p>IČO: {companySettings.ico} {companySettings.dic && `• DIČ: ${companySettings.dic}`}</p>
                  {companySettings.icDph && <p>IČ DPH: {companySettings.icDph}</p>}
                </div>
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Odberateľ</span>
                  <p className="font-bold">{selectedInvoiceForDetail.customerName}</p>
                  <p>{selectedInvoiceForDetail.customerAddress}</p>
                  {selectedInvoiceForDetail.customerIco && <p>IČO: {selectedInvoiceForDetail.customerIco} {selectedInvoiceForDetail.customerDic && `• DIČ: ${selectedInvoiceForDetail.customerDic}`}</p>}
                  {selectedInvoiceForDetail.customerIcDph && <p>IČ DPH: {selectedInvoiceForDetail.customerIcDph}</p>}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-6 text-xs bg-slate-50 p-3 rounded">
                <div><span className="text-slate-500 block">Dátum vystavenia</span><strong>{formatDeliveryDate(selectedInvoiceForDetail.issueDate)}</strong></div>
                <div><span className="text-slate-500 block">Dátum dodania</span><strong>{formatDeliveryDate(selectedInvoiceForDetail.deliveryDate)}</strong></div>
                <div><span className="text-slate-500 block">Splatnosť</span><strong>{formatDeliveryDate(selectedInvoiceForDetail.dueDate)}</strong></div>
                <div><span className="text-slate-500 block">Variabilný symbol</span><strong>{selectedInvoiceForDetail.variableSymbol}</strong></div>
              </div>

              <table className="w-full text-xs mb-6">
                <thead><tr className="border-b border-slate-300 text-slate-500"><th className="text-left py-1.5">Popis</th><th className="text-center py-1.5">Ks</th><th className="text-right py-1.5">Cena/ks</th><th className="text-right py-1.5">DPH</th><th className="text-right py-1.5">Spolu s DPH</th></tr></thead>
                <tbody>
                  {selectedInvoiceForDetail.items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100"><td className="py-1.5">{it.description}</td><td className="text-center py-1.5">{it.qty}</td><td className="text-right py-1.5">{it.unitPrice.toFixed(2)} €</td><td className="text-right py-1.5">{it.vatRate}%</td><td className="text-right py-1.5 font-bold">{(it.qty * it.unitPrice * (1 + it.vatRate / 100)).toFixed(2)} €</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start gap-6">
                <div className="text-xs space-y-1">
                  <p><span className="text-slate-500">Banka:</span> {companySettings.bankName}</p>
                  <p><span className="text-slate-500">IBAN:</span> <strong className="font-mono">{companySettings.iban}</strong></p>
                  <p><span className="text-slate-500">Variabilný symbol:</span> <strong>{selectedInvoiceForDetail.variableSymbol}</strong></p>
                  {selectedInvoiceForDetail.notes && <p className="italic text-slate-600 mt-2">{selectedInvoiceForDetail.notes}</p>}
                </div>
                <div className="text-right space-y-1 text-xs shrink-0">
                  <p>Základ: <strong>{selectedInvoiceForDetail.subtotal.toFixed(2)} €</strong></p>
                  <p>DPH: <strong>{selectedInvoiceForDetail.vatTotal.toFixed(2)} €</strong></p>
                  <p className="text-lg font-extrabold border-t border-slate-800 pt-1 mt-1">{selectedInvoiceForDetail.total.toFixed(2)} €</p>
                </div>
                {companySettings.iban && generateBySquareQr(selectedInvoiceForDetail) && (
                  <div className="text-center shrink-0">
                    <QRCodeSVG value={generateBySquareQr(selectedInvoiceForDetail)} size={100} level="M" />
                    <p className="text-[9px] text-slate-500 mt-1">PAY by square</p>
                  </div>
                )}
              </div>

              {(selectedInvoiceForDetail.corrections || []).length > 0 && (
                <div className="print:hidden mt-6 pt-4 border-t border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-amber-700 uppercase">História opráv</h4>
                  {selectedInvoiceForDetail.corrections.map((c, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-slate-700">
                      <p><strong>{c.author}</strong> • {c.date}</p>
                      <p className="italic">Dôvod: {c.reason}</p>
                      <p className="text-slate-500">Pôvodne: {c.before.customerName}, {c.before.total?.toFixed?.(2)} € → Opravené: {c.after.customerName}, {c.after.total?.toFixed?.(2)} €</p>
                    </div>
                  ))}
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
                {hasPermission('create_order') && (
                  <button onClick={() => { setActiveTab('invoices'); handleStartNewInvoice(selectedOrderDetails); }} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Banknote className="h-4 w-4" /> Vystaviť faktúru</button>
                )}
                <button onClick={() => printWithFilename(selectedOrderDetails.orderNumber || selectedOrderDetails.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť (A4)</button>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Staré číslo zákazky (voliteľné)</label>
                  <input type="text" value={orderEditDraft.legacyOrderNumber || ''} onChange={(e) => setOrderEditDraft({ ...orderEditDraft, legacyOrderNumber: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white" />
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
                            <button type="button" onClick={() => downloadFile(item.imageUrl, `${item.itemId}-nahlad.jpg`)} className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white" title="Stiahnuť"><Download className="h-3.5 w-3.5" /></button>
                            <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-2 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-400 font-bold">
                              <Upload className="h-3 w-3" /> Zmeniť obrázok
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDraftItemImageChange(item.itemId, e.target.files[0])} />
                            </label>
                            <button type="button" onClick={() => handleDraftItemImageRemove(item.itemId)} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded text-[10px] font-bold">Odstrániť obrázok</button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-500">
                            <Upload className="h-3.5 w-3.5" /> Nahrať obrázok
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDraftItemImageChange(item.itemId, e.target.files[0])} />
                          </label>
                        )}
                        <p className="text-[9px] text-slate-600 italic mt-1">Zmena sa uloží až po kliknutí na "Uložiť zmeny" nižšie.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Rozpis (2. strana sprievodky)</label>
                        {item.rozpisUrl ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-300 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 truncate max-w-[140px]">📎 {item.rozpisFileName || 'súbor'}</span>
                            <button type="button" onClick={() => downloadFile(item.rozpisUrl, item.rozpisFileName || 'rozpis')} className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white" title="Stiahnuť"><Download className="h-3.5 w-3.5" /></button>
                            <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-2 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-400 font-bold">
                              <Upload className="h-3 w-3" /> Zmeniť
                              <input type="file" accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => handleDraftItemRozpisChange(item.itemId, e.target.files[0])} />
                            </label>
                            <button type="button" onClick={() => handleDraftItemRozpisRemove(item.itemId)} className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 px-2 py-1 rounded text-[10px] font-bold">Odstrániť</button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-500">
                            <Upload className="h-3.5 w-3.5" /> Nahrať rozpis
                            <input type="file" accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => handleDraftItemRozpisChange(item.itemId, e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}

                  {!showAddItemForm ? (
                    <button type="button" onClick={() => { setShowAddItemForm(true); setAddItemStations(buildAllStationsPreset()); }} className="w-full border-2 border-dashed border-indigo-800/50 hover:border-indigo-600 text-indigo-400 font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Pridať novú položku do tejto zákazky</button>
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
                        <div className="grid grid-cols-2 gap-1">
                          {['men', 'women', 'children', 'neutral'].map(g => (
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
                        <div className="grid grid-cols-2 gap-1 mb-1.5">
                          <button type="button" onClick={() => setAddItemStations(buildAllStationsPreset())} className={`py-1 text-center text-[10px] font-bold rounded transition-colors ${matchesStationPreset(addItemStations, buildAllStationsPreset()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>Výroba (všetko)</button>
                          <button type="button" onClick={() => setAddItemStations(buildPrintOnlyPreset())} className={`py-1 text-center text-[10px] font-bold rounded transition-colors ${matchesStationPreset(addItemStations, buildPrintOnlyPreset()) ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>Len potlač</button>
                        </div>
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
                      {addItemStations.grafik && (
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Priradený grafik (voliteľné)</label>
                          <select value={addItemDesignerId} onChange={(e) => setAddItemDesignerId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white">
                            <option value="">-- Nepriradený --</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.avatar} {e.firstName} {e.lastName}</option>)}
                          </select>
                        </div>
                      )}
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
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Rozpis (voliteľné) — 2. strana sprievodky</label>
                        {addItemRozpisFile ? (
                          <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-1.5">
                            <span className="text-[10px] text-slate-300 truncate">📎 {addItemRozpisFile.name}</span>
                            <button type="button" onClick={() => setAddItemRozpisFile(null)} className="text-rose-400 hover:text-rose-300 shrink-0"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 border border-dashed border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer hover:border-indigo-600 transition-colors text-[10px] text-slate-500">
                            <Upload className="h-3.5 w-3.5" /> Nahrať rozpis
                            <input type="file" accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) setAddItemRozpisFile(f); }} />
                          </label>
                        )}
                      </div>
                      {(() => {
                        const prod = products.find(p => p.id === addItemProductId);
                        if (!prod) return null;
                        const qtyNum = parseInt(addItemQty) || 0;
                        const livePreview = [
                          prod.layer1 ? { layerName: 'Primárna látka', materialId: addItemLayer1Mat, qtyNeeded: calculateLayerConsumption(prod, addItemGender, 'layer1', qtyNum) } : null,
                          prod.layer2 && addItemLayer2Mat ? { layerName: 'Sekundárna látka', materialId: addItemLayer2Mat, qtyNeeded: calculateLayerConsumption(prod, addItemGender, 'layer2', qtyNum) } : null,
                          prod.layer3 && addItemLayer3Mat ? { layerName: 'Terciárna látka', materialId: addItemLayer3Mat, qtyNeeded: calculateLayerConsumption(prod, addItemGender, 'layer3', qtyNum) } : null,
                        ].filter(Boolean);
                        const warnings = computeStockWarnings(livePreview, materials, {});
                        if (warnings.length === 0) return null;
                        return (
                          <div className="bg-rose-950/40 border-2 border-rose-600 rounded-xl p-3 space-y-1.5">
                            <p className="text-xs font-extrabold text-rose-300 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Pozor — nedostatok materiálu na sklade!</p>
                            {warnings.map(w => (
                              <p key={w.materialId} className="text-[11px] text-rose-200">
                                <strong>{w.name}</strong>: {w.status === 'insufficient'
                                  ? <>potrebné {w.needed} {w.unit}, na sklade je len {w.available} {w.unit} (chýba {w.shortBy} {w.unit})</>
                                  : <>po tejto položke ostane už len {w.remaining} {w.unit} — na tesno, treba doobjednať</>}
                              </p>
                            ))}
                          </div>
                        );
                      })()}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-1 rounded print:bg-black print:text-white font-mono">SPRIEVODNÝ LIST VÝROBY</span>
                    {selectedOrderDetails.companyBrand && (
                      <span className={`text-xs font-extrabold uppercase tracking-widest px-2.5 py-1 rounded print:text-black print:border print:border-black ${companyBrandBadgeClass(selectedOrderDetails.companyBrand, 'solid')}`}>{selectedOrderDetails.companyBrand}</span>
                    )}
                    <CashBadge paymentType={selectedOrderDetails.paymentType} />
                  </div>
                  {selectedOrderDetails.orderNumber && <p className="font-mono text-lg font-extrabold text-white print:text-black">{selectedOrderDetails.orderNumber}</p>}
                  <p className="font-mono text-[11px] text-slate-500 print:text-black">interné ID: {selectedOrderDetails.id}</p>
                  <h1 className="text-2xl font-extrabold text-white print:text-black">{selectedOrderDetails.customer}</h1>
                  <p className="text-sm text-slate-400 print:text-black">Vytvorené: <strong className="text-white print:text-black">{selectedOrderDetails.createdAt}</strong> • Termín dodania: <strong className={isUrgentDate(selectedOrderDetails.deliveryDate) ? 'text-rose-400 print:text-black bg-rose-950/50 px-1.5 py-0.5 rounded print:bg-transparent' : 'text-indigo-400 print:text-black'}>{formatDeliveryDate(selectedOrderDetails.deliveryDate)}</strong></p>
                  <p className="text-sm text-slate-400 print:text-black">Platba: <strong className="text-white print:text-black">{selectedOrderDetails.paymentType === 'hotovost' ? 'Hotovosť' : 'Faktúra'}</strong></p>
                  {selectedOrderDetails.legacyOrderNumber && <p className="text-sm text-slate-400 print:text-black">Staré číslo zákazky: <strong className="text-white print:text-black">{selectedOrderDetails.legacyOrderNumber}</strong></p>}
                  {selectedOrderDetails.notes && <p className="text-sm text-slate-400 print:text-black">Poznámka: <strong className="text-white print:text-black">{selectedOrderDetails.notes}</strong></p>}
                  {selectedOrderDetails.driveLink && (
                    <p className="text-sm text-slate-400 print:text-black">
                      Podklady: <a href={selectedOrderDetails.driveLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 print:text-black underline break-all">{selectedOrderDetails.driveLink}</a>
                    </p>
                  )}
                </div>
              </div>

              <div className="print:hidden bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><FileEdit className="h-3.5 w-3.5" /> Denník zákazky — trvalé poznámky (nedajú sa mazať ani upravovať)</h4>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {(selectedOrderDetails.orderLog || []).length === 0 && (
                    <p className="text-xs text-slate-600 italic">Zatiaľ žiadne záznamy. Sem zapisuj detaily, ktoré sa oplatí zapamätať pre budúce opakovanie tejto zákazky.</p>
                  )}
                  {(selectedOrderDetails.orderLog || []).map((entry, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-200">{entry.text}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{entry.author} • {entry.date}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOrderLogEntry}
                    onChange={(e) => setNewOrderLogEntry(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOrderLogEntry(selectedOrderDetails, newOrderLogEntry)}
                    placeholder="napr. Zákazník chce logo o 2cm menšie ako štandard, farba na mieru miešaná..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <button onClick={() => handleAddOrderLogEntry(selectedOrderDetails, newOrderLogEntry)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg shrink-0">Zapísať natrvalo</button>
                </div>
              </div>

              {selectedOrderDetails.items.map((item, itemIdx) => (
                <div key={item.itemId} className="py-6 border-b border-slate-800 print:border-black space-y-4" style={itemIdx > 0 ? { breakBefore: 'page' } : {}}>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <span className="font-mono text-xs text-indigo-400 font-bold block">Položka #{itemIdx + 1} • {item.itemId}</span>
                      <h2 className="text-lg font-extrabold text-white print:text-black">{item.productName} [{item.customCode}]</h2>
                      <p className="text-sm text-slate-400 print:text-black">Vyhotovenie: <strong className="text-indigo-400 print:text-black uppercase">{item.qualityTier}</strong>{qualityTiers.find(t => t.name === item.qualityTier)?.desc && <span className="text-xs text-slate-500 italic print:text-black"> ({qualityTiers.find(t => t.name === item.qualityTier).desc})</span>} • {genderLabel(item.gender)} • <strong className="text-white print:text-black">{item.qty} ks</strong></p>
                      {item.notes && <p className="text-xs text-slate-400 italic print:text-black mt-1">Poznámka: {item.notes}</p>}
                      {(() => {
                        const { arrival, departure } = getArrivalDeparture(item);
                        if (!arrival && !departure) return null;
                        return (
                          <div className="flex flex-wrap gap-2 mt-2 print:hidden">
                            {arrival && <span className="text-[10px] bg-sky-950/40 text-sky-300 border border-sky-800/40 px-2 py-1 rounded-full font-bold">📥 Prijaté: {arrival.at} {arrival.by ? `(${arrival.by})` : ''}</span>}
                            {departure && <span className="text-[10px] bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-1 rounded-full font-bold">📦 Odoslané: {departure.at} {departure.by ? `(${departure.by})` : ''}</span>}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="bg-white p-3 rounded-xl flex flex-col items-center border border-slate-300 shadow-sm shrink-0">
                      <QRCodeSVG value={`${window.location.origin}${window.location.pathname}?scan=${item.itemId}`} size={88} level="M" />
                      <span className="font-mono text-[9px] text-black font-extrabold mt-1">{item.itemId}</span>
                    </div>
                  </div>

                  {item.imageUrl ? (
                    <div className="relative">
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-[320px] sm:h-[380px] print:h-[140mm] object-contain bg-white rounded-xl border border-slate-300" />
                      <button onClick={() => downloadFile(item.imageUrl, `${item.itemId}-nahlad.jpg`, () => triggerNotification('error', 'Stiahnutie zlyhalo, skús otvoriť obrázok priamo.'))} className="print:hidden absolute top-2 right-2 bg-slate-950/80 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur"><Download className="h-3.5 w-3.5" /> Stiahnuť</button>
                    </div>
                  ) : (
                    <div className="w-full h-[320px] sm:h-[380px] print:h-[140mm] rounded-xl border border-dashed border-slate-700 print:border-slate-400 flex items-center justify-center text-slate-600 print:text-slate-400 text-sm italic">Bez obrázka</div>
                  )}

                  {item.rozpisUrl && (
                    item.rozpisMimeType?.startsWith('image/') ? (
                      <div style={{ breakBefore: 'page' }} className="pt-6 space-y-2">
                        <div className="flex items-center justify-between print:hidden">
                          <span className="font-mono text-xs text-indigo-400 font-bold block">Rozpis — Položka #{itemIdx + 1} • {item.itemId}</span>
                          <button onClick={() => downloadFile(item.rozpisUrl, item.rozpisFileName || `${item.itemId}-rozpis.jpg`, () => triggerNotification('error', 'Stiahnutie zlyhalo, skús otvoriť obrázok priamo.'))} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Stiahnuť</button>
                        </div>
                        <span className="font-mono text-xs text-indigo-400 font-bold hidden print:block">Rozpis — Položka #{itemIdx + 1} • {item.itemId}</span>
                        <img src={item.rozpisUrl} alt="Rozpis" className="w-full h-[320px] sm:h-[600px] print:h-[250mm] object-contain bg-white rounded-xl border border-slate-300" />
                      </div>
                    ) : (
                      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-300 flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-400" /> Priložený rozpis: <strong>{item.rozpisFileName}</strong></span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => downloadFile(item.rozpisUrl, item.rozpisFileName || 'rozpis', () => window.open(item.rozpisUrl, '_blank'))} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Stiahnuť</button>
                          <a href={item.rozpisUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] px-3 py-1.5 rounded-lg">Otvoriť</a>
                        </div>
                      </div>
                    )
                  )}

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
