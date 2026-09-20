import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Palette, Loader2 } from 'lucide-react';

const BUCKET = 'grafiky';
const PREFIX = 'dres-vzory';

const VRSTVY = [
  { key: 'zaklad', label: 'Základ (Hlavné telo)', hint: 'Miesta, ktoré sa vyfarbia farbou "Hlavné telo".' },
  { key: 'vzor', label: 'Vzor', hint: 'Miesta, ktoré sa vyfarbia farbou "Hlavný vzor".' },
  { key: 'akcent', label: 'Akcent', hint: 'Miesta, ktoré sa vyfarbia farbou "Doplnkový akcent".' },
];

export default function DresVlastneVzoryTab({ supabase }) {
  const [zoznam, setZoznam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [nazov, setNazov] = useState('');
  const [subory, setSubory] = useState({ zaklad: null, vzor: null, akcent: null });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('dres_vlastne_vzory').select('*').order('id', { ascending: false });
    setZoznam(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const otvorForm = () => { setFormOpen(true); setNazov(''); setSubory({ zaklad: null, vzor: null, akcent: null }); setError(''); };
  const zavriForm = () => setFormOpen(false);

  const nahrajVrstvu = async (subor) => {
    const cesta = `${PREFIX}/${Date.now()}-${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, subor);
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(cesta);
    return pub.publicUrl;
  };

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov vzoru.'); return; }
    if (!subory.zaklad && !subory.vzor && !subory.akcent) { setError('Nahraj aspoň jednu vrstvu (základ, vzor alebo akcent).'); return; }
    setIsSaving(true);
    setError('');
    try {
      const urls = {};
      for (const v of VRSTVY) {
        if (subory[v.key]) urls[`${v.key}_url`] = await nahrajVrstvu(subory[v.key]);
      }
      const { error: err } = await supabase.from('dres_vlastne_vzory').insert({ nazov: nazov.trim(), ...urls });
      if (err) throw new Error(err.message);
      zavriForm();
      nacitaj();
    } catch (e) {
      setError('Nahratie zlyhalo: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const prepniAktivny = async (v) => {
    const { error: err } = await supabase.from('dres_vlastne_vzory').update({ aktivny: !v.aktivny }).eq('id', v.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  const zmaz = async (v) => {
    if (!window.confirm(`Zmazať vzor "${v.nazov}"?`)) return;
    const cesty = [v.zaklad_url, v.vzor_url, v.akcent_url]
      .filter(Boolean)
      .map((u) => u.split(`/${BUCKET}/`)[1])
      .filter(Boolean);
    if (cesty.length > 0) {
      try { await supabase.storage.from(BUCKET).remove(cesty); } catch (e) { /* best effort */ }
    }
    const { error: err } = await supabase.from('dres_vlastne_vzory').delete().eq('id', v.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Palette className="text-indigo-400 h-5 w-5" /> Vlastné vzory dresu</h2>
          <p className="text-xs text-slate-400 mt-1">
            Hotový dizajn ako 3 samostatné PNG vrstvy s priehľadným pozadím (základ / vzor / akcent), presne podľa
            šablóny rozloženia dresu. Zákazník si vzor vyberie a naďalej mu fungujú farebné políčka na každú vrstvu.
          </p>
        </div>
        <button onClick={otvorForm} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition shrink-0">
          <Plus className="w-4 h-4" /> Pridať vzor
        </button>
      </div>

      {formOpen && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4 max-w-lg">
          <h3 className="font-bold text-sm text-slate-200">Nový vlastný vzor</h3>
          <div>
            <label className="text-xs text-slate-400 font-medium">Názov</label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Klub XY - domáci dizajn" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          {VRSTVY.map((v) => (
            <div key={v.key}>
              <label className="text-xs text-slate-400 font-medium block">{v.label}</label>
              <span className="text-[11px] text-slate-500 block mb-1">{v.hint}</span>
              <input
                onChange={(e) => setSubory((s) => ({ ...s, [v.key]: e.target.files[0] || null }))}
                type="file" accept="image/png"
                className="text-sm text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
          ))}
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
          {zoznam.map((v) => (
            <div key={v.id} className={`bg-slate-900 rounded-xl border overflow-hidden ${v.aktivny ? 'border-slate-800' : 'border-slate-800/50 opacity-50'}`}>
              <div className="h-24 bg-slate-950 flex items-center justify-center gap-1 p-2">
                {[v.zaklad_url, v.vzor_url, v.akcent_url].filter(Boolean).map((u, i) => (
                  <img key={i} src={u} alt="" className="h-full flex-1 object-contain" />
                ))}
                {![v.zaklad_url, v.vzor_url, v.akcent_url].some(Boolean) && <Palette className="w-8 h-8 text-slate-700" />}
              </div>
              <div className="p-2.5">
                <div className="font-semibold text-xs text-white truncate">{v.nazov}</div>
                <div className="text-[11px] text-slate-500">{v.aktivny ? 'Aktívny' : 'Skrytý'}</div>
                <div className="flex justify-between mt-1">
                  <button onClick={() => prepniAktivny(v)} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">
                    {v.aktivny ? 'Skryť' : 'Zobraziť'}
                  </button>
                  <button onClick={() => zmaz(v)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {zoznam.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne vlastné vzory.</p>}
        </div>
      )}
    </div>
  );
}
