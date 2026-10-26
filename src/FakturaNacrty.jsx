import React, { useMemo, useState } from 'react';
import { X, Check, Plus, Trash2, FileText, Clock, Send } from 'lucide-react';

// NÁČRTY FAKTÚR ZO ZÁKAZKY — pri vytvorení zákazky s fakturáciou sa pripraví náčrt faktúry (alebo zálohovej faktúry),
// ktorý odsúhlasí predávajúci (obchodník) aj financie. Až po oboch súhlasoch sa vystaví ostrá faktúra (s číslom, účtovným zápisom)
// a predávajúci ju jedným klikom pošle zákazníkovi e-mailom. Náčrt nemá číslo, nevstupuje do účtovníctva ani do DPH.

export const mapNacrtFromDb = (r) => ({
  id: r.id, orderId: r.order_id || '', docType: r.doc_type || 'faktura', status: r.status || 'navrh',
  customerName: r.customer_name || '', customerAddress: r.customer_address || '', customerIco: r.customer_ico || '', customerDic: r.customer_dic || '',
  customerIcDph: r.customer_ic_dph || '', customerType: r.customer_type || 'sk_platca', customerEmail: r.customer_email || '', customerPhone: r.customer_phone || '',
  language: r.language || 'sk', dueDate: r.due_date || '', items: r.items || [], notes: r.notes || '',
  sellerId: r.seller_id || '', sellerName: r.seller_name || '', sellerApprovedAt: r.seller_approved_at || null, sellerApprovedBy: r.seller_approved_by || '',
  financeApprovedAt: r.finance_approved_at || null, financeApprovedBy: r.finance_approved_by || '', invoiceId: r.invoice_id || '', createdBy: r.created_by || '', createdAt: r.created_at,
});
export const mapNacrtToDb = (n) => ({
  id: n.id, order_id: n.orderId || null, doc_type: n.docType, status: n.status,
  customer_name: n.customerName, customer_address: n.customerAddress, customer_ico: n.customerIco, customer_dic: n.customerDic,
  customer_ic_dph: n.customerIcDph, customer_type: n.customerType, customer_email: n.customerEmail, customer_phone: n.customerPhone,
  language: n.language, due_date: n.dueDate || null, items: n.items, notes: n.notes,
  seller_id: n.sellerId || null, seller_name: n.sellerName || null, seller_approved_at: n.sellerApprovedAt || null, seller_approved_by: n.sellerApprovedBy || null,
  finance_approved_at: n.financeApprovedAt || null, finance_approved_by: n.financeApprovedBy || null, invoice_id: n.invoiceId || null, created_by: n.createdBy || null,
  updated_at: new Date().toISOString(),
});

