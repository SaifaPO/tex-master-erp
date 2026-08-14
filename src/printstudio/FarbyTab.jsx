import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Palette } from 'lucide-react';

// Odhadne, či je farba "tmavá" (relevantné pre sieťotlač — na tmavý textil treba 2 vrstvy farby).
// Len návrh — admin ho vie v každom prípade prebiť checkboxom.
function jeHexTmavy(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return false;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const jas = (r * 299 + g * 587 + b * 114) / 1000;
  return jas < 128;
}

export default function FarbyTab({ supabase }) {
  const [farby, setFarby] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined = zatvorené, null = nová, obj = úprava
  const [nazov, setNazov] = useState('');
  const [hex, setHex] = useState('#2563eb');
  const [jeTmava, setJeTmava] = useState(false);
  const [error, setError] = useState('');

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('farby').select('*').order('id');
    setFarby(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const otvorNovu = () => { setEditing(null); setNazov(''); setHex('#2563eb'); setJeTmava(jeHexTmavy('#2563eb')); setError(''); };
  const otvorUpravu = (f) => { setEditing(f); setNazov(f.nazov); setHex(f.hex); setJeTmava(!!f.je_tmava); setError(''); };
  const zavri = () => setEditing(undefined);

  const zmenHex = (novyHex) => { setHex(novyHex); setJeTmava(jeHexTmavy(novyHex)); };

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov farby.'); return; }
    if (editing) {
      const { error: err } = await supabase.from('farby').update({ nazov: nazov.trim(), hex, je_tmava: jeTmava }).eq('id', editing.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('farby').insert({ nazov: nazov.trim(), hex, je_tmava: jeTmava });
      if (err) { setError(err.message); return; }
    }
    zavri();
    nacitaj();
  };

  const zmaz = async (f) => {
    if (!window.confirm(`Zmazať farbu "${f.nazov}"? Produkty, ktoré ju používajú, o ňu prídu.`)) return;
    const { error: err } = await supabase.from('farby').delete().eq('id', f.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Palette className="text-indigo-400 h-5 w-5" /> Farby</h2>
          <p className="text-xs text-slate-400 mt-1">Globálna paleta farieb textilu, z ktorej si produkty vyberajú svoje dostupné farby.</p>
        </div>
        <button onClick={otvorNovu} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať farbu
        </button>
      </div>

      {editing !== undefined && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-slate-200">{editing ? 'Upraviť farbu' : 'Nová farba'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Názov</label>
              <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Petrolejová" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Hex kód</label>
              <input value={hex} onChange={(e) => zmenHex(e.target.value)} type="color" className="w-full mt-1 h-10 px-1 py-1 bg-slate-950 border border-slate-800 rounded-lg" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={jeTmava} onChange={(e) => setJeTmava(e.target.checked)} className="rounded bg-slate-950 border-slate-700" />
            Tmavý textil (na sieťotlač treba 2 vrstvy farby — automaticky navrhnuté podľa hexu, dá sa prebiť)
          </label>
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
          {farby.map(f => (
            <div key={f.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full border border-slate-700 shrink-0" style={{ background: f.hex }}></span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate">{f.nazov}</div>
                <div className="text-xs text-slate-500 font-mono">{f.hex} {f.je_tmava && <span className="text-slate-400">· tmavý textil</span>}</div>
              </div>
              <button onClick={() => otvorUpravu(f)} className="text-slate-400 hover:text-indigo-400 p-1"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => zmaz(f)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {farby.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne farby.</p>}
        </div>
      )}
    </div>
  );
}
