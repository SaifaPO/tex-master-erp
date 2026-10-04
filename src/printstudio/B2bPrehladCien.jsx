import React, { useEffect, useState } from 'react';
import { Loader2, Calculator } from 'lucide-react';
import NumberInput from '../NumberInput';

const r2 = (x) => Math.round(x * 100) / 100;
const eur = (x) => Number(x).toFixed(2).replace('.', ',') + ' €';

// Prehľad B2B cien: admin zadá % zľavy a hneď vidí, aké ceny dostane agentúra pri akom počte kusov —
// vlajka, každý prút, každý podstavec, doplnky. Ceny za 1 ks počíta Edge Function beachflag-price-preview
// (režim b2bCennik) tým istým vzorcom ako zákaznícky konfigurátor; zľavu si tu len odpočítavame.
export default function B2bPrehladCien({ supabase, kody }) {
  const [zlava, setZlava] = useState(15);
  const [sDph, setSDph] = useState(false);
  const [tvary, setTvary] = useState([]);
  const [materialy, setMaterialy] = useState([]);
  const [dokoncenia, setDokoncenia] = useState([]);
  const [tvarKod, setTvarKod] = useState('');
  const [materialKod, setMaterialKod] = useState('');
  const [dokoncenieKod, setDokoncenieKod] = useState('');
  const [data, setData] = useState(null);
  const [nacitava, setNacitava] = useState(false);
  const [chyba, setChyba] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: m }, { data: d }] = await Promise.all([
        supabase.from('vlajka_tvary').select('kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_materialy').select('kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_dokoncenie').select('kod, nazov').eq('aktivny', true).order('poradie').order('id'),
      ]);
      setTvary(t || []); setMaterialy(m || []); setDokoncenia(d || []);
      if (t?.[0]) setTvarKod(t[0].kod);
      if (m?.[0]) setMaterialKod(m[0].kod);
      if (d?.[0]) setDokoncenieKod(d[0].kod);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!tvarKod || !materialKod) return;
    let zrusene = false;
    (async () => {
      setNacitava(true); setChyba('');
      const { data: res, error } = await supabase.functions.invoke('beachflag-price-preview', { body: { b2bCennik: true, tvarKod, materialKod, dokoncenieKod } });
      if (zrusene) return;
      if (error || res?.error || !res?.b2bCennik) {
        setData(null);
        setChyba('Ceny sa nepodarilo načítať. Skontroluj, že je v Supabase nasadená najnovšia funkcia beachflag-price-preview. ' + (res?.error || error?.message || ''));
      } else setData(res.b2bCennik);
      setNacitava(false);
    })();
    return () => { zrusene = true; };
  }, [supabase, tvarKod, materialKod, dokoncenieKod]);

  const z = Math.min(90, Math.max(0, Number(zlava) || 0));
  const dphK = data ? (sDph ? 1 + data.dphPercent / 100 : 1) : 1;

  // Bunka: B2B cena za 1 ks (hrubo), pod nou povodna cena a o kolko je lacnejsie.
  const Bunka = ({ cena }) => {
    if (cena == null) return <td className="px-3 py-1.5 text-center text-slate-600">—</td>;
    const povodna = r2(cena * dphK);
    const b2b = r2(cena * (1 - z / 100) * dphK);
    return (
      <td className="px-3 py-1.5 text-center whitespace-nowrap">
        <div className="font-bold text-emerald-400 text-sm">{eur(b2b)}</div>
        <div className="text-[10px] text-slate-500"><span className="line-through">{eur(povodna)}</span> · −{eur(povodna - b2b)}</div>
      </td>
    );
  };

  const Riadky = ({ polozky }) => polozky
    .filter(p => p.ceny.some(c => c != null && c > 0))
    .map(p => (
      <tr key={p.nazov} className="border-t border-slate-800">
        <td className="px-3 py-1.5 text-xs text-slate-300">{p.nazov}</td>
        {p.ceny.map((c, i) => <Bunka key={i} cena={c} />)}
      </tr>
    ));

  const Hlavicka = ({ prvyStlpec }) => (
    <thead className="bg-slate-950/60 text-slate-500 text-[11px] uppercase tracking-wide">
      <tr>
        <th className="text-left px-3 py-2">{prvyStlpec}</th>
        {data.hladiny.map(h => <th key={h} className="px-3 py-2 text-center">{h} ks</th>)}
      </tr>
    </thead>
  );

  const prvaVelkost = data?.velkosti?.[0];

  return (
    <div className="space-y-4 pt-4 border-t border-slate-800">
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2"><Calculator className="text-indigo-400 h-4 w-4" /> Prehľad cien pre B2B zľavu (Beachvlajky)</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">Zadaj % zľavy a uvidíš, aké ceny za 1 kus dostane agentúra pri rôznom počte kusov. Zeleno je cena po zľave, pod ňou pôvodná cena a koľko ušetrí. Cena za kus klesá s počtom kusov aj bez zľavy (množstevná marža).</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
        <label className="text-[11px] text-slate-400 block">Zľava (%)
          <NumberInput step="0.5" min="0" max="90" value={zlava} onChange={setZlava} fallback={0} className="mt-1 block w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </label>
        {kody.length > 0 && (
          <div className="text-[11px] text-slate-400">Zľava z kódu
            <div className="flex flex-wrap gap-1 mt-1">
              {[...new Set(kody.map(k => Number(k.zlava_percent)))].sort((a, b) => a - b).map(p => (
                <button key={p} onClick={() => setZlava(p)} className={`px-2 py-1.5 rounded-lg text-xs font-semibold ${z === p ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{p} %</button>
              ))}
            </div>
          </div>
        )}
        <label className="text-[11px] text-slate-400 block">Tvar
          <select value={tvarKod} onChange={(e) => setTvarKod(e.target.value)} className="mt-1 block px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
            {tvary.map(t => <option key={t.kod} value={t.kod}>{t.nazov}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-slate-400 block">Materiál
          <select value={materialKod} onChange={(e) => setMaterialKod(e.target.value)} className="mt-1 block px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
            {materialy.map(m => <option key={m.kod} value={m.kod}>{m.nazov}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-slate-400 block">Opracovanie okrajov
          <select value={dokoncenieKod} onChange={(e) => setDokoncenieKod(e.target.value)} className="mt-1 block px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
            {dokoncenia.map(d => <option key={d.kod} value={d.kod}>{d.nazov}</option>)}
          </select>
        </label>
        <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs font-semibold">
          <button onClick={() => setSDph(false)} className={`px-3 py-2 ${!sDph ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>bez DPH</button>
          <button onClick={() => setSDph(true)} className={`px-3 py-2 ${sDph ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>s DPH</button>
        </div>
        {nacitava && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {chyba && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">{chyba}</p>}

      {data && data.velkosti.map(v => (
        <div key={v.kod} className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <div className="px-3 pt-3 text-sm font-bold text-white">Veľkosť {v.nazov} <span className="text-[11px] font-normal text-slate-500">· cena za 1 kus {sDph ? 's' : 'bez'} DPH, zľava {z} %</span></div>
          <table className="w-full text-sm mt-2">
            <Hlavicka prvyStlpec="Položka" />
            <tbody>
              <tr className="border-t border-slate-800 bg-indigo-950/20">
                <td className="px-3 py-1.5 text-xs font-semibold text-indigo-300">Vlajka (materiál + opracovanie)</td>
                {v.vlajka.map((c, i) => <Bunka key={i} cena={c} />)}
              </tr>
              <tr><td colSpan={data.hladiny.length + 1} className="px-3 pt-2 text-[10px] uppercase tracking-wide text-slate-500">Konštrukcia / prút</td></tr>
              <Riadky polozky={v.stoziare} />
              <tr><td colSpan={data.hladiny.length + 1} className="px-3 pt-2 text-[10px] uppercase tracking-wide text-slate-500">Podstavec</td></tr>
              <Riadky polozky={v.podstavce} />
            </tbody>
          </table>
        </div>
      ))}

      {prvaVelkost && prvaVelkost.doplnky.some(d => d.ceny.some(c => c != null && c > 0)) && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <div className="px-3 pt-3 text-sm font-bold text-white">Príslušenstvo / doplnky <span className="text-[11px] font-normal text-slate-500">· cena za 1 kus {sDph ? 's' : 'bez'} DPH, zľava {z} %</span></div>
          <table className="w-full text-sm mt-2">
            <Hlavicka prvyStlpec="Položka" />
            <tbody><Riadky polozky={prvaVelkost.doplnky} /></tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">Ceny predpokladajú, že zákazník berie rovnaký počet kusov vlajok, prútov aj podstavcov (v skutočnosti sa množstvová cena každej položky počíta zvlášť podľa jej počtu kusov). Rovnaká zľava platí aj pre Zástavy, Dresy, DTF, textilnú metráž, Buffky a Čelenky, tu sa zatiaľ ukazujú len Beachvlajky.</p>
    </div>
  );
}
