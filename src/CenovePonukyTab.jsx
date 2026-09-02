import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, Trash2, Copy, Eye, Code, Save, Search, FolderOpen,
  Image as ImageIcon, Upload, Award, ListChecks, Clock, ShoppingCart, Loader2
} from 'lucide-react';

// --- Lokálne konštanty (duplicitne s App.jsx, aby tento súbor zostal samostatný) ---
const TIER_LABELS = { standard: 'Standard', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
const TIER_COLORS = { standard: 'bg-slate-700 text-slate-200', bronze: 'bg-amber-800 text-amber-100', silver: 'bg-slate-400 text-slate-900', gold: 'bg-yellow-500 text-yellow-950' };

const mapPriceItemFromDb = (r) => ({ id: r.id, name: r.name, description: r.description || '', price: r.price || 0, sortOrder: r.sort_order || 0 });
const mapPriceItemToDb = (i) => ({ id: i.id, name: i.name, description: i.description || null, price: i.price, sort_order: i.sortOrder || 0 });

const mapQuoteFromDb = (r) => ({ id: r.id, offerNumber: r.offer_number, quoteDate: r.quote_date, customerName: r.customer_name || '', customerEmail: r.customer_email || '', title: r.title || '', total: r.total || 0, status: r.status || 'Odoslaná', data: r.data || {} });

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function fmtMoney(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',') + ' €';
}

function defaultOfferNumber() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 90) + 10);
  return `${yyyy}-${mm}${dd}-${rand}`;
}

