import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

export default function ZastavaMaterialyTab({ supabase }) {
  const [materialy, setMaterialy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('zastava_materialy').select('*').order('poradie').order('id');
    setMaterialy(data || []);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const { data, error } = await supabase.from('zastava_materialy').insert({ kod: `material_${Date.now()}`, nazov: 'Nový materiál', naklad_m2: 0, poradie: materialy.length }).select().single();
    if (!error && data) setMaterialy(m => [...m, data]);
  };
  const uprav = async (id, patch) => {
    setMaterialy(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('zastava_materialy').update(patch).eq('id', id);
  };
  const zmaz = async (id) => {
    if (!window.confirm('Zmazať tento materiál?')) return;
    setMaterialy(m => m.filter(x => x.id !== id));
    await supabase.from('zastava_materialy').delete().eq('id', id);
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="text-indigo-400 h-5 w-5" /> Materiály vlajkoviny</h2>
        <p className="text-xs text-slate-400 mt-1">
          "Náklad €/m²" je VÝROBNÁ (nákupná) cena materiálu — zákazník ju nikdy neuvidí. Predajná cena sa
          dopočítava jednotným maržovým vzorcom zo záložky Cenotvorba.
        </p>
      </div>

      <div className="space-y-2">
        {materialy.map(m => (
          <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" value={m.nazov} onChange={(e) => uprav(m.id, { nazov: e.target.value })} placeholder="Názov" className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <input type="number" step="0.1" value={m.naklad_m2} onChange={(e) => uprav(m.id, { naklad_m2: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> € naklad/m²
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                <input type="checkbox" checked={m.aktivny} onChange={(e) => uprav(m.id, { aktivny: e.target.checked })} /> aktívny
              </label>
              <button onClick={() => zmaz(m.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
            <input type="text" value={m.popis || ''} onChange={(e) => uprav(m.id, { popis: e.target.value })} placeholder="Popis (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300" />
            <input type="text" value={m.pouzitie || ''} onChange={(e) => uprav(m.id, { pouzitie: e.target.value })} placeholder="Odporúčané použitie (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300" />
          </div>
        ))}
        {materialy.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne materiály.</p>}
      </div>
      <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať materiál</button>
    </div>
  );
}
