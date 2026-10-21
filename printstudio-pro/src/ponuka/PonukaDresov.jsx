import React, { useEffect, useMemo, useRef, useState } from 'react';
import PbtHeader from '../PbtHeader';
import { spocitaj, normalizujVyber, maSklad, dostupnePolozky, importujRiadky, POLOZKY, STULP_HOKEJ, VELKOSTI } from './ponukaCalc';

// VEREJNÁ PONUKA DRESOV pre kluby, školy a reklamné agentúry (https://printstudio-pro.vercel.app/?typ=ponuka):
// zákazník si naklikne šport, typ výroby, strih, kvalitu, doplnky, súpisku a termín a hneď vidí cenu so zľavami. Dopyt sa uloží v ERP.
// Ceny (s DPH za kus) prichádzajú z Edge Function ponuka-dresy — výrobné ceny a marže sa sem nikdy nedostanú. Pri odoslaní dopytu sa cena
// prepočíta ešte raz na serveri.

const IKONY = {
  futbal: 'M15 3a12 12 0 1 0 0.01 0M15 9l5 3.5-2 6h-6l-2-6z', hokej: 'M6 4l9 17h9M21 21h4', hadzana: 'M15 3a12 12 0 1 0 0.01 0M5 10q10 4 20 0M5 20q10-4 20 0',
  volejbal: 'M15 3a12 12 0 1 0 0.01 0M15 3q-4 12 4 23M3 15q12-2 22 6', lacrosse: 'M5 25L19 11M17 5a5 5 0 1 0 8 6z', florbal: 'M8 3l6 18q1 4 5 4h6M24 12a2 2 0 1 0 0.01 0',
  motokros: 'M7 22a4 4 0 1 0 0.01 0M23 22a4 4 0 1 0 0.01 0M7 22l6-9h7l3 9M13 13l-2-4h-3',
};
const FITS = { klasik: { n: 'Klasický', d: 'voľný, pohodlný', w: 15 }, slim: { n: 'Slim fit', d: 'užší v páse', w: 12 }, obtiahnuty: { n: 'Obtiahnutý', d: 'atletický, priliehavý', w: 9.5 } };
const SLEEVES = { bez: { n: 'Bez rukávov', d: 'tielko' }, kratky: { n: 'Krátky', d: 'klasika' }, dlhy: { n: 'Dlhý', d: 'aj na chladné dni' } };
const COLLARS = { okruhly: { n: 'Okrúhly' }, v: { n: 'V-výstrih' }, polo: { n: 'Polo s gombíkmi' }, snur: { n: 'Šnurovací' } };
const TIERS = [
  { n: 'Základ', d: 'DryCool', pts: ['rýchloschnúci funkčný polyester', 'na tréning a rekreačný šport'] },
  { n: 'Premium', d: 'ELCool', pts: ['jemnejší materiál, lepší odvod potu', 'pre súťažné tímy'] },
  { n: 'Pro', d: 'ELCool Pro', pts: ['vetracie zóny, zosilnené švy', 'pre profesionálov'] },
];
const PRINTS = { meno: { n: 'Meno', d: 'na chrbát' }, cislo: { n: 'Číslo', d: 'chrbát a hruď' }, logo: { n: 'Logo klubu', d: 'na hruď' }, cisloTren: { n: 'Číslo na trenírky', d: 'na nohavicu' } };
const APPS = { logo3d: { n: '3D logo', d: 'vystúpené silikónové logo' }, flexRefl: { n: 'Reflexný flex', d: 'svieti pri osvetlení' }, flexMetal: { n: 'Metalický flex', d: 'zlatý alebo strieborný' }, flexGlitter: { n: 'Glitter flex', d: 'trblietavý efekt' } };
const MODES = {
  stock: { n: 'Zo skladu + dotlač', d: 'Hotové ušité dresy, dotlačíme meno, číslo a logo.', pts: ['najlacnejšie a najrýchlejšie', 'jednofarebné skladové farby'] },
  custom: { n: 'Zákazková celopotlač', d: 'Celý dres vo vašom dizajne, sublimáciou.', pts: ['ľubovoľné farby, vzory a logá', 'výber strihu, goliera a materiálu'] },
};
const eur = (v) => `${(Number(v) || 0).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const znamienko = (p) => (p > 0 ? `+${eur(p)}` : p < 0 ? `−${eur(-p)}` : 'bez príplatku');
const tricko = (w) => `M22 8 L12 12 L4 22 L10 27 L15 22 L${30 - w} 54 L${30 + w} 54 L45 22 L50 27 L56 22 L48 12 L38 8 Q30 14 22 8Z`;

const SIvyber = { sport: 'futbal', mode: 'custom', comps: { dres: true, trenirky: true, stulpne: false }, nn: true, prints: { meno: true, cislo: true, logo: true, cisloTren: false },
  fit: 'klasik', sleeve: 'kratky', collar: 'okruhly', tier: 1, stulpVer: 1, apps: {}, gkElbow: false, gkHip: false, pmode: 'count', players: 18, gk: 2, del: 'std', b2b: null };

function Tile({ aktivna, disabled, onClick, children, className = '' }) {
  return (
    <button type="button" aria-pressed={aktivna} disabled={disabled} onClick={onClick}
      className={`relative text-left rounded-lg border p-3 transition min-w-0 ${aktivna ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:border-blue-400'} ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {children}
    </button>
  );
}
const T = ({ children, big }) => <span className={`block font-extrabold uppercase leading-tight text-slate-900 ${big ? 'text-xl' : 'text-lg'}`} style={{ fontFamily: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif' }}>{children}</span>;
const D = ({ children }) => <span className="block text-[13px] text-slate-500 mt-0.5">{children}</span>;
const P = ({ children }) => <span className="block text-sm font-bold text-blue-700 mt-1">{children}</span>;

function Krok({ cislo, nadpis, vpravo, children }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 flex-wrap text-2xl sm:text-3xl font-extrabold uppercase text-slate-900" style={{ fontFamily: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif' }}>
        <span className="text-sm font-bold bg-blue-700 text-white rounded px-2 py-px -translate-y-1 inline-block">{cislo}</span>{nadpis}
        {vpravo && <span className="ml-auto text-sm font-semibold normal-case">{vpravo}</span>}
      </h2>
      {children}
    </section>
  );
}

export default function PonukaDresov({ supabase }) {
  const [cfg, setCfg] = useState(null);
  const [chyba, setChyba] = useState('');
  const [S, setS] = useState(SIvyber);
  const [roster, setRoster] = useState([]);
  const [b2bKod, setB2bKod] = useState('');
  const [b2bInfo, setB2bInfo] = useState(null);
  const [b2bMsg, setB2bMsg] = useState('');
  const [rmsg, setRmsg] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [tabulka, setTabulka] = useState(false);
  const [kontakt, setKontakt] = useState({ klub: '', kto: '', telefon: '', email: '', poznamka: '', hp: '' });
  const [odosiela, setOdosiela] = useState(false);
  const [chybaOdoslania, setChybaOdoslania] = useState('');
  const [hotovo, setHotovo] = useState(null);
  const dopytRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setChyba('Supabase klient nie je nakonfigurovaný.'); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke('ponuka-dresy', { body: { akcia: 'cennik' } });
      if (error || !data?.ok) { setChyba(data?.error || 'Ponuku sa nepodarilo načítať (je funkcia ponuka-dresy nasadená v Supabase?).'); return; }
      setCfg(data.cennik);
      const prvy = data.cennik.poradie?.[0];
      if (prvy) setS((p) => normalizujVyber(data.cennik, { ...p, sport: p.sport in data.cennik.sporty ? p.sport : prvy }));
    })();
  }, [supabase]);

  const V = useMemo(() => (cfg ? normalizujVyber(cfg, { ...S, comps: { ...S.comps }, apps: { ...S.apps } }) : S), [cfg, S]);
  const sp = cfg?.sporty?.[V.sport];
  const r = useMemo(() => (cfg && sp ? spocitaj(cfg, { ...V, b2b: b2bInfo }, roster) : null), [cfg, sp, V, roster, b2bInfo]);

  if (chyba) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chyba}</div>;
  if (!cfg || !r) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam ponuku…</div>;
  if (cfg.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Ponuka dresov je dočasne vypnutá.</div>;

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const stock = V.mode === 'stock';
  const av = dostupnePolozky(cfg, V);
  const src = stock ? cfg.stock[V.sport] : cfg.items[V.sport];
  const pole = r.show;
  const delText = (id) => cfg.terminy[id]?.[V.mode === 'stock' ? 'sklad' : 'custom'] || '';

  const overKod = async () => {
    const kod = b2bKod.trim().toUpperCase(); setB2bMsg('');
    if (!kod) return;
    const { data } = await supabase.functions.invoke('ponuka-dresy', { body: { akcia: 'b2b', kod } });
    if (!data?.platny) { setB2bMsg('Tento kód nepoznáme. Skontrolujte ho alebo nám napíšte.'); return; }
    setB2bInfo({ p: Number(data.zlavaPercent) || 0, n: data.agentura || 'B2B', kod });
  };

  const nahrajSubor = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
      const nove = importujRiadky(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }));
      setRoster((p) => p.filter((x) => x.m || x.c).concat(nove)); setRmsg(`Načítaných ${nove.length} hráčov.`);
    } catch { setRmsg('Súbor sa nepodarilo prečítať. Skúste .xlsx alebo .csv so stĺpcami Meno, Číslo, Veľkosť.'); }
  };
  const vlozText = () => {
    const nove = importujRiadky(pasteText.split(/\r?\n/).map((l) => l.split(/\t|;|,/)));
    setRoster((p) => p.filter((x) => x.m || x.c).concat(nove)); setRmsg(`Načítaných ${nove.length} hráčov.`); setPasteText(''); setPasteOpen(false);
  };
  const upravRiadok = (i, patch) => setRoster((p) => p.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const pocetVelkosti = {}; roster.forEach((x) => { pocetVelkosti[x.s] = (pocetVelkosti[x.s] || 0) + 1; });

  const odoslat = async (e) => {
    e.preventDefault();
    setOdosiela(true); setChybaOdoslania('');
    const vyber = { ...V, b2b: undefined };
    const { data, error } = await supabase.functions.invoke('ponuka-dresy', {
      body: { akcia: 'dopyt', vyber, supiska: S.pmode === 'roster' ? roster.filter((x) => x.m || x.c) : [], kontakt, b2bKod: b2bInfo?.kod || '', hp: kontakt.hp },
    });
    setOdosiela(false);
    if (error || !data?.ok) { setChybaOdoslania(data?.error || 'Dopyt sa nepodarilo odoslať. Skúste to prosím znova alebo nám napíšte e-mail.'); return; }
    setHotovo(data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const popis = [sp.n, stock ? 'sklad + dotlač' : 'celopotlač', r.chosen.map((k) => POLOZKY[k]).join(' + ')];
  if (!stock) { popis.push(TIERS[V.tier].n, FITS[V.fit].n.toLowerCase() + ' strih'); if (sp.rukavy.length > 1) popis.push(SLEEVES[V.sleeve].n.toLowerCase() + ' rukáv'); if (sp.goliere.length > 1) popis.push('golier ' + COLLARS[V.collar].n.toLowerCase()); }
  const ap = Object.keys(APPS).filter((k) => V.apps[k]).map((k) => APPS[k].n); if (ap.length) popis.push(ap.join(', '));

  if (hotovo) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PbtHeader title="Ponuka pre kluby" subtitle="Dresy pre váš tím" />
        <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-3xl font-extrabold uppercase text-slate-900" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>Dopyt sme prijali</h2>
          <p className="text-slate-600">Číslo dopytu: <strong className="font-mono">{hotovo.cislo}</strong></p>
          <p className="text-slate-600">Orientačná cena: <strong>{eur(b2bInfo ? hotovo.celkomBezDph : hotovo.celkomSDph)} {b2bInfo ? 'bez DPH' : 's DPH'}</strong>. Presnú ponuku vám pošleme do 1 pracovného dňa.</p>
          {hotovo.email && <p className="text-sm text-slate-500">Potvrdenie sme poslali na váš e-mail.</p>}
          <button onClick={() => { setHotovo(null); }} className="mt-4 px-5 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold">Upraviť konfiguráciu</button>
        </div>
      </div>
    );
  }

  let cisloKroku = 0;
  const k = () => ++cisloKroku;

  return (
    <div className="bg-slate-100 text-slate-800 min-h-screen" style={{ fontFamily: 'Barlow, system-ui, sans-serif' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap" />
      <PbtHeader title="Ponuka pre kluby" subtitle="Dresy pre váš tím" />
      <div className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
          <div className="text-xs font-bold tracking-[0.14em] uppercase text-blue-300">Ponuka pre kluby, školy a agentúry</div>
          <h1 className="text-4xl sm:text-6xl font-extrabold uppercase leading-none mt-2" style={{ fontFamily: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif' }}>Dresy pre váš tím, <span className="text-blue-400">cena hneď</span></h1>
          <p className="mt-3 text-slate-300 max-w-2xl">Vyberte šport, typ výroby, strih a kvalitu, nahrajte súpisku a hneď uvidíte cenu aj so zľavami. Dizajn s vašimi farbami a logom pripravíme my.</p>
        </div>
      </div>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4">
          {[['Od 1 kusu', 'Bez minimálneho odberu, doobjednanie kedykoľvek'], ['Grafika zadarmo', 'Návrh dizajnu podľa vašich farieb a loga'], ['Zo skladu rýchlo', 'Hotové dresy s dotlačou už do 7 dní'], ['SK · CZ · AT', 'Výroba na Slovensku, doručenie do troch krajín']].map(([a, b]) => (
            <div key={a} className="p-4 border-r border-slate-200 last:border-r-0"><b className="block text-xl font-extrabold uppercase text-blue-700 leading-tight" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>{a}</b><span className="text-sm text-slate-500">{b}</span></div>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-8 items-start pb-28 lg:pb-12">
        <div className="space-y-10 min-w-0">
          <Krok cislo={k()} nadpis="Šport">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cfg.poradie.map((kod) => {
                const s = cfg.sporty[kod];
                return (
                  <Tile key={kod} aktivna={kod === V.sport} onClick={() => set({ sport: kod })}>
                    <svg viewBox="0 0 30 30" className="w-8 h-8 mb-1.5 stroke-blue-700 fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={IKONY[kod] || 'M15 3a12 12 0 1 0 0.01 0'} /></svg>
                    <T big>{s.n}</T><P>{maSklad(cfg, kod) ? 'zo skladu od ' + eur(cfg.stock[kod].dres || 0) : 'dres od ' + eur(cfg.items[kod].dres?.[0] || 0)}</P>
                  </Tile>
                );
              })}
            </div>
          </Krok>

          <Krok cislo={k()} nadpis="Typ výroby">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {['stock', 'custom'].map((m) => {
                const ok = m === 'custom' || maSklad(cfg, V.sport);
                const cena = m === 'stock' ? (ok ? 'dres od ' + eur((cfg.stock[V.sport].dres || 0) + (cfg.dotlac.meno || 0) + (cfg.dotlac.cislo || 0)) : 'pre tento šport nie je skladom') : 'dres od ' + eur(cfg.items[V.sport].dres?.[0] || 0);
                return (
                  <Tile key={m} aktivna={m === V.mode} disabled={!ok} onClick={() => set({ mode: m })}>
                    {m === 'stock' && ok && <span className="absolute top-2.5 right-2.5 text-[11px] font-bold uppercase tracking-wide bg-emerald-600 text-white rounded px-1.5">najrýchlejšie</span>}
                    <T big>{MODES[m].n}</T><D>{MODES[m].d}{m === 'stock' && sp.skladPoznamka && ok ? ` Pri tomto športe ${sp.skladPoznamka}.` : ''}</D>
                    <ul className="mt-1.5 pl-4 list-disc text-[13px] text-slate-500">{MODES[m].pts.map((x) => <li key={x}>{x}</li>)}</ul><P>{cena}</P>
                  </Tile>
                );
              })}
            </div>
          </Krok>

          <Krok cislo={k()} nadpis="Čo potrebujete">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {av.map((kk) => (
                <label key={kk} className={`flex gap-3 items-start rounded-lg border p-3 cursor-pointer ${V.comps[kk] ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" className="w-[18px] h-[18px] mt-1 accent-blue-700" checked={!!V.comps[kk]} onChange={(e) => set({ comps: { ...V.comps, [kk]: e.target.checked } })} />
                  <span className="min-w-0">
                    <T>{POLOZKY[kk]}{stock ? ' zo skladu' : ''}</T>
                    {stock ? <D>{eur(src[kk])} / ks</D> : kk === 'stulpne' && V.sport === 'hokej' ? (
                      <select value={V.stulpVer} onClick={(e) => e.stopPropagation()} onChange={(e) => set({ stulpVer: Number(e.target.value) })} className="mt-1.5 border border-slate-300 rounded px-2 py-1 text-sm bg-white">
                        {STULP_HOKEJ.map((nn, i) => <option key={nn} value={i}>{nn} · {eur(src.stulpne[i])}</option>)}
                      </select>
                    ) : <D>{eur(src[kk][V.tier])} / ks</D>}
                  </span>
                </label>
              ))}
            </div>
            {!stock && <label className="flex gap-2 items-center cursor-pointer mt-2 text-sm"><input type="checkbox" className="w-[18px] h-[18px] accent-blue-700" checked={V.nn} onChange={(e) => set({ nn: e.target.checked })} /> Meno a číslo hráča na dres <span className="text-slate-500 text-[13px]">(+{eur(cfg.nameNum)}/ks)</span></label>}
            {r.gkOn && (
              <div className="mt-3 border border-dashed border-slate-300 rounded-lg p-3.5 bg-white">
                <h3 className="text-xl font-bold uppercase" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>Brankári</h3>
                <p className="text-[13px] text-slate-500">Brankársky strih +{eur(cfg.gk.cut)}/ks{sp.brankari === 'futbal' ? ', vždy s dlhým rukávom.' : '.'} Počet brankárov zadáte v kroku Hráči.</p>
                {sp.brankari === 'futbal' && <label className="flex gap-2 items-center cursor-pointer mt-2 text-sm"><input type="checkbox" className="w-[18px] h-[18px] accent-blue-700" checked={V.gkElbow} onChange={(e) => set({ gkElbow: e.target.checked })} /> Spevnené lakte molitanom na drese <span className="text-slate-500 text-[13px]">(+{eur(cfg.gk.lakte)}/ks)</span></label>}
                {sp.brankari === 'futbal' && av.includes('trenirky') && <label className="flex gap-2 items-center cursor-pointer mt-2 text-sm"><input type="checkbox" className="w-[18px] h-[18px] accent-blue-700" checked={V.gkHip} onChange={(e) => set({ gkHip: e.target.checked })} /> Spevnené boky molitanom na trenírkach <span className="text-slate-500 text-[13px]">(+{eur(cfg.gk.boky)}/ks)</span></label>}
              </div>
            )}
          </Krok>

          <Krok cislo={k()} nadpis="Strih" vpravo={<button type="button" onClick={() => setTabulka(true)} className="text-blue-700 underline underline-offset-2">Rozmerová tabuľka</button>}>
            {stock ? <p className="text-sm text-slate-500">Skladové dresy majú klasický voľný strih. Veľkosť si overte v rozmerovej tabuľke.</p> : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(FITS).map(([kk, f]) => (
                    <Tile key={kk} aktivna={kk === V.fit} onClick={() => set({ fit: kk })}>
                      <svg viewBox="0 0 60 60" className={`w-12 h-12 mb-1 stroke-blue-700 ${kk === V.fit ? 'fill-blue-700' : 'fill-blue-100'}`} strokeWidth="1.6" strokeLinejoin="round"><path d={tricko(f.w)} /></svg>
                      <T>{f.n}</T><D>{f.d}</D><P>{znamienko(cfg.fit[kk] || 0)}</P>
                    </Tile>
                  ))}
                </div>
                {sp.rukavy.length > 1 && <><div className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-4">Rukáv</div><div className="grid grid-cols-3 gap-2">{sp.rukavy.map((kk) => <Tile key={kk} aktivna={kk === V.sleeve} onClick={() => set({ sleeve: kk })}><T>{SLEEVES[kk].n}</T><D>{SLEEVES[kk].d}</D><P>{znamienko(cfg.sleeve[kk] || 0)}</P></Tile>)}</div></>}
                {sp.goliere.length > 1 && <><div className="text-sm font-bold uppercase tracking-wider text-slate-500 mt-4">Golier</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{sp.goliere.map((kk) => <Tile key={kk} aktivna={kk === V.collar} onClick={() => set({ collar: kk })}><T>{COLLARS[kk].n}</T><P>{znamienko(cfg.collar[kk] || 0)}</P></Tile>)}</div></>}
              </>
            )}
          </Krok>

          {!stock && (
            <Krok cislo={k()} nadpis="Vyhotovenie">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TIERS.map((t, i) => (
                  <Tile key={t.n} aktivna={i === V.tier} onClick={() => set({ tier: i })}>
                    <T big>{t.n}</T><D>{t.d}</D><ul className="mt-1.5 pl-4 list-disc text-[13px] text-slate-500">{t.pts.map((x) => <li key={x}>{x}</li>)}</ul><P>dres {eur(cfg.items[V.sport].dres?.[i] || 0)}</P>
                  </Tile>
                ))}
              </div>
            </Krok>
          )}

          {stock && (
            <Krok cislo={k()} nadpis="Dotlač">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.keys(PRINTS).filter((kk) => kk !== 'cisloTren' || av.includes('trenirky')).map((kk) => (
                  <label key={kk} className={`flex gap-3 items-start rounded-lg border p-3 cursor-pointer ${V.prints[kk] ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <input type="checkbox" className="w-[18px] h-[18px] mt-1 accent-blue-700" checked={!!V.prints[kk]} onChange={(e) => set({ prints: { ...V.prints, [kk]: e.target.checked } })} />
                    <span><T>{PRINTS[kk].n}</T><D>{PRINTS[kk].d} · +{eur(cfg.dotlac[kk] || 0)}/ks</D></span>
                  </label>
                ))}
              </div>
            </Krok>
          )}

          <Krok cislo={k()} nadpis="Doplnkové aplikácie">
            <p className="text-sm text-slate-500">Voliteľné efekty na dres, cena za kus.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.keys(APPS).filter((kk) => kk in cfg.apps).map((kk) => (
                <label key={kk} className={`flex gap-3 items-start rounded-lg border p-3 cursor-pointer ${V.apps[kk] ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" className="w-[18px] h-[18px] mt-1 accent-blue-700" checked={!!V.apps[kk]} onChange={(e) => set({ apps: { ...V.apps, [kk]: e.target.checked } })} />
                  <span><T>{APPS[kk].n}</T><D>{APPS[kk].d} · +{eur(cfg.apps[kk])}/ks</D></span>
                </label>
              ))}
            </div>
          </Krok>

          <Krok cislo={k()} nadpis="Hráči">
            <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden mb-3">
              {[['count', 'Zadám počet'], ['roster', 'Súpiska']].map(([m, n]) => <button key={m} type="button" onClick={() => { set({ pmode: m }); if (m === 'roster' && !roster.length) setRoster([{ m: '', c: '', s: 'M', g: false }]); }} className={`px-4 py-2 text-[15px] font-semibold ${V.pmode === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>{n}</button>)}
            </div>
            {V.pmode === 'count' ? (
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" aria-label="Menej" onClick={() => set({ players: Math.max(1, (V.players || 1) - 1) })} className="w-11 h-11 text-2xl font-bold border border-slate-300 bg-white rounded-lg">−</button>
                  <input type="number" min="1" inputMode="numeric" value={V.players} onChange={(e) => set({ players: Math.max(0, parseInt(e.target.value, 10) || 0) })} aria-label="Počet hráčov" className="w-24 text-center text-3xl font-extrabold border border-slate-300 rounded-lg py-1" />
                  <button type="button" aria-label="Viac" onClick={() => set({ players: (V.players || 0) + 1 })} className="w-11 h-11 text-2xl font-bold border border-slate-300 bg-white rounded-lg">+</button>
                  <span className="text-sm text-slate-500">hráčov</span>
                  {r.gkOn && <span className="flex items-center gap-2 ml-2"><span className="text-sm text-slate-500">z toho brankári</span><input type="number" min="0" inputMode="numeric" value={V.gk} onChange={(e) => set({ gk: Math.max(0, parseInt(e.target.value, 10) || 0) })} aria-label="Počet brankárov" className="w-[70px] text-center text-xl font-bold border border-slate-300 rounded-lg py-1" /></span>}
                </div>
                <p className="text-sm text-slate-500 mt-2">Mená, čísla a veľkosti môžete doplniť neskôr, alebo rovno v záložke Súpiska.</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200"><th className="p-2">#</th><th className="p-2">Meno na dres</th><th className="p-2">Číslo</th><th className="p-2">Veľkosť</th>{r.gkOn && <th className="p-2">Brankár</th>}<th /></tr></thead>
                    <tbody>
                      {roster.map((x, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="p-1.5 text-right text-slate-400 w-10">{i + 1}</td>
                          <td className="p-1"><input type="text" value={x.m} placeholder="NOVÁK" aria-label={`Meno hráča ${i + 1}`} onChange={(e) => upravRiadok(i, { m: e.target.value })} className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300" /></td>
                          <td className="p-1 w-20"><input type="text" inputMode="numeric" value={x.c} placeholder="10" aria-label={`Číslo hráča ${i + 1}`} onChange={(e) => upravRiadok(i, { c: e.target.value })} className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300" /></td>
                          <td className="p-1 w-24"><select value={x.s} aria-label={`Veľkosť hráča ${i + 1}`} onChange={(e) => upravRiadok(i, { s: e.target.value })} className="w-full px-1 py-1.5 rounded border border-transparent hover:border-slate-300 bg-transparent">{VELKOSTI.map((v) => <option key={v}>{v}</option>)}</select></td>
                          {r.gkOn && <td className="p-1 text-center w-16"><input type="checkbox" className="w-[18px] h-[18px] accent-blue-700" checked={x.g} aria-label={`Hráč ${i + 1} je brankár`} onChange={(e) => upravRiadok(i, { g: e.target.checked })} /></td>}
                          <td className="p-1 w-10"><button type="button" aria-label={`Odstrániť hráča ${i + 1}`} onClick={() => setRoster((p) => p.filter((_, k2) => k2 !== i))} className="w-8 h-8 text-lg text-slate-400 hover:text-rose-600">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <button type="button" onClick={() => setRoster((p) => [...p, { m: '', c: '', s: 'M', g: false }])} className="px-3.5 py-2 text-[15px] font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600">+ Hráč</button>
                  <label className="relative overflow-hidden px-3.5 py-2 text-[15px] font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600 cursor-pointer">Nahrať Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={nahrajSubor} className="absolute inset-0 opacity-0 cursor-pointer" /></label>
                  <button type="button" onClick={() => setPasteOpen((v) => !v)} className="px-3.5 py-2 text-[15px] font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600">Vložiť z Excelu</button>
                </div>
                {pasteOpen && <div className="mt-2.5"><textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Skopírujte stĺpce Meno, Číslo, Veľkosť z Excelu a vložte sem" className="w-full min-h-[76px] border border-slate-300 rounded-lg p-2.5" /><button type="button" onClick={vlozText} className="mt-1.5 px-3.5 py-2 text-[15px] font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600">Načítať</button></div>}
                {rmsg && <div className="text-sm text-emerald-700 mt-2">{rmsg}</div>}
                <div className="flex flex-wrap gap-1.5 mt-2.5">{VELKOSTI.filter((v) => pocetVelkosti[v]).map((v) => <span key={v} className="text-[13px] font-semibold bg-blue-100 rounded px-2 py-0.5">{v} × {pocetVelkosti[v]}</span>)}</div>
              </div>
            )}
          </Krok>

          <Krok cislo={k()} nadpis="Termín dodania">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.keys(cfg.terminy).map((id) => {
                const p = cfg.delivery[id] || 0;
                return <Tile key={id} aktivna={id === V.del} onClick={() => set({ del: id })}><T>{cfg.terminy[id].n}</T><D>{delText(id)}</D><P>{p < 0 ? `zľava ${-p} %` : p > 0 ? `príplatok +${p} %` : 'bez príplatku'}</P></Tile>;
              })}
            </div>
          </Krok>

          <Krok cislo={k()} nadpis="Odoslať dopyt">
            <div ref={dopytRef} id="dopyt" />
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">B2B kód pre reklamné agentúry</div>
            {b2bInfo ? (
              <div className="font-semibold text-emerald-700">✓ {b2bInfo.n}: zľava {b2bInfo.p} %, ceny zobrazujeme bez DPH <button type="button" onClick={() => { setB2bInfo(null); setB2bKod(''); }} className="ml-2 text-blue-700 underline text-sm font-medium">Zrušiť kód</button></div>
            ) : (
              <div className="flex gap-2 max-w-md"><input type="text" value={b2bKod} onChange={(e) => setB2bKod(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); overKod(); } }} placeholder="napr. AGENTURA…" aria-label="B2B kód" autoComplete="off" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 uppercase tracking-wider" /><button type="button" onClick={overKod} className="px-3.5 py-2 text-[15px] font-semibold bg-white border border-slate-300 rounded-lg hover:border-blue-600">Použiť</button></div>
            )}
            {b2bMsg && <div className="text-sm text-amber-700">{b2bMsg}</div>}
            <form onSubmit={odoslat} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Klub / škola / firma<input type="text" value={kontakt.klub} onChange={(e) => setKontakt({ ...kontakt, klub: e.target.value })} placeholder="napr. FK Michalovce U15" className="border border-slate-300 rounded-lg px-3 py-2 text-base normal-case tracking-normal font-normal text-slate-800" /></label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Meno kontaktnej osoby<input type="text" value={kontakt.kto} onChange={(e) => setKontakt({ ...kontakt, kto: e.target.value })} placeholder="Ján Novák" className="border border-slate-300 rounded-lg px-3 py-2 text-base normal-case tracking-normal font-normal text-slate-800" /></label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">E-mail *<input type="email" required value={kontakt.email} onChange={(e) => setKontakt({ ...kontakt, email: e.target.value })} placeholder="jan@klub.sk" className="border border-slate-300 rounded-lg px-3 py-2 text-base normal-case tracking-normal font-normal text-slate-800" /></label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Telefón<input type="tel" value={kontakt.telefon} onChange={(e) => setKontakt({ ...kontakt, telefon: e.target.value })} placeholder="0905 …" className="border border-slate-300 rounded-lg px-3 py-2 text-base normal-case tracking-normal font-normal text-slate-800" /></label>
              <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Farby, logo, termín, poznámky<textarea value={kontakt.poznamka} onChange={(e) => setKontakt({ ...kontakt, poznamka: e.target.value })} placeholder="Modro-biele, logo pošleme mailom, turnaj máme 15. marca." className="min-h-[76px] border border-slate-300 rounded-lg px-3 py-2 text-base normal-case tracking-normal font-normal text-slate-800" /></label>
              <input type="text" tabIndex={-1} autoComplete="off" value={kontakt.hp} onChange={(e) => setKontakt({ ...kontakt, hp: e.target.value })} aria-hidden="true" className="hidden" />
              <div className="sm:col-span-2">
                {chybaOdoslania && <p className="text-sm text-rose-600 mb-2">{chybaOdoslania}</p>}
                <button type="submit" disabled={odosiela || r.players < 1} className="px-6 py-3.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-45 text-white text-lg font-extrabold uppercase tracking-wider" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>{odosiela ? 'Odosielam…' : 'Odoslať dopyt'}</button>
                <p className="text-xs text-slate-500 mt-2">Odoslaním dopytu sa nezaväzujete k objednávke. Presnú ponuku pošleme do 1 pracovného dňa.</p>
              </div>
            </form>
          </Krok>
        </div>

        <aside className="lg:sticky lg:top-20 bg-slate-900 text-white rounded-xl p-5" aria-live="polite">
          <div className="text-xs font-bold tracking-[0.14em] uppercase text-slate-400">{b2bInfo ? 'Orientačná cena bez DPH' : 'Orientačná cena s DPH'}</div>
          <div className="text-5xl font-extrabold leading-none my-1.5" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>{eur(pole(r.total))}</div>
          <div className="text-sm text-slate-400">{r.players ? `${eur(pole(r.total) / r.players)} na hráča` : 'Zadajte počet hráčov'}</div>
          <div className="flex gap-1 my-3.5">
            {r.volume.map((t, i) => { const nx = r.volume[i + 1]; return <div key={t.min} className={`flex-1 text-center text-[11px] py-1.5 rounded ${t === r.vt ? 'bg-blue-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}><b className={`block text-base ${t === r.vt ? 'text-slate-900' : 'text-white'}`}>−{t.p} %</b>{nx ? `${t.min}–${nx.min - 1}` : `${t.min}+`} ks</div>; })}
          </div>
          {[['Hráči × kusy', `${r.players}${r.gk ? ` (${r.gk} brank.)` : ''} × ${r.chosen.length} = ${r.pcs} ks`], ['Cena bez zliav', eur(pole(r.gross))], ['Množstevná zľava', r.vol ? `− ${eur(pole(r.vol))} (${r.vt.p} %)` : '0 €']].map(([a, b]) => (
            <div key={a} className="flex justify-between gap-2 text-[15px] py-1.5 border-b border-slate-700"><span className="text-slate-400">{a}</span><span className={a === 'Množstevná zľava' && r.vol ? 'text-emerald-300' : ''}>{b}</span></div>
          ))}
          {b2bInfo && <div className="flex justify-between gap-2 text-[15px] py-1.5 border-b border-slate-700"><span className="text-slate-400">B2B zľava</span><span className="text-emerald-300">− {eur(pole(r.b2bAmt))} ({b2bInfo.p} %)</span></div>}
          <div className="flex justify-between gap-2 text-[15px] py-1.5 border-b border-slate-700"><span className="text-slate-400">Termín · {cfg.terminy[V.del]?.n}</span><span>{r.delAmt ? <span className={r.delAmt < 0 ? 'text-emerald-300' : 'text-orange-300'}>{r.delAmt < 0 ? '− ' : '+ '}{eur(Math.abs(pole(r.delAmt)))}</span> : delText(V.del)}</span></div>
          {r.capped && <p className="text-[12px] text-amber-300 py-1.5">Celková zľava je obmedzená na {cfg.maxZlavaPercent} %.</p>}
          {b2bInfo && <div className="flex justify-between gap-2 text-[15px] py-1.5"><span className="text-slate-400">S DPH</span><span>{eur(r.total)}</span></div>}
          <p className="text-[13px] text-slate-400 mt-2.5 leading-snug">{popis.join(' · ')}</p>
          <a href="#dopyt" onClick={(e) => { e.preventDefault(); dopytRef.current?.scrollIntoView({ behavior: 'smooth' }); }} className="block mt-4 text-center bg-blue-400 hover:bg-blue-300 text-slate-900 font-extrabold uppercase tracking-wider py-3 rounded-lg text-lg" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>Odoslať dopyt</a>
        </aside>
      </main>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900 text-white flex items-center justify-between gap-3 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,.18)]">
        <div><small className="block text-slate-400 text-xs">{r.players} hráčov · {r.pcs} ks{r.vt.p ? ` · −${r.vt.p} %` : ''}{b2bInfo ? ' · bez DPH' : ''}</small><b className="text-3xl font-extrabold leading-none" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>{eur(pole(r.total))}</b></div>
        <a href="#dopyt" onClick={(e) => { e.preventDefault(); dopytRef.current?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-blue-400 text-slate-900 font-extrabold uppercase tracking-wider px-4 py-2.5 rounded-lg">Dopyt</a>
      </div>

      <footer className="border-t border-slate-200 py-6 text-sm text-slate-500"><div className="max-w-6xl mx-auto px-4">PBT · pbtprint.sk · Ceny sú orientačné{cfg.updated ? `, platné k ${cfg.updated.split('-').reverse().map(Number).join('. ')}` : ''}. Presnú ponuku pošleme do 1 pracovného dňa.</div></footer>

      {tabulka && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center overflow-y-auto p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) setTabulka(false); }}>
          <div className="bg-white rounded-xl max-w-3xl w-full p-5 relative">
            <button type="button" onClick={() => setTabulka(false)} aria-label="Zavrieť" className="absolute top-2.5 right-3 w-10 h-10 text-2xl text-slate-500">×</button>
            <h3 className="text-3xl font-extrabold uppercase" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>Rozmerová tabuľka</h3>
            <p className="text-sm text-slate-500 mt-1">Šírka hrudníka sa meria na položenom drese 2 cm pod podpazuším, z jedného boku na druhý. Dĺžka od najvyššieho bodu ramena po spodný okraj. Tolerancia ±2 cm.</p>
            <div className="grid grid-cols-3 gap-2.5 my-4">
              {Object.entries(FITS).map(([kk, f]) => <div key={kk} className={`border rounded-lg p-2.5 text-center ${!stock && kk === V.fit ? 'bg-blue-50 border-blue-400' : 'border-slate-200'}`}><svg viewBox="0 0 60 60" className="w-16 h-16 mx-auto fill-blue-100 stroke-blue-700" strokeWidth="1.4" strokeLinejoin="round"><path d={tricko(f.w)} /></svg><b className="block text-lg font-bold uppercase" style={{ fontFamily: '"Barlow Condensed", Arial, sans-serif' }}>{f.n}</b><span className="text-[13px] text-slate-500">{f.d}</span></div>)}
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm text-center">
                <thead><tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200"><th className="p-2 text-left">Veľkosť</th>{Object.entries(FITS).map(([kk, f]) => <th key={kk} className={`p-2 ${!stock && kk === V.fit ? 'bg-blue-50' : ''}`}>Hrudník {f.n.toLowerCase()}</th>)}<th className="p-2">Dĺžka</th></tr></thead>
                <tbody>{VELKOSTI.filter((v) => cfg.sizeChart[v]).map((v) => { const row = cfg.sizeChart[v]; return <tr key={v} className="border-b border-slate-100 last:border-0"><td className="p-2 text-left font-bold">{v}</td>{Object.keys(FITS).map((kk, i) => <td key={kk} className={`p-2 ${!stock && kk === V.fit ? 'bg-blue-50' : ''}`}>{row[i]} cm</td>)}<td className="p-2">{row[3]} cm</td></tr>; })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
