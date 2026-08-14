import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Type } from 'lucide-react';

const POUZITIE_LABEL = { vsetko: 'Meno, číslo, text', meno: 'Len meno', cislo: 'Len číslo', text: 'Len voľný text' };

export default function FontyTab({ supabase }) {
  const [fonty, setFonty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(undefined);
  const [nazov, setNazov] = useState('');
  const [pouzitie, setPouzitie] = useState('vsetko');
  const [error, setError] = useState('');

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('fonty').select('*').order('id');
    setFonty(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const otvorNovu = () => { setEditing(null); setNazov(''); setPouzitie('vsetko'); setError(''); };
  const otvorUpravu = (f) => { setEditing(f); setNazov(f.nazov); setPouzitie(f.pouzitie); setError(''); };
  const zavri = () => setEditing(undefined);

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov fontu (presný CSS font-family).'); return; }
    if (editing) {
      const { error: err } = await supabase.from('fonty').update({ nazov: nazov.trim(), pouzitie }).eq('id', editing.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('fonty').insert({ nazov: nazov.trim(), pouzitie });
      if (err) { setError(err.message); return; }
    }
    zavri();
    nacitaj();
  };

  const zmaz = async (f) => {
    if (!window.confirm(`Zmazať font "${f.nazov}"?`)) return;
    const { error: err } = await supabase.from('fonty').delete().eq('id', f.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Type className="text-indigo-400 h-5 w-5" /> Fonty</h2>
          <p className="text-xs text-slate-400 mt-1">Fonty dostupné v textovom nástroji konfigurátora.</p>
        </div>
        <button onClick={otvorNovu} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať font
        </button>
      </div>

      {editing !== undefined && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-slate-200">{editing ? 'Upraviť font' : 'Nový font'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Názov (CSS font-family)</label>
              <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Impact" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Použitie</label>
              <select value={pouzitie} onChange={(e) => setPouzitie(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
                <option value="vsetko">Meno aj číslo aj text</option>
                <option value="meno">Len meno na drese</option>
                <option value="cislo">Len číslo na drese</option>
                <option value="text">Len voľný text</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={uloz} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">Uložiť</button>
            <button onClick={zavri} className="border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800">Zrušiť</button>
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr><th className="text-left px-4 py-3">Ukážka</th><th className="text-left px-4 py-3">Názov</th><th className="text-left px-4 py-3">Použitie</th><th className="text-right px-4 py-3">Akcie</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center text-slate-500 py-8 text-sm">Načítavam…</td></tr>
            ) : fonty.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-slate-500 py-8 text-sm">Zatiaľ žiadne fonty.</td></tr>
            ) : fonty.map(f => (
              <tr key={f.id} className="border-t border-slate-800">
                <td className="px-4 py-3 text-xl text-white" style={{ fontFamily: `'${f.nazov}', sans-serif` }}>Aa 123</td>
                <td className="px-4 py-3 font-medium text-white">{f.nazov}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{POUZITIE_LABEL[f.pouzitie] || f.pouzitie}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => otvorUpravu(f)} className="text-slate-400 hover:text-indigo-400 p-1.5"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => zmaz(f)} className="text-slate-400 hover:text-rose-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
