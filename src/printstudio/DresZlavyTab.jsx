import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Percent } from 'lucide-react';

export default function DresZlavyTab({ supabase }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('dres_mnozstevne_zlavy').select('*').order('min_pocet');
    setRiadky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const dalsiPocet = (riadky[riadky.length - 1]?.min_pocet || 0) + 5;
    const { data, error } = await supabase.from('dres_mnozstevne_zlavy').insert({ min_pocet: dalsiPocet, zlava_percent: 0, poradie: riadky.length }).select().single();
    if (!error && data) setRiadky(r => [...r, data]);
  };

  const uprav = async (id, patch) => {
    setRiadky(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('dres_mnozstevne_zlavy').update(patch).eq('id', id);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto zľavovú hladinu?')) return;
    setRiadky(r => r.filter(x => x.id !== id));
    await supabase.from('dres_mnozstevne_zlavy').delete().eq('id', id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Percent className="text-indigo-400 h-5 w-5" /> Množstevné zľavy — 3D dresy</h2>
          <p className="text-xs text-slate-400 mt-1">Zľava sa počíta z celkového počtu hráčov v tímovej súpiske. Platí najvyššia hladina, na ktorú počet dosiahne.</p>
        </div>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať hladinu</button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Od počtu kusov</th>
                <th className="text-left px-4 py-2.5">Zľava (%)</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {riadky.map(r => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-4 py-2"><input type="number" min="1" value={r.min_pocet} onChange={(e) => uprav(r.id, { min_pocet: parseInt(e.target.value) || 1 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2"><input type="number" step="0.5" min="0" max="100" value={r.zlava_percent} onChange={(e) => uprav(r.id, { zlava_percent: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2 text-right"><button onClick={() => zmaz(r.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {riadky.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne zľavové hladiny.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
