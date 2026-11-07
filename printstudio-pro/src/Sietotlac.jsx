import React, { useEffect, useRef, useState } from 'react';
import { Layers, Minus, Plus, Send, CheckCircle2, AlertTriangle, Moon, Sun } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { MnozstevneZlavy } from './cenaNahlad';

// Verejná appka „Sieťotlač“ (?typ=sietotlac): kalkulačka + dopyt (bez platby).
// Cenu počíta Edge Function sietotlac-dopyt z Kostry cien a maržového modulu; klient nikdy nevidí náklady.
const FUNKCIA = 'sietotlac-dopyt';
const RYCHLE_KS = [10, 30, 50, 100, 250];
const eur = (v) => `${Number(v).toFixed(2)} €`;

function Volba({ aktivna, onClick, children, podtext }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-3 rounded-xl border transition ${aktivna ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className={`text-sm font-semibold flex items-center gap-1.5 ${aktivna ? 'text-indigo-800' : 'text-slate-700'}`}>{children}</div>
      {podtext && <div className="text-xs text-slate-500 mt-0.5 leading-snug">{podtext}</div>}
    </button>
  );
}

function Sekcia({ cislo, nazov, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{cislo}</span>{nazov}
      </h2>
      {children}
    </section>
  );
}

// Tričko so zakreslenou veľkosťou motívu (tričko ≈ 50 cm široké, 70 cm vysoké) — len orientačný náhľad.
function TrickoNahlad({ sirka, vyska, tmavy, farby }) {
  const trikoFarba = tmavy ? '#1e293b' : '#f1f5f9';
  const okraj = tmavy ? '#475569' : '#cbd5e1';
  const w = Math.min(sirka, 46), h = Math.min(vyska, 62);
  const x = 50 - w / 2, y = 14;
  const motivFarba = farby.length ? farby : ['#6366f1'];
  return (
    <svg viewBox="0 0 100 80" className="w-full max-w-[220px] mx-auto" role="img" aria-label="Náhľad veľkosti potlače na tričku">
      <path d="M32 4 L18 10 L4 26 L14 34 L22 28 L22 76 L78 76 L78 28 L86 34 L96 26 L82 10 L68 4 Q50 16 32 4 Z" fill={trikoFarba} stroke={okraj} strokeWidth="1" />
      <rect x={x} y={y} width={w} height={h * 0.9} rx="1.5" fill="none" stroke="#6366f1" strokeWidth="0.8" strokeDasharray="2 1.5" />
      {motivFarba.map((c, i) => <rect key={i} x={x + 1 + (i * (w - 2)) / motivFarba.length} y={y + 1} width={(w - 2) / motivFarba.length} height={h * 0.9 - 2} fill={c} opacity="0.55" />)}
    </svg>
  );
}
const PALETA = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#475569', '#db2777'];

