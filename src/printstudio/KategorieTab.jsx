import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';

export default function KategorieTab({ supabase }) {
  const [kategorie, setKategorie] = useState([]);
  const [pocty, setPocty] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, nazov } | null pri novej | undefined = zatvorené
  const [nazov, setNazov] = useState('');
  const [error, setError] = useState('');

  const nacitaj = async () => {
    setIsLoading(true);
    const { data: kats } = await supabase.from('kategorie').select('*').order('poradie').order('id');
    const { data: prods } = await supabase.from('produkty').select('id, kategoria_id');
    const counts = {};
    (prods || []).forEach(p => { counts[p.kategoria_id] = (counts[p.kategoria_id] || 0) + 1; });
    setKategorie(kats || []);
    setPocty(counts);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const otvorNovu = () => { setEditing(null); setNazov(''); setError(''); };
  const otvorUpravu = (k) => { setEditing(k); setNazov(k.nazov); setError(''); };
  const zavri = () => setEditing(undefined);

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov kategórie.'); return; }
    if (editing) {
      const { error: err } = await supabase.from('kategorie').update({ nazov: nazov.trim() }).eq('id', editing.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('kategorie').insert({ nazov: nazov.trim() });
      if (err) { setError(err.message); return; }
    }
    zavri();
    nacitaj();
  };

  const zmaz = async (k) => {
    if (!window.confirm(`Naozaj zmazať kategóriu "${k.nazov}"?`)) return;
    const { error: err } = await supabase.from('kategorie').delete().eq('id', k.id);
    if (err) {
      if (err.code === '23503') {
        window.alert(`Nedá sa zmazať — kategória obsahuje produkty. Najprv ich presuň alebo zmaž.`);
      } else {
        window.alert(err.message);
      }
      return;
    }
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Tag className="text-indigo-400 h-5 w-5" /> Kategórie</h2>
          <p className="text-xs text-slate-400 mt-1">To, čo zákazník uvidí ako hlavný katalóg v konfigurátore — Tričká, Mikiny, Šiltovky, Tašky...</p>
        </div>
        <button onClick={otvorNovu} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať kategóriu
        </button>
      </div>

      {editing !== undefined && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-slate-200">{editing ? 'Upraviť kategóriu' : 'Nová kategória'}</h3>
          <div>
            <label className="text-xs text-slate-400 font-medium">Názov</label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Šiltovka" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={uloz} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">Uložiť</button>
            <button onClick={zavri} className="border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800">Zrušiť</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {kategorie.map(k => {
            const pocet = pocty[k.id] || 0;
            return (
              <div key={k.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="font-bold text-sm text-white">{k.nazov}</div>
                <div className="text-xs text-slate-500 mb-3">{pocet} produkt{pocet === 1 ? '' : 'y'}</div>
                <div className="flex gap-2">
                  <button onClick={() => otvorUpravu(k)} className="text-slate-400 hover:text-indigo-400 p-1"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => zmaz(k)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {kategorie.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne kategórie.</p>}
        </div>
      )}
    </div>
  );
}
