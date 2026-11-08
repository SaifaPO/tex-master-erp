import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Upload, Trash2, FileImage, ChevronDown, PenTool, Shirt, Check } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';
import NavrhInline from './NavrhInline';
import TrickoNahlad from './TrickoNahlad';

// Verejná appka „Potlač textilu“ (?typ=potlac): produkt (tričko, mikina…) → farba → technológia (DTF / rezaný transfer / sieťotlač) → potlače
// s umiestnením na fotke produktu a vlastným návrhom → cena → platba cez Shopify. Textil môže dodať zákazník, alebo ho objednať od nás.
// Cenu počíta Edge Function potlac-textilu z Kostry cien; klient nikdy nevidí náklady.
const FUNKCIA = 'potlac-textilu';
const BUCKET = 'print-designs';
const RYCHLE_KS = [1, 5, 10, 30, 50, 100];
const POVOLENE = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf', '.ai', '.eps'];
const MAX_MB = 40;
const eur = (v) => `${Number(v).toFixed(2)} €`;
const jeObrazok = (f) => !!f && /^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type);

const TECH = {
  dtf: { nazov: 'DTF transfer', popis: 'Plnofarebná potlač aj s fotkami a farebnými prechodmi. Od 1 kusa, na všetky farby a materiály.', farby: false, efekt: false },
  rezany: { nazov: 'Rezaný transfer', popis: 'Plné plochy, texty a čísla vo fólii (1 farba = 1 fólia). Od 1 kusa, veľmi odolné.', farby: true, efekt: false },
  sietotlac: { nazov: 'Sieťotlač', popis: 'Najlacnejšie pri väčších sériách. Jednoduché plné plochy a texty, 1–6 farieb.', farby: true, efekt: true },
};
const PORADIE_TECH = ['dtf', 'rezany', 'sietotlac'];

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

let idCounter = 0;
const noveId = () => `t${++idCounter}`;

