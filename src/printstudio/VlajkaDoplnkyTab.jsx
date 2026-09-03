import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';

export default function VlajkaDoplnkyTab({ supabase }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Package className="text-indigo-400 h-5 w-5" /> Opracovanie, prúty, doplnky, Pantone</h2>
        <p className="text-xs text-slate-400 mt-1">Voliteľné položky, ktoré si zákazník pridáva ku konfigurácii vlajky.</p>
      </div>
      <JednoduchaSekcia supabase={supabase} tabulka="vlajka_dokoncenie" nazovSekcie="Opracovanie okrajov" popisSekcie="Napr. obšitie / laserový orez." maMaxMnozstvo={false} />
      <JednoduchaSekcia supabase={supabase} tabulka="vlajka_stoziare" nazovSekcie="Konštrukcia / prút" popisSekcie="Napr. bez konštrukcie / laminát / hliník." maMaxMnozstvo={false} />
      <JednoduchaSekcia supabase={supabase} tabulka="vlajka_doplnky" nazovSekcie="Podstavce a príslušenstvo" popisSekcie="Zákazník si môže vybrať aj viac kusov naraz — nastav maximálne množstvo." maMaxMnozstvo={true} />
      <PantoneSekcia supabase={supabase} />
    </div>
  );
}

function JednoduchaSekcia({ supabase, tabulka, nazovSekcie, popisSekcie, maMaxMnozstvo }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from(tabulka).select('*').order('poradie').order('id');
    setRiadky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const patch = { kod: `polozka_${Date.now()}`, nazov: 'Nová položka', cena: 0 };
    if (maMaxMnozstvo) patch.max_mnozstvo = 5;
    const { data, error } = await supabase.from(tabulka).insert(patch).select().single();
    if (!error && data) setRiadky(r => [...r, data]);
  };

  const uprav = async (id, patch) => {
    setRiadky(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from(tabulka).update(patch).eq('id', id);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto položku?')) return;
    setRiadky(r => r.filter(x => x.id !== id));
    await supabase.from(tabulka).delete().eq('id', id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">{nazovSekcie}</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">{popisSekcie}</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Kód</th>
                <th className="text-left px-4 py-2.5">Názov</th>
                <th className="text-left px-4 py-2.5">Cena (€)</th>
                {maMaxMnozstvo && <th className="text-left px-4 py-2.5">Max. ks</th>}
                <th className="text-left px-4 py-2.5">Popis</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {riadky.map(r => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-4 py-2"><input type="text" value={r.kod} onChange={(e) => uprav(r.id, { kod: e.target.value })} className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" /></td>
                  <td className="px-4 py-2"><input type="text" value={r.nazov} onChange={(e) => uprav(r.id, { nazov: e.target.value })} className="w-48 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2"><input type="number" step="0.5" value={r.cena} onChange={(e) => uprav(r.id, { cena: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  {maMaxMnozstvo && <td className="px-4 py-2"><input type="number" min="1" value={r.max_mnozstvo} onChange={(e) => uprav(r.id, { max_mnozstvo: parseInt(e.target.value) || 1 })} className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>}
                  <td className="px-4 py-2"><input type="text" value={r.popis || ''} onChange={(e) => uprav(r.id, { popis: e.target.value })} className="w-64 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" /></td>
                  <td className="px-4 py-2 text-right"><button onClick={() => zmaz(r.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {riadky.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne položky.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PantoneSekcia({ supabase }) {
  const [vzorky, setVzorky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('vlajka_pantone').select('*').order('poradie').order('id');
    setVzorky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const { data, error } = await supabase.from('vlajka_pantone').insert({ kod: 'Nová vzorka', hex: '#000000' }).select().single();
    if (!error && data) setVzorky(v => [...v, data]);
  };

  const uprav = async (id, patch) => {
    setVzorky(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_pantone').update(patch).eq('id', id);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto Pantone vzorku?')) return;
    setVzorky(v => v.filter(x => x.id !== id));
    await supabase.from('vlajka_pantone').delete().eq('id', id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">Pantone vzorky</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať vzorku</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Farebná paleta pre pozadie vlajky — samostatná od farieb oblečenia.</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {vzorky.map(v => (
            <div key={v.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <input type="color" value={v.hex} onChange={(e) => uprav(v.id, { hex: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-slate-700 shrink-0" />
              <input type="text" value={v.kod} onChange={(e) => uprav(v.id, { kod: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white" />
              <button onClick={() => zmaz(v.id)} className="text-slate-400 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {vzorky.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne vzorky.</p>}
        </div>
      )}
    </div>
  );
}
