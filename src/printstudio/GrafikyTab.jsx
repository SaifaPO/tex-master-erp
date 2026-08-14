import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';

const BUCKET = 'grafiky';

export default function GrafikyTab({ supabase }) {
  const [grafiky, setGrafiky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [nazov, setNazov] = useState('');
  const [kategoria, setKategoria] = useState('');
  const [subor, setSubor] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('grafiky').select('*').order('id', { ascending: false });
    setGrafiky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const otvorForm = () => { setFormOpen(true); setNazov(''); setKategoria(''); setSubor(null); setError(''); };
  const zavriForm = () => setFormOpen(false);

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov grafiky.'); return; }
    setIsSaving(true);
    setError('');
    let url = '';
    if (subor) {
      const cestaSuboru = `${Date.now()}-${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cestaSuboru, subor);
      if (uploadErr) { setError('Nahratie zlyhalo: ' + uploadErr.message); setIsSaving(false); return; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(cestaSuboru);
      url = pub.publicUrl;
    }
    const { error: err } = await supabase.from('grafiky').insert({ nazov: nazov.trim(), kategoria: kategoria.trim() || null, url });
    setIsSaving(false);
    if (err) { setError(err.message); return; }
    zavriForm();
    nacitaj();
  };

  const zmaz = async (g) => {
    if (!window.confirm(`Zmazať grafiku "${g.nazov}"?`)) return;
    if (g.url) {
      try {
        const cesta = g.url.split(`/${BUCKET}/`)[1];
        if (cesta) await supabase.storage.from(BUCKET).remove([cesta]);
      } catch (e) { /* best effort */ }
    }
    const { error: err } = await supabase.from('grafiky').delete().eq('id', g.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><ImageIcon className="text-indigo-400 h-5 w-5" /> Grafiky (Design knižnica)</h2>
          <p className="text-xs text-slate-400 mt-1">Motívy, ktoré si zákazník môže pridať do návrhu v konfigurátore.</p>
        </div>
        <button onClick={otvorForm} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať grafiku
        </button>
      </div>

      {formOpen && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-slate-200">Nová grafika</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Názov</label>
              <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Vlnovka" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Kategória</label>
              <input value={kategoria} onChange={(e) => setKategoria(e.target.value)} type="text" placeholder="napr. Šport, Príroda, Logá" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Obrázok</label>
            <input onChange={(e) => setSubor(e.target.files[0] || null)} type="file" accept="image/*" className="text-sm text-slate-300" />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={uloz} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Uložiť
            </button>
            <button onClick={zavriForm} className="border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800">Zrušiť</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {grafiky.map(g => (
            <div key={g.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="h-24 bg-slate-950 flex items-center justify-center">
                {g.url ? <img src={g.url} alt={g.nazov} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}
              </div>
              <div className="p-2.5">
                <div className="font-semibold text-xs text-white truncate">{g.nazov}</div>
                <div className="text-[11px] text-slate-500">{g.kategoria || '—'}</div>
                <div className="flex justify-end mt-1">
                  <button onClick={() => zmaz(g)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {grafiky.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne grafiky.</p>}
        </div>
      )}
    </div>
  );
}
