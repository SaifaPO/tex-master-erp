import { useState, useEffect, useMemo, Fragment } from 'react';
import { Calculator, ArrowUp, ArrowDown, Download, Loader2, AlertTriangle, Save } from 'lucide-react';
import { priceAt, marginAt, priceWithCapacity, marginEurPerCapUnit, QUANTITY_LEVELS, QTY_PRESETS, mapConfigFromDb, mapConfigToDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// Toto je JEDINÉ miesto v appke, kde sa nastavuje 5 koeficientov marže (pricing_config) —
// pouziva ich aj Cennik potlace (nakladove kalkulacky sublimacia/DTF/sietotlac/rezany transfer).
// Tabulka nizsie navyse ukazuje cennik pre cely katalog produktov (products v hlavnom ERP).
//
// "6. koeficient" (capMarginTarget) nizsie je zatial CISTA DIAGNOSTIKA/SIMULACIA — priceAt/marginAt
// pouzivane vsade inde (Cennik potlace, DTF metraz) ho necitaju, takze zmena tejto hodnoty
// neovplyvni ziadnu skutocnu cenu, kym sa Martin nerozhodne to naozaj zapojit.

const mapProductFromDb = (r) => ({ id: r.id, name: r.name, productionCost: r.production_cost ?? null, priceGroup: r.price_group || '', redukovanyVykon: r.redukovany_vykon ?? null });

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function CenotvorbaTab({ supabase }) {
  const [config, setConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [refQty, setRefQty] = useState(1);
  const [refQtyText, setRefQtyText] = useState('1');
  const [savingRowId, setSavingRowId] = useState(null);
  const [message, setMessage] = useState(null);

  const notify = (type, text) => {
    setMessage({ type, text });
    if (type === 'success') setTimeout(() => setMessage(m => (m && m.text === text ? null : m)), 3000);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: cfg }, { data: prod }] = await Promise.all([
        supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('products').select('id, name, production_cost, price_group, redukovany_vykon').order('name'),
      ]);
      if (!active) return;
      if (cfg) setConfig(mapConfigFromDb(cfg));
      setProducts((prod || []).map(mapProductFromDb));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase]);

  const handleSaveConfig = async () => {
    setSaving(true);
    const { error } = await supabase.from('pricing_config').update(mapConfigToDb(config)).eq('id', 1);
    setSaving(false);
    if (error) notify('error', error.message);
    else notify('success', 'Koeficienty cenotvorby boli uložené.');
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleRowFieldBlur = async (product, field, rawValue) => {
    let patch, localPatch;
    if (field === 'productionCost') {
      const num = rawValue.trim() === '' ? null : parseFloat(rawValue.replace(',', '.'));
      const val = Number.isFinite(num) ? num : null;
      patch = { production_cost: val };
      localPatch = { productionCost: val };
    } else if (field === 'redukovanyVykon') {
      const num = rawValue.trim() === '' ? null : parseFloat(rawValue.replace(',', '.'));
      const val = Number.isFinite(num) ? num : null;
      patch = { redukovany_vykon: val };
      localPatch = { redukovanyVykon: val };
    } else {
      const val = rawValue.trim() === '' ? null : rawValue.trim();
      patch = { price_group: val };
      localPatch = { priceGroup: val || '' };
    }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, ...localPatch } : p)); // okamzita zmena v UI, nespoliehat sa na neskorsi refetch
    setSavingRowId(product.id);
    const { error } = await supabase.from('products').update(patch).eq('id', product.id);
    setSavingRowId(null);
    if (error) {
      notify('error', error.message);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, [field]: product[field] } : p)); // vratit spat ak zapis zlyha
    }
  };

  const handleFieldKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

  const groupOptions = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.priceGroup) set.add(p.priceGroup); });
    return Array.from(set).sort();
  }, [products]);

  const sortedProducts = useMemo(() => {
    const capMarginFor = (p) => {
      if (p.productionCost == null || p.productionCost <= 0 || !p.redukovanyVykon) return null;
      return marginEurPerCapUnit(p.productionCost, marginAt(p.productionCost, refQty, config), p.redukovanyVykon);
    };
    const arr = [...products];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortField === 'cost') return ((a.productionCost ?? -1) - (b.productionCost ?? -1)) * dir;
      if (sortField === 'redukovanyVykon') return ((a.redukovanyVykon ?? -1) - (b.redukovanyVykon ?? -1)) * dir;
      if (sortField === 'capMargin') return ((capMarginFor(a) ?? -1) - (capMarginFor(b) ?? -1)) * dir;
      if (sortField === 'group') return (a.priceGroup || '').localeCompare(b.priceGroup || '') * dir || a.name.localeCompare(b.name);
      return (a.name || '').localeCompare(b.name || '') * dir;
    });
    return arr;
  }, [products, sortField, sortDir, refQty, config]);

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
      {message && (
        <div className={`text-xs font-semibold rounded-lg px-3 py-2 -mt-2 ${message.type === 'error' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/40' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'}`}>{message.text}</div>
      )}
      <p className="text-xs text-slate-400 -mt-4">
        Jediné miesto na nastavenie marže v celom PrintStudio Pro — 5 koeficientov nižšie používa aj
        záložka "Cenník potlače" (nákladové kalkulačky sublimácia/DTF/sieťotlač/rezaný transfer).
        Cena sa vždy dopočítava z výrobnej ceny — nikde sa neukladá natvrdo, zmena koeficientu okamžite
        prepočíta ceny všade. Pozor: tento modul zatiaľ nie je napojený priamo na tvorbu cenových
        ponúk/zákaziek — ak sa raz použije priamo pri vystavovaní dokumentu, treba vypočítanú cenu
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

      {/* 6. koeficient — SIMULACIA, nema vplyv na skutocne ceny nikde inde v appke */}
      <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4">
        <h3 className="font-bold text-sm text-amber-300 mb-1">🧪 Diagnostika: marža podľa kapacity (čas výroby)</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Súčasný vzorec reaguje len na výrobnú cenu a počet kusov — nevie, koľko kapacity (šitie, tlač)
          daný kus reálne zožerie. Nastav tu, koľko € marže chceš dostať za 1 jednotku "Redukovaného výkonu"
          — tabuľka nižšie potom ukáže, ako by vyzerala cena, keby sa marža zdvihla vždy, keď súčasný
          vzorec dáva menej než tento cieľ. Zatiaľ len náhľad — kým toto nezapneš nikde inde, skutočné
          ceny v Cenníku potlače/DTF metráži sa nemenia.
        </p>
        <p className="text-[11px] font-semibold text-amber-400/90 mb-3">
          ⚠️ Najprv treba mať vyplnený "Red. výkon" pri produktoch — bez neho diagnostika nemá čo počítať
          a stĺpce nižšie ostanú prázdne. Dá sa vyplniť rovno v stĺpci "Red. výkon" v tabuľke nižšie
          (rovnaké pole ako "Redukovaný výkon" v Katalógu Modelov — zmena sa prejaví na oboch miestach).
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Cieľ: € marže / jednotku redukovaného výkonu (coef_f)</label>
            <input type="number" step="0.01" min="0" value={config.capMarginTarget} onChange={e => setConfig({ ...config, capMarginTarget: parseFloat(e.target.value) || 0 })} className="w-64 bg-slate-950 border border-amber-900/40 rounded p-2 text-white text-sm" />
          </div>
          <p className="text-[11px] text-slate-500 pb-2">0 = vypnuté (tabuľka nižšie sa správa ako doteraz)</p>
        </div>
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

      {/* Tabulka produktov + cennik (katalog produktov z hlavneho ERP) */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('name')}>Názov<SortIcon field="name" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('group')}>Skupina<SortIcon field="group" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('cost')}>Výrobná cena<SortIcon field="cost" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('redukovanyVykon')}>Red. výkon<SortIcon field="redukovanyVykon" /></th>
              <th className="text-left p-2 cursor-pointer select-none whitespace-nowrap bg-amber-950/20" onClick={() => handleSort('capMargin')}>🧪 €/jedn. RV<SortIcon field="capMargin" /></th>
              <th className="text-left p-2 whitespace-nowrap bg-indigo-950/40">Cena @ {refQty}ks</th>
              <th className="text-left p-2 whitespace-nowrap bg-amber-950/20">🧪 Cena so 6. koef.</th>
              {QUANTITY_LEVELS.map(q => <th key={q} className="text-left p-2 whitespace-nowrap">{q}ks</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map(p => {
              const cost = p.productionCost;
              const hasCost = cost != null && cost > 0;
              const rv = p.redukovanyVykon;
              const hasRv = rv != null && rv > 0;
              const currentMargin = hasCost ? marginAt(cost, refQty, config) : null;
              const capEurPerUnit = hasCost && hasRv ? marginEurPerCapUnit(cost, currentMargin, rv) : null;
              const capPrice = hasCost ? priceWithCapacity(cost, refQty, rv, config) : null;
              const showGroupHeader = sortField === 'group' && (p.priceGroup || '') !== lastGroupSeen;
              if (showGroupHeader) lastGroupSeen = p.priceGroup || '';
              return (
                <Fragment key={p.id}>
                  {showGroupHeader && (
                    <tr className="bg-slate-950">
                      <td colSpan={7 + QUANTITY_LEVELS.length} className="p-1.5 text-[11px] font-bold text-indigo-400 uppercase">{p.priceGroup || 'Bez skupiny'}</td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="p-2 text-slate-200 whitespace-nowrap">{p.name}</td>
                    <td className="p-1.5">
                      <input list="cenotvorba-groups" key={`grp-${p.id}-${p.priceGroup || ''}`} defaultValue={p.priceGroup || ''} onBlur={e => handleRowFieldBlur(p, 'priceGroup', e.target.value)} onKeyDown={handleFieldKeyDown} placeholder="—" className="w-28 bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                    </td>
                    <td className="p-1.5">
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="decimal" key={`cost-${p.id}-${cost ?? ''}`} defaultValue={cost != null ? String(cost) : ''} onBlur={e => handleRowFieldBlur(p, 'productionCost', e.target.value)} onKeyDown={handleFieldKeyDown} placeholder="0.00" className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                        {savingRowId === p.id && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
                      </div>
                      {!hasCost && <div className="flex items-center gap-1 text-amber-500 text-[10px] mt-0.5"><AlertTriangle className="h-3 w-3 shrink-0" /> chýba výrobná cena</div>}
                    </td>
                    <td className="p-1.5">
                      <input type="text" inputMode="decimal" key={`rv-${p.id}-${rv ?? ''}`} defaultValue={rv != null ? String(rv) : ''} onBlur={e => handleRowFieldBlur(p, 'redukovanyVykon', e.target.value)} onKeyDown={handleFieldKeyDown} placeholder="—" className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                    </td>
                    <td className="p-2 text-amber-300 bg-amber-950/10 whitespace-nowrap">{capEurPerUnit != null ? `${capEurPerUnit.toFixed(2)} €` : '—'}</td>
                    <td className="p-2 font-bold text-indigo-300 bg-indigo-950/20 whitespace-nowrap">
                      {hasCost ? `${priceAt(cost, refQty, config).toFixed(2)} € (${currentMargin.toFixed(0)}%)` : '⚠️ chýba výrobná cena'}
                    </td>
                    <td className="p-2 text-amber-300 bg-amber-950/10 whitespace-nowrap">
                      {hasCost ? (
                        <>
                          {capPrice.toFixed(2)} €
                          {config.capMarginTarget > 0 && hasRv && capPrice > priceAt(cost, refQty, config) && (
                            <span className="text-amber-500 ml-1">(+{(capPrice - priceAt(cost, refQty, config)).toFixed(2)} €)</span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    {QUANTITY_LEVELS.map(q => (
                      <td key={q} className="p-2 text-slate-300 whitespace-nowrap">{hasCost ? `${priceAt(cost, q, config).toFixed(2)} €` : '—'}</td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
            {sortedProducts.length === 0 && (
              <tr><td colSpan={7 + QUANTITY_LEVELS.length} className="p-4 text-center text-slate-500">Katalóg produktov je prázdny.</td></tr>
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
