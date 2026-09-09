import { useState, useEffect, useMemo, Fragment } from 'react';
import { Calculator, ArrowUp, ArrowDown, Download, Loader2, AlertTriangle, Save } from 'lucide-react';

// ============================================================
// Marzovy cenovy modul — dynamicka cenotvorba podla vyrobnej ceny a poctu kusov.
// Vzorec je presne podla specifikacie (erp-marzovy-modul-specifikacia.md), overene
// proti kontrolnej tabulke zo specifikacie (napr. VC 1€/1ks -> 4,00€, VC 100€/1ks
// -> 151,32€, VC 500€ pri lubovolnom odbere -> 650,00€). NEMENIT poradie krokov
// ani zaokruhlovanie (zaokruhlovat az na konci) — inak sa vysledky rozidu s tabulkou.
// ============================================================

function baseMargin(cost, cfg) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost, qty, cfg) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.qtyAtFloor, 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost, qty, cfg) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

// Odberove hladiny zobrazene v cenniku (kazdy produkt x kazda hladina) — samostatne
// od rychlych tlacidiel prepinaca nizsie, presne podla specifikacie.
const QUANTITY_LEVELS = [1, 10, 25, 50, 100, 250, 500, 1000];
const QTY_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

const mapConfigFromDb = (r) => ({
  coefA: Number(r.coef_a), coefB: Number(r.coef_b), marginFloor: Number(r.margin_floor),
  coefP: Number(r.coef_p), qtyAtFloor: Number(r.qty_at_floor),
});
const mapConfigToDb = (c) => ({
  coef_a: c.coefA, coef_b: c.coefB, margin_floor: c.marginFloor, coef_p: c.coefP, qty_at_floor: c.qtyAtFloor,
});

