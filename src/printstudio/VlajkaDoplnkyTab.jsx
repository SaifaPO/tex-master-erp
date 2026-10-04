import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Package, ChevronDown, ChevronUp, ImagePlus, ArrowUp, ArrowDown } from 'lucide-react';
import { nahrajObrazokDoplnku } from './nahrajObrazok';
import NumberInput from '../NumberInput';

const VELKOSTI = ['S', 'M', 'L', 'XL'];

// Zmena poradia (hore/dole) — poradie sa ulozi do stlpca "poradie" a zakaznicka appka radi podla neho.
// Pri posune sa poradie VSETKYM riadkom znovu ocisluje 0..n-1 (nove polozky maju poradie 0, takze by
// sa inak neda spolahlivo prehodit).
async function posunPoradie(supabase, tabulka, riadky, setRiadky, id, smer) {
  const i = riadky.findIndex(x => x.id === id);
  const j = i + smer;
  if (i < 0 || j < 0 || j >= riadky.length) return;
  const nove = riadky.slice();
  [nove[i], nove[j]] = [nove[j], nove[i]];
  const preCislovane = nove.map((x, idx) => ({ ...x, poradie: idx }));
  const povodne = new Map(riadky.map(x => [x.id, x.poradie]));
  setRiadky(preCislovane);
  await Promise.all(preCislovane
    .filter(x => povodne.get(x.id) !== x.poradie)
    .map(x => supabase.from(tabulka).update({ poradie: x.poradie }).eq('id', x.id)));
}

