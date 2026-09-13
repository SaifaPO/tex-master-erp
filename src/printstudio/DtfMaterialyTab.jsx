import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

// Prepocita cenu €/m2 z realneho skladoveho materialu (cena za bezny meter / sirka rolky v cm).
// Vracia null, ak sklad. material nema vyplnenu sirku (width) — bez nej sa neda bm -> m2 previest.
// Rovnaky vzorec ako ZastavaMaterialyTab.jsx / VlajkaMaterialyTab.jsx.
function vypocitajNakladZoSkladu(skladMaterial) {
  if (!skladMaterial || !skladMaterial.width || skladMaterial.width <= 0) return null;
  const sirkaM = skladMaterial.width / 100;
  return Math.round((Number(skladMaterial.price_per_m) || 0) / sirkaM * 100) / 100;
}

export default function DtfMaterialyTab({ supabase }) {
  const [materialy, setMaterialy] = useState([]);
  const [skladMaterialy, setSkladMaterialy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: dm }, { data: sm }] = await Promise.all([
      supabase.from('dtf_materialy').select('*').order('poradie').order('id'),
      supabase.from('materials').select('id, name, color, price_per_m, width, unit, qty').eq('unit', 'm').order('name'),
    ]);
    setMaterialy(dm || []);
    setSkladMaterialy(sm || []);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const { data, error } = await supabase.from('dtf_materialy').insert({ kod: `material_${Date.now()}`, nazov: 'Nová látka', naklad_m2: 0, poradie: materialy.length }).select().single();
    if (!error && data) setMaterialy(m => [...m, data]);
  };
  const uprav = async (id, patch) => {
    setMaterialy(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('dtf_materialy').update(patch).eq('id', id);
  };
  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto látku?')) return;
    setMaterialy(m => m.filter(x => x.id !== id));
    await supabase.from('dtf_materialy').delete().eq('id', id);
  };

  const pripojSklad = async (m, skladMaterialId) => {
    if (!skladMaterialId) { await uprav(m.id, { sklad_material_id: null }); return; }
    const sklad = skladMaterialy.find(s => s.id === skladMaterialId);
    const vypocet = vypocitajNakladZoSkladu(sklad);
    const patch = vypocet != null ? { sklad_material_id: skladMaterialId, naklad_m2: vypocet } : { sklad_material_id: skladMaterialId };
    await uprav(m.id, patch);
  };
  const prepocitajZoSkladu = async (m) => {
    const sklad = skladMaterialy.find(s => s.id === m.sklad_material_id);
    const vypocet = vypocitajNakladZoSkladu(sklad);
    if (vypocet != null) await uprav(m.id, { naklad_m2: vypocet });
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-sm text-white flex items-center gap-2"><Layers className="text-indigo-400 w-4 h-4" /> Vlastné látky (tlač aj na náš materiál)</h3>
        <p className="text-xs text-slate-400 mt-1">
          Zákazník si v appke okrem "vlastný materiál" (súčasný stav, len cena potlače) môže vybrať aj jednu
          z týchto látok — cena látky sa dopočíta jednotným maržovým vzorcom (Cenotvorba) a pripočíta k cene
          potlače. "Náklad €/m²" je nákupná cena — zákazník ju nevidí, len výslednú predajnú cenu.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Prepoj na skutočný sklad (Materiály, položky na bežný meter) — cena €/m² sa dopočíta sama z €/bm
          a šírky. Ak sklad. položka nemá vyplnenú šírku, prepočet sa nedá urobiť — treba ju doplniť v Sklade.
        </p>
      </div>

      <div className="space-y-2">
        {materialy.map(m => {
          const sklad = skladMaterialy.find(s => s.id === m.sklad_material_id);
          const jePrepojeny = !!m.sklad_material_id;
          const chybaSirka = jePrepojeny && sklad && (!sklad.width || sklad.width <= 0);
          const skladNenajdeny = jePrepojeny && !sklad;
          return (
            <div key={m.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" value={m.nazov} onChange={(e) => uprav(m.id, { nazov: e.target.value })} placeholder="Názov" className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" />
                <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <input type="number" step="0.1" value={m.naklad_m2} disabled={jePrepojeny && !chybaSirka} onChange={(e) => uprav(m.id, { naklad_m2: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white disabled:opacity-60" /> € náklad/m²
                  {jePrepojeny && !chybaSirka && (
                    <button type="button" onClick={() => prepocitajZoSkladu(m)} title="Prepočítať zo skladu" className="text-slate-500 hover:text-indigo-400 p-1"><RefreshCw className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                  <input type="checkbox" checked={m.aktivny} onChange={(e) => uprav(m.id, { aktivny: e.target.checked })} /> aktívna
                </label>
                <button onClick={() => zmaz(m.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-slate-500 shrink-0">Materiál zo skladu:</label>
                <select value={m.sklad_material_id || ''} onChange={(e) => pripojSklad(m, e.target.value || null)} className="flex-1 min-w-[200px] px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white">
                  <option value="">-- žiadny (zadať €/m² ručne) --</option>
                  {skladMaterialy.map(s => <option key={s.id} value={s.id}>{s.name}{s.color ? ` (${s.color})` : ''} — {Number(s.price_per_m).toFixed(2)} €/bm{s.width ? `, š.${s.width}cm` : ''} · sklad {s.qty}m</option>)}
                </select>
              </div>
              {jePrepojeny && !chybaSirka && !skladNenajdeny && (
                <p className="text-[10px] text-emerald-500">✓ Prepojené: {sklad.price_per_m} €/bm ÷ {(sklad.width / 100).toFixed(2)}m šírka = {vypocitajNakladZoSkladu(sklad)?.toFixed(2)} €/m² (na sklade {sklad.qty}m)</p>
              )}
              {chybaSirka && (
                <p className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Skladová položka "{sklad.name}" nemá vyplnenú šírku (cm) — doplň ju v Sklade, potom sa dá prepočítať. Zatiaľ treba náklad/m² zadať ručne.</p>
              )}
              {skladNenajdeny && (
                <p className="text-[10px] text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Prepojená skladová položka už neexistuje — vyber inú, alebo prepojenie zruš.</p>
              )}
              <input type="text" value={m.popis || ''} onChange={(e) => uprav(m.id, { popis: e.target.value })} placeholder="Popis — na čo je vhodná (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300" />
              <input type="text" value={m.pouzitie || ''} onChange={(e) => uprav(m.id, { pouzitie: e.target.value })} placeholder="Odporúčané použitie (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300" />
              <input type="text" value={m.specifikacie || ''} onChange={(e) => uprav(m.id, { specifikacie: e.target.value })} placeholder="Technické špecifikácie — napr. 95% bavlna / 5% elastan, 180 g/m² (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300" />
            </div>
          );
        })}
        {materialy.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne látky.</p>}
      </div>
      <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať látku</button>
    </div>
  );
}
