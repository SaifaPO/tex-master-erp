import React, { useEffect, useState } from 'react';
import { Shirt, Plus, Trash2 } from 'lucide-react';

// Rovnaké statické zoznamy vzorov/golierov ako v printstudio-pro/src/dres3d/dresPresets.js —
// duplikované zámerne (samostatný Vite projekt, iné node_modules), toto je len zoznam
// id/label pre admin checkboxy, nie kresliaca logika.
const VSETKY_VZORY = [
  { id: 'stripes', nazov: 'Zvislé Pruhy' },
  { id: 'hoops', nazov: 'Vodorovné Pásy' },
  { id: 'sash', nazov: 'Šikmý Pás' },
  { id: 'honeycomb', nazov: 'Hexagon Vzor' },
  { id: 'chevron', nazov: 'Modern Chevron' },
  { id: 'gradient', nazov: 'Gradient Fade' },
  { id: 'modern', nazov: 'Glitch / Digital' },
  { id: 'camo', nazov: 'Polygon Camo' },
  { id: 'plain', nazov: 'Hladký Minimal' },
];
const VSETKY_GOLIERE = [
  { id: 'round', nazov: 'Okrúhly' },
  { id: 'vneck', nazov: 'V-Výstrih' },
  { id: 'ribbed', nazov: 'Rebrovaný' },
];
const PREDVOLENE_FARBY = { farba_zakladna: '#1e3a8a', farba_vzor: '#dc2626', farba_akcent: '#f59e0b', farba_rukava: '#1e3a8a', farba_golier: '#ffffff' };