function PosunTlacidla({ index, pocet, onPosun }) {
  return (
    <div className="flex flex-col shrink-0">
      <button type="button" disabled={index === 0} onClick={() => onPosun(-1)} title="Posunúť vyššie" className="text-slate-500 hover:text-white disabled:opacity-25 disabled:hover:text-slate-500 leading-none"><ArrowUp className="w-3.5 h-3.5" /></button>
      <button type="button" disabled={index === pocet - 1} onClick={() => onPosun(1)} title="Posunúť nižšie" className="text-slate-500 hover:text-white disabled:opacity-25 disabled:hover:text-slate-500 leading-none"><ArrowDown className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// Mala fotka + tlacidlo na nahratie/vymenu — pouzite vo vsetkych sekciach nizsie, aby zakaznik
// videl realnu fotku podstavca/prutu/doplnku namiesto len textu.
function FotoUpload({ url, onNahraj }) {
  const inputRef = useRef(null);
  const [nahravam, setNahravam] = useState(false);
  const vyber = async (e) => {
    const subor = e.target.files?.[0];
    e.target.value = '';
    if (!subor) return;
    setNahravam(true);
    try { await onNahraj(subor); } catch (err) { window.alert('Nahratie zlyhalo: ' + err.message); }
    setNahravam(false);
  };
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {url ? <img src={url} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-700" /> : <div className="w-9 h-9 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600"><ImagePlus className="w-4 h-4" /></div>}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={nahravam} title="Nahrať fotku" className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold disabled:opacity-50">{nahravam ? '…' : (url ? 'Vymeniť' : 'Nahrať foto')}</button>
      <input ref={inputRef} type="file" accept="image/*" onChange={vyber} className="hidden" />
    </div>
  );
}

export default function VlajkaDoplnkyTab({ supabase }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Package className="text-indigo-400 h-5 w-5" /> Opracovanie, prúty, podstavce, príslušenstvo, Pantone</h2>
        <p className="text-xs text-slate-400 mt-1">Voliteľné položky, ktoré si zákazník pridáva ku konfigurácii vlajky. Zadávaš NÁKUPNÉ ceny — predajná cena sa dopočíta z marže (Cenotvorba) a počtu kusov, rovnako ako pri látke.</p>
      </div>
      <JednoduchaSekcia supabase={supabase} tabulka="vlajka_dokoncenie" nazovSekcie="Opracovanie okrajov" popisSekcie="Napr. obšitie / laserový orez." maMaxMnozstvo={false} />
      <StoziareSekcia supabase={supabase} />
      <PodstavceSekcia supabase={supabase} />
      <JednoduchaSekcia supabase={supabase} tabulka="vlajka_doplnky" nazovSekcie="Príslušenstvo" popisSekcie="Ostatné doplnky (napr. karabínky navyše) — zákazník si môže vybrať aj viac kusov naraz, nastav maximálne množstvo. Podstavce majú odteraz vlastnú kartu vyššie (cena podľa veľkosti vlajky)." maMaxMnozstvo={true} />
      <PantoneSekcia supabase={supabase} />
    </div>
  );
}

function JednoduchaSekcia({ supabase, tabulka, nazovSekcie, popisSekcie, maMaxMnozstvo }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from(tabulka).select('*').order('poradie').order('id');
    setRiadky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const posun = (id, smer) => posunPoradie(supabase, tabulka, riadky, setRiadky, id, smer);

  const pridaj = async () => {
    const patch = { kod: `polozka_${Date.now()}`, nazov: 'Nová položka', cena: 0 };
    if (maMaxMnozstvo) patch.max_mnozstvo = 5;
    const { data, error } = await supabase.from(tabulka).insert(patch).select().single();
    if (!error && data) setRiadky(r => [...r, data]);
  };

  const uprav = async (id, patch) => {
    setRiadky(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from(tabulka).update(patch).eq('id', id);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto položku?')) return;
    setRiadky(r => r.filter(x => x.id !== id));
    await supabase.from(tabulka).delete().eq('id', id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">{nazovSekcie}</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">{popisSekcie}</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2.5"></th>
                <th className="text-left px-4 py-2.5">Foto</th>
                <th className="text-left px-4 py-2.5">Kód</th>
                <th className="text-left px-4 py-2.5">Názov</th>
                <th className="text-left px-4 py-2.5">Nákup (€)</th>
                {maMaxMnozstvo && <th className="text-left px-4 py-2.5">Max. ks</th>}
                <th className="text-left px-4 py-2.5">Popis</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {riadky.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="pl-3 pr-1 py-2"><PosunTlacidla index={i} pocet={riadky.length} onPosun={(s) => posun(r.id, s)} /></td>
                  <td className="px-4 py-2"><FotoUpload url={r.obrazok_url} onNahraj={async (subor) => uprav(r.id, { obrazok_url: await nahrajObrazokDoplnku(supabase, subor) })} /></td>
                  <td className="px-4 py-2"><input type="text" value={r.kod} onChange={(e) => uprav(r.id, { kod: e.target.value })} className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" /></td>
                  <td className="px-4 py-2"><input type="text" value={r.nazov} onChange={(e) => uprav(r.id, { nazov: e.target.value })} className="w-48 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2"><NumberInput step="0.5" value={r.cena} onChange={(v) => uprav(r.id, { cena: v })} fallback={0} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  {maMaxMnozstvo && <td className="px-4 py-2"><NumberInput min="1" value={r.max_mnozstvo} onChange={(v) => uprav(r.id, { max_mnozstvo: v })} fallback={1} className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>}
                  <td className="px-4 py-2"><input type="text" value={r.popis || ''} onChange={(e) => uprav(r.id, { popis: e.target.value })} className="w-64 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" /></td>
                  <td className="px-4 py-2 text-right"><button onClick={() => zmaz(r.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {riadky.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne položky.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Stoziare — cena sa lisi podla velkosti vlajky (vacsia vlajka = dlhsi/pevnejsi stoziar).
function StoziareSekcia({ supabase }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rozbaleny, setRozbaleny] = useState(null);
  const [ceny, setCeny] = useState({}); // { [velkost]: cena }
  const [ukladam, setUkladam] = useState(false);
  const [tvary, setTvary] = useState([]);
  const [povoleneTvary, setPovoleneTvary] = useState({}); // { [stoziarId]: [tvarId] } — prazdne = dostupne pre vsetky tvary

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data }, { data: t }, { data: pt }] = await Promise.all([
      supabase.from('vlajka_stoziare').select('*').order('poradie').order('id'),
      supabase.from('vlajka_tvary').select('id, nazov').order('poradie').order('id'),
      supabase.from('vlajka_stoziare_tvary').select('stoziar_id, tvar_id'),
    ]);
    setRiadky(data || []);
    setTvary(t || []);
    const map = {};
    (pt || []).forEach(x => { (map[x.stoziar_id] = map[x.stoziar_id] || []).push(x.tvar_id); });
    setPovoleneTvary(map);
    setIsLoading(false);
  };
  // Zaskrtnute tvary = kde sa prut ponuka. Vsetky zaskrtnute (alebo ziadny riadok) = ponuka sa pri vsetkych tvaroch.
  const prepniTvar = async (stoziarId, tvarId) => {
    const aktualne = povoleneTvary[stoziarId]?.length ? povoleneTvary[stoziarId] : tvary.map(t => t.id);
    let nove = aktualne.includes(tvarId) ? aktualne.filter(x => x !== tvarId) : [...aktualne, tvarId];
    if (nove.length === 0) return; // aspon jeden tvar musi ostat zaskrtnuty
    const vsetky = nove.length === tvary.length;
    setPovoleneTvary(m => ({ ...m, [stoziarId]: vsetky ? [] : nove }));
    await supabase.from('vlajka_stoziare_tvary').delete().eq('stoziar_id', stoziarId);
    if (!vsetky) await supabase.from('vlajka_stoziare_tvary').insert(nove.map(tid => ({ stoziar_id: stoziarId, tvar_id: tid })));
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const posun = (id, smer) => posunPoradie(supabase, 'vlajka_stoziare', riadky, setRiadky, id, smer);

  const pridaj = async () => {
    const { data, error } = await supabase.from('vlajka_stoziare').insert({ kod: `stoziar_${Date.now()}`, nazov: 'Nový prút', cena: 0 }).select().single();
    if (!error && data) setRiadky(r => [...r, data]);
  };
  const uprav = async (id, patch) => {
    setRiadky(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_stoziare').update(patch).eq('id', id);
  };
  const zmaz = async (id) => {
    if (!window.confirm('Zmazať tento prút? Zmažú sa aj jeho ceny pre všetky veľkosti.')) return;
    setRiadky(r => r.filter(x => x.id !== id));
    await supabase.from('vlajka_stoziare').delete().eq('id', id);
  };

  const rozbal = async (id) => {
    if (rozbaleny === id) { setRozbaleny(null); return; }
    setRozbaleny(id);
    const { data } = await supabase.from('vlajka_stoziare_ceny').select('*').eq('stoziar_id', id);
    const map = {};
    VELKOSTI.forEach(v => { map[v] = data?.find(r => r.velkost === v)?.cena ?? 0; });
    setCeny(map);
  };
  const ulozCeny = async (stoziarId) => {
    setUkladam(true);
    const riadkyNaUlozenie = VELKOSTI.map(v => ({ stoziar_id: stoziarId, velkost: v, cena: parseFloat(ceny[v]) || 0 }));
    await supabase.from('vlajka_stoziare_ceny').upsert(riadkyNaUlozenie, { onConflict: 'stoziar_id,velkost' });
    setUkladam(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">Konštrukcia / prút</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Napr. bez konštrukcie / laminát / hliník — cena sa nastavuje samostatne pre každú veľkosť vlajky (rozbaľ riadok).</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
          {riadky.map((r, i) => (
            <div key={r.id} className="border-b border-slate-800 last:border-b-0">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <PosunTlacidla index={i} pocet={riadky.length} onPosun={(s) => posun(r.id, s)} />
                <button onClick={() => rozbal(r.id)} className="text-slate-500 hover:text-white shrink-0">{rozbaleny === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                <FotoUpload url={r.obrazok_url} onNahraj={async (subor) => uprav(r.id, { obrazok_url: await nahrajObrazokDoplnku(supabase, subor) })} />
                <input type="text" value={r.kod} onChange={(e) => uprav(r.id, { kod: e.target.value })} className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" />
                <input type="text" value={r.nazov} onChange={(e) => uprav(r.id, { nazov: e.target.value })} className="w-48 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                <input type="text" value={r.popis || ''} onChange={(e) => uprav(r.id, { popis: e.target.value })} placeholder="Popis" className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" />
                <button onClick={() => zmaz(r.id)} className="text-slate-400 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              {rozbaleny === r.id && (
                <div className="px-4 pb-3 bg-slate-950/60">
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-500 block mb-1">Ponúka sa pri tvaroch (všetky zaškrtnuté = pri všetkých)</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {tvary.map(t => {
                        const povolene = povoleneTvary[r.id]?.length ? povoleneTvary[r.id] : tvary.map(x => x.id);
                        return (
                          <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={povolene.includes(t.id)} onChange={() => prepniTvar(r.id, t.id)} className="rounded bg-slate-950 border-slate-700" /> {t.nazov}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {VELKOSTI.map(v => (
                      <div key={v}>
                        <label className="text-[10px] text-slate-500">Nákup, veľkosť {v} (€)</label>
                        <input type="number" step="0.5" value={ceny[v] ?? 0} onChange={(e) => setCeny(c => ({ ...c, [v]: e.target.value }))} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => ulozCeny(r.id)} disabled={ukladam} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">{ukladam ? 'Ukladám…' : 'Uložiť ceny'}</button>
                </div>
              )}
            </div>
          ))}
          {riadky.length === 0 && <p className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne prúty.</p>}
        </div>
      )}
    </div>
  );
}

// Podstavce — samostatna tabulka (oddelena od vseobecneho prislusenstva), pretoze potrebuju cenu
// AJ vhodnost per velkost vlajky (napr. lahky podstavec sa neopdporuca pre XL vlajku vonku).
function PodstavceSekcia({ supabase }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rozbaleny, setRozbaleny] = useState(null);
  const [nastavenia, setNastavenia] = useState({}); // { [velkost]: {cena, vhodny, poznamka} }
  const [ukladam, setUkladam] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('vlajka_podstavce').select('*').order('poradie').order('id');
    setRiadky(data || []);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const posun = (id, smer) => posunPoradie(supabase, 'vlajka_podstavce', riadky, setRiadky, id, smer);

  const pridaj = async () => {
    const { data, error } = await supabase.from('vlajka_podstavce').insert({ kod: `podstavec_${Date.now()}`, nazov: 'Nový podstavec' }).select().single();
    if (!error && data) setRiadky(r => [...r, data]);
  };
  const uprav = async (id, patch) => {
    setRiadky(r => r.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_podstavce').update(patch).eq('id', id);
  };
  const zmaz = async (id) => {
    if (!window.confirm('Zmazať tento podstavec? Zmažú sa aj jeho ceny pre všetky veľkosti.')) return;
    setRiadky(r => r.filter(x => x.id !== id));
    await supabase.from('vlajka_podstavce').delete().eq('id', id);
  };
  const prepniAktivny = async (r) => {
    await uprav(r.id, { aktivny: !r.aktivny });
  };

  const rozbal = async (id) => {
    if (rozbaleny === id) { setRozbaleny(null); return; }
    setRozbaleny(id);
    const { data } = await supabase.from('vlajka_podstavce_ceny').select('*').eq('podstavec_id', id);
    const map = {};
    VELKOSTI.forEach(v => {
      const row = data?.find(r => r.velkost === v);
      map[v] = { cena: row?.cena ?? 0, vhodny: row?.vhodny ?? true, poznamka: row?.poznamka || '' };
    });
    setNastavenia(map);
  };
  const zmenNastavenie = (v, field, value) => {
    setNastavenia(n => ({ ...n, [v]: { ...n[v], [field]: value } }));
  };
  const ulozNastavenia = async (podstavecId) => {
    setUkladam(true);
    const riadkyNaUlozenie = VELKOSTI.map(v => ({
      podstavec_id: podstavecId, velkost: v,
      cena: parseFloat(nastavenia[v]?.cena) || 0,
      vhodny: nastavenia[v]?.vhodny !== false,
      poznamka: nastavenia[v]?.poznamka?.trim() || null,
    }));
    await supabase.from('vlajka_podstavce_ceny').upsert(riadkyNaUlozenie, { onConflict: 'podstavec_id,velkost' });
    setUkladam(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">Podstavce</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Pre každý podstavec nastav cenu, či je vhodný pre danú veľkosť vlajky a voliteľnú poznámku (napr. "vhodné aj pre XL, ale len v interiéri") — rozbaľ riadok.</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
          {riadky.map((r, i) => (
            <div key={r.id} className="border-b border-slate-800 last:border-b-0">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <PosunTlacidla index={i} pocet={riadky.length} onPosun={(s) => posun(r.id, s)} />
                <button onClick={() => rozbal(r.id)} className="text-slate-500 hover:text-white shrink-0">{rozbaleny === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                <FotoUpload url={r.obrazok_url} onNahraj={async (subor) => uprav(r.id, { obrazok_url: await nahrajObrazokDoplnku(supabase, subor) })} />
                <input type="text" value={r.kod} onChange={(e) => uprav(r.id, { kod: e.target.value })} className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" />
                <input type="text" value={r.nazov} onChange={(e) => uprav(r.id, { nazov: e.target.value })} className="w-48 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                <input type="text" value={r.popis || ''} onChange={(e) => uprav(r.id, { popis: e.target.value })} placeholder="Popis" className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" />
                <button onClick={() => prepniAktivny(r)} className={`text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 ${r.aktivny ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{r.aktivny ? 'Aktívny' : 'Neaktívny'}</button>
                <button onClick={() => zmaz(r.id)} className="text-slate-400 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              {rozbaleny === r.id && (
                <div className="px-4 pb-3 bg-slate-950/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                    {VELKOSTI.map(v => {
                      const n = nastavenia[v] || { cena: 0, vhodny: true, poznamka: '' };
                      return (
                        <div key={v} className="bg-slate-900 rounded-xl border border-slate-800 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">Veľkosť {v}</span>
                            <label className="flex items-center gap-1 text-[10px] text-slate-400">
                              <input type="checkbox" checked={n.vhodny !== false} onChange={(e) => zmenNastavenie(v, 'vhodny', e.target.checked)} className="rounded bg-slate-950 border-slate-700" /> vhodný
                            </label>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Nákupná cena (€)</label>
                            <input type="number" step="0.5" value={n.cena} onChange={(e) => zmenNastavenie(v, 'cena', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500">Poznámka (voliteľné)</label>
                            <input type="text" value={n.poznamka} onChange={(e) => zmenNastavenie(v, 'poznamka', e.target.value)} placeholder="napr. len v interiéri" className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => ulozNastavenia(r.id)} disabled={ukladam} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">{ukladam ? 'Ukladám…' : 'Uložiť'}</button>
                </div>
              )}
            </div>
          ))}
          {riadky.length === 0 && <p className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne podstavce.</p>}
        </div>
      )}
    </div>
  );
}

function PantoneSekcia({ supabase }) {
  const [vzorky, setVzorky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('vlajka_pantone').select('*').order('poradie').order('id');
    setVzorky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const { data, error } = await supabase.from('vlajka_pantone').insert({ kod: 'Nová vzorka', hex: '#000000' }).select().single();
    if (!error && data) setVzorky(v => [...v, data]);
  };

  const uprav = async (id, patch) => {
    setVzorky(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_pantone').update(patch).eq('id', id);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať túto Pantone vzorku?')) return;
    setVzorky(v => v.filter(x => x.id !== id));
    await supabase.from('vlajka_pantone').delete().eq('id', id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm text-white">Pantone vzorky</h3>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať vzorku</button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Farebná paleta pre pozadie vlajky — samostatná od farieb oblečenia.</p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {vzorky.map(v => (
            <div key={v.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <input type="color" value={v.hex} onChange={(e) => uprav(v.id, { hex: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-slate-700 shrink-0" />
              <input type="text" value={v.kod} onChange={(e) => uprav(v.id, { kod: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white" />
              <button onClick={() => zmaz(v.id)} className="text-slate-400 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {vzorky.length === 0 && <p className="text-sm text-slate-500 col-span-full">Zatiaľ žiadne vzorky.</p>}
        </div>
      )}
    </div>
  );
}
