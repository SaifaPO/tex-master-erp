import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Minus, Plus, Send, CheckCircle2, Moon, Sun, Upload, Trash2, FileImage, ChevronDown, PenTool } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';
import NavrhGrafiky from './NavrhGrafiky';

// Verejná appka „Sieťotlač“ (?typ=sietotlac): na jednom kuse môže byť viac potlačí (srdce, chrbát, rukávy…), každá s vlastným rozmerom,
// farbami, efektom a grafikou. Objednávka sa platí cez Shopify (ako ostatné appky) alebo sa pošle len dopyt.
// Cenu počíta Edge Function sietotlac-dopyt z Kostry cien a maržového modulu; klient nikdy nevidí náklady.
const FUNKCIA = 'sietotlac-dopyt';
const BUCKET = 'print-designs';
const RYCHLE_KS = [10, 30, 50, 100, 250];
const POVOLENE = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf', '.ai', '.eps'];
const MAX_MB = 40;
const PALETA = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#475569', '#db2777'];
const eur = (v) => `${Number(v).toFixed(2)} €`;
const jeObrazok = (f) => !!f && /^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type);

function Volba({ aktivna, onClick, children, podtext, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`text-left p-3 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed ${aktivna ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className={`text-sm font-semibold flex items-center gap-1.5 ${aktivna ? 'text-indigo-800' : 'text-slate-700'}`}>{children}</div>
      {podtext && <div className="text-xs text-slate-500 mt-0.5 leading-snug">{podtext}</div>}
    </button>
  );
}

function Sekcia({ cislo, nazov, children, akcia }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{cislo}</span>{nazov}
        </h2>
        {akcia}
      </div>
      {children}
    </section>
  );
}

// Náhľad umiestnenia: tričko spredu a zozadu (≈ 50 cm široké), potlače v mierke; rukávy sa kreslia na rukávoch spredu.
// Súradnice v jednotkách náhľadu (1 cm ≈ 1,12 jednotky).
const K = 1.12;
function Tricko({ x0, tmavy, nazov, children }) {
  const fill = tmavy ? '#1e293b' : '#f1f5f9', stroke = tmavy ? '#64748b' : '#cbd5e1';
  return (
    <g transform={`translate(${x0} 0)`}>
      <path d="M36 6 L20 12 L6 30 L16 38 L22 32 L22 92 L78 92 L78 32 L84 38 L94 30 L80 12 L64 6 Q50 18 36 6 Z" fill={fill} stroke={stroke} strokeWidth="1" />
      {children}
      <text x="50" y="99" textAnchor="middle" fontSize="5" fill={tmavy ? '#94a3b8' : '#64748b'}>{nazov}</text>
    </g>
  );
}
function PotlacRect({ x, y, w, h, nahlad, farby, popis, otocit = 0 }) {
  return (
    <g transform={otocit ? `rotate(${otocit} ${x + w / 2} ${y + h / 2})` : undefined}>
      <rect x={x} y={y} width={w} height={h} rx="0.8" fill="#ffffff" fillOpacity="0.12" stroke="#6366f1" strokeWidth="0.7" strokeDasharray="2 1.2" />
      {nahlad ? <image href={nahlad} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
        : farby.map((c, i) => <rect key={i} x={x + 0.8 + (i * (w - 1.6)) / farby.length} y={y + 0.8} width={(w - 1.6) / farby.length} height={h - 1.6} fill={c} opacity="0.55" />)}
      <title>{popis}</title>
    </g>
  );
}
function NahladTricka({ tlace, umiestnenia, tmavy }) {
  const najdi = (strana) => tlace.map((t) => ({ t, u: umiestnenia.find((x) => x.kod === t.umiestnenie) })).filter((x) => x.u?.strana === strana);
  const rozmer = (t) => ({ w: Math.max(3, t.sirka * K), h: Math.max(3, t.vyska * K) });
  const paleta = (t) => PALETA.slice(0, t.farby);
  return (
    <svg viewBox="0 0 208 104" className="w-full max-w-md mx-auto" role="img" aria-label="Náhľad umiestnenia potlače na tričku spredu a zozadu">
      <Tricko x0={0} tmavy={tmavy} nazov="Spredu">
        {najdi('predok').map(({ t, u }) => {
          const { w, h } = rozmer(t);
          const srdce = u.kod === 'hrud_srdce'; // srdce = ľavá strana nositeľa = pravá strana náhľadu
          const x = srdce ? 60 : 50 - w / 2, y = srdce ? 18 : 16;
          return <PotlacRect key={t.id} x={x} y={y} w={Math.min(w, 44)} h={Math.min(h, 70)} nahlad={t.nahlad} farby={paleta(t)} popis={u.nazov} />;
        })}
        {najdi('rukav_l').map(({ t, u }) => { const { w, h } = rozmer(t); return <PotlacRect key={t.id} x={86 - Math.min(w, 9) / 2} y={22} w={Math.min(w, 9)} h={Math.min(h, 14)} nahlad={t.nahlad} farby={paleta(t)} popis={u.nazov} otocit={-35} />; })}
        {najdi('rukav_p').map(({ t, u }) => { const { w, h } = rozmer(t); return <PotlacRect key={t.id} x={14 - Math.min(w, 9) / 2} y={22} w={Math.min(w, 9)} h={Math.min(h, 14)} nahlad={t.nahlad} farby={paleta(t)} popis={u.nazov} otocit={35} />; })}
        {najdi('rukav_l').length > 0 && <text x="94" y="45" fontSize="4.5" fill="#6366f1" textAnchor="middle">ľavý</text>}
        {najdi('rukav_p').length > 0 && <text x="6" y="45" fontSize="4.5" fill="#6366f1" textAnchor="middle">pravý</text>}
      </Tricko>
      <Tricko x0={108} tmavy={tmavy} nazov="Zozadu">
        {najdi('zadok').map(({ t, u }) => {
          const { w, h } = rozmer(t);
          return <PotlacRect key={t.id} x={50 - Math.min(w, 50) / 2} y={14} w={Math.min(w, 50)} h={Math.min(h, 74)} nahlad={t.nahlad} farby={paleta(t)} popis={u.nazov} />;
        })}
      </Tricko>
    </svg>
  );
}

let idCounter = 0;
const noveId = () => `t${++idCounter}`;

export default function Sietotlac({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [nast, setNast] = useState(null);
  const [efekty, setEfekty] = useState([]);
  const [umiestnenia, setUmiestnenia] = useState([]);

  const [material, setMaterial] = useState('bavlna');
  const [tmavy, setTmavy] = useState(false);
  const [dveVelkosti, setDveVelkosti] = useState(false);
  const [pocetKs, setPocetKs] = useState(50);
  const [tlace, setTlace] = useState([]);
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const b2b = useB2bKod(supabase);

  const [bezi, setBezi] = useState(false);
  const [chybaObj, setChybaObj] = useState('');
  const [potvrdenie, setPotvrdenie] = useState('');

  const [navrhId, setNavrhId] = useState(null); // id potlače, ktorej sa práve navrhuje vlastný motív v editore
  const [dopytOtvoreny, setDopytOtvoreny] = useState(false);
  const [kontakt, setKontakt] = useState({ meno: '', email: '', telefon: '', poznamka: '' });
  const [hp, setHp] = useState('');
  const [odosielam, setOdosielam] = useState(false);
  const [chybaDopytu, setChybaDopytu] = useState('');
  const [hotovo, setHotovo] = useState(null);
  const fileRefs = useRef({});

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
        setNast(d.nastavenia); setEfekty(d.efekty); setUmiestnenia(d.umiestnenia);
        setPocetKs((p) => Math.max(d.nastavenia.minKs, p));
        const u = d.umiestnenia.find((x) => x.kod === 'hrud_stred') || d.umiestnenia[0];
        if (u) setTlace([{ id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: d.efekty[0]?.kod || 'klasicka', subor: null, nahlad: null }]);
      } catch (e) { setChybaNacitania(e.message); }
      setNacitava(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const uprav = (id, patch) => setTlace((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const volneUmiestnenia = umiestnenia.filter((u) => !tlace.some((t) => t.umiestnenie === u.kod));
  const pridajTlac = () => {
    const u = volneUmiestnenia[0];
    if (!u) return;
    setTlace((l) => [...l, { id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: efekty[0]?.kod || 'klasicka', subor: null, nahlad: null }]);
  };
  const zmenUmiestnenie = (id, kod) => {
    const u = umiestnenia.find((x) => x.kod === kod);
    if (u) uprav(id, { umiestnenie: kod, sirka: Math.min(u.vychodziaSirkaCm, u.maxSirkaCm), vyska: Math.min(u.vychodziaVyskaCm, u.maxVyskaCm) });
  };
  const zmazTlac = (id) => setTlace((l) => { const t = l.find((x) => x.id === id); if (t?.nahlad) URL.revokeObjectURL(t.nahlad); return l.filter((x) => x.id !== id); });
  const vyberSubor = (id, f) => {
    if (!f) return;
    const pripona = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!POVOLENE.includes(pripona)) { window.alert(`Nahrajte prosím súbor vo formáte: ${POVOLENE.join(', ')}.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { window.alert(`Súbor je príliš veľký (max. ${MAX_MB} MB).`); return; }
    setTlace((l) => l.map((t) => { if (t.id !== id) return t; if (t.nahlad) URL.revokeObjectURL(t.nahlad); return { ...t, subor: f, nahlad: jeObrazok(f) ? URL.createObjectURL(f) : null, navrhJson: null }; }));
  };
  const hotovyNavrh = (id, { subor, nahlad, json }) => {
    setTlace((l) => l.map((t) => { if (t.id !== id) return t; if (t.nahlad) URL.revokeObjectURL(t.nahlad); return { ...t, subor, nahlad, navrhJson: json }; }));
    setNavrhId(null);
  };

  const teloCeny = useMemo(() => ({
    material, tmavy, dveVelkosti, pocetKs, osobnyOdber, b2bKod: b2b.kod,
    tlace: tlace.map((t) => ({ umiestnenie: t.umiestnenie, sirkaCm: t.sirka, vyskaCm: t.vyska, farby: t.farby, efekt: t.efekt })),
  }), [material, tmavy, dveVelkosti, pocetKs, osobnyOdber, b2b.kod, tlace]);
  const { cena, chyba } = useCenaNahlad(supabase, FUNKCIA, teloCeny, !!nast && nast.aktivny !== false && tlace.length > 0);

  const nahrajSubory = async () => {
    const sk = crypto.randomUUID();
    const vysledok = [];
    for (const t of tlace) {
      if (!t.subor) { vysledok.push({ suborCesta: null, suborNazov: null }); continue; }
      const cesta = `sietotlac/${sk}/${t.umiestnenie}_${t.subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(cesta, t.subor, { contentType: t.subor.type || undefined });
      if (error) throw new Error('Súbor sa nepodarilo nahrať: ' + error.message);
      vysledok.push({ suborCesta: cesta, suborNazov: t.subor.name });
    }
    return vysledok;
  };
  const telo = (subory) => ({ ...teloCeny, tlace: teloCeny.tlace.map((t, i) => ({ ...t, ...subory[i] })) });

  const chybajuSubory = tlace.some((t) => !t.subor);
  const objednat = async () => {
    if (chybajuSubory) { setChybaObj('Nahrajte prosím grafiku ku každej potlači.'); return; }
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const subory = await nahrajSubory();
      const d = await volaj(telo(subory));
      setPotvrdenie(`Objednávka bola vytvorená — ${Number(d.cenaSpolu).toFixed(2)} €. Presmerúvam na platbu…`);
      window.location.href = d.checkoutUrl;
    } catch (e) { setChybaObj('Objednávku sa nepodarilo odoslať: ' + e.message); } finally { setBezi(false); }
  };
  const odoslatDopyt = async (e) => {
    e.preventDefault();
    setOdosielam(true); setChybaDopytu('');
    try {
      const subory = await nahrajSubory();
      const d = await volaj({ akcia: 'dopyt', vyber: telo(subory), kontakt, hp });
      setHotovo({ cislo: d.cislo, email: d.email });
    } catch (err) { setChybaDopytu(err.message); }
    setOdosielam(false);
  };

  if (nacitava) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (chybaNacitania) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chybaNacitania}</div>;
  if (nast?.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Kalkulačka sieťotlače je dočasne vypnutá.</div>;

  const pole = 'w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium bg-white';
  const riadky = cena ? [
    ['Počet kusov', `${cena.pocetKs} ks`],
    ['Textil', `${material === 'polyester' ? 'Polyester' : 'Bavlna'} · ${tmavy ? 'tmavý' : 'svetlý'}`],
    ...(cena.tlace || []).map((t) => [t.nazov, `${eur(t.cenaKsBezDph)} / ks`]),
    ['Počet sít', String(cena.pocetSit)],
    ...(cena.priplatokPolyesterPercent > 0 ? [['Príplatok polyester (v cenách vyššie)', `+${cena.priplatokPolyesterPercent} %`]] : []),
  ] : [];

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Sieťotlač" subtitle="Potlač tričiek: viac potlačí, objednávka a platba online" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {nast?.infoText && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{nast.infoText}</p>}
      {navrhId && (() => {
        const t = tlace.find((x) => x.id === navrhId);
        if (!t) return null;
        const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
        return (
          <NavrhGrafiky key={t.id} supabase={supabase} sirkaCm={t.sirka} vyskaCm={t.vyska} nazov={u?.nazov || 'potlač'} pocetFarieb={t.farby}
            povodnyJson={t.navrhJson} onHotovo={(v) => hotovyNavrh(t.id, v)} onZrus={() => setNavrhId(null)} />
        );
      })()}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          {/* mobil: náhľad trička je prilepený hore, ovládanie je pod ním */}
          <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4 pt-1 pb-2 bg-slate-50/95 backdrop-blur"><div className="bg-white rounded-2xl border border-slate-200 p-2 [&_svg]:max-h-[26vh]"><NahladTricka tlace={tlace} umiestnenia={umiestnenia} tmavy={tmavy} /></div></div>
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

          <Sekcia cislo="2" nazov={`Potlače na jednom kuse (${tlace.length})`}
            akcia={<button type="button" onClick={pridajTlac} disabled={volneUmiestnenia.length === 0 || tlace.length >= 6} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Pridať potlač</button>}>
            <p className="text-xs text-slate-500">Napríklad malé logo na srdci a veľká potlač na chrbte, prípadne aj na rukávoch. Každá potlač má vlastný rozmer, počet farieb a grafiku.</p>
            <div className="hidden lg:block"><NahladTricka tlace={tlace} umiestnenia={umiestnenia} tmavy={tmavy} /></div>
            <div className="space-y-3">
              {tlace.map((t, i) => {
                const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
                const efektObj = efekty.find((x) => x.kod === t.efekt);
                const sirkaChyba = u && (t.sirka > u.maxSirkaCm || t.vyska > u.maxVyskaCm);
                return (
                  <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-700">Potlač {i + 1}</span>
                      {tlace.length > 1 && <button type="button" onClick={() => zmazTlac(t.id)} className="text-slate-400 hover:text-rose-500 flex items-center gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> Odstrániť</button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Umiestnenie</label>
                        <div className="relative">
                          <select value={t.umiestnenie} onChange={(e) => zmenUmiestnenie(t.id, e.target.value)} className={`${pole} appearance-none pr-8`}>
                            {umiestnenia.filter((x) => x.kod === t.umiestnenie || volneUmiestnenia.some((v) => v.kod === x.kod)).map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                        {u?.popis && <p className="text-[11px] text-slate-400 mt-1">{u.popis} (max. {u.maxSirkaCm} × {u.maxVyskaCm} cm)</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (cm)</label><NumberInput min="1" max={u?.maxSirkaCm} step="0.5" value={t.sirka} onChange={(v) => uprav(t.id, { sirka: Math.min(u?.maxSirkaCm || 43, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (cm)</label><NumberInput min="1" max={u?.maxVyskaCm} step="0.5" value={t.vyska} onChange={(v) => uprav(t.id, { vyska: Math.min(u?.maxVyskaCm || 58, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Počet farieb (1–6)</label>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => uprav(t.id, { farby: Math.max(1, t.farby - 1) })} className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Menej farieb"><Minus className="w-4 h-4" /></button>
                          <span className="text-lg font-bold font-mono w-8 text-center">{t.farby}</span>
                          <button type="button" onClick={() => uprav(t.id, { farby: Math.min(6, t.farby + 1) })} className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Viac farieb"><Plus className="w-4 h-4" /></button>
                          <div className="flex -space-x-1.5">{PALETA.slice(0, t.farby).map((c) => <span key={c} className="w-4 h-4 rounded-full border-2 border-white" style={{ background: c }} />)}</div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Typ farby / efekt</label>
                        <select value={t.efekt} onChange={(e) => uprav(t.id, { efekt: e.target.value })} className={pole}>
                          {efekty.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}{x.priplatokPercent > 0 ? ` (+${x.priplatokPercent} %)` : ''}</option>)}
                        </select>
                        {efektObj?.popis && <p className="text-[11px] text-slate-400 mt-1">{efektObj.popis}</p>}
                      </div>
                    </div>
                    {sirkaChyba && <p className="text-xs text-rose-600">Rozmer presahuje maximum pre toto umiestnenie ({u.maxSirkaCm} × {u.maxVyskaCm} cm).</p>}
                    <div>
                      <input ref={(el) => { fileRefs.current[t.id] = el; }} type="file" accept={POVOLENE.join(',')} className="hidden" onChange={(e) => { vyberSubor(t.id, e.target.files?.[0]); e.target.value = ''; }} />
                      <button type="button" onClick={() => fileRefs.current[t.id]?.click()}
                        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); vyberSubor(t.id, e.dataTransfer.files?.[0]); }}
                        className={`w-full rounded-xl border-2 border-dashed p-3 flex items-center gap-3 text-left transition ${t.subor ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                        {t.nahlad ? <img src={t.nahlad} alt="" className="w-12 h-12 object-contain rounded bg-slate-100 shrink-0" /> : t.subor ? <FileImage className="w-8 h-8 text-emerald-600 shrink-0" /> : <Upload className="w-7 h-7 text-slate-400 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-700 truncate">{t.subor ? t.subor.name : 'Nahrať grafiku k tejto potlači'}</span>
                          <span className="block text-[11px] text-slate-400">{t.subor ? 'Kliknutím súbor vymeníte' : `Kliknite alebo pretiahnite súbor (${POVOLENE.join(', ')}, max. ${MAX_MB} MB). Najlepšie vektor alebo PNG s priehľadným pozadím.`}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => setNavrhId(t.id)} disabled={sirkaChyba}
                        className="mt-2 w-full rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-800 text-sm font-semibold py-2.5 flex items-center justify-center gap-2 transition">
                        <PenTool className="w-4 h-4" /> {t.navrhJson ? 'Upraviť môj návrh' : 'Navrhnúť vlastný motív (text, symboly, grafiky)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Sekcia>

          <Sekcia cislo="3" nazov="Počet kusov a veľkosti potlače">
            <div className="flex flex-wrap items-center gap-3">
              <NumberInput min={nast.minKs} max={nast.maxKs} step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.min(nast.maxKs, Math.max(1, Math.round(v))))} fallback={nast.minKs} className="w-36 border border-slate-300 rounded-lg p-2.5 text-lg font-bold font-mono bg-white" />
              <div className="flex flex-wrap gap-2">
                {RYCHLE_KS.filter((k) => k >= nast.minKs).map((k) => <button key={k} type="button" onClick={() => setPocetKs(k)} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${pocetKs === k ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{k} ks</button>)}
              </div>
            </div>
            <p className="text-xs text-slate-400">Minimálny odber pre sieťotlač je {nast.minKs} ks (príprava sít). Čím viac kusov, tým nižšia cena za kus.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Volba aktivna={!dveVelkosti} onClick={() => setDveVelkosti(false)} podtext="Všetky tričká (XS–XXL) majú rovnako veľké potlače. 1 sada sít.">Jedna veľkosť potlače</Volba>
              <Volba aktivna={dveVelkosti} onClick={() => setDveVelkosti(true)} podtext="Menšie potlače na XS–M, väčšie na L–XXL. Potrebné sú 2 sady sít. Zadajte rozmery väčšej verzie.">Dve veľkosti potlače</Volba>
            </div>
          </Sekcia>

          {cena?.urovne && <MnozstevneZlavy urovne={cena.urovne} pocetKs={pocetKs} b2bPercent={cena.zlavaB2bPercent} b2bKod={b2b.kod} />}
        </div>

        <aside className="lg:sticky lg:top-20 space-y-3 min-w-0">
          <CenaSuhrn cena={cena} chyba={chyba} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi}
            chybaObjednavky={chybaObj} potvrdenie={potvrdenie} zakazane={chybajuSubory} poznamkaZakazane="Pred objednávkou nahrajte grafiku ku každej potlači." riadky={riadky} />

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            {hotovo ? (
              <div className="text-xs text-emerald-700 space-y-1">
                <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4" /> Dopyt {hotovo.cislo} bol odoslaný</div>
                <p>Ďakujeme, ozveme sa vám s konečnou ponukou do 24 hodín.{hotovo.email ? ' Potvrdenie sme poslali na váš e-mail.' : ''}</p>
              </div>
            ) : !dopytOtvoreny ? (
              <button type="button" onClick={() => setDopytOtvoreny(true)} className="w-full text-sm font-semibold text-indigo-700 hover:text-indigo-600 flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Radšej poslať len dopyt (bez platby)</button>
            ) : (
              <form onSubmit={odoslatDopyt} className="space-y-2.5">
                <p className="text-xs text-slate-600">Vyplňte kontakt — do 24 hodín vám pošleme záväznú ponuku. Odoslaním dopytu sa nič neplatí. Grafiku môžete nahrať vyššie alebo dať odkaz do poznámky.</p>
                <input value={kontakt.meno} onChange={(e) => setKontakt({ ...kontakt, meno: e.target.value })} required maxLength={120} placeholder="Meno / firma *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="email" value={kontakt.email} onChange={(e) => setKontakt({ ...kontakt, email: e.target.value })} required placeholder="E-mail *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="tel" value={kontakt.telefon} onChange={(e) => setKontakt({ ...kontakt, telefon: e.target.value })} required maxLength={40} placeholder="Telefón *" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={kontakt.poznamka} onChange={(e) => setKontakt({ ...kontakt, poznamka: e.target.value })} rows={3} maxLength={2000} placeholder="Poznámka alebo odkaz na grafiku (Google Disk, WeTransfer…)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                {chybaDopytu && <p className="text-xs text-rose-600">{chybaDopytu}</p>}
                <button type="submit" disabled={odosielam || !cena} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {odosielam ? 'Odosielam…' : 'Odoslať dopyt'}
                </button>
                <p className="text-[11px] text-slate-400 leading-snug">Vaše údaje použijeme len na vypracovanie ponuky. Viac v <a href="https://pbtprint.sk/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Zásadách ochrany osobných údajov</a>.</p>
              </form>
            )}
          </div>
          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Cena je len za potlač (textil nie je v cene). Platba kartou cez Shopify.</p>
        </aside>
      </main>
    </div>
  );
}