function newItem() {
  return { key: `it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: '', desc: '', badge: '', price: 0, qty: 1 };
}

function emptyForm(defaults = {}) {
  return {
    offerNumber: defaultOfferNumber(),
    offerValidity: '30 dní',
    customerName: '',
    customerEmail: '',
    offerTitle: '',
    offerSubtitle: 'Ceny sú uvedené v EUR bez DPH.',
    discountPercent: 0,
    items: [newItem()],
    summaryMode: 'auto',
    variantA: { title: 'Základná varianta', price: 0 },
    variantB: { title: 'Odporúčaná varianta', price: 0 },
    showVisual: false,
    visualUrl: '',
    services: '',
    repName: defaults.repName || '',
    repRole: defaults.repRole || '',
    repPhone: defaults.repPhone || '',
    repEmail: defaults.repEmail || '',
    vatRate: defaults.vatRate ?? 20,
    ...defaults.overrides,
  };
}

function computeTotals(form) {
  const subtotal = form.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const discountVal = subtotal * ((Number(form.discountPercent) || 0) / 100);
  const afterDiscount = subtotal - discountVal;
  const vat = afterDiscount * ((Number(form.vatRate) || 0) / 100);
  const total = afterDiscount + vat;
  return { subtotal, discountVal, afterDiscount, vat, total };
}

function buildEmailHtml(form, company) {
  const totals = computeTotals(form);
  const companyName = company.companyName || 'Vaša firma';
  const addrLine = [company.address, company.ico ? `IČO: ${company.ico}` : '', company.icDph ? `IČ DPH: ${company.icDph}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');

  let discountBanner = '';
  if (form.discountPercent > 0) {
    discountBanner = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;background-color:#EEF2FF;border:1px solid #6366F1;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-size:12px;font-weight:700;color:#3730A3;">Na túto ponuku bola uplatnená zľava ${escapeHtml(form.discountPercent)}%.</td></tr>
    </table>`;
  }

  let itemsHtml = '';
  form.items.forEach((item) => {
    const isRecommended = item.badge && item.badge.toUpperCase().includes('ODPOR');
    itemsHtml += `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:12px;background-color:${isRecommended ? '#EEF2FF' : '#F8FAFC'};border:1px solid ${isRecommended ? '#A5B4FC' : '#E2E8F0'};border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
          <td valign="top">
            <div style="font-size:14px;font-weight:700;color:#1E293B;margin-bottom:4px;">
              ${escapeHtml(item.title)}
              ${item.badge ? `<span style="display:inline-block;background-color:${isRecommended ? '#C7D2FE' : '#E2E8F0'};color:${isRecommended ? '#3730A3' : '#475569'};font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;margin-left:6px;text-transform:uppercase;">${escapeHtml(item.badge)}</span>` : ''}
            </div>
            <div style="font-size:12px;color:#64748B;line-height:1.4;">${escapeHtml(item.desc)}</div>
          </td>
          <td valign="top" align="right" style="width:120px;">
            <div style="font-size:16px;font-weight:800;color:#4F46E5;text-align:right;white-space:nowrap;">${fmtMoney(item.price)}</div>
            <div style="font-size:10px;color:#94A3B8;text-align:right;margin-top:2px;">${item.qty ? `počet: ${item.qty} ks` : 'bez DPH / ks'}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>`;
  });

  let summaryHtml = '';
  if (form.summaryMode === 'auto') {
    summaryHtml = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:18px;margin-bottom:24px;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);border-radius:10px;color:#fff;border:1px solid #334155;">
      <tr><td style="padding:20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
          <td>
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#818CF8;margin-bottom:4px;">CELKOVÁ REKAPITULÁCIA PONUKY</div>
          </td>
          <td align="right">
            <div style="font-size:12px;color:#CBD5E1;">Spolu bez DPH: <strong style="color:#fff;">${fmtMoney(totals.afterDiscount)}</strong></div>
            <div style="font-size:12px;color:#CBD5E1;margin-top:2px;">DPH (${escapeHtml(form.vatRate)}%): <strong>${fmtMoney(totals.vat)}</strong></div>
            <div style="font-size:20px;font-weight:900;color:#34D399;margin-top:4px;white-space:nowrap;">${fmtMoney(totals.total)} <span style="font-size:11px;font-weight:600;color:#94A3B8;">s DPH</span></div>
          </td>
        </tr></table>
      </td></tr>
    </table>`;
  } else if (form.summaryMode === 'variants') {
    summaryHtml = `
    <div style="margin-top:18px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#4F46E5;margin-bottom:8px;">MOŽNOSTI NA VÝBER PRE ZÁKAZNÍKA:</div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
        <td width="48%" valign="top" style="background-color:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;padding:12px;">
          <div style="font-size:10px;font-weight:800;color:#64748B;text-transform:uppercase;">MOŽNOSŤ A</div>
          <div style="font-size:13px;font-weight:700;color:#1E293B;margin-top:2px;">${escapeHtml(form.variantA.title)}</div>
          <div style="font-size:16px;font-weight:800;color:#4F46E5;margin-top:6px;">${fmtMoney(form.variantA.price)} <span style="font-size:10px;color:#94A3B8;font-weight:normal;">bez DPH</span></div>
        </td>
        <td width="4%">&nbsp;</td>
        <td width="48%" valign="top" style="background-color:#ECFDF5;border:2px solid #10B981;border-radius:8px;padding:12px;">
          <div style="font-size:10px;font-weight:800;color:#047857;text-transform:uppercase;">MOŽNOSŤ B (ODPORÚČAME)</div>
          <div style="font-size:13px;font-weight:700;color:#065F46;margin-top:2px;">${escapeHtml(form.variantB.title)}</div>
          <div style="font-size:16px;font-weight:900;color:#059669;margin-top:6px;">${fmtMoney(form.variantB.price)} <span style="font-size:10px;color:#047857;font-weight:normal;">bez DPH</span></div>
        </td>
      </tr></table>
    </div>`;
  }

  let visualHtml = '';
  if (form.showVisual && form.visualUrl) {
    visualHtml = `
    <div style="margin-top:25px;margin-bottom:25px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;text-align:center;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#4F46E5;margin-bottom:10px;text-align:left;">GRAFICKÝ NÁHĽAD / VIZUÁL</div>
      <img src="${form.visualUrl}" alt="Grafický vizuál ponuky" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #CBD5E1;" />
    </div>`;
  }

  let servicesHtml = '';
  const servicesArr = (form.services || '').split('\n').filter(s => s.trim() !== '');
  if (servicesArr.length > 0) {
    let rows = '';
    servicesArr.forEach(s => {
      rows += `<tr><td width="20" valign="top" style="color:#10B981;font-weight:bold;font-size:14px;">✓</td><td style="font-size:12px;color:#475569;line-height:1.4;padding-bottom:6px;">${escapeHtml(s)}</td></tr>`;
    });
    servicesHtml = `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:10px;margin-bottom:24px;background-color:#F8FAFC;border:1px dashed #CBD5E1;border-radius:8px;">
      <tr><td style="padding:16px;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#1E293B;margin-bottom:10px;letter-spacing:0.5px;">ZAHRNUTÉ V CENE</div>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">${rows}</table>
      </td></tr>
    </table>`;
  }

  const mailtoSubject = encodeURIComponent(`Cenová ponuka č. ${form.offerNumber}`);
  const mailtoBody = encodeURIComponent(`Dobrý deň,\n\nreagujem na cenovú ponuku č. ${form.offerNumber} (${form.offerTitle}).\n\n`);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><title>Cenová ponuka</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;padding:20px 10px;"><tr><td align="center">
<table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);border:1px solid #E2E8F0;">

<tr><td style="background:linear-gradient(135deg,#1E293B 0%,#0F172A 100%);padding:22px 28px;border-bottom:3px solid #4F46E5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr>
    <td><div style="color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(companyName)}</div></td>
    <td align="right" valign="middle">
      <div style="background-color:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 12px;display:inline-block;text-align:right;">
        <div style="font-size:10px;color:#CBD5E1;text-transform:uppercase;letter-spacing:0.5px;">CENOVÁ PONUKA</div>
        <div style="font-size:13px;font-weight:700;color:#ffffff;">Č. ${escapeHtml(form.offerNumber)}</div>
        <div style="font-size:9px;color:#A5B4FC;margin-top:1px;">PLATNOSŤ ${escapeHtml(form.offerValidity)}</div>
      </div>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:30px 30px 20px 30px;">
  ${form.customerName ? `<div style="font-size:14px;color:#334155;font-weight:600;margin-bottom:6px;">Dobrý deň ${escapeHtml(form.customerName)},</div>` : ''}
  <div style="font-size:13px;color:#64748B;margin-bottom:16px;line-height:1.5;">Na základe Vašej žiadosti Vám zasielame cenovú ponuku:</div>
  ${discountBanner}
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#EEF2FF;border-left:4px solid #4F46E5;border-radius:4px;margin-bottom:24px;">
    <tr><td style="padding:12px 16px;">
      <div style="font-size:17px;font-weight:800;color:#3730A3;">${escapeHtml(form.offerTitle)}</div>
      ${form.offerSubtitle ? `<div style="font-size:12px;color:#4338CA;margin-top:3px;">${escapeHtml(form.offerSubtitle)}</div>` : ''}
    </td></tr>
  </table>
  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin-bottom:12px;">POLOŽKY PONUKY</div>
  ${itemsHtml}
  ${summaryHtml}
  ${visualHtml}
  ${servicesHtml}

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#EEF2FF;border:2px solid #6366F1;border-radius:12px;margin-bottom:25px;">
    <tr><td style="padding:20px;text-align:center;">
      <div style="font-size:14px;font-weight:800;color:#3730A3;margin-bottom:6px;">MÁTE ZÁUJEM O TÚTO PONUKU?</div>
      <div style="font-size:12px;color:#3730A3;line-height:1.4;margin-bottom:14px;">Odpovedzte na tento e-mail a obratom potvrdíme objednávku.</div>
      <a href="mailto:${escapeHtml(form.repEmail)}?subject=${mailtoSubject}&body=${mailtoBody}" style="background-color:#10B981;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:800;display:inline-block;">MÁM ZÁUJEM – REAGOVAŤ NA PONUKU Č. ${escapeHtml(form.offerNumber)}</a>
    </td></tr>
  </table>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:2px solid #F1F5F9;padding-top:20px;">
    <tr><td valign="top">
      <div style="font-size:11px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">PONUKU VYPRACOVAL</div>
      <div style="font-size:15px;font-weight:800;color:#0F172A;">${escapeHtml(form.repName)}</div>
      <div style="font-size:12px;color:#64748B;font-weight:600;">${escapeHtml(form.repRole)} | <strong>${escapeHtml(companyName)}</strong></div>
      <div style="font-size:12px;color:#4F46E5;margin-top:6px;font-weight:600;">
        ${form.repPhone ? `<a href="tel:${escapeHtml(form.repPhone)}" style="color:#4F46E5;text-decoration:none;">${escapeHtml(form.repPhone)}</a>` : ''}
        ${form.repPhone && form.repEmail ? ' &nbsp;|&nbsp; ' : ''}
        ${form.repEmail ? `<a href="mailto:${escapeHtml(form.repEmail)}" style="color:#4F46E5;text-decoration:none;">${escapeHtml(form.repEmail)}</a>` : ''}
      </div>
    </td></tr>
  </table>
</td></tr>

<tr><td style="background-color:#0F172A;padding:20px 30px;color:#94A3B8;font-size:11px;text-align:center;border-top:1px solid #1E293B;">
  <div style="line-height:1.6;color:#64748B;font-size:11px;">
    <strong style="color:#94A3B8;">${escapeHtml(companyName)}</strong>${company.address ? ` • ${escapeHtml(company.address)}` : ''}<br/>
    ${addrLine ? `${addrLine}<br/>` : ''}
    <span style="font-size:10px;color:#475569;">Zaslané na základe Vašej žiadosti o cenovú ponuku.</span>
  </div>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

export default function CenovePonukyTab({ supabase, customers, companySettings, tierRules, getCustomerTier, currentUser, triggerNotification }) {
  const [subTab, setSubTab] = useState('builder');
  const [priceList, setPriceList] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState('preview');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [quickCatalogId, setQuickCatalogId] = useState('');
  const [quickCatalogQty, setQuickCatalogQty] = useState(1);
  const [newPriceItem, setNewPriceItem] = useState({ name: '', description: '', price: '' });
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => emptyForm({
    repName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '',
    repRole: currentUser?.position || '',
    repPhone: currentUser?.phone || '',
    repEmail: currentUser?.email || '',
    vatRate: companySettings?.defaultVatRate ?? 20,
  }));

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const [priceRes, quoteRes] = await Promise.all([
        supabase.from('quote_price_list').select('*').order('sort_order'),
        supabase.from('price_quotes').select('*').order('created_at', { ascending: false }),
      ]);
      setPriceList(priceRes.error ? [] : (priceRes.data || []).map(mapPriceItemFromDb));
      setQuotes(quoteRes.error ? [] : (quoteRes.data || []).map(mapQuoteFromDb));
      setLoading(false);
    })();
  }, [supabase]);

  const totals = computeTotals(form);

  const updateForm = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const updateItem = (key, field, value) => setForm(prev => ({ ...prev, items: prev.items.map(it => it.key === key ? { ...it, [field]: value } : it) }));
  const addFormItem = () => setForm(prev => ({ ...prev, items: [...prev.items, newItem()] }));
  const removeFormItem = (key) => setForm(prev => ({ ...prev, items: prev.items.filter(it => it.key !== key) }));

  const onSelectCustomer = (name) => {
    if (!name) { updateForm({ customerName: '', customerEmail: '', discountPercent: 0 }); return; }
    const c = customers.find(c => c.name === name);
    const tier = getCustomerTier(name);
    const rule = tierRules.find(r => r.tier === tier);
    updateForm({
      customerName: name,
      customerEmail: c?.email || '',
      discountPercent: rule?.discountPercent || 0,
    });
  };

  const addCatalogItemToForm = () => {
    const catItem = priceList.find(p => p.id === quickCatalogId);
    if (!catItem) return;
    setForm(prev => ({ ...prev, items: [...prev.items, { key: `it-${Date.now()}`, title: catItem.name, desc: catItem.description, badge: '', price: catItem.price, qty: Number(quickCatalogQty) || 1 }] }));
  };

  const handleVisualUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateForm({ visualUrl: ev.target.result });
    reader.readAsDataURL(file);
  };

  const emailHtml = buildEmailHtml(form, companySettings || {});

  const copyRawHtml = async () => {
    try {
      await navigator.clipboard.writeText(emailHtml);
      triggerNotification('success', 'HTML kód ponuky skopírovaný do schránky.');
    } catch {
      triggerNotification('error', 'Kopírovanie sa nepodarilo.');
    }
  };

  const copyFormattedHtml = (containerId) => {
    try {
      const container = document.getElementById(containerId);
      const range = document.createRange();
      range.selectNode(container);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('copy');
      selection.removeAllRanges();
      triggerNotification('success', 'Formátovaná ponuka skopírovaná. Vložte cez Ctrl+V priamo do e-mailu.');
    } catch {
      copyRawHtml();
    }
  };

  const saveQuoteToHistory = async () => {
    if (!supabase) return;
    const id = `Q-${form.offerNumber}`;
    const record = {
      id,
      offer_number: form.offerNumber,
      quote_date: new Date().toISOString().slice(0, 10),
      customer_name: form.customerName,
      customer_email: form.customerEmail,
      title: form.offerTitle,
      total: totals.total,
      status: 'Odoslaná',
      data: form,
    };
    const { error } = await supabase.from('price_quotes').upsert(record);
    if (error) { triggerNotification('error', error.message); return; }
    setQuotes(prev => [mapQuoteFromDb(record), ...prev.filter(q => q.id !== id)]);
    triggerNotification('success', `Ponuka č. ${form.offerNumber} bola uložená do histórie.`);
  };

  const loadQuoteFromHistory = (q) => {
    setForm({ ...emptyForm(), ...q.data, offerNumber: q.offerNumber });
    setSubTab('builder');
    triggerNotification('success', `Ponuka č. ${q.offerNumber} načítaná do editora.`);
  };

  const updateQuoteStatus = async (q, status) => {
    if (!supabase) return;
    const { error } = await supabase.from('price_quotes').update({ status }).eq('id', q.id);
    if (error) { triggerNotification('error', error.message); return; }
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
  };

  const deleteQuote = async (q) => {
    if (!supabase) return;
    if (!window.confirm(`Vymazať ponuku č. ${q.offerNumber} z archívu?`)) return;
    const { error } = await supabase.from('price_quotes').delete().eq('id', q.id);
    if (error) { triggerNotification('error', error.message); return; }
    setQuotes(prev => prev.filter(x => x.id !== q.id));
  };

  const addPriceListItem = async () => {
    if (!supabase || !newPriceItem.name.trim()) return;
    const item = { id: `qpl-${Date.now()}`, name: newPriceItem.name.trim(), description: newPriceItem.description, price: parseFloat(newPriceItem.price) || 0, sortOrder: priceList.length };
    const { error } = await supabase.from('quote_price_list').insert(mapPriceItemToDb(item));
    if (error) { triggerNotification('error', error.message); return; }
    setPriceList(prev => [...prev, item]);
    setNewPriceItem({ name: '', description: '', price: '' });
    triggerNotification('success', 'Položka pridaná do cenníka.');
  };

  const updatePriceListItem = async (id, field, value) => {
    const parsed = field === 'price' ? (parseFloat(value) || 0) : value;
    setPriceList(prev => prev.map(p => p.id === id ? { ...p, [field]: parsed } : p));
    if (!supabase) return;
    const dbField = field === 'name' ? 'name' : field === 'description' ? 'description' : 'price';
    await supabase.from('quote_price_list').update({ [dbField]: parsed }).eq('id', id);
  };

  const deletePriceListItem = async (id) => {
    if (!supabase) return;
    if (!window.confirm('Vymazať túto položku z cenníka?')) return;
    const { error } = await supabase.from('quote_price_list').delete().eq('id', id);
    if (error) { triggerNotification('error', error.message); return; }
    setPriceList(prev => prev.filter(p => p.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Načítavam cenové ponuky...</div>;
  }

  const inputCls = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none";
  const labelCls = "block text-[11px] text-slate-400 mb-1";

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-indigo-400 h-5 w-5" /> Cenové ponuky</h2>
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button onClick={() => setSubTab('builder')} className={`px-3.5 py-2 rounded-lg flex items-center gap-2 ${subTab === 'builder' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Plus className="h-3.5 w-3.5" /> Nová ponuka</button>
          <button onClick={() => setSubTab('history')} className={`px-3.5 py-2 rounded-lg flex items-center gap-2 ${subTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Clock className="h-3.5 w-3.5" /> História <span className="bg-slate-700 text-slate-200 text-[10px] px-1.5 rounded-full">{quotes.length}</span></button>
          <button onClick={() => setSubTab('pricelist')} className={`px-3.5 py-2 rounded-lg flex items-center gap-2 ${subTab === 'pricelist' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><ListChecks className="h-3.5 w-3.5" /> Cenník</button>
        </div>
      </div>

      {subTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: FORM */}
          <section className="lg:col-span-5 bg-slate-900/40 rounded-2xl p-5 border border-slate-800 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-14rem)]">

            <div className="space-y-3 border-b border-slate-800 pb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Zákazník</h3>
              <div>
                <label className={labelCls}>Výber z CRM zákazníkov</label>
                <select value={form.customerName && customers.some(c => c.name === form.customerName) ? form.customerName : ''} onChange={(e) => onSelectCustomer(e.target.value)} className={inputCls}>
                  <option value="">-- Nový / príležitostný zákazník --</option>
                  {customers.map(c => {
                    const tier = getCustomerTier(c.name);
                    return <option key={c.name} value={c.name}>{c.name} ({TIER_LABELS[tier]})</option>;
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Meno / Firma</label><input type="text" value={form.customerName} onChange={(e) => updateForm({ customerName: e.target.value })} className={inputCls} placeholder="Firma s.r.o." /></div>
                <div><label className={labelCls}>E-mail</label><input type="email" value={form.customerEmail} onChange={(e) => updateForm({ customerEmail: e.target.value })} className={inputCls} placeholder="klient@firma.sk" /></div>
              </div>
              {form.customerName && customers.some(c => c.name === form.customerName) && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${TIER_COLORS[getCustomerTier(form.customerName)]}`}><Award className="h-3 w-3 inline mr-1" />{TIER_LABELS[getCustomerTier(form.customerName)]}</span>
                  <span className="text-[10px] text-slate-400">Odporúčaná zľava dosadená nižšie, dá sa upraviť</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Číslo ponuky</label><input type="text" value={form.offerNumber} onChange={(e) => updateForm({ offerNumber: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Platnosť</label><input type="text" value={form.offerValidity} onChange={(e) => updateForm({ offerValidity: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Zľava (%)</label><input type="number" step="0.1" value={form.discountPercent} onChange={(e) => updateForm({ discountPercent: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Názov ponuky</label><input type="text" value={form.offerTitle} onChange={(e) => updateForm({ offerTitle: e.target.value })} className={inputCls} placeholder="napr. Firemné tričká s potlačou" /></div>
              <div><label className={labelCls}>Podnadpis / poznámka</label><input type="text" value={form.offerSubtitle} onChange={(e) => updateForm({ offerSubtitle: e.target.value })} className={inputCls} /></div>
            </div>

            <div className="space-y-3 border-b border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Položky ponuky</h3>
                <button onClick={addFormItem} className="text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-md font-medium flex items-center gap-1"><Plus className="h-3 w-3" /> Pridať</button>
              </div>
              {priceList.length > 0 && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex gap-2">
                  <select value={quickCatalogId} onChange={(e) => setQuickCatalogId(e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">-- Vybrať z cenníka --</option>
                    {priceList.map(p => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</option>)}
                  </select>
                  <input type="number" min="1" value={quickCatalogQty} onChange={(e) => setQuickCatalogQty(e.target.value)} className="w-16 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white text-center" />
                  <button onClick={addCatalogItemToForm} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 rounded-lg font-bold">Pridať</button>
                </div>
              )}
              <div className="space-y-2.5">
                {form.items.map(it => (
                  <div key={it.key} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="text" value={it.title} onChange={(e) => updateItem(it.key, 'title', e.target.value)} placeholder="Názov položky" className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                      <input type="number" min="1" value={it.qty} onChange={(e) => updateItem(it.key, 'qty', e.target.value)} className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-white text-center" />
                      <input type="number" step="0.01" value={it.price} onChange={(e) => updateItem(it.key, 'price', e.target.value)} className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-emerald-400 font-bold text-right" />
                      <button onClick={() => removeFormItem(it.key)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={it.desc} onChange={(e) => updateItem(it.key, 'desc', e.target.value)} placeholder="Popis položky" className="col-span-2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300" />
                      <input type="text" value={it.badge} onChange={(e) => updateItem(it.key, 'badge', e.target.value)} placeholder="Štítok (napr. ODPORÚČAME)" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-b border-slate-800 pb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Typ rekapitulácie</h3>
              <div className="space-y-1.5">
                {[['auto', `Automatický súčet (položky × ks + DPH ${form.vatRate}%)`], ['variants', 'Porovnanie variantov A vs. B'], ['none', 'Bez celkového súčtu']].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input type="radio" name="summary-mode" checked={form.summaryMode === val} onChange={() => updateForm({ summaryMode: val })} className="text-indigo-500" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {form.summaryMode === 'auto' && (
                <div><label className={labelCls}>Sadzba DPH (%)</label><input type="number" step="0.1" value={form.vatRate} onChange={(e) => updateForm({ vatRate: e.target.value })} className={`${inputCls} w-24`} /></div>
              )}
              {form.summaryMode === 'variants' && (
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={form.variantA.title} onChange={(e) => updateForm({ variantA: { ...form.variantA, title: e.target.value } })} placeholder="Variant A" className="col-span-2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                    <input type="number" step="0.01" value={form.variantA.price} onChange={(e) => updateForm({ variantA: { ...form.variantA, price: e.target.value } })} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={form.variantB.title} onChange={(e) => updateForm({ variantB: { ...form.variantB, title: e.target.value } })} placeholder="Variant B" className="col-span-2 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white" />
                    <input type="number" step="0.01" value={form.variantB.price} onChange={(e) => updateForm({ variantB: { ...form.variantB, price: e.target.value } })} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-emerald-400 font-bold" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-b border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Grafický vizuál</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.showVisual} onChange={(e) => updateForm({ showVisual: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              {form.showVisual && (
                <div className="space-y-2">
                  <input type="text" value={form.visualUrl.startsWith('data:') ? '' : form.visualUrl} onChange={(e) => updateForm({ visualUrl: e.target.value })} placeholder="URL obrázka (https://...)" className={inputCls} />
                  <div className="flex items-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Nahrať súbor</button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleVisualUpload} className="hidden" />
                    {form.visualUrl.startsWith('data:') && <span className="text-[10px] text-emerald-400">Obrázok nahraný</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-b border-slate-800 pb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Služby zahrnuté v cene</h3>
              <textarea rows={3} value={form.services} onChange={(e) => updateForm({ services: e.target.value })} className={inputCls} placeholder={'Jedna služba na riadok, napr.:\nGrafický návrh a schválenie\nVýroba do 10 pracovných dní'} />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Vybavuje</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Meno</label><input type="text" value={form.repName} onChange={(e) => updateForm({ repName: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Pozícia</label><input type="text" value={form.repRole} onChange={(e) => updateForm({ repRole: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Telefón</label><input type="text" value={form.repPhone} onChange={(e) => updateForm({ repPhone: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>E-mail</label><input type="text" value={form.repEmail} onChange={(e) => updateForm({ repEmail: e.target.value })} className={inputCls} /></div>
              </div>
            </div>

            <button onClick={saveQuoteToHistory} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2"><Save className="h-3.5 w-3.5" /> Uložiť do histórie</button>
          </section>

          {/* RIGHT: PREVIEW */}
          <section className="lg:col-span-7 flex flex-col gap-3">
            <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setPreviewMode('preview')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${previewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Eye className="h-3.5 w-3.5" /> Náhľad e-mailu</button>
                <button onClick={() => setPreviewMode('code')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${previewMode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Code className="h-3.5 w-3.5" /> HTML zdroj</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyFormattedHtml('quote-preview-container')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Kopírovať pre e-mail</button>
              </div>
            </div>

            <div className="bg-slate-950 p-2 md:p-6 rounded-2xl border border-slate-800 flex justify-center overflow-x-auto min-h-[500px]">
              {previewMode === 'preview' ? (
                <div id="quote-preview-container" className="w-full max-w-[620px] shadow-2xl rounded-lg overflow-hidden bg-white text-slate-900" dangerouslySetInnerHTML={{ __html: emailHtml }} />
              ) : (
                <textarea readOnly value={emailHtml} className="w-full h-[500px] bg-transparent text-slate-300 font-mono text-xs p-2 focus:outline-none resize-none" />
              )}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-4 px-1">
              <span>Medzisúčet: <strong className="text-slate-300">{fmtMoney(totals.subtotal)}</strong></span>
              {form.discountPercent > 0 && <span>Zľava: <strong className="text-amber-400">-{fmtMoney(totals.discountVal)}</strong></span>}
              <span>Spolu s DPH: <strong className="text-emerald-400">{fmtMoney(totals.total)}</strong></span>
            </div>
          </section>
        </div>
      )}

      {subTab === 'history' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Hľadať ponuku, firmu, produkt..." className="w-full bg-slate-950 text-xs text-white pl-8 pr-3 py-2 rounded-lg border border-slate-800" />
            </div>
            <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="bg-slate-950 text-xs text-white px-3 py-2 rounded-lg border border-slate-800">
              <option value="ALL">Všetky stavy</option>
              <option value="Odoslaná">Odoslaná</option>
              <option value="Akceptovaná">Akceptovaná</option>
              <option value="Zamietnutá">Zamietnutá</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr><th className="p-3">Číslo</th><th className="p-3">Dátum</th><th className="p-3">Zákazník</th><th className="p-3">Predmet</th><th className="p-3 text-right">Suma bez DPH</th><th className="p-3 text-center">Stav</th><th className="p-3 text-center">Akcie</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {quotes.filter(q => {
                  const s = historySearch.toLowerCase();
                  const matchText = !s || q.offerNumber.toLowerCase().includes(s) || q.customerName.toLowerCase().includes(s) || q.title.toLowerCase().includes(s);
                  const matchStatus = historyStatusFilter === 'ALL' || q.status === historyStatusFilter;
                  return matchText && matchStatus;
                }).map(q => (
                  <tr key={q.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{q.offerNumber}</td>
                    <td className="p-3 text-slate-400">{q.quoteDate}</td>
                    <td className="p-3 font-semibold">{q.customerName}</td>
                    <td className="p-3 max-w-[220px] truncate">{q.title}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{fmtMoney(q.total)}</td>
                    <td className="p-3 text-center">
                      <select value={q.status} onChange={(e) => updateQuoteStatus(q, e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white">
                        <option value="Odoslaná">Odoslaná</option>
                        <option value="Akceptovaná">Akceptovaná</option>
                        <option value="Zamietnutá">Zamietnutá</option>
                      </select>
                    </td>
                    <td className="p-3 text-center flex items-center justify-center gap-1.5">
                      <button onClick={() => loadQuoteFromHistory(q)} className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[11px] flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Načítať</button>
                      <button onClick={() => deleteQuote(q)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-500">Zatiaľ žiadne uložené ponuky.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'pricelist' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-indigo-400" /> Cenník položiek pre rýchle pridávanie do ponuky</h3>
            <p className="text-[11px] text-slate-500 mt-1">Tento cenník slúži len pre generátor cenových ponúk — nie je prepojený s katalógom modelov ani so skladom.</p>
          </div>
          <div className="grid grid-cols-12 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input type="text" value={newPriceItem.name} onChange={(e) => setNewPriceItem({ ...newPriceItem, name: e.target.value })} placeholder="Názov položky" className="col-span-4 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <input type="text" value={newPriceItem.description} onChange={(e) => setNewPriceItem({ ...newPriceItem, description: e.target.value })} placeholder="Popis" className="col-span-5 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <input type="number" step="0.01" value={newPriceItem.price} onChange={(e) => setNewPriceItem({ ...newPriceItem, price: e.target.value })} placeholder="Cena €" className="col-span-2 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <button onClick={addPriceListItem} className="col-span-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr><th className="p-3">Názov</th><th className="p-3">Popis</th><th className="p-3 text-right">Cena bez DPH</th><th className="p-3 text-center">Akcie</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {priceList.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-2"><input type="text" defaultValue={p.name} onBlur={(e) => updatePriceListItem(p.id, 'name', e.target.value)} className="bg-transparent w-full p-1 rounded hover:bg-slate-900 focus:bg-slate-900" /></td>
                    <td className="p-2"><input type="text" defaultValue={p.description} onBlur={(e) => updatePriceListItem(p.id, 'description', e.target.value)} className="bg-transparent w-full p-1 rounded hover:bg-slate-900 focus:bg-slate-900" /></td>
                    <td className="p-2 text-right"><input type="number" step="0.01" defaultValue={p.price} onBlur={(e) => updatePriceListItem(p.id, 'price', e.target.value)} className="bg-transparent w-24 text-right p-1 rounded hover:bg-slate-900 focus:bg-slate-900 text-emerald-400 font-bold" /></td>
                    <td className="p-2 text-center"><button onClick={() => deletePriceListItem(p.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
                {priceList.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-500">Cenník je prázdny — pridajte prvú položku vyššie.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