export default function DresNastaveniaTab({ supabase }) {
  const [produkty, setProdukty] = useState([]);
  const [vybranyId, setVybranyId] = useState(null);
  const [nastavenia, setNastavenia] = useState(null);
  const [materialy, setMaterialy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('produkty').select('id, nazov').eq('typ_konfiguratora', '3d_dres').order('nazov');
      setProdukty(data || []);
      if (data && data.length > 0) setVybranyId(data[0].id);
      setIsLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (vybranyId == null) return;
    nacitajProdukt(vybranyId);
  }, [vybranyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nacitajProdukt = async (produktId) => {
    const [{ data: n }, { data: m }] = await Promise.all([
      supabase.from('produkt_dres_nastavenia').select('*').eq('produkt_id', produktId).maybeSingle(),
      supabase.from('produkt_dres_materialy').select('*').eq('produkt_id', produktId).order('poradie'),
    ]);
    if (n) {
      setNastavenia(n);
    } else {
      const novy = {
        produkt_id: produktId, ...PREDVOLENE_FARBY,
        dostupne_vzory: VSETKY_VZORY.map(v => v.id),
        dostupne_goliere: VSETKY_GOLIERE.map(g => g.id),
      };
      const { data } = await supabase.from('produkt_dres_nastavenia').insert(novy).select().single();
      setNastavenia(data || novy);
    }
    setMaterialy(m || []);
  };

  const uprav = async (patch) => {
    setNastavenia(n => ({ ...n, ...patch }));
    await supabase.from('produkt_dres_nastavenia').update(patch).eq('produkt_id', vybranyId);
  };

  const prepniVPoli = (pole, id) => {
    const aktualne = nastavenia[pole] || [];
    const nove = aktualne.includes(id) ? aktualne.filter(x => x !== id) : [...aktualne, id];
    uprav({ [pole]: nove });
  };

  const pridajMaterial = async () => {
    const patch = { produkt_id: vybranyId, kod: `material_${Date.now()}`, nazov: 'Nový materiál', priplatok_eur: 0, poradie: materialy.length };
    const { data, error } = await supabase.from('produkt_dres_materialy').insert(patch).select().single();
    if (!error && data) setMaterialy(m => [...m, data]);
  };

  const upravMaterial = async (id, patch) => {
    setMaterialy(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('produkt_dres_materialy').update(patch).eq('id', id);
  };

  const zmazMaterial = async (id) => {
    if (!window.confirm('Zmazať tento materiál?')) return;
    setMaterialy(m => m.filter(x => x.id !== id));
    await supabase.from('produkt_dres_materialy').delete().eq('id', id);
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  if (produkty.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        Zatiaľ žiadny produkt nemá nastavený typ <code className="text-indigo-400">3d_dres</code>. Nastav ho priamo v Supabase
        (Table editor → <code className="text-indigo-400">produkty</code> → stĺpec <code className="text-indigo-400">typ_konfiguratora</code>),
        kým sa v Produktoch nepridá prepínač.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="text-indigo-400 h-5 w-5" /> Nastavenia 3D dresu</h2>
          <p className="text-xs text-slate-400 mt-1">Predvolené farby zón, dostupné vzory/goliere a materiály na produkt.</p>
        </div>
        <select value={vybranyId || ''} onChange={(e) => setVybranyId(Number(e.target.value))} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
          {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
        </select>
      </div>

      {nastavenia && (
        <>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
            <h3 className="font-bold text-sm text-white mb-3">Predvolené farby zón</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { key: 'farba_zakladna', label: 'Základná' },
                { key: 'farba_vzor', label: 'Vzor' },
                { key: 'farba_akcent', label: 'Akcent' },
                { key: 'farba_rukava', label: 'Rukávy' },
                { key: 'farba_golier', label: 'Golier' },
              ].map(z => (
                <div key={z.key} className="flex flex-col items-center gap-1.5">
                  <input type="color" value={nastavenia[z.key]} onChange={(e) => uprav({ [z.key]: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-700" />
                  <span className="text-[11px] text-slate-400">{z.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
              <h3 className="font-bold text-sm text-white mb-3">Dostupné vzory</h3>
              <div className="space-y-1.5">
                {VSETKY_VZORY.map(v => (
                  <label key={v.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={(nastavenia.dostupne_vzory || []).includes(v.id)} onChange={() => prepniVPoli('dostupne_vzory', v.id)} className="rounded text-indigo-500 bg-slate-950 border-slate-700" />
                    {v.nazov}
                  </label>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
              <h3 className="font-bold text-sm text-white mb-3">Dostupné goliere</h3>
              <div className="space-y-1.5">
                {VSETKY_GOLIERE.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={(nastavenia.dostupne_goliere || []).includes(g.id)} onChange={() => prepniVPoli('dostupne_goliere', g.id)} className="rounded text-indigo-500 bg-slate-950 border-slate-700" />
                    {g.nazov}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-white">Materiály</h3>
              <button onClick={pridajMaterial} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať materiál</button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Prvý materiál (najnižšie poradie) sa v konfigurátore ponúka ako štandard — príplatok 0 €.</p>
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5">Kód</th>
                    <th className="text-left px-4 py-2.5">Názov</th>
                    <th className="text-left px-4 py-2.5">Popis</th>
                    <th className="text-left px-4 py-2.5">Príplatok (€)</th>
                    <th className="text-left px-4 py-2.5">Poradie</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {materialy.map(m => (
                    <tr key={m.id} className="border-t border-slate-800">
                      <td className="px-4 py-2"><input type="text" value={m.kod} onChange={(e) => upravMaterial(m.id, { kod: e.target.value })} className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" /></td>
                      <td className="px-4 py-2"><input type="text" value={m.nazov} onChange={(e) => upravMaterial(m.id, { nazov: e.target.value })} className="w-48 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                      <td className="px-4 py-2"><input type="text" value={m.popis || ''} onChange={(e) => upravMaterial(m.id, { popis: e.target.value })} className="w-56 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" /></td>
                      <td className="px-4 py-2"><input type="number" step="0.5" value={m.priplatok_eur} onChange={(e) => upravMaterial(m.id, { priplatok_eur: parseFloat(e.target.value) || 0 })} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                      <td className="px-4 py-2"><input type="number" value={m.poradie} onChange={(e) => upravMaterial(m.id, { poradie: parseInt(e.target.value) || 0 })} className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                      <td className="px-4 py-2 text-right"><button onClick={() => zmazMaterial(m.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                  {materialy.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne materiály — konfigurátor ukáže len golier/vzor bez výberu materiálu.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
