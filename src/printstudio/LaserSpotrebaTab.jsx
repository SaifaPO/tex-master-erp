import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Scissors, RefreshCw, Copy, Plus, X, Mail, Eye, AlertTriangle, CheckCircle2, EyeOff, Trash2 } from 'lucide-react';

// Spotreba metráže z laserového hotfoldera. Lokálny agent (laser-spotreba-agent/) posiela rozmery DXF súborov do funkcie laser-spotreba-ingest,
// tá z názvu súboru rozparsuje zákazku/farbu/materiál/strih/veľkosť/počet a ukladá do tabuľky laser_spotreba. Denný súhrn e-mailom posiela
// funkcia laser-spotreba-sumar (pg_cron). Tu je prehľad, oprava chybných názvov a nastavenia.
const STAVY = {
  ok: ['OK', 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'],
  chyba_v_nazve: ['Chyba v názve', 'bg-amber-500/15 text-amber-300 border-amber-500/30'],
  nezmesti_sa: ['Nezmestí sa na šírku', 'bg-rose-500/15 text-rose-300 border-rose-500/30'],
  chyba_suboru: ['Súbor sa nedal prečítať', 'bg-rose-500/15 text-rose-300 border-rose-500/30'],
};
const FUNKCIA_URL = `${(import.meta.env.VITE_SUPABASE_URL || 'https://<projekt>.supabase.co').replace(/\/$/, '')}/functions/v1/laser-spotreba-ingest`;
const baDatum = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(d);
const posunDni = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const skDatum = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '—');
const m2 = (n) => (Math.round(n * 100) / 100).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kedy = (iso) => { if (!iso) return 'ešte nikdy'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'práve teraz' : m < 60 ? `pred ${m} min` : m < 1440 ? `pred ${Math.round(m / 60)} h` : `pred ${Math.round(m / 1440)} dňami`; };

const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white';
const labelCls = 'text-[11px] text-slate-400 block mb-1';

