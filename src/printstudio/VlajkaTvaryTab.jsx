import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Flag, ChevronDown, ChevronUp } from 'lucide-react';

const VELKOSTI = ['S', 'M', 'L', 'XL'];
const PRAZDNY_ROZMER = { viewbox: '0 0 210 430', cut_path: '', safe_path: '' };

export default function VlajkaTvaryTab({ supabase }) {
  const [tvary, setTvary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined = zatvorené, null = nový, objekt = úprava
  const [kod, setKod] = useState('');
  const [nazov, setNazov] = useState('');
  const [ikona, setIkona] = useState('flag');
  const [error, setError] = useState('');
  const [rozbaleny, setRozbaleny] = useState(null); // id tvaru s otvoreným rozmer-editorom
  const [rozmery, setRozmery] = useState({}); // { [velkost]: {viewbox, cut_path, safe_path} }
  const [ukladamRozmery, setUkladamRozmery] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('vlajka_tvary').select('*').order('poradie').order('id');
    setTvary(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const otvorNovy = () => { setEditing(null); setKod(''); setNazov(''); setIkona('flag'); setError(''); };
  const otvorUpravu = (t) => { setEditing(t); setKod(t.kod); setNazov(t.nazov); setIkona(t.ikona || 'flag'); setError(''); };
  const zavri = () => setEditing(undefined);

  const uloz = async () => {
    if (!kod.trim() || !nazov.trim()) { setError('Vyplň kód aj názov.'); return; }
    const patch = { kod: kod.trim(), nazov: nazov.trim(), ikona: ikona.trim() || 'flag' };
    const { error: err } = editing
      ? await supabase.from('vlajka_tvary').update(patch).eq('id', editing.id)
      : await supabase.from('vlajka_tvary').insert(patch);
    if (err) { setError(err.message); return; }
    zavri();
    nacitaj();
  };

  const zmaz = async (t) => {
    if (!window.confirm(`Naozaj zmazať tvar "${t.nazov}"? Zmažú sa aj jeho orezové krivky pre všetky veľkosti.`)) return;
    const { error: err } = await supabase.from('vlajka_tvary').delete().eq('id', t.id);
    if (err) { window.alert(err.message); return; }
    nacitaj();
  };

  const prepniAktivny = async (t) => {
    await supabase.from('vlajka_tvary').update({ aktivny: !t.aktivny }).eq('id', t.id);
    nacitaj();
  };

  const rozbal = async (t) => {
    if (rozbaleny === t.id) { setRozbaleny(null); return; }
    setRozbaleny(t.id);
    const { data } = await supabase.from('vlajka_tvar_rozmery').select('*').eq('tvar_id', t.id);
    const map = {};
    VELKOSTI.forEach(v => {
      const row = (data || []).find(r => r.velkost === v);
      map[v] = row ? { viewbox: row.viewbox, cut_path: row.cut_path, safe_path: row.safe_path } : { ...PRAZDNY_ROZMER };
    });
    setRozmery(map);
  };

  const zmenRozmer = (velkost, field, value) => {
    setRozmery(r => ({ ...r, [velkost]: { ...r[velkost], [field]: value } }));
  };

  const ulozRozmery = async (tvarId) => {
    setUkladamRozmery(true);
    const riadky = VELKOSTI
      .filter(v => rozmery[v]?.cut_path?.trim() && rozmery[v]?.safe_path?.trim())
      .map(v => ({ tvar_id: tvarId, velkost: v, viewbox: rozmery[v].viewbox || '0 0 210 430', cut_path: rozmery[v].cut_path.trim(), safe_path: rozmery[v].safe_path.trim() }));
    await supabase.from('vlajka_tvar_rozmery').upsert(riadky, { onConflict: 'tvar_id,velkost' });
    setUkladamRozmery(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Flag className="text-indigo-400 h-5 w-5" /> Tvary vlajok</h2>
          <p className="text-xs text-slate-400 mt-1">Pre každý tvar nastav orezovú (červená) a bezpečnú (zelená) krivku ako SVG "d" cestu — zvlášť pre S/M/L/XL. Živý náhľad ti ukáže, či cesta dáva zmysel.</p>
        </div>
        <button onClick={otvorNovy} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať tvar
        </button>
      </div>

      {editing !== undefined && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-slate-200">{editing ? 'Upraviť tvar' : 'Nový tvar'}</h3>
          <div>
            <label className="text-xs text-slate-400 font-medium">Kód (bez diakritiky, jedno slovo)</label>
            <input value={kod} onChange={(e) => setKod(e.target.value)} type="text" placeholder="napr. pierko" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Názov</label>
            <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Pierko (Feather)" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Ikona (lucide-react meno)</label>
            <input value={ikona} onChange={(e) => setIkona(e.target.value)} type="text" placeholder="flag" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
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
        <div className="space-y-3">
          {tvary.map(t => (
            <div key={t.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <button onClick={() => rozbal(t)} className="flex items-center gap-2 text-left flex-1">
                  {rozbaleny === t.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  <div>
                    <div className="font-bold text-sm text-white">{t.nazov} <span className="text-slate-500 font-normal">({t.kod})</span></div>
                    {!t.aktivny && <span className="text-[10px] text-amber-400">neaktívny</span>}
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => prepniAktivny(t)} className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${t.aktivny ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {t.aktivny ? 'Aktívny' : 'Neaktívny'}
                  </button>
                  <button onClick={() => otvorUpravu(t)} className="text-slate-400 hover:text-indigo-400 p-1"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => zmaz(t)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {rozbaleny === t.id && (
                <div className="border-t border-slate-800 p-4 bg-slate-950/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {VELKOSTI.map(v => {
                    const r = rozmery[v] || PRAZDNY_ROZMER;
                    return (
                      <div key={v} className="bg-slate-900 rounded-xl border border-slate-800 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Veľkosť {v}</span>
                        </div>
                        <div className="w-full aspect-[210/430] bg-white rounded-lg overflow-hidden flex items-center justify-center">
                          <svg viewBox={r.viewbox} className="w-full h-full">
                            {r.cut_path && <path d={r.cut_path} stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="6 4" />}
                            {r.safe_path && <path d={r.safe_path} stroke="#10b981" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />}
                          </svg>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">viewBox</label>
                          <input value={r.viewbox} onChange={(e) => zmenRozmer(v, 'viewbox', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[10px] text-white font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">orezová (červená) cesta</label>
                          <textarea value={r.cut_path} onChange={(e) => zmenRozmer(v, 'cut_path', e.target.value)} rows={2} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[10px] text-white font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">bezpečná (zelená) cesta</label>
                          <textarea value={r.safe_path} onChange={(e) => zmenRozmer(v, 'safe_path', e.target.value)} rows={2} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[10px] text-white font-mono" />
                        </div>
                      </div>
                    );
                  })}
                  <div className="lg:col-span-4">
                    <button onClick={() => ulozRozmery(t.id)} disabled={ukladamRozmery} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                      {ukladamRozmery ? 'Ukladám…' : 'Uložiť krivky pre všetky veľkosti'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tvary.length === 0 && <p className="text-sm text-slate-500">Zatiaľ žiadne tvary.</p>}
        </div>
      )}
    </div>
  );
}