const DEFAULT_CONFIG = { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function CenotvorbaTab({ supabase, products, triggerNotification }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [refQty, setRefQty] = useState(1);
  const [refQtyText, setRefQtyText] = useState('1');
  const [savingRowId, setSavingRowId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle();
      if (active && !error && data) setConfig(mapConfigFromDb(data));
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase]);

  const handleSaveConfig = async () => {
    setSaving(true);
    const { error } = await supabase.from('pricing_config').update(mapConfigToDb(config)).eq('id', 1);
    setSaving(false);
    if (error) triggerNotification('error', error.message);
    else triggerNotification('success', 'Koeficienty cenotvorby boli uložené.');
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleRowFieldBlur = async (product, field, rawValue) => {
    let patch;
    if (field === 'productionCost') {
      const num = rawValue.trim() === '' ? null : parseFloat(rawValue.replace(',', '.'));
      patch = { production_cost: Number.isFinite(num) ? num : null };
    } else {
      patch = { price_group: rawValue.trim() === '' ? null : rawValue.trim() };
    }
    setSavingRowId(product.id);
    const { error } = await supabase.from('products').update(patch).eq('id', product.id);
    setSavingRowId(null);
    if (error) triggerNotification('error', error.message);
  };

  const groupOptions = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.priceGroup) set.add(p.priceGroup); });
    return Array.from(set).sort();
  }, [products]);

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortField === 'cost') return ((a.productionCost ?? -1) - (b.productionCost ?? -1)) * dir;
      if (sortField === 'group') return (a.priceGroup || '').localeCompare(b.priceGroup || '') * dir || a.name.localeCompare(b.name);
      return (a.name || '').localeCompare(b.name || '') * dir;
    });
    return arr;
  }, [products, sortField, sortDir]);

  const handleRefQtyPreset = (q) => { setRefQty(q); setRefQtyText(String(q)); };
  const handleRefQtyText = (v) => {
    setRefQtyText(v);
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1) setRefQty(n);
  };

  const handleExportCsv = () => {
    const header = ['Názov', 'Skupina', 'Výrobná cena', ...QUANTITY_LEVELS.map(q => `Cena @ ${q}ks`)];
    const lines = [header.map(csvEscape).join(';')];
    sortedProducts.forEach(p => {
      const cost = p.productionCost;
      const row = [p.name, p.priceGroup || '', cost != null ? cost.toFixed(2) : ''];
      QUANTITY_LEVELS.forEach(q => row.push(cost > 0 ? priceAt(cost, q, config).toFixed(2) : ''));
      lines.push(row.map(csvEscape).join(';'));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cennik-marze.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }) => sortField !== field ? null : (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>;

  let lastGroupSeen = null;
  if (sortField !== 'group') lastGroupSeen = undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-indigo-400" />
        <h2 className="text-lg font-bold text-white">Cenotvorba — maržový modul</h2>
      </div>
      <p className="text-xs text-slate-400 -mt-4">
        Cena sa vždy dopočítava z výrobnej ceny a 5 koeficientov nižšie — nikde sa neukladá natvrdo.
        Zmena koeficientu okamžite prepočíta ceny všetkých produktov v tabuľke.
        Pozor: tento modul zatiaľ nie je napojený na tvorbu cenových ponúk/zákaziek — je to samostatný
        cenník/kalkulačka. Ak sa raz použije priamo pri vystavovaní dokumentu, treba vypočítanú cenu
        k danému dokumentu zmraziť (uložiť ako snapshot), aby sa spätne nezmenila pri úprave koeficientov.
      </p>

      {/* Koeficienty */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-200 mb-3">Koeficienty cenotvorby</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Strop marže pri 1 ks (coef_a, %)</label>
            <input type="number" step="0.1" value={config.coefA} onChange={e => setConfig({ ...config, coefA: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Citlivosť na cenu (coef_b)</label>
            <input type="number" step="0.1" value={config.coefB} onChange={e => setConfig({ ...config, coefB: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Podlaha marže (%)</label>
            <input type="number" step="0.1" value={config.marginFloor} onChange={e => setConfig({ ...config, marginFloor: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Tvar degresie (coef_p)</label>
            <input type="number" step="0.1" value={config.coefP} onChange={e => setConfig({ ...config, coefP: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Ks pri podlahe marže</label>
            <input type="number" step="1" value={config.qtyAtFloor} onChange={e => setConfig({ ...config, qtyAtFloor: parseInt(e.target.value, 10) || 1 })} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm" />
          </div>
        </div>
        <button onClick={handleSaveConfig} disabled={saving} className="mt-3 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Uložiť koeficienty
        </button>
      </div>

      {/* Rychla kalkulacka / prepinac referencneho poctu kusov */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-200 mb-3">Referenčný počet kusov (len na náhľad, neukladá sa)</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {QTY_PRESETS.map(q => (
            <button key={q} onClick={() => handleRefQtyPreset(q)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${refQty === q ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{q}</button>
          ))}
          <input type="number" min="1" step="1" value={refQtyText} onChange={e => handleRefQtyText(e.target.value)} className="w-24 bg-slate-950 border border-slate-800 rounded p-1.5 text-white text-xs" placeholder="vlastný počet" />
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportCsv} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg">
          <Download className="h-3.5 w-3.5" /> Export cenníka (CSV)
        </button>
      </div>

      {/* Tabulka produktov + cennik */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('name')}>Názov<SortIcon field="name" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('group')}>Skupina<SortIcon field="group" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('cost')}>Výrobná cena<SortIcon field="cost" /></th>
              <th className="text-left p-2 whitespace-nowrap bg-indigo-950/40">Cena @ {refQty}ks</th>
              {QUANTITY_LEVELS.map(q => <th key={q} className="text-left p-2 whitespace-nowrap">{q}ks</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map(p => {
              const cost = p.productionCost;
              const hasCost = cost != null && cost > 0;
              const showGroupHeader = sortField === 'group' && (p.priceGroup || '') !== lastGroupSeen;
              if (showGroupHeader) lastGroupSeen = p.priceGroup || '';
              return (
                <Fragment key={p.id}>
                  {showGroupHeader && (
                    <tr className="bg-slate-950">
                      <td colSpan={4 + QUANTITY_LEVELS.length} className="p-1.5 text-[11px] font-bold text-indigo-400 uppercase">{p.priceGroup || 'Bez skupiny'}</td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="p-2 text-slate-200 whitespace-nowrap">{p.name}</td>
                    <td className="p-1.5">
                      <input list="cenotvorba-groups" defaultValue={p.priceGroup || ''} onBlur={e => handleRowFieldBlur(p, 'priceGroup', e.target.value)} placeholder="—" className="w-28 bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                    </td>
                    <td className="p-1.5">
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="decimal" defaultValue={cost != null ? String(cost) : ''} onBlur={e => handleRowFieldBlur(p, 'productionCost', e.target.value)} placeholder="0.00" className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                        {savingRowId === p.id && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
                        {!hasCost && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="Chýba výrobná cena" />}
                      </div>
                    </td>
                    <td className="p-2 font-bold text-indigo-300 bg-indigo-950/20 whitespace-nowrap">
                      {hasCost ? `${priceAt(cost, refQty, config).toFixed(2)} € (${marginAt(cost, refQty, config).toFixed(0)}%)` : '—'}
                    </td>
                    {QUANTITY_LEVELS.map(q => (
                      <td key={q} className="p-2 text-slate-300 whitespace-nowrap">{hasCost ? `${priceAt(cost, q, config).toFixed(2)} €` : '—'}</td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
            {sortedProducts.length === 0 && (
              <tr><td colSpan={4 + QUANTITY_LEVELS.length} className="p-4 text-center text-slate-500">Katalóg produktov je prázdny.</td></tr>
            )}
          </tbody>
        </table>
        <datalist id="cenotvorba-groups">
          {groupOptions.map(g => <option key={g} value={g} />)}
        </datalist>
      </div>
    </div>
  );
}
