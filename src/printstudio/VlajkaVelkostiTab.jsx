import React, { useEffect, useState } from 'react';
import { Ruler, Calculator } from 'lucide-react';
import { vypocitajCenuVlajky } from './vlajkaCenotvorba';

export default function VlajkaVelkostiTab({ supabase }) {
  const [velkosti, setVelkosti] = useState([]);
  const [nastavenia, setNastavenia] = useState({ dph_percent: 23, expresny_priplatok_percent: 10 });
  const [isLoading, setIsLoading] = useState(true);

  const [testVelkostId, setTestVelkostId] = useState(null);
  const [testExpres, setTestExpres] = useState(false);
  const [testKs, setTestKs] = useState(1);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: v }, { data: n }] = await Promise.all([
      supabase.from('vlajka_velkosti').select('*').order('poradie').order('id'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    setVelkosti(v || []);
    if (n) setNastavenia(n);
    if ((v || []).length > 0) setTestVelkostId(v[0].id);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upravVelkost = async (id, patch) => {
    setVelkosti(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_velkosti').update(patch).eq('id', id);
  };

  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('vlajka_nastavenia').upsert({ id: 1, ...next });
  };

  const testVelkost = velkosti.find(v => v.id === testVelkostId);
  const vysledok = vypocitajCenuVlajky({
    velkost: testVelkost || { cena: 0 },
    dokoncenie: null,
    stoziar: null,
    doplnky: [],
    expresne: testExpres,
    pocetKs: testKs,
    nastavenia,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Ruler className="text-indigo-400 h-5 w-5" /> Veľkosti, DPH a expres</h2>
        <p className="text-xs text-slate-400 mt-1">Každá veľkosť má plochú základnú cenu (nie podľa plochy potlače) — k nej sa v konfigurátore pripočíta opracovanie, prút a doplnky.</p>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Kód</th>
              <th className="text-left px-4 py-2.5">Výška od zeme (cm)</th>
              <th className="text-left px-4 py-2.5">Rozmer plachty</th>
              <th className="text-left px-4 py-2.5">Základná cena (€)</th>
            </tr>
          </thead>
          <tbody>
            {velkosti.map(v => (
              <tr key={v.id} className="border-t border-slate-800">
                <td className="px-4 py-2 text-white font-bold">{v.kod}</td>
                <td className="px-4 py-2">
                  <input type="number" value={v.vyska_cm} onChange={(e) => upravVelkost(v.id, { vyska_cm: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                </td>
                <td className="px-4 py-2">
                  <input type="text" value={v.rozmer_popis} onChange={(e) => upravVelkost(v.id, { rozmer_popis: e.target.value })} className="w-36 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" step="0.5" value={v.cena} onChange={(e) => upravVelkost(v.id, { cena: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-indigo-950/30 border border-indigo-900/40 p-4 rounded-xl grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="text-xs text-indigo-300 font-medium">DPH (%)</label>
          <input type="number" step="0.5" value={nastavenia.dph_percent} onChange={(e) => ulozNastavenia({ dph_percent: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-indigo-800 rounded-lg text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-indigo-300 font-medium">Expresný príplatok (%)</label>
          <input type="number" step="0.5" value={nastavenia.expresny_priplatok_percent} onChange={(e) => ulozNastavenia({ expresny_priplatok_percent: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-indigo-800 rounded-lg text-sm text-white" />
        </div>
      </div>

      {/* TESTOVACIA KALKULAČKA */}
      <div className="bg-slate-950 rounded-2xl p-5 border border-indigo-900/40">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Testovacia kalkulačka</h3>
        <p className="text-xs text-slate-400 mb-4">Rýchla kontrola ceny len podľa veľkosti (bez opracovania/prútu/doplnkov — tie sa pripočítajú rovnako v konfigurátore).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 max-w-xl">
          <div>
            <label className="text-xs text-slate-400">Veľkosť</label>
            <select value={testVelkostId || ''} onChange={(e) => setTestVelkostId(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              {velkosti.map(v => <option key={v.id} value={v.id}>{v.kod} ({Number(v.cena).toFixed(2)} €)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Počet kusov</label>
            <input type="number" min="1" value={testKs} onChange={(e) => setTestKs(parseInt(e.target.value) || 1)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          <div className="flex items-end pb-1">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              <input type="checkbox" checked={testExpres} onChange={(e) => setTestExpres(e.target.checked)} /> Expres
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">{vysledok.vzorec}</div>
          <div className="text-2xl font-black text-emerald-400">{vysledok.cenaSpolu.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  );
}