export default function LaserSpotrebaTab({ supabase }) {
  const [pohlad, setPohlad] = useState('prehlad'); // prehlad | subory | nastavenia
  const [obdobie, setObdobie] = useState('mesiac');
  const [od, setOd] = useState(baDatum().slice(0, 8) + '01');
  const [doD, setDoD] = useState(baDatum());
  const [hladaj, setHladaj] = useState('');
  const [len, setLen] = useState('vsetko'); // vsetko | problemy
  const [riadky, setRiadky] = useState([]);
  const [nast, setNast] = useState(null);
  const [slovnik, setSlovnik] = useState([]);
  const [chyba, setChyba] = useState('');
  const [sprava, setSprava] = useState('');
  const [nacitava, setNacitava] = useState(false);
  const [novyPrijemca, setNovyPrijemca] = useState('');
  const [novySlovnik, setNovySlovnik] = useState({ typ: 'farba', hodnota: '' });
  const [nahlad, setNahlad] = useState('');
  const [posiela, setPosiela] = useState(false);

  // rozsah dátumov podľa výberu obdobia
  useEffect(() => {
    const dnes = baDatum();
    if (obdobie === 'dnes') { setOd(dnes); setDoD(dnes); }
    else if (obdobie === 'vcera') { const v = posunDni(dnes, -1); setOd(v); setDoD(v); }
    else if (obdobie === 'tyzden') { setOd(posunDni(dnes, -6)); setDoD(dnes); }
    else if (obdobie === 'mesiac') { setOd(dnes.slice(0, 8) + '01'); setDoD(dnes); }
    else if (obdobie === 'minuly') {
      const prvy = dnes.slice(0, 8) + '01'; const posledny = posunDni(prvy, -1);
      setOd(posledny.slice(0, 8) + '01'); setDoD(posledny);
    }
  }, [obdobie]);

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const [r, n, s] = await Promise.all([
      supabase.from('laser_spotreba').select('*').gte('datum', od).lte('datum', doD).order('zmena_ts', { ascending: false }).limit(5000),
      supabase.from('laser_spotreba_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('laser_slovnik').select('*').order('hodnota'),
    ]);
    setNacitava(false);
    if (r.error || n.error) { setChyba('Tabuľky pre spotrebu metráže ešte neexistujú — spusti v Supabase SQL Editore migration_laser_spotreba.sql.'); return; }
    setChyba(''); setRiadky(r.data || []); setNast(n.data); setSlovnik(s.data || []);
  }, [supabase, od, doD]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const nasobit = nast?.nasobit_poctom !== false;
  const metre = useCallback((r) => ((Number(r.dlzka_cm) || 0) / 100) * (nasobit ? (Number(r.pocet_ks) || 1) : 1), [nasobit]);
  const aktivne = useMemo(() => riadky.filter((r) => !r.ignorovat), [riadky]);
  const spolu = useMemo(() => aktivne.reduce((a, r) => a + metre(r), 0), [aktivne, metre]);
  const problemy = useMemo(() => aktivne.filter((r) => r.stav !== 'ok'), [aktivne]);

  const zoskup = (rr, kluc) => {
    const mp = new Map();
    for (const r of rr) { const k = kluc(r); const x = mp.get(k) || { m: 0, n: 0, kluc: k }; x.m += metre(r); x.n += 1; mp.set(k, x); }
    return [...mp.values()].sort((a, b) => b.m - a.m);
  };
  const poDnoch = useMemo(() => zoskup(aktivne, (r) => r.datum).sort((a, b) => (a.kluc < b.kluc ? 1 : -1)), [aktivne, metre]); // eslint-disable-line react-hooks/exhaustive-deps
  const poMaterialoch = useMemo(() => zoskup(aktivne, (r) => `${r.material || 'materiál ?'} — ${r.farba || 'farba ?'}`), [aktivne, metre]); // eslint-disable-line react-hooks/exhaustive-deps
  const poZakazkach = useMemo(() => {
    const mp = new Map();
    for (const r of aktivne) {
      const k = r.zakazka || '?';
      const x = mp.get(k) || { kluc: k, zakaznik: r.zakaznik, m: 0, n: 0, kusov: 0, strih: new Set(), mat: new Set() };
      x.m += metre(r); x.n += 1; x.kusov += Number(r.pocet_ks) || 0;
      if (r.strih) x.strih.add(r.strih);
      if (r.material || r.farba) x.mat.add(`${r.material || '?'} ${r.farba || '?'}`);
      if (!x.zakaznik && r.zakaznik) x.zakaznik = r.zakaznik;
      mp.set(k, x);
    }
    return [...mp.values()].sort((a, b) => b.m - a.m);
  }, [aktivne, metre]); // eslint-disable-line react-hooks/exhaustive-deps

  const viditelne = useMemo(() => {
    const q = hladaj.trim().toLowerCase();
    return riadky.filter((r) => (len === 'vsetko' || (r.stav !== 'ok' && !r.ignorovat)) && (!q || [r.subor_nazov, r.zakazka, r.zakaznik, r.material, r.farba, r.strih].some((x) => String(x || '').toLowerCase().includes(q))));
  }, [riadky, hladaj, len]);

  // ---- úpravy riadkov
  const novyStav = (r) => {
    if (r.stav === 'chyba_suboru') return r.stav;
    if (!r.zakazka || !r.velkost || r.pocet_ks == null) return 'chyba_v_nazve';
    return (Number(r.sirka_cm) || 0) > (Number(nast?.max_sirka_cm) || 160) ? 'nezmesti_sa' : 'ok';
  };
  const uloz = async (r, patch) => {
    const upravene = { ...r, ...patch };
    if ('zakazka' in patch || 'velkost' in patch || 'pocet_ks' in patch) patch = { ...patch, stav: novyStav(upravene) };
    setRiadky((rr) => rr.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('laser_spotreba').update(patch).eq('id', r.id);
    if (error) { setSprava('Uloženie zlyhalo: ' + error.message); nacitaj(); }
  };
  const zmaz = async (r) => {
    if (!window.confirm(`Zmazať riadok „${r.subor_nazov}"? Agent ho už znova nepošle (súbor má v agente poznačený ako spracovaný).`)) return;
    await supabase.from('laser_spotreba').delete().eq('id', r.id); nacitaj();
  };

  // ---- nastavenia
  const ulozNast = async (patch) => {
    setNast((n) => ({ ...n, ...patch }));
    const { error } = await supabase.from('laser_spotreba_nastavenia').update(patch).eq('id', 1);
    if (error) setSprava('Uloženie nastavení zlyhalo: ' + error.message);
  };
  const kopiruj = async (t) => { try { await navigator.clipboard.writeText(t); setSprava('Skopírované.'); } catch { setSprava(t); } };
  const pridajPrijemcu = () => {
    const e = novyPrijemca.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setSprava('Zadaj platnú e-mailovú adresu.'); return; }
    if ((nast.prijemcovia || []).includes(e)) return;
    ulozNast({ prijemcovia: [...(nast.prijemcovia || []), e] }); setNovyPrijemca('');
  };
  const pridajSlovnik = async () => {
    const h = novySlovnik.hodnota.trim();
    if (!h) return;
    const { error } = await supabase.from('laser_slovnik').insert({ typ: novySlovnik.typ, hodnota: h });
    if (error) { setSprava(error.message.includes('duplicate') ? 'Táto hodnota už v slovníku je.' : error.message); return; }
    setNovySlovnik({ ...novySlovnik, hodnota: '' }); nacitaj();
  };
  const zmazSlovnik = async (id) => { await supabase.from('laser_slovnik').delete().eq('id', id); nacitaj(); };
  const novyToken = async () => {
    if (!window.confirm('Vygenerovať nový token? Agent na PC prestane fungovať, kým mu v config.json nevložíš nový token.')) return;
    const t = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('');
    await ulozNast({ agent_token: t });
  };
  const volajSumar = async (body) => {
    const { data, error } = await supabase.functions.invoke('laser-spotreba-sumar', { body });
    if (error) {
      let detail = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) detail = j.error; } catch { /* nič */ }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const nahladSumaru = async () => {
    setPosiela(true); setSprava(''); setNahlad('');
    try { const d = await volajSumar({ dryRun: true, datum: doD }); setNahlad(`${d.predmet}\n\n${d.text}`); } catch (e) { setSprava('Náhľad zlyhal: ' + e.message + ' (je nasadená funkcia laser-spotreba-sumar?)'); }
    setPosiela(false);
  };
  const posliTeraz = async () => {
    if (!window.confirm(`Poslať súhrn za ${skDatum(doD)} teraz na: ${(nast.prijemcovia || []).join(', ') || '— žiadne adresy —'}?`)) return;
    setPosiela(true); setSprava('');
    try { const d = await volajSumar({ datum: doD }); setSprava(`Odoslané na ${d.prijemcovia.join(', ')}.`); } catch (e) { setSprava('Odoslanie zlyhalo: ' + e.message); }
    setPosiela(false);
  };

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;

  const agentZije = nast?.posledny_ping && Date.now() - new Date(nast.posledny_ping).getTime() < 6 * 3600 * 1000;
  const Karta = ({ nadpis, hodnota, pod, farba = 'text-white' }) => (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4"><p className="text-[11px] text-slate-500 uppercase font-bold">{nadpis}</p><p className={`text-2xl font-extrabold mt-1 ${farba}`}>{hodnota}</p>{pod && <p className="text-[11px] text-slate-500 mt-0.5">{pod}</p>}</div>
  );
  const Tabulka = ({ hlavicka, riadkyT, prazdny = 'Žiadne údaje.' }) => (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
      <table className="w-full text-xs"><thead><tr className="text-left text-slate-500 border-b border-slate-800">{hlavicka.map((h, i) => <th key={i} className={`px-3 py-2 font-bold ${i > 0 && /^(Metre|Súborov|Kusov)/.test(h) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>{riadkyT.length ? riadkyT : <tr><td colSpan={hlavicka.length} className="px-3 py-3 text-slate-500">{prazdny}</td></tr>}</tbody></table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Scissors className="text-indigo-400 h-5 w-5" /> Laser – spotreba metráže</h2>
        <span className={`text-xs flex items-center gap-1 ${agentZije ? 'text-emerald-400' : 'text-amber-400'}`}>{agentZije ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} agent na PC: {agentZije ? 'online' : 'neozýva sa'} (posledný signál {kedy(nast?.posledny_ping)})</span>
        <div className="ml-auto flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {[['prehlad', 'Prehľad'], ['subory', `Súbory (${riadky.length})`], ['nastavenia', 'Nastavenia']].map(([k, l]) => (
            <button key={k} onClick={() => setPohlad(k)} className={`px-3 py-1.5 rounded text-xs font-bold ${pohlad === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>

      {pohlad !== 'nastavenia' && (
        <div className="flex flex-wrap items-end gap-3 bg-slate-900/60 rounded-2xl border border-slate-800 p-3 text-xs">
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[['dnes', 'Dnes'], ['vcera', 'Včera'], ['tyzden', '7 dní'], ['mesiac', 'Tento mesiac'], ['minuly', 'Minulý mesiac'], ['vlastne', 'Vlastné']].map(([k, l]) => (
              <button key={k} onClick={() => setObdobie(k)} className={`px-2.5 py-1.5 rounded font-bold ${obdobie === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          <label className="text-slate-400">Od<input type="date" value={od} onChange={(e) => { setOd(e.target.value); setObdobie('vlastne'); }} className="ml-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" /></label>
          <label className="text-slate-400">Do<input type="date" value={doD} onChange={(e) => { setDoD(e.target.value); setObdobie('vlastne'); }} className="ml-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" /></label>
          <button onClick={nacitaj} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${nacitava ? 'animate-spin' : ''}`} /> Obnoviť</button>
        </div>
      )}
      {sprava && <p className="text-xs text-emerald-300 break-words">{sprava}</p>}

      {pohlad === 'prehlad' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta nadpis="Spotreba spolu" hodnota={`${m2(spolu)} m`} pod={`${skDatum(od)} – ${skDatum(doD)}`} />
            <Karta nadpis="Súborov" hodnota={aktivne.length} pod={`${riadky.length - aktivne.length} ignorovaných`} />
            <Karta nadpis="Zákaziek" hodnota={poZakazkach.filter((z) => z.kluc !== '?').length} />
            <Karta nadpis="Na kontrolu" hodnota={problemy.length} farba={problemy.length ? 'text-amber-300' : 'text-emerald-300'} pod={problemy.length ? 'chyba v názve / nezmestí sa' : 'všetko v poriadku'} />
          </div>
          {problemy.length > 0 && (
            <button onClick={() => { setLen('problemy'); setPohlad('subory'); }} className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {problemy.length} súborov vyžaduje kontrolu — otvoriť a opraviť</button>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div><h3 className="text-sm font-bold text-white mb-2">Podľa materiálu a farby</h3>
              <Tabulka hlavicka={['Materiál — farba', 'Metre', 'Súborov']} riadkyT={poMaterialoch.map((x) => <tr key={x.kluc} className="border-b border-slate-800/60"><td className="px-3 py-1.5 text-slate-200">{x.kluc}</td><td className="px-3 py-1.5 text-right font-mono text-white">{m2(x.m)} m</td><td className="px-3 py-1.5 text-right text-slate-400">{x.n}</td></tr>)} /></div>
            <div><h3 className="text-sm font-bold text-white mb-2">Podľa dní</h3>
              <Tabulka hlavicka={['Deň', 'Metre', 'Súborov']} riadkyT={poDnoch.map((x) => <tr key={x.kluc} className="border-b border-slate-800/60"><td className="px-3 py-1.5 text-slate-200">{skDatum(x.kluc)}</td><td className="px-3 py-1.5 text-right font-mono text-white">{m2(x.m)} m</td><td className="px-3 py-1.5 text-right text-slate-400">{x.n}</td></tr>)} /></div>
          </div>
          <div><h3 className="text-sm font-bold text-white mb-2">Skutočná spotreba podľa zákazky</h3>
            <Tabulka hlavicka={['Zákazka', 'Zákazník', 'Strih', 'Materiál / farba', 'Kusov', 'Metre']} riadkyT={poZakazkach.map((x) => <tr key={x.kluc} className="border-b border-slate-800/60"><td className="px-3 py-1.5 font-bold text-white">{x.kluc}</td><td className="px-3 py-1.5 text-slate-300">{x.zakaznik || '—'}</td><td className="px-3 py-1.5 text-slate-400">{[...x.strih].join(', ') || '—'}</td><td className="px-3 py-1.5 text-slate-400">{[...x.mat].join(', ') || '—'}</td><td className="px-3 py-1.5 text-right text-slate-400">{x.kusov || '—'}</td><td className="px-3 py-1.5 text-right font-mono text-white">{m2(x.m)} m</td></tr>)} /></div>
        </div>
      )}

      {pohlad === 'subory' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input value={hladaj} onChange={(e) => setHladaj(e.target.value)} placeholder="Hľadať (zákazka, zákazník, materiál, názov…)" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white w-72" />
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setLen('vsetko')} className={`px-2.5 py-1 rounded font-bold ${len === 'vsetko' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Všetky</button>
              <button onClick={() => setLen('problemy')} className={`px-2.5 py-1 rounded font-bold ${len === 'problemy' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Len na kontrolu</button>
            </div>
            <span className="text-slate-500">Úprava políčka sa uloží po opustení. Po doplnení zákazky, veľkosti a počtu sa stav prepočíta.</span>
          </div>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead><tr className="text-left text-slate-500 border-b border-slate-800">{['Deň', 'Súbor', 'Zákazka', 'Zákazník', 'Materiál', 'Farba', 'Strih', 'Veľk.', 'Ks', 'Dĺžka', 'Šírka', 'Metre', 'Stav', ''].map((h, i) => <th key={i} className="px-2 py-2 font-bold">{h}</th>)}</tr></thead>
              <tbody>
                {viditelne.length === 0 && <tr><td colSpan={14} className="px-3 py-3 text-slate-500">Žiadne súbory v tomto období.</td></tr>}
                {viditelne.map((r) => {
                  const pole = (k, w = 'w-24', typ = 'text') => (
                    <input key={k + r.id + String(r[k])} type={typ} defaultValue={r[k] ?? ''} onBlur={(e) => { const v = typ === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : (e.target.value.trim() || null); if (v !== (r[k] ?? null)) uloz(r, { [k]: v }); }} className={`${w} bg-transparent border border-transparent hover:border-slate-700 focus:border-indigo-500 rounded px-1 py-0.5 text-slate-200`} />
                  );
                  const [stText, stCls] = STAVY[r.stav] || [r.stav, STAVY.chyba_v_nazve[1]];
                  return (
                    <tr key={r.id} className={`border-b border-slate-800/60 ${r.ignorovat ? 'opacity-40' : ''}`}>
                      <td className="px-2 py-1 text-slate-400 whitespace-nowrap">{skDatum(r.datum)}</td>
                      <td className="px-2 py-1 text-slate-300 max-w-[260px] truncate" title={`${r.subor_cesta}${r.poznamka ? '\n' + r.poznamka : ''}`}>{r.subor_nazov}</td>
                      <td className="px-1 py-1">{pole('zakazka', 'w-16')}</td>
                      <td className="px-1 py-1">{pole('zakaznik', 'w-32')}</td>
                      <td className="px-1 py-1">{pole('material', 'w-28')}</td>
                      <td className="px-1 py-1">{pole('farba', 'w-20')}</td>
                      <td className="px-1 py-1">{pole('strih', 'w-20')}</td>
                      <td className="px-1 py-1">{pole('velkost', 'w-14')}</td>
                      <td className="px-1 py-1">{pole('pocet_ks', 'w-12', 'number')}</td>
                      <td className="px-2 py-1 font-mono text-slate-400 whitespace-nowrap">{m2(Number(r.dlzka_cm))} cm</td>
                      <td className="px-2 py-1 font-mono text-slate-400 whitespace-nowrap">{m2(Number(r.sirka_cm))} cm</td>
                      <td className="px-2 py-1 font-mono text-white text-right whitespace-nowrap">{m2(metre(r))} m</td>
                      <td className="px-2 py-1"><span title={r.poznamka || ''} className={`px-2 py-0.5 rounded border whitespace-nowrap ${stCls}`}>{stText}</span></td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <button onClick={() => uloz(r, { ignorovat: !r.ignorovat })} title={r.ignorovat ? 'Znova počítať' : 'Ignorovať (nepočítať do spotreby)'} className="text-slate-400 hover:text-white mr-1">{r.ignorovat ? <Eye className="w-3.5 h-3.5 inline" /> : <EyeOff className="w-3.5 h-3.5 inline" />}</button>
                        <button onClick={() => zmaz(r)} title="Zmazať riadok" className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pohlad === 'nastavenia' && nast && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">Agent na PC (číta hotfolder)</h3>
            <p className="text-slate-400">Inštalácia: priečinok <code className="text-slate-300">laser-spotreba-agent</code> v projekte (návod je v súbore README.md). Do súboru <code className="text-slate-300">config.json</code> sa vkladá nižšie uvedený token.</p>
            <div><span className={labelCls}>Token agenta</span><div className="flex gap-2"><code className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 break-all">{nast.agent_token}</code><button onClick={() => kopiruj(nast.agent_token)} className="px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Copy className="w-3.5 h-3.5" /></button><button onClick={novyToken} className="px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">Nový token</button></div></div>
            <div><span className={labelCls}>Adresa funkcie (už je predvyplnená v config.json)</span><code className="block bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-400 break-all">{FUNKCIA_URL}</code></div>
            <p className="text-slate-500">Posledný signál: {kedy(nast.posledny_ping)}{nast.agent_info ? ` · ${nast.agent_info}` : ''}</p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">Výpočet spotreby</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>Najširšia metráž (cm) — širší strih sa označí „nezmestí sa"</label><input type="number" min="50" step="5" defaultValue={nast.max_sirka_cm} onBlur={(e) => ulozNast({ max_sirka_cm: Number(e.target.value) || 160 })} className={inputCls} /></div>
              <div><label className={labelCls}>Ktorá strana rozloženia je dĺžka rolky</label>
                <select value={nast.osa_dlzky} onChange={(e) => ulozNast({ osa_dlzky: e.target.value })} className={inputCls}><option value="dlhsia">Dlhšia strana (odporúčané)</option><option value="x">Os X (šírka výkresu)</option><option value="y">Os Y (výška výkresu)</option></select></div>
              <label className="flex items-center gap-2 text-slate-300 mt-5 cursor-pointer"><input type="checkbox" checked={nast.nasobit_poctom !== false} onChange={(e) => ulozNast({ nasobit_poctom: e.target.checked })} className="accent-indigo-600" /> Násobiť dĺžku počtom kusov z názvu (napr. „M 3X" = 3 sady)</label>
            </div>
            <p className="text-[11px] text-slate-500">Zmena platí pre zobrazenie a e-mail hneď; stav „nezmestí sa" sa pri už uložených súboroch nepočíta spätne (zmení sa po úprave riadka).</p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-400" /> Denný e-mailový súhrn</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer"><input type="checkbox" checked={!!nast.sumar_zapnuty} onChange={(e) => ulozNast({ sumar_zapnuty: e.target.checked })} className="accent-indigo-600" /> Posielať súhrn každý deň</label>
              <label className="text-slate-400">o hodine <input type="number" min="0" max="23" defaultValue={nast.cas_sumaru} onBlur={(e) => ulozNast({ cas_sumaru: Math.min(23, Math.max(0, Number(e.target.value) || 18)) })} className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" /> (slovenský čas)</label>
              <span className="text-slate-500">Posiela sa len keď pribudli súbory, alebo keď sa agent dlhšie neozval.</span>
            </div>
            <div>
              <span className={labelCls}>Príjemcovia</span>
              <div className="flex flex-wrap gap-1.5 mb-2">{(nast.prijemcovia || []).length === 0 && <span className="text-slate-500">Zatiaľ žiadne adresy.</span>}{(nast.prijemcovia || []).map((e) => (
                <span key={e} className="bg-slate-800 text-slate-200 rounded-full pl-3 pr-1.5 py-1 flex items-center gap-1">{e}<button onClick={() => ulozNast({ prijemcovia: nast.prijemcovia.filter((x) => x !== e) })} className="text-slate-400 hover:text-rose-400"><X className="w-3 h-3" /></button></span>))}</div>
              <div className="flex gap-2"><input value={novyPrijemca} onChange={(e) => setNovyPrijemca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pridajPrijemcu()} placeholder="meno@firma.sk" className={`${inputCls} max-w-xs`} /><button onClick={pridajPrijemcu} className="px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              <div><label className={labelCls}>Meno odosielateľa</label><input defaultValue={nast.odosielatel_meno || ''} onBlur={(e) => ulozNast({ odosielatel_meno: e.target.value.trim() || null })} placeholder="Laser PBT" className={inputCls} /></div>
              <div><label className={labelCls}>E-mail odosielateľa (musí byť na overenej Resend doméne)</label><input defaultValue={nast.odosielatel_email || ''} onBlur={(e) => ulozNast({ odosielatel_email: e.target.value.trim() || null })} placeholder="laser@vasadomena.sk" className={inputCls} /></div>
            </div>
            <p className="text-[11px] text-slate-500">Prázdny odosielateľ = použije sa odosielateľ z automatických upomienok (Resend).</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={nahladSumaru} disabled={posiela} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"><Eye className="w-3.5 h-3.5" /> Náhľad súhrnu za {skDatum(doD)}</button>
              <button onClick={posliTeraz} disabled={posiela} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"><Mail className="w-3.5 h-3.5" /> Poslať súhrn teraz</button>
            </div>
            {nahlad && <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-300 whitespace-pre-wrap text-[11px] max-h-96 overflow-y-auto">{nahlad}</pre>}
          </div>

          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">Slovník farieb a materiálov (na rozpoznanie názvu súboru)</h3>
            <p className="text-slate-400">Z názvu typu <code className="text-slate-300">1171 sk zahradne ten 691 z cierne garzato XXL 2X.dxf</code> sa číslo zákazky berie zo začiatku, veľkosť a počet z konca a farba s materiálom podľa tohto slovníka. Čo v slovníku nie je, zostane nerozpoznané — doplň to sem, alebo to oprav priamo v riadku.</p>
            {['farba', 'material'].map((typ) => (
              <div key={typ}><span className={labelCls}>{typ === 'farba' ? 'Farby' : 'Materiály'}</span>
                <div className="flex flex-wrap gap-1.5">{slovnik.filter((s) => s.typ === typ).map((s) => <span key={s.id} className="bg-slate-800 text-slate-200 rounded-full pl-3 pr-1.5 py-1 flex items-center gap-1">{s.hodnota}<button onClick={() => zmazSlovnik(s.id)} className="text-slate-400 hover:text-rose-400"><X className="w-3 h-3" /></button></span>)}</div></div>
            ))}
            <div className="flex gap-2 items-center"><select value={novySlovnik.typ} onChange={(e) => setNovySlovnik({ ...novySlovnik, typ: e.target.value })} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white"><option value="farba">Farba</option><option value="material">Materiál</option></select>
              <input value={novySlovnik.hodnota} onChange={(e) => setNovySlovnik({ ...novySlovnik, hodnota: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && pridajSlovnik()} placeholder="napr. antracit" className={`${inputCls} max-w-xs`} />
              <button onClick={pridajSlovnik} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
