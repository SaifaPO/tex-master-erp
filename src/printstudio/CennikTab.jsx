import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Banknote, Calculator } from 'lucide-react';
import { vypocitajCenuPotlace } from './cenotvorba';

export default function CennikTab({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  const [sublimacia, setSublimacia] = useState({ cena_cm2: 0, min_cena: 0 });
  const [dtf, setDtf] = useState({ cena_cm2: 0, min_cena: 0 });
  const [sietotlac, setSietotlac] = useState({ cena_cm2: 0, cena_cm2_tmavy: 0, min_cena: 0, priplatok_farba: 0 });
  const [rezanyMinCena, setRezanyMinCena] = useState(0);
  const [folie, setFolie] = useState([]);

  const [testTech, setTestTech] = useState('sublimacia');
  const [testW, setTestW] = useState(10);
  const [testH, setTestH] = useState(10);
  const [testFarby, setTestFarby] = useState(1);
  const [testTmavyTextil, setTestTmavyTextil] = useState(false);
  const [testFoliaId, setTestFoliaId] = useState(null);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: tech }, { data: sieto }, { data: fol }, { data: rez }] = await Promise.all([
      supabase.from('cennik_technologie').select('*'),
      supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_folie').select('*').order('id'),
      supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
    ]);
    const subRow = (tech || []).find(t => t.technologia === 'sublimacia');
    const dtfRow = (tech || []).find(t => t.technologia === 'dtf');
    if (subRow) setSublimacia({ cena_cm2: subRow.cena_cm2, min_cena: subRow.min_cena });
    if (dtfRow) setDtf({ cena_cm2: dtfRow.cena_cm2, min_cena: dtfRow.min_cena });
    if (sieto) setSietotlac({ cena_cm2: sieto.cena_cm2, cena_cm2_tmavy: sieto.cena_cm2_tmavy, min_cena: sieto.min_cena, priplatok_farba: sieto.priplatok_farba });
    if (rez) setRezanyMinCena(rez.min_cena);
    setFolie(fol || []);
    if ((fol || []).length > 0) setTestFoliaId(fol[0].id);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const ulozSublimacia = async (patch) => {
    const next = { ...sublimacia, ...patch };
    setSublimacia(next);
    await supabase.from('cennik_technologie').upsert({ technologia: 'sublimacia', ...next });
  };
  const ulozDtf = async (patch) => {
    const next = { ...dtf, ...patch };
    setDtf(next);
    await supabase.from('cennik_technologie').upsert({ technologia: 'dtf', ...next });
  };
  const ulozSietotlac = async (patch) => {
    const next = { ...sietotlac, ...patch };
    setSietotlac(next);
    await supabase.from('cennik_sietotlac').upsert({ id: 1, ...next });
  };
  const ulozRezanyMin = async (val) => {
    setRezanyMinCena(val);
    await supabase.from('cennik_rezany_transfer').upsert({ id: 1, min_cena: val });
  };

  const pridajFoliu = async () => {
    const { data, error } = await supabase.from('cennik_folie').insert({ nazov: 'Nová fólia', cena_cm2: 0.15 }).select().single();
    if (!error && data) setFolie(f => [...f, data]);
  };
  const upravFoliu = async (id, patch) => {
    setFolie(f => f.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('cennik_folie').update(patch).eq('id', id);
  };
  const zmazFoliu = async (id) => {
    if (!window.confirm('Zmazať tento typ fólie?')) return;
    setFolie(f => f.filter(x => x.id !== id));
    await supabase.from('cennik_folie').delete().eq('id', id);
  };

  const cennikProKalkulacku = {
    sublimacia, dtf, sietotlac, folie, rezanyMinCena,
  };
  const plocha = Math.round((parseFloat(testW) || 0) * (parseFloat(testH) || 0) * 10) / 10;
  const vysledok = vypocitajCenuPotlace(cennikProKalkulacku, testTech, plocha, parseInt(testFarby) || 1, testTmavyTextil, testFoliaId);

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-indigo-400 h-5 w-5" /> Cenník potlače</h2>
        <p className="text-xs text-slate-400 mt-1">Každá technológia má iný spôsob výpočtu ceny — plošné technológie rozhoduje len cm², pri sieťotlači a rezanom transfere ráta aj počet farieb (a pri transfere typ fólie).</p>
      </div>

      {/* SUBLIMÁCIA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sublimácia</h3>
        <p className="text-xs text-slate-400 mb-3">Cena = plocha (cm²) × sadzba. Počet farieb ani počet samostatných motívov cenu neovplyvňuje — je to plnofarebná digitálna tlač.</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <label className="text-xs text-slate-400 font-medium">Sadzba (€/cm²)</label>
            <input type="number" step="0.01" value={sublimacia.cena_cm2} onChange={(e) => ulozSublimacia({ cena_cm2: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Minimálna cena úkonu (€)</label>
            <input type="number" step="0.1" value={sublimacia.min_cena} onChange={(e) => ulozSublimacia({ min_cena: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
        </div>
      </div>

      {/* DTF */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Digitálny transfer (DTF)</h3>
        <p className="text-xs text-slate-400 mb-3">Cena = plocha (cm²) × sadzba. Aj tu rozhoduje len celková plocha — jedno veľké logo alebo veľa malých na rovnakej ploche stojí rovnako.</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <label className="text-xs text-slate-400 font-medium">Sadzba (€/cm²)</label>
            <input type="number" step="0.01" value={dtf.cena_cm2} onChange={(e) => ulozDtf({ cena_cm2: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Minimálna cena úkonu (€)</label>
            <input type="number" step="0.1" value={dtf.min_cena} onChange={(e) => ulozDtf({ min_cena: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
        </div>
      </div>

      {/* SIEŤOTLAČ */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sieťotlač</h3>
        <p className="text-xs text-slate-400 mb-3">Cena = základ (plocha × sadzba, min. cena) + príplatok za každú ďalšiu farbu nad rámec prvej (každá farba = nové sito). Na tmavý textil treba 2 vrstvy farby pre dobré krytie, preto má vlastnú (vyššiu) sadzbu.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          <div>
            <label className="text-xs text-slate-400 font-medium">Sadzba — svetlý textil (€/cm²)</label>
            <input type="number" step="0.01" value={sietotlac.cena_cm2} onChange={(e) => ulozSietotlac({ cena_cm2: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Sadzba — tmavý textil (€/cm²)</label>
            <input type="number" step="0.01" value={sietotlac.cena_cm2_tmavy} onChange={(e) => ulozSietotlac({ cena_cm2_tmavy: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Minimálna cena úkonu (€)</label>
            <input type="number" step="0.1" value={sietotlac.min_cena} onChange={(e) => ulozSietotlac({ min_cena: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Príplatok za ďalšiu farbu (€)</label>
            <input type="number" step="0.1" value={sietotlac.priplatok_farba} onChange={(e) => ulozSietotlac({ priplatok_farba: parseFloat(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
        </div>
      </div>

      {/* REZANÝ TRANSFER */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Rezaný transfer (fóliový vinyl)</h3>
        <p className="text-xs text-slate-400 mb-3">Cena = plocha (cm²) × sadzba fólie × počet farieb (každá farba sa reže a lisuje zvlášť). Sadzba sa líši podľa typu fólie.</p>
        <div className="max-w-xs mb-3">
          <label className="text-xs text-slate-400 font-medium">Minimálna cena úkonu (€)</label>
          <input type="number" step="0.1" value={rezanyMinCena} onChange={(e) => ulozRezanyMin(parseFloat(e.target.value) || 0)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400 font-medium">Typy fólie a ich sadzba (€/cm²)</label>
          <button onClick={pridajFoliu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať typ fólie</button>
        </div>
        <div className="space-y-2">
          {folie.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <input type="text" value={f.nazov} onChange={(e) => upravFoliu(f.id, { nazov: e.target.value })} className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <input type="number" step="0.01" value={f.cena_cm2} onChange={(e) => upravFoliu(f.id, { cena_cm2: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> €/cm²
              </div>
              <button onClick={() => zmazFoliu(f.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {folie.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne typy fólie.</p>}
        </div>
      </div>

      {/* TESTOVACIA KALKULAČKA */}
      <div className="bg-slate-950 rounded-2xl p-5 border border-indigo-900/40">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Testovacia kalkulačka</h3>
        <p className="text-xs text-slate-400 mb-4">Over si, akú cenu dostane zákazník pri malej aj veľkej potlači, kým to nasadíš naostro.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400">Technológia</label>
            <select value={testTech} onChange={(e) => setTestTech(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              <option value="sublimacia">Sublimácia</option>
              <option value="dtf">Digitálny transfer</option>
              <option value="sietotlac">Sieťotlač</option>
              <option value="rezany">Rezaný transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Šírka (cm)</label>
            <input type="number" value={testW} onChange={(e) => setTestW(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Výška (cm)</label>
            <input type="number" value={testH} onChange={(e) => setTestH(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Počet farieb</label>
            <input type="number" min="1" value={testFarby} onChange={(e) => setTestFarby(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
        </div>
        {testTech === 'sietotlac' && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs text-slate-400">Textil:</label>
            <button onClick={() => setTestTmavyTextil(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${!testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Svetlý</button>
            <button onClick={() => setTestTmavyTextil(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Tmavý</button>
          </div>
        )}
        {testTech === 'rezany' && (
          <div className="mb-4 max-w-xs">
            <label className="text-xs text-slate-400">Typ fólie</label>
            <select value={testFoliaId || ''} onChange={(e) => setTestFoliaId(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              {folie.map(f => <option key={f.id} value={f.id}>{f.nazov} ({f.cena_cm2.toFixed(2)} €/cm²)</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Plocha: <span className="text-white font-semibold">{plocha} cm²</span>
            <span className="block mt-0.5">{vysledok.vzorec}</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{vysledok.cena.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  );
}