export default function PotlacTextilu({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [nast, setNast] = useState(null);
  const [produkty, setProdukty] = useState([]);
  const [efekty, setEfekty] = useState([]);
  const [umiestnenia, setUmiestnenia] = useState([]);

  const [produktId, setProduktId] = useState(null);
  const [vlastnyTextil, setVlastnyTextil] = useState(false);
  const [farbaHex, setFarbaHex] = useState('#ffffff');
  const [material, setMaterial] = useState('bavlna');
  const [technologia, setTechnologia] = useState('dtf');
  const [velkosti, setVelkosti] = useState({});
  const [pocetKsVlastny, setPocetKsVlastny] = useState(10);
  const [tlace, setTlace] = useState([]);
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const [pohlad, setPohlad] = useState('predok');
  const [vybranaId, setVybranaId] = useState(null);
  const b2b = useB2bKod(supabase);

  const [bezi, setBezi] = useState(false);
  const [chybaObj, setChybaObj] = useState('');
  const [potvrdenie, setPotvrdenie] = useState('');
  const [navrhId, setNavrhId] = useState(null); // id potlače, ktorej editor je otvorený priamo na stránke
  const flushRef = useRef({});
  const registruj = useCallback((id, fn) => { if (fn) flushRef.current[id] = fn; else delete flushRef.current[id]; }, []);
  const fileRefs = useRef({});

  const volaj = async (body) => {
    const { data, error } = await supabase.functions.invoke(FUNKCIA, { body });
    if (error) throw new Error(`Spojenie so serverom zlyhalo (${error.message || 'chyba'}).`);
    if (!data?.ok) throw new Error(data?.error || 'Server nevrátil odpoveď.');
    return data;
  };

  const produkt = produkty.find((p) => p.id === produktId) || null;
  const miesta = useMemo(() => (produkt ? umiestnenia.filter((u) => produkt.pozicie?.[u.kod]) : []), [produkt, umiestnenia]);

  const novaPotlac = (u, tech = technologia) => ({ id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: efekty[0]?.kod || 'klasicka', subor: null, nahlad: null, navrhJson: null, _tech: tech });
  const vyberProdukt = (p, d = { umiestnenia, efekty }) => {
    setProduktId(p.id);
    setFarbaHex(p.farby?.[0]?.hex || '#ffffff');
    setMaterial(p.material || 'bavlna');
    setTechnologia((t) => ((p.technologie || []).includes(t) ? t : (PORADIE_TECH.find((x) => (p.technologie || []).includes(x)) || 'dtf')));
    setVelkosti({});
    const dostupne = d.umiestnenia.filter((u) => p.pozicie?.[u.kod]);
    const u = dostupne.find((x) => x.kod === 'hrud_stred') || dostupne[0];
    setTlace((l) => { l.forEach((t) => t.nahlad && URL.revokeObjectURL(t.nahlad)); return u ? [{ id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: d.efekty[0]?.kod || 'klasicka', subor: null, nahlad: null, navrhJson: null }] : []; });
    setPohlad('predok');
  };

  useEffect(() => {
    if (!supabase) { setChybaNacitania('Supabase klient nie je nakonfigurovaný.'); setNacitava(false); return; }
    (async () => {
      try {
        const d = await volaj({ akcia: 'cennik' });
        setNast(d.nastavenia); setProdukty(d.produkty); setEfekty(d.efekty); setUmiestnenia(d.umiestnenia);
        if (d.produkty[0]) vyberProdukt(d.produkty[0], d);
      } catch (e) { setChybaNacitania(e.message); }
      setNacitava(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const minKs = nast?.minKs?.[technologia] || 1;
  const pocetKs = vlastnyTextil ? pocetKsVlastny : Object.values(velkosti).reduce((s, q) => s + (Number(q) || 0), 0);

  const uprav = (id, patch) => setTlace((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const volneMiesta = miesta.filter((u) => !tlace.some((t) => t.umiestnenie === u.kod));
  const pridajTlac = () => {
    const u = volneMiesta[0];
    if (!u) return;
    const t = novaPotlac(u);
    setTlace((l) => [...l, t]); setVybranaId(t.id);
    const poz = produkt?.pozicie?.[u.kod];
    if (poz && !poz[pohlad]) setPohlad(poz.predok ? 'predok' : 'zadok');
  };
  const zmenUmiestnenie = (id, kod) => {
    const u = umiestnenia.find((x) => x.kod === kod);
    if (!u) return;
    uprav(id, { umiestnenie: kod, sirka: Math.min(u.vychodziaSirkaCm, u.maxSirkaCm), vyska: Math.min(u.vychodziaVyskaCm, u.maxVyskaCm) });
    const poz = produkt?.pozicie?.[kod];
    if (poz && !poz[pohlad]) setPohlad(poz.predok ? 'predok' : 'zadok');
    setVybranaId(id);
  };
  const zmazTlac = (id) => setTlace((l) => { const t = l.find((x) => x.id === id); if (t?.nahlad) URL.revokeObjectURL(t.nahlad); return l.filter((x) => x.id !== id); });
  const vyberSubor = (id, f) => {
    if (!f) return;
    const pripona = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!POVOLENE.includes(pripona)) { window.alert(`Nahrajte prosím súbor vo formáte: ${POVOLENE.join(', ')}.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { window.alert(`Súbor je príliš veľký (max. ${MAX_MB} MB).`); return; }
    setTlace((l) => l.map((t) => { if (t.id !== id) return t; if (t.nahlad) URL.revokeObjectURL(t.nahlad); return { ...t, subor: f, nahlad: jeObrazok(f) ? URL.createObjectURL(f) : null, navrhJson: null }; }));
  };

  const teloCeny = useMemo(() => ({
    produktId, vlastnyTextil, farbaHex, material, technologia, velkosti, pocetKs: pocetKsVlastny, osobnyOdber, b2bKod: b2b.kod,
    tlace: tlace.map((t) => ({ umiestnenie: t.umiestnenie, sirkaCm: t.sirka, vyskaCm: t.vyska, farby: t.farby, efekt: t.efekt })),
  }), [produktId, vlastnyTextil, farbaHex, material, technologia, velkosti, pocetKsVlastny, osobnyOdber, b2b.kod, tlace]);
  const pripravene = !!nast && nast.aktivny !== false && !!produkt && tlace.length > 0 && pocetKs >= minKs;
  const { cena, chyba } = useCenaNahlad(supabase, FUNKCIA, teloCeny, pripravene);

  const nahrajSubory = async (zoznam = tlace) => {
    const sk = crypto.randomUUID();
    const vysledok = [];
    for (const t of zoznam) {
      if (!t.subor) { vysledok.push({ suborCesta: null, suborNazov: null }); continue; }
      const cesta = `potlac/${sk}/${t.umiestnenie}_${t.subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(cesta, t.subor, { contentType: t.subor.type || undefined });
      if (error) throw new Error('Súbor sa nepodarilo nahrať: ' + error.message);
      vysledok.push({ suborCesta: cesta, suborNazov: t.subor.name });
    }
    return vysledok;
  };
  const chybajuSubory = tlace.some((t) => !t.subor && !t.navrhJson);
  // pred objednávkou sa dokončia rozpracované návrhy v otvorených editoroch
  const dokonciNavrhy = async () => {
    const hotove = {};
    for (const [id, fn] of Object.entries(flushRef.current)) { const patch = await fn(); if (patch) hotove[id] = patch; }
    return tlace.map((t) => (hotove[t.id] ? { ...t, ...hotove[t.id] } : t));
  };
  const objednat = async () => {
    if (chybajuSubory) { setChybaObj('Pridajte prosím grafiku ku každej potlači (nahrajte súbor alebo si ju navrhnite).'); return; }
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const zoznam = await dokonciNavrhy();
      if (zoznam.some((t) => !t.subor)) throw new Error('Motív je prázdny — pridajte text, symbol alebo grafiku.');
      const subory = await nahrajSubory(zoznam);
      const d = await volaj({ ...teloCeny, tlace: zoznam.map((t, i) => ({ umiestnenie: t.umiestnenie, sirkaCm: t.sirka, vyskaCm: t.vyska, farby: t.farby, efekt: t.efekt, ...subory[i] })), preview: undefined });
      setPotvrdenie(`Objednávka bola vytvorená — ${Number(d.cenaSpolu).toFixed(2)} €. Presmerúvam na platbu…`);
      window.location.href = d.checkoutUrl;
    } catch (e) { setChybaObj('Objednávku sa nepodarilo odoslať: ' + e.message); } finally { setBezi(false); }
  };

  if (nacitava) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (chybaNacitania) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chybaNacitania}</div>;
  if (nast?.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Appka je dočasne vypnutá.</div>;
  if (!produkt) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Zatiaľ nie je dostupný žiadny produkt.</div>;

  const pole = 'w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium bg-white';
  const farbaNazov = produkt.farby?.find((f) => f.hex === farbaHex)?.nazov || '';
  const riadky = cena ? [
    ['Technológia', TECH[technologia].nazov],
    ['Počet kusov', `${cena.pocetKs} ks`],
    ['Textil', vlastnyTextil ? `Vlastný (${material === 'polyester' ? 'polyester' : 'bavlna'})` : `${produkt.nazov}, ${farbaNazov}`],
    ...(cena.textilSpoluBezDph > 0 ? [[`Textil od nás (${cena.pocetKs} ks × ${eur(cena.textilKsBezDph)})`, `${eur(cena.textilSpoluBezDph)}`]] : []),
    ...(cena.tlace || []).map((t) => [t.nazov, `${eur(t.cenaKsBezDph)} / ks`]),
    ...(cena.priplatokPolyesterPercent > 0 ? [['Príplatok polyester (v cenách vyššie)', `+${cena.priplatokPolyesterPercent} %`]] : []),
  ] : [];
  const nahlad = (
    <TrickoNahlad produkt={produkt} farbaHex={farbaHex} pohlad={pohlad} onPohlad={setPohlad} tlace={tlace} umiestnenia={umiestnenia} vybranaId={vybranaId} onVyber={setVybranaId} />
  );
  const techDostupne = PORADIE_TECH.filter((t) => (produkt.technologie || []).includes(t));

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Potlač textilu" subtitle="Tričká, mikiny a ďalšie: DTF, rezaný transfer alebo sieťotlač" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {nast?.infoText && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{nast.infoText}</p>}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          {/* mobil: vizualizácia je prilepená hore, ovládacie prvky sú pod ňou — zmenu farby či potlače vidno hneď */}
          <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4 pt-1 pb-2 bg-slate-50/95 backdrop-blur"><div className="bg-white rounded-2xl border border-slate-200 p-2">{nahlad}</div></div>
          <Sekcia cislo="1" nazov="Čo chcete potlačiť?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {produkty.map((p) => (
                <button key={p.id} type="button" onClick={() => vyberProdukt(p)}
                  className={`text-left rounded-xl border overflow-hidden transition ${p.id === produktId ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <img src={p.fotoPredok} alt="" className="w-full h-28 object-contain bg-white" loading="lazy" />
                  <div className="p-2.5 pt-1.5">
                    <div className="text-sm font-semibold text-slate-800 leading-tight">{p.nazov}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.cenaTextiluBezDph > 0 ? `textil od ${eur(p.cenaTextiluBezDph)} bez DPH` : 'textil od nás'}</div>
                  </div>
                </button>
              ))}
            </div>
            {produkt.popis && !/FIKT[ÍI]VN/i.test(produkt.popis) && <p className="text-xs text-slate-500">{produkt.popis}</p>}
          </Sekcia>

          <Sekcia cislo="2" nazov="Textil a farba">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Volba aktivna={!vlastnyTextil} onClick={() => setVlastnyTextil(false)} podtext="Dodáme vám textil aj s potlačou — vyberiete veľkosti a farbu.">
                <Shirt className="w-4 h-4" /> Textil od vás
              </Volba>
              <Volba aktivna={vlastnyTextil} onClick={() => setVlastnyTextil(true)} podtext="Pošlete alebo prinesiete vlastné kusy, my ich len potlačíme (cena je len za potlač).">
                <Check className="w-4 h-4" /> Mám vlastný textil
              </Volba>
            </div>
            {vlastnyTextil && (
              <div className="grid grid-cols-2 gap-2">
                <Volba aktivna={material === 'bavlna'} onClick={() => setMaterial('bavlna')}>Bavlna</Volba>
                <Volba aktivna={material === 'polyester'} onClick={() => setMaterial('polyester')}>Polyester</Volba>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{vlastnyTextil ? 'Farba vášho textilu (pre vizualizáciu a cenu)' : 'Farba'}: <span className="text-slate-800 font-semibold">{farbaNazov}</span></label>
              <div className="flex flex-wrap gap-2">
                {(produkt.farby || []).map((f) => (
                  <button key={f.hex} type="button" title={f.nazov} onClick={() => setFarbaHex(f.hex)} aria-label={f.nazov}
                    className={`w-9 h-9 rounded-full border-2 transition ${farbaHex === f.hex ? 'border-indigo-600 ring-2 ring-indigo-200 scale-105' : 'border-slate-300 hover:border-slate-400'}`} style={{ background: f.hex }} />
                ))}
              </div>
            </div>
          </Sekcia>

          <Sekcia cislo="3" nazov="Technológia potlače">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PORADIE_TECH.map((k) => (
                <Volba key={k} aktivna={technologia === k} disabled={!techDostupne.includes(k)} onClick={() => setTechnologia(k)}
                  podtext={techDostupne.includes(k) ? TECH[k].popis : 'Pre tento produkt nie je dostupná.'}>
                  {TECH[k].nazov}{k === 'sietotlac' && nast.minKs.sietotlac > 1 && <span className="text-[10px] font-medium text-slate-400">od {nast.minKs.sietotlac} ks</span>}
                </Volba>
              ))}
            </div>
          </Sekcia>

          <Sekcia cislo="4" nazov="Potlače a grafika" akcia={volneMiesta.length > 0 && tlace.length < 6 ? (
            <button type="button" onClick={pridajTlac} className="text-xs font-semibold text-indigo-700 hover:text-indigo-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať potlač</button>
          ) : null}>
            <div className="space-y-3">
              {tlace.map((t, i) => {
                const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
                const sirkaChyba = u && (t.sirka > u.maxSirkaCm || t.vyska > u.maxVyskaCm);
                return (
                  <div key={t.id} onClick={() => setVybranaId(t.id)} className={`rounded-xl border p-3 space-y-3 ${vybranaId === t.id ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-slate-50/60'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Potlač {i + 1}</span>
                      {tlace.length > 1 && <button type="button" onClick={() => zmazTlac(t.id)} className="text-slate-400 hover:text-rose-600 p-1" aria-label="Odstrániť potlač"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Umiestnenie</label>
                        <div className="relative">
                          <select value={t.umiestnenie} onChange={(e) => zmenUmiestnenie(t.id, e.target.value)} className={`${pole} appearance-none pr-8`}>
                            {miesta.filter((x) => x.kod === t.umiestnenie || volneMiesta.some((v) => v.kod === x.kod)).map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                        {u?.popis && <p className="text-[11px] text-slate-400 mt-1">{u.popis} (max. {u.maxSirkaCm} × {u.maxVyskaCm} cm)</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (cm)</label><NumberInput disabled={!!t.navrhJson} min="1" max={u?.maxSirkaCm} step="0.5" value={t.sirka} onChange={(v) => uprav(t.id, { sirka: Math.min(u?.maxSirkaCm || 43, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (cm)</label><NumberInput disabled={!!t.navrhJson} min="1" max={u?.maxVyskaCm} step="0.5" value={t.vyska} onChange={(v) => uprav(t.id, { vyska: Math.min(u?.maxVyskaCm || 58, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                      </div>
                      {TECH[technologia].farby && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">{technologia === 'rezany' ? 'Počet farieb fólie (1–6)' : 'Počet farieb (1–6)'}</label>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => uprav(t.id, { farby: Math.max(1, t.farby - 1) })} className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Menej farieb"><Minus className="w-4 h-4" /></button>
                            <span className="text-lg font-bold font-mono w-8 text-center">{t.farby}</span>
                            <button type="button" onClick={() => uprav(t.id, { farby: Math.min(6, t.farby + 1) })} className="w-9 h-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-50" aria-label="Viac farieb"><Plus className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                      {TECH[technologia].efekt && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Typ farby / efekt</label>
                          <select value={t.efekt} onChange={(e) => uprav(t.id, { efekt: e.target.value })} className={pole}>
                            {efekty.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}{x.priplatokPercent > 0 ? ` (+${x.priplatokPercent} %)` : ''}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    {t.navrhJson && <p className="text-[11px] text-emerald-700">Rozmer sa nastavil automaticky podľa vášho motívu.</p>}
                    {sirkaChyba && <p className="text-xs text-rose-600">Rozmer presahuje maximum pre toto umiestnenie ({u.maxSirkaCm} × {u.maxVyskaCm} cm).</p>}
                    <div>
                      <input ref={(el) => { fileRefs.current[t.id] = el; }} type="file" accept={POVOLENE.join(',')} className="hidden" onChange={(e) => { vyberSubor(t.id, e.target.files?.[0]); e.target.value = ''; }} />
                      <button type="button" onClick={() => fileRefs.current[t.id]?.click()}
                        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); vyberSubor(t.id, e.dataTransfer.files?.[0]); }}
                        className={`w-full rounded-xl border-2 border-dashed p-3 flex items-center gap-3 text-left transition ${t.subor ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                        {t.nahlad ? <img src={t.nahlad} alt="" className="w-12 h-12 object-contain rounded bg-slate-100 shrink-0" /> : t.subor ? <FileImage className="w-8 h-8 text-emerald-600 shrink-0" /> : <Upload className="w-7 h-7 text-slate-400 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-700 truncate">{t.subor ? t.subor.name : 'Nahrať vlastnú grafiku'}</span>
                          <span className="block text-[11px] text-slate-400">{t.subor ? 'Kliknutím súbor vymeníte' : `Kliknite alebo pretiahnite súbor (${POVOLENE.join(', ')}, max. ${MAX_MB} MB). Najlepšie vektor alebo PNG s priehľadným pozadím.`}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => setNavrhId(navrhId === t.id ? null : t.id)}
                        className="mt-2 w-full rounded-xl border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 p-3 flex items-center gap-3 text-left transition">
                        <PenTool className="w-7 h-7 text-indigo-500 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-indigo-900">{navrhId === t.id ? 'Zavrieť editor' : t.navrhJson ? 'Upraviť môj návrh' : 'Navrhnúť vlastný motív priamo tu'}</span>
                          <span className="block text-[11px] text-indigo-700/70">Text, písma, symboly, knižnica grafík — motív hneď vidíte na produkte.</span>
                        </span>
                      </button>
                      {navrhId === t.id && u && (
                        <div className="mt-2">
                          <NavrhInline key={`${t.id}-${t.umiestnenie}`} supabase={supabase} id={t.id} maxSirkaCm={u.maxSirkaCm} maxVyskaCm={u.maxVyskaCm} podkladFarba={farbaHex}
                            upozornenie={technologia === 'dtf' ? null : technologia === 'rezany'
                              ? `Rezaný transfer sa vyrezáva z jednofarebnej fólie — používajte plné tvary a texty (${t.farby} ${t.farby === 1 ? 'farba' : t.farby < 5 ? 'farby' : 'farieb'}). Fotografie a jemné prechody nejdú; na ne je lepší DTF.`
                              : `Sieťotlač je vhodná na jednoduché plné plochy a texty (${t.farby} ${t.farby === 1 ? 'farba' : t.farby < 5 ? 'farby' : 'farieb'}). Fotografie a farebné prechody sa v sieťotlači nevytlačia — na ne je lepšia DTF potlač.`}
                            povodnyJson={t.navrhJson} onZmena={(patch) => uprav(t.id, patch)} registruj={registruj} onZavri={() => setNavrhId(null)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Sekcia>

          <Sekcia cislo="5" nazov={vlastnyTextil ? 'Počet kusov' : 'Veľkosti a počet kusov'}>
            {vlastnyTextil ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <NumberInput min={minKs} max={nast.maxKs} step="1" value={pocetKsVlastny} onChange={(v) => setPocetKsVlastny(Math.min(nast.maxKs, Math.max(1, Math.round(v))))} fallback={minKs} className="w-36 border border-slate-300 rounded-lg p-2.5 text-lg font-bold font-mono bg-white" />
                  <div className="flex flex-wrap gap-2">
                    {RYCHLE_KS.filter((k) => k >= minKs).map((k) => <button key={k} type="button" onClick={() => setPocetKsVlastny(k)} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${pocetKsVlastny === k ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{k} ks</button>)}
                  </div>
                </div>
                <p className="text-xs text-slate-400">{minKs > 1 ? `Minimálny odber pre ${TECH[technologia].nazov.toLowerCase()} je ${minKs} ks (príprava sít). ` : ''}Čím viac kusov, tým nižšia cena za kus.</p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(produkt.velkosti || []).map((v) => (
                    <div key={v}>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1 text-center">{v}</label>
                      <NumberInput min="0" max={nast.maxKs} step="1" value={velkosti[v] || 0} onChange={(q) => setVelkosti((s) => ({ ...s, [v]: Math.max(0, Math.round(q)) }))} fallback={0} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold font-mono bg-white text-center" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Spolu: <strong>{pocetKs} ks</strong>{pocetKs < minKs && <span className="text-rose-600"> — minimálny odber pre {TECH[technologia].nazov.toLowerCase()} je {minKs} ks.</span>}</p>
              </>
            )}
          </Sekcia>

          {cena?.urovne && <MnozstevneZlavy urovne={cena.urovne} pocetKs={pocetKs} b2bPercent={cena.zlavaB2bPercent} b2bKod={b2b.kod} />}
        </div>

        <aside className="lg:sticky lg:top-20 space-y-3 min-w-0">
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 p-3">{nahlad}</div>
          <CenaSuhrn cena={cena} chyba={chyba || (!pripravene && pocetKs < minKs ? `Zadajte aspoň ${minKs} ks.` : '')} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi}
            chybaObjednavky={chybaObj} potvrdenie={potvrdenie} zakazane={chybajuSubory || !pripravene} poznamkaZakazane="Pred objednávkou pridajte grafiku ku každej potlači." riadky={riadky} />
          <p className="text-[11px] text-slate-400 text-center">{vlastnyTextil ? 'Cena je len za potlač (vlastný textil). ' : 'V cene je textil aj potlač. '}Platba kartou cez Shopify.</p>
        </aside>
      </main>
    </div>
  );
}