export default function Sietotlac({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [nast, setNast] = useState(null);
  const [efekty, setEfekty] = useState([]);

  const [material, setMaterial] = useState('bavlna');
  const [tmavy, setTmavy] = useState(false);
  const [dveVelkosti, setDveVelkosti] = useState(false);
  const [sirka, setSirka] = useState(30);
  const [vyska, setVyska] = useState(40);
  const [farby, setFarby] = useState(1);
  const [efekt, setEfekt] = useState('klasicka');
  const [pocetKs, setPocetKs] = useState(50);

  const [cena, setCena] = useState(null);
  const [chybaCeny, setChybaCeny] = useState('');
  const idDotazu = useRef(0);

  const [formOtvoreny, setFormOtvoreny] = useState(false);
  const [kontakt, setKontakt] = useState({ meno: '', email: '', telefon: '', poznamka: '' });
  const [hp, setHp] = useState('');
  const [odosielam, setOdosielam] = useState(false);
  const [chybaDopytu, setChybaDopytu] = useState('');
  const [hotovo, setHotovo] = useState(null);

  const volaj = async (body) => {
    const { data, error } = await supabase.functions.invoke(FUNKCIA, { body });
    if (error) throw new Error(`Spojenie so serverom zlyhalo (${error.message || 'chyba'}).`);
    if (!data?.ok) throw new Error(data?.error || 'Server nevrátil odpoveď.');
    return data;
  };

  useEffect(() => {
    if (!supabase) { setChybaNacitania('Supabase klient nie je nakonfigurovaný.'); setNacitava(false); return; }
    (async () => {
      try {
        const d = await volaj({ akcia: 'cennik' });
        setNast(d.nastavenia); setEfekty(d.efekty);
        setEfekt(d.efekty[0]?.kod || 'klasicka');
        setPocetKs((p) => Math.max(d.nastavenia.minKs, p));
        setSirka((s) => Math.min(s, d.nastavenia.maxSirkaCm)); setVyska((v) => Math.min(v, d.nastavenia.maxVyskaCm));
      } catch (e) { setChybaNacitania(e.message); }
      setNacitava(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const vyber = { material, tmavy, dveVelkosti, sirkaCm: sirka, vyskaCm: vyska, farby, efekt, pocetKs };
  const kluc = JSON.stringify(vyber);
  useEffect(() => {
    if (!nast || nast.aktivny === false) return undefined;
    const id = ++idDotazu.current;
    const t = setTimeout(async () => {
      try {
        const d = await volaj({ akcia: 'cena', ...vyber });
        if (id !== idDotazu.current) return;
        setChybaCeny(''); setCena(d.cena);
      } catch (e) {
        if (id !== idDotazu.current) return;
        setCena(null); setChybaCeny(e.message);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nast, kluc]);

  const odoslat = async (e) => {
    e.preventDefault();
    setOdosielam(true); setChybaDopytu('');
    try {
      const d = await volaj({ akcia: 'dopyt', vyber, kontakt, hp });
      setHotovo({ cislo: d.cislo, email: d.email });
    } catch (err) { setChybaDopytu(err.message); }
    setOdosielam(false);
  };

  if (nacitava) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (chybaNacitania) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chybaNacitania}</div>;
  if (nast?.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Kalkulačka sieťotlače je dočasne vypnutá.</div>;

  const efektObj = efekty.find((x) => x.kod === efekt);
  const farbyPaleta = PALETA.slice(0, farby);
  const pole = 'w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium bg-white';

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Sieťotlač" subtitle="Kalkulačka a dopyt na potlač tričiek" />
      {nast?.infoText && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{nast.infoText}</p>}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <Sekcia cislo="1" nazov="Textil">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Materiál</label>
                <div className="grid grid-cols-2 gap-2">
                  <Volba aktivna={material === 'bavlna'} onClick={() => setMaterial('bavlna')}>Bavlna</Volba>
                  <Volba aktivna={material === 'polyester'} onClick={() => setMaterial('polyester')}>Polyester</Volba>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Farba textilu</label>
                <div className="grid grid-cols-2 gap-2">
                  <Volba aktivna={!tmavy} onClick={() => setTmavy(false)}><Sun className="w-4 h-4" /> Svetlý</Volba>
                  <Volba aktivna={tmavy} onClick={() => setTmavy(true)}><Moon className="w-4 h-4" /> Tmavý</Volba>
                </div>
              </div>
            </div>
            {tmavy && <p className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2.5">Na tmavý textil sa tlačí v dvoch vrstvách (podklad + farba), aby farby dobre kryli. Je to zohľadnené v cene.</p>}
            {material === 'polyester' && nast.polyesterPriplatokPercent > 0 && <p className="text-xs text-slate-500">Na polyester počítame príplatok {nast.polyesterPriplatokPercent} %.</p>}
          </Sekcia>

          <Sekcia cislo="2" nazov={`Veľkosť motívu (najviac ${nast.maxSirkaCm} × ${nast.maxVyskaCm} cm)`}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (cm)</label><NumberInput min="1" max={nast.maxSirkaCm} step="1" value={sirka} onChange={(v) => setSirka(Math.min(nast.maxSirkaCm, Math.max(1, v)))} fallback={20} className={pole} /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (cm)</label><NumberInput min="1" max={nast.maxVyskaCm} step="1" value={vyska} onChange={(v) => setVyska(Math.min(nast.maxVyskaCm, Math.max(1, v)))} fallback={20} className={pole} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Volba aktivna={!dveVelkosti} onClick={() => setDveVelkosti(false)} podtext="Všetky tričká (XS–XXL) majú rovnako veľký motív. 1 sada sít.">Jedna veľkosť potlače</Volba>
                  <Volba aktivna={dveVelkosti} onClick={() => setDveVelkosti(true)} podtext="Menšia na XS–M, väčšia na L–XXL. Potrebné sú 2 sady sít. Zadajte rozmer väčšieho motívu.">Dve veľkosti potlače</Volba>
                </div>
              </div>
              <TrickoNahlad sirka={sirka} vyska={vyska} tmavy={tmavy} farby={farbyPaleta} />
            </div>
          </Sekcia>

          <Sekcia cislo="3" nazov="Počet farieb a efekt">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Počet farieb v motíve (1–6)</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFarby((f) => Math.max(1, f - 1))} className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Menej farieb"><Minus className="w-4 h-4" /></button>
                  <span className="text-xl font-bold font-mono w-10 text-center">{farby}</span>
                  <button type="button" onClick={() => setFarby((f) => Math.min(6, f + 1))} className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Viac farieb"><Plus className="w-4 h-4" /></button>
                  <div className="flex -space-x-1.5 ml-1">{farbyPaleta.map((c) => <span key={c} className="w-5 h-5 rounded-full border-2 border-white" style={{ background: c }} />)}</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Každá farba = jedno sito. Farby pri sieťotlači nemiešame, počítajú sa jednotlivé farby motívu.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Typ farby / efekt</label>
                <select value={efekt} onChange={(e) => setEfekt(e.target.value)} className={pole}>
                  {efekty.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}{x.priplatokPercent > 0 ? ` (+${x.priplatokPercent} %)` : ''}</option>)}
                </select>
                {efektObj?.popis && <p className="text-[11px] text-slate-400 mt-1.5">{efektObj.popis}</p>}
              </div>
            </div>
          </Sekcia>

          <Sekcia cislo="4" nazov="Počet kusov">
            <div className="flex flex-wrap items-center gap-3">
              <NumberInput min={nast.minKs} max={nast.maxKs} step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.min(nast.maxKs, Math.max(1, Math.round(v))))} fallback={nast.minKs} className="w-36 border border-slate-300 rounded-lg p-2.5 text-lg font-bold font-mono bg-white" />
              <div className="flex flex-wrap gap-2">
                {RYCHLE_KS.filter((k) => k >= nast.minKs).map((k) => <button key={k} type="button" onClick={() => setPocetKs(k)} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${pocetKs === k ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{k} ks</button>)}
              </div>
            </div>
            <p className="text-xs text-slate-400">Minimálny odber pre sieťotlač je {nast.minKs} ks (príprava sít). Čím viac kusov, tým nižšia cena za kus.</p>
          </Sekcia>

          {cena && <MnozstevneZlavy urovne={cena.urovne} pocetKs={pocetKs} />}
        </div>

        <aside className="lg:sticky lg:top-20 space-y-3 min-w-0">
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
            <h3 className="text-base font-bold border-b border-slate-700 pb-3 flex items-center justify-between gap-2">
              <span>Cenový prehľad</span><span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">Predbežná kalkulácia</span>
            </h3>
            {chybaCeny ? (
              <div className="bg-rose-950/60 border border-rose-700 text-rose-200 p-3 rounded-lg text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {chybaCeny}</div>
            ) : cena ? (
              <>
                <div className="space-y-1.5 text-xs">
                  <Riadok l="Počet kusov" v={`${cena.pocetKs} ks`} />
                  <Riadok l="Farby / sitá" v={`${farby} ${farby === 1 ? 'farba' : farby < 5 ? 'farby' : 'farieb'} · ${cena.pocetSit} ${cena.pocetSit === 1 ? 'sito' : cena.pocetSit < 5 ? 'sitá' : 'sít'}`} />
                  <Riadok l="Textil" v={`${material === 'polyester' ? 'Polyester' : 'Bavlna'} · ${tmavy ? 'tmavý' : 'svetlý'}`} />
                  <Riadok l="Efekt" v={efektObj ? efektObj.nazov.split(' (')[0] + (cena.priplatokEfektPercent > 0 ? ` (+${cena.priplatokEfektPercent} %)` : '') : '—'} />
                  {cena.priplatokPolyesterPercent > 0 && <Riadok l="Príplatok polyester" v={`+${cena.priplatokPolyesterPercent} %`} />}
                  <Riadok l="Cena za 1 ks potlače (bez DPH)" v={eur(cena.cenaKsBezDph)} />
                </div>
                <div className="border-t border-slate-700 pt-3 space-y-1.5 text-xs">
                  <Riadok l="Spolu bez DPH" v={eur(cena.spoluBezDph)} />
                  <Riadok l={`DPH ${cena.dphPercent} %`} v={eur(cena.dph)} />
                </div>
                <div className="bg-indigo-600 rounded-xl p-3">
                  <div className="text-indigo-100 text-[11px]">Celkom s DPH:</div>
                  <div className="text-2xl font-extrabold font-mono">{eur(cena.spoluSDph)}</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">Cena je za potlač. Textil, doprava a konečná ponuka sa potvrdia po kontrole podkladov.</p>
              </>
            ) : <p className="text-xs text-slate-400">Počítam cenu…</p>}

            {hotovo ? (
              <div className="bg-emerald-950/50 border border-emerald-700 rounded-xl p-3 text-xs text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Dopyt {hotovo.cislo} bol odoslaný</div>
                <p>Ďakujeme, ozveme sa vám s konečnou ponukou do 24 hodín.{hotovo.email ? ' Potvrdenie sme poslali na váš e-mail.' : ''}</p>
              </div>
            ) : !formOtvoreny ? (
              <button type="button" disabled={!cena} onClick={() => setFormOtvoreny(true)} className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Odoslať dopyt
              </button>
            ) : (
              <form onSubmit={odoslat} className="space-y-2.5 border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-300">Vyplňte kontakt — do 24 hodín vám pošleme záväznú ponuku. Odoslaním dopytu sa nič neplatí.</p>
                <input value={kontakt.meno} onChange={(e) => setKontakt({ ...kontakt, meno: e.target.value })} required maxLength={120} placeholder="Meno / firma *" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500" />
                <input type="email" value={kontakt.email} onChange={(e) => setKontakt({ ...kontakt, email: e.target.value })} required placeholder="E-mail *" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500" />
                <input type="tel" value={kontakt.telefon} onChange={(e) => setKontakt({ ...kontakt, telefon: e.target.value })} required maxLength={40} placeholder="Telefón *" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500" />
                <textarea value={kontakt.poznamka} onChange={(e) => setKontakt({ ...kontakt, poznamka: e.target.value })} rows={3} maxLength={2000} placeholder="Poznámka alebo odkaz na grafiku (Google Disk, WeTransfer…)" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500" />
                <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                {chybaDopytu && <p className="text-xs text-rose-300">{chybaDopytu}</p>}
                <button type="submit" disabled={odosielam || !cena} className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-sm flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {odosielam ? 'Odosielam…' : 'Odoslať dopyt'}
                </button>
                <p className="text-[11px] text-slate-400 leading-snug">Vaše údaje použijeme len na vypracovanie ponuky. Viac v <a href="https://pbtprint.sk/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-200">Zásadách ochrany osobných údajov</a>.</p>
              </form>
            )}
          </div>
          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Sieťotlač plastizolovými farbami, tlač na karusele</p>
        </aside>
      </main>
    </div>
  );
}

function Riadok({ l, v }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-slate-400">{l}</span><span className="font-mono text-slate-100 text-right">{v}</span></div>;
}