export const spoluNacrtu = (items) => {
  let zaklad = 0, dph = 0;
  (items || []).forEach((it) => {
    const r = (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0);
    zaklad += r; dph += r * ((parseFloat(it.vatRate) || 0) / 100);
  });
  return { subtotal: Math.round(zaklad * 100) / 100, vatTotal: Math.round(dph * 100) / 100, total: Math.round((zaklad + dph) * 100) / 100 };
};
const eur = (v) => `${Number(v || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const cas = (iso) => (iso ? new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const TYPY_ODBERATELA = { sk_platca: 'SK — platca DPH', sk_neplatca: 'SK — neplatca DPH', eu_platca: 'EÚ — platca DPH', eu_neplatca: 'EÚ — neplatca DPH', tretia_krajina: 'Tretia krajina' };
// Polia, ktorých zmena zruší už udelené súhlasy (súhlas sa vzťahuje na to, čo si dotyčný pozrel)
const OBSAH = (n) => JSON.stringify([n.docType, n.customerName, n.customerAddress, n.customerIco, n.customerDic, n.customerIcDph, n.customerType, n.language, n.dueDate,
  (n.items || []).filter((it) => String(it.description || '').trim()).map((it) => [String(it.description || '').trim(), Number(it.qty) || 0, Number(it.unitPrice) || 0, Number(it.vatRate) || 0]), n.notes]);

export const stavSuhlasov = (n) => ({
  predavajuci: !!n.sellerApprovedAt, financie: !!n.financeApprovedAt, oba: !!n.sellerApprovedAt && !!n.financeApprovedAt,
});

// Zoznam náčrtov čakajúcich na súhlas / vystavenie (Financie → Fronta pre účtovníka)
export function NacrtyFronta({ nacrty, orders, onOtvor }) {
  const cakajuce = nacrty.filter((n) => n.status === 'navrh').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (cakajuce.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      <h3 className="text-sm font-bold text-sky-300 flex items-center gap-1.5"><FileText className="h-4 w-4" /> Náčrty faktúr na odsúhlasenie ({cakajuce.length})</h3>
      {cakajuce.map((n) => {
        const o = orders.find((x) => x.id === n.orderId);
        const s = stavSuhlasov(n);
        const t = spoluNacrtu(n.items);
        return (
          <div key={n.id} className={`bg-slate-950 border rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${s.oba ? 'border-emerald-700/50' : 'border-sky-800/40'}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-indigo-400 text-xs">{o?.orderNumber || n.orderId || 'bez zákazky'}</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300">{n.docType === 'zalohova' ? 'ZÁLOHOVÁ (náčrt)' : 'FAKTÚRA (náčrt)'}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.predavajuci ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/50 text-amber-300'}`}>Predávajúci {s.predavajuci ? '✓' : 'čaká'}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.financie ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/50 text-amber-300'}`}>Financie {s.financie ? '✓' : 'čaká'}</span>
              </div>
              <p className="font-bold text-white text-sm truncate">{n.customerName}</p>
              <p className="text-[11px] text-slate-500">Predávajúci: {n.sellerName || '—'} • spolu {t.total > 0 ? eur(t.total) : 'ceny ešte nie sú doplnené'}</p>
            </div>
            <button onClick={() => onOtvor(n.id)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] px-3 py-2 rounded-lg shrink-0">Otvoriť náčrt</button>
          </div>
        );
      })}
    </div>
  );
}

export function NacrtModal({ nacrt, order, employees, jePredavajuci, jeFinancie, mozeVystavit, onUloz, onSchvalPredavajuci, onSchvalFinancie, onVystav, onZrus, onClose }) {
  const [d, setD] = useState(() => ({ ...nacrt, items: (nacrt.items || []).map((it, i) => ({ ...it, tempId: it.tempId || `n-${i}` })) }));
  const [zaneprazdneny, setZaneprazdneny] = useState(false);
  const zmeneny = useMemo(() => OBSAH(d) !== OBSAH(nacrt) || d.customerEmail !== nacrt.customerEmail || d.customerPhone !== nacrt.customerPhone || d.sellerId !== nacrt.sellerId, [d, nacrt]);
  const sk = stavSuhlasov(nacrt);
  const t = spoluNacrtu(d.items);
  const vstup = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white';
  const pole = (k) => ({ value: d[k] || '', onChange: (e) => setD((p) => ({ ...p, [k]: e.target.value })), className: vstup });
  const upravPolozku = (id, k, v) => setD((p) => ({ ...p, items: p.items.map((it) => (it.tempId === id ? { ...it, [k]: v } : it)) }));
  const predavajuciMozni = employees.filter((e) => ['master', 'supervisor', 'sales', 'manazer'].includes(e.role) || e.id === d.sellerId);
  const bezSellerEmail = !employees.find((e) => e.id === d.sellerId)?.email;

  const spusti = async (fn) => { setZaneprazdneny(true); try { await fn(); } finally { setZaneprazdneny(false); } };
  const cistyObsah = () => ({ ...d, items: d.items.filter((it) => String(it.description || '').trim()).map(({ tempId, ...r }) => ({ ...r, qty: parseFloat(r.qty) || 0, unitPrice: parseFloat(r.unitPrice) || 0, vatRate: parseFloat(r.vatRate) || 0 })) });
  const uloz = () => spusti(() => onUloz(cistyObsah(), OBSAH(d) !== OBSAH(nacrt)));
  const udaje_ok = d.customerName.trim() && d.items.some((it) => String(it.description || '').trim() && parseFloat(it.qty) > 0) && t.total > 0;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-3" onClick={() => !zaneprazdneny && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">{d.docType === 'zalohova' ? 'Náčrt zálohovej faktúry' : 'Náčrt faktúry'}{order ? ` — zákazka ${order.orderNumber || order.id}` : ''}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Náčrt nemá číslo ani sa nezapisuje do účtovníctva. Po odsúhlasení predávajúcim aj financiami sa z neho vystaví ostrý doklad a pošle zákazníkovi.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg border p-2.5 text-xs ${sk.predavajuci ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-300' : 'border-amber-700/50 bg-amber-950/10 text-amber-300'}`}>
            <b>Predávajúci</b> ({nacrt.sellerName || '—'})<br />{sk.predavajuci ? `✓ odsúhlasil ${cas(nacrt.sellerApprovedAt)}` : <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> čaká na súhlas</span>}
          </div>
          <div className={`rounded-lg border p-2.5 text-xs ${sk.financie ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-300' : 'border-amber-700/50 bg-amber-950/10 text-amber-300'}`}>
            <b>Financie</b>{nacrt.financeApprovedBy ? ` (${nacrt.financeApprovedBy})` : ''}<br />{sk.financie ? `✓ odsúhlasili ${cas(nacrt.financeApprovedAt)}` : <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> čaká na súhlas</span>}
          </div>
        </div>
        {(sk.predavajuci || sk.financie) && zmeneny && <p className="text-[11px] text-amber-300 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2">Ak náčrt uložíš so zmenami, už udelené súhlasy sa zrušia a obaja ho musia odsúhlasiť znova.</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-400">Odberateľ<input type="text" {...pole('customerName')} /></label>
          <label className="text-[11px] text-slate-400">Typ odberateľa
            <select value={d.customerType} onChange={(e) => { const typ = e.target.value; setD((p) => ({ ...p, customerType: typ, items: (typ === 'eu_platca' || typ === 'tretia_krajina') ? p.items.map((it) => ({ ...it, vatRate: 0 })) : p.items })); }} className={vstup}>
              {Object.entries(TYPY_ODBERATELA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 sm:col-span-2">Adresa odberateľa<input type="text" {...pole('customerAddress')} /></label>
          <label className="text-[11px] text-slate-400">IČO<input type="text" {...pole('customerIco')} /></label>
          <label className="text-[11px] text-slate-400">DIČ<input type="text" {...pole('customerDic')} /></label>
          <label className="text-[11px] text-slate-400">IČ DPH<input type="text" {...pole('customerIcDph')} /></label>
          <label className="text-[11px] text-slate-400">Splatnosť<input type="date" {...pole('dueDate')} /></label>
          <label className="text-[11px] text-slate-400">E-mail zákazníka (na odoslanie faktúry)<input type="email" {...pole('customerEmail')} placeholder="zakaznik@firma.sk" /></label>
          <label className="text-[11px] text-slate-400">Telefón zákazníka<input type="text" {...pole('customerPhone')} /></label>
          <label className="text-[11px] text-slate-400">Jazyk dokladu
            <select value={d.language} onChange={(e) => setD((p) => ({ ...p, language: e.target.value }))} className={vstup}><option value="sk">Slovensky</option><option value="en">English</option></select>
          </label>
          <label className="text-[11px] text-slate-400">Predávajúci (z jeho e-mailu sa pošle kópia a odpoveď zákazníka)
            <select value={d.sellerId || ''} onChange={(e) => { const emp = employees.find((x) => x.id === e.target.value); setD((p) => ({ ...p, sellerId: e.target.value, sellerName: emp ? `${emp.firstName} ${emp.lastName}` : '' })); }} className={vstup}>
              <option value="">— nevybraný —</option>
              {predavajuciMozni.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.email ? '' : ' (bez e-mailu)'}</option>)}
            </select>
          </label>
        </div>
        {bezSellerEmail && d.sellerId && <p className="text-[11px] text-amber-300">Predávajúci nemá v profile (Zamestnanci & Práva) vyplnený e-mail — kópia faktúry mu nepríde a zákazník nebude vedieť odpovedať priamo jemu.</p>}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-300 uppercase">Položky</span>
            <button type="button" onClick={() => setD((p) => ({ ...p, items: [...p.items, { tempId: `n-${Date.now()}`, description: '', qty: 1, unitPrice: 0, vatRate: p.items[0]?.vatRate ?? 23 }] }))} className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1"><Plus className="h-3 w-3" /> Pridať položku</button></div>
          <div className="hidden sm:grid grid-cols-[1fr_70px_90px_60px_28px] gap-1.5 text-[10px] text-slate-500 px-0.5"><span>Popis</span><span>Množstvo</span><span>Cena/ks bez DPH</span><span>DPH %</span><span /></div>
          {d.items.map((it) => (
            <div key={it.tempId} className="grid grid-cols-[1fr_70px_90px_60px_28px] gap-1.5 items-center">
              <input type="text" value={it.description || ''} onChange={(e) => upravPolozku(it.tempId, 'description', e.target.value)} className={vstup} />
              <input type="number" min="0" step="any" value={it.qty} onChange={(e) => upravPolozku(it.tempId, 'qty', e.target.value)} className={vstup} />
              <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => upravPolozku(it.tempId, 'unitPrice', e.target.value)} className={vstup} />
              <input type="number" min="0" step="1" value={it.vatRate} onChange={(e) => upravPolozku(it.tempId, 'vatRate', e.target.value)} className={vstup} />
              <button type="button" onClick={() => setD((p) => ({ ...p, items: p.items.filter((x) => x.tempId !== it.tempId) }))} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <p className="text-xs text-slate-400 text-right">Základ {eur(t.subtotal)} • DPH {eur(t.vatTotal)} • <b className="text-white">spolu {eur(t.total)}</b></p>
          {t.total <= 0 && <p className="text-[11px] text-amber-300">Doplň ceny položiek — kým je suma 0 €, náčrt sa nedá odsúhlasiť.</p>}
        </div>
        <label className="text-[11px] text-slate-400 block">Poznámka na doklade<textarea {...pole('notes')} rows={2} /></label>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
          <button onClick={uloz} disabled={zaneprazdneny || !zmeneny} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg">Uložiť náčrt</button>
          {jePredavajuci && !sk.predavajuci && (
            <button onClick={() => spusti(() => onSchvalPredavajuci(cistyObsah()))} disabled={zaneprazdneny || !udaje_ok} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Check className="h-4 w-4" /> Odsúhlasiť ako predávajúci</button>
          )}
          {jeFinancie && !sk.financie && (
            <button onClick={() => spusti(() => onSchvalFinancie(cistyObsah()))} disabled={zaneprazdneny || !udaje_ok} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Check className="h-4 w-4" /> Odsúhlasiť za financie</button>
          )}
          {sk.oba && !zmeneny && mozeVystavit && (
            <button onClick={() => spusti(() => onVystav(nacrt))} disabled={zaneprazdneny} className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Send className="h-4 w-4" /> Vystaviť a pripraviť e-mail zákazníkovi</button>
          )}
          {(jePredavajuci || jeFinancie) && <button onClick={() => spusti(() => onZrus(nacrt))} disabled={zaneprazdneny} className="ml-auto text-[11px] text-rose-400 hover:text-rose-300 underline">Zrušiť náčrt</button>}
        </div>
      </div>
    </div>
  );
}
