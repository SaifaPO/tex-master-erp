import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Upload, Trash2, FileImage, ChevronDown, PenTool, Shirt, Check } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';
import TrickoEditor from './TrickoEditor';

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
  dtf: { nazov: 'DTF transfer', popis: 'Plnofarebná digitálna tlač aj od jedného kusa — fotky, farebné prechody, super stabilita, pratelnosť a živé farby. Najnovšia technológia na trhu: farba je nanesená na povrch trička zažehlením. Potlačí sa na všetky farby a materiály.', farby: false, efekt: false },
  rezany: { nazov: 'Rezaný transfer', popis: 'Ideálny na kusovky — kvalitná rezaná fólia (1 farba = 1 fólia), veľmi odolná. Výhodou sú zaujímavé efektné fólie: neónové, reflexné, metalické, glitrové, semišové, pufinové a ďalšie.', farby: true, efekt: false },
  sietotlac: { nazov: 'Sieťotlač', popis: 'Najlepšia na veľké série a veľké motívy, najmä na jedno-, dvoj- a trojfarebné potlače. Staré remeslo, kvalitná potlač — farba ostáva na povrchu trička.', farby: true, efekt: true },
  sublimacia: { nazov: 'Sublimácia', popis: 'Plnofarebná potlač, pri ktorej farba zafarbí samotné vlákno — potlač sa nedá nahmatať. Robí sa len na 100 % polyester alebo zmesi polyestru (na bielu a svetlú látku).', farby: false, efekt: false },
};
const PORADIE_TECH = ['dtf', 'rezany', 'sietotlac', 'sublimacia'];
const lumHex = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1; const n = parseInt(m[1], 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

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

// veľkostné tabuľky produktov (obrázky vo /public/produkty); ďalšie produkty sa dopĺňajú sem
const TABULKY = { 'tricko-panske': '/produkty/velkostna-tabulka-tricko-panske.jpg', 'tricko-damske': '/produkty/velkostna-tabulka-tricko-damske.jpg' };

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
  const [tabulka, setTabulka] = useState(false); // okno s veľkostnou tabuľkou
  const edRef = useRef(null); // editor motívov priamo na produkte
  const [nezaradene, setNezaradene] = useState(0); // objekty na produkte mimo akejkoľvek potlače
  const zivy = useCallback((out) => setTlace((l) => l.map((t) => (out[t.id] ? { ...t, ...out[t.id] } : t))), []);
  const fileRefs = useRef({});

  const volaj = async (body) => {
    const { data, error } = await supabase.functions.invoke(FUNKCIA, { body });
    if (error) throw new Error(`Spojenie so serverom zlyhalo (${error.message || 'chyba'}).`);
    if (!data?.ok) throw new Error(data?.error || 'Server nevrátil odpoveď.');
    return data;
  };

  const produkt = produkty.find((p) => p.id === produktId) || null;
  const miesta = useMemo(() => (produkt ? umiestnenia.filter((u) => produkt.pozicie?.[u.kod]) : []), [produkt, umiestnenia]);

  // textil: tmavý / polyester -> dostupnosť technológií; max. rozmery potlače podľa technológie a podľa najmenšej zvolenej veľkosti trička
  const tmavyTextil = lumHex(farbaHex) < 0.5;
  const jePolyester = produkt ? (vlastnyTextil ? material === 'polyester' : /polyester/i.test(produkt.material || '')) : false;
  const techDostupne = produkt ? PORADIE_TECH.filter((k) => (k === 'sublimacia' ? (jePolyester && !tmavyTextil) : (produkt.technologie || []).includes(k))) : [];
  const limity = nast?.limity || {};
  const zvoleneVelkosti = Object.entries(velkosti).filter(([, q]) => Number(q) > 0).map(([k]) => k);
  const maxPlochy = (u) => {
    let sMax = u.maxSirkaCm, vMax = u.maxVyskaCm, dovod = '';
    if (u.maxSirkaCm >= 30) { // veľké plochy (hruď stred, chrbát): limit technológie + limit podľa veľkosti trička
      const tm = limity.maxRozmery?.[technologia];
      if (tm) { sMax = tm.sirka; vMax = tm.vyska; }
      if (!vlastnyTextil && produkt?.velkostnaTabulka) {
        for (const k of zvoleneVelkosti) {
          const r = produkt.velkostnaTabulka[k]; if (!r) continue;
          const ds = r.A - (limity.okrajSirkaCm ?? 8), dv = r.B - (limity.okrajVyskaCm ?? 20);
          if (ds < sMax) { sMax = ds; dovod = `veľkosť ${k}`; }
          if (dv < vMax) { vMax = dv; dovod = `veľkosť ${k}`; }
        }
      }
    }
    return { sirka: Math.max(1, Math.floor(sMax)), vyska: Math.max(1, Math.floor(vMax)), dovod };
  };
  const umiestneniaEf = umiestnenia.map((u) => { const m = maxPlochy(u); return { ...u, maxSirkaCm: m.sirka, maxVyskaCm: m.vyska, dovodMax: m.dovod }; });
  const pocetNazehleni = (w, h) => { const a = limity.lisSirkaCm || 38, b = limity.lisVyskaCm || 48; return Math.max(1, Math.min(Math.ceil(w / a) * Math.ceil(h / b), Math.ceil(w / b) * Math.ceil(h / a))); };
  useEffect(() => { if (produkt && techDostupne.length && !techDostupne.includes(technologia)) setTechnologia('dtf'); }, [techDostupne.join('|'), technologia]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const stara = tlace.find((x) => x.id === id);
    uprav(id, { umiestnenie: kod, ...(stara?.maNavrh ? {} : { sirka: Math.min(u.vychodziaSirkaCm, u.maxSirkaCm), vyska: Math.min(u.vychodziaVyskaCm, u.maxVyskaCm) }) });
    if (stara?.maNavrh) setTimeout(() => edRef.current?.presunZonu(stara.umiestnenie, kod), 250);
  };
  const zmazTlac = (id) => {
    const t = tlace.find((x) => x.id === id);
    if (t) edRef.current?.odstranZonu(t.umiestnenie);
    setTlace((l) => { const x = l.find((y) => y.id === id); if (x?.nahlad && !x.maNavrh) URL.revokeObjectURL(x.nahlad); return l.filter((y) => y.id !== id); });
  };
  const vyberSubor = (id, f) => {
    if (!f) return;
    const pripona = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!POVOLENE.includes(pripona)) { window.alert(`Nahrajte prosím súbor vo formáte: ${POVOLENE.join(', ')}.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { window.alert(`Súbor je príliš veľký (max. ${MAX_MB} MB).`); return; }
    if (jeObrazok(f) && edRef.current) { const kod = tlace.find((x) => x.id === id)?.umiestnenie; edRef.current.pridajObrazok(f, kod); return; } // obrázok sa vloží priamo na produkt (dá sa posúvať, otáčať, meniť veľkosť)
    uprav(id, { subor: f, nahlad: null, maNavrh: false });
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
  const chybajuSubory = tlace.some((t) => !t.subor && !t.maNavrh);
  const prekrocene = tlace.some((t) => { const u = umiestneniaEf.find((x) => x.kod === t.umiestnenie); return t.presah || (u && (t.sirka > u.maxSirkaCm + 0.01 || t.vyska > u.maxVyskaCm + 0.01)); });
  // pred objednávkou sa z motívov na produkte vytvoria tlačové PNG (orezané na motív)
  const dokonciNavrhy = async () => {
    const hotove = (await edRef.current?.dokonci()) || {};
    return tlace.map((t) => (hotove[t.id] ? { ...t, ...hotove[t.id] } : t));
  };
  const objednat = async () => {
    if (chybajuSubory) { setChybaObj('Pridajte prosím grafiku ku každej potlači (nahrajte súbor alebo si ju navrhnite).'); return; }
    if (prekrocene) { setChybaObj('Niektorý motív je väčší než maximálny rozmer pre svoje umiestnenie.'); return; }
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const zoznam = await dokonciNavrhy();
      if (zoznam.some((t) => !t.subor)) throw new Error('Motív je prázdny — pridajte text, logo alebo obrázok.');
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

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      {tabulka && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setTabulka(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800">Veľkostná tabuľka — {produkt.nazov}</h3><button type="button" onClick={() => setTabulka(false)} className="text-slate-500 hover:text-slate-800 text-sm font-semibold">Zavrieť</button></div>
            {(produkt.velkostnaTabulkaUrl || TABULKY[produkt.kod]) ? <img src={produkt.velkostnaTabulkaUrl || TABULKY[produkt.kod]} alt="Veľkostná tabuľka" className="w-full" /> : <p className="text-sm text-slate-500">Veľkostnú tabuľku pre tento produkt práve dopĺňame.</p>}
          </div>
        </div>
      )}
      <PbtHeader title="Potlač textilu" subtitle="Tričká, mikiny a ďalšie: DTF, rezaný transfer alebo sieťotlač" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {nast?.infoText && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{nast.infoText}</p>}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* vizuál je vždy hore „napevno“ (mobil: prilepený pod hlavičkou, počítač: vľavo) — zmeny vidno hneď, bez scrollovania */}
        <div className="sticky top-16 lg:top-20 z-30 -mx-4 px-4 pt-1 pb-2 lg:mx-0 lg:px-0 lg:pt-0 bg-slate-50/95 backdrop-blur lg:bg-transparent lg:backdrop-blur-none min-w-0 self-start">
          <TrickoEditor key={produkt.id} ref={edRef} supabase={supabase} produkt={produkt} farbaHex={farbaHex} umiestnenia={umiestneniaEf} tlace={tlace} onZivy={zivy} onNezaradene={setNezaradene} bezSymbolov={technologia !== 'dtf'}>
            {({ nastroje, plocha }) => (
              <div className="space-y-3">
                {plocha}
                {nastroje}
              </div>
            )}
          </TrickoEditor>
        </div>
        <div className="space-y-4 min-w-0">
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


          <Sekcia cislo="3" nazov="Potlače a grafika" akcia={volneMiesta.length > 0 && tlace.length < 6 ? (
            <button type="button" onClick={pridajTlac} className="text-xs font-semibold text-indigo-700 hover:text-indigo-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať potlač</button>
          ) : null}>
            <div className="space-y-3">
              {tlace.map((t, i) => {
                const u = umiestneniaEf.find((x) => x.kod === t.umiestnenie);
                const sirkaChyba = u && (t.sirka > u.maxSirkaCm || t.vyska > u.maxVyskaCm);
                return (
                  <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
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
                        {u?.popis && <p className="text-[11px] text-slate-400 mt-1">{u.popis} (max. {u.maxSirkaCm} × {u.maxVyskaCm} cm{u.dovodMax ? ` — kvôli ${u.dovodMax}` : ''})</p>}
                      </div>
                      {t.subor ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (cm)</label><NumberInput disabled={!!t.maNavrh} min="1" max={u?.maxSirkaCm} step="0.5" value={t.sirka} onChange={(v) => uprav(t.id, { sirka: Math.min(u?.maxSirkaCm || 43, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (cm)</label><NumberInput disabled={!!t.maNavrh} min="1" max={u?.maxVyskaCm} step="0.5" value={t.vyska} onChange={(v) => uprav(t.id, { vyska: Math.min(u?.maxVyskaCm || 58, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                      </div>
                      ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 flex items-center">{t.maNavrh ? <span>Rozmer motívu: <strong>{t.sirka} × {t.vyska} cm</strong> (podľa motívu na produkte)</span> : <span>Rozmer sa nastaví podľa motívu — vložte ho na produkt a zmeňte mu veľkosť.</span>}</div>
                      )}
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
                    {t.maNavrh && t.nahlad && <p className="text-[11px] text-emerald-700 flex items-center gap-2"><img src={t.nahlad} alt="" className="h-8 object-contain rounded bg-slate-100" />Náhľad motívu pre túto potlač</p>}
                    {t.presah && <p className="text-xs text-rose-600">Motív je väčší než maximálny rozmer pre toto umiestnenie — zmenšite ho.</p>}
                    {technologia === 'dtf' && pocetNazehleni(t.sirka, t.vyska) > 1 && <p className="text-xs text-amber-700">{`Motív je väčší než plocha lisu (${limity.lisSirkaCm || 38} × ${limity.lisVyskaCm || 48} cm) — žehlí sa na ${pocetNazehleni(t.sirka, t.vyska)} krát, zvýšená manipulácia je započítaná v cene.`}</p>}
                    {sirkaChyba && <p className="text-xs text-rose-600">Rozmer presahuje maximum pre toto umiestnenie ({u.maxSirkaCm} × {u.maxVyskaCm} cm).</p>}
                    <div>
                      <input ref={(el) => { fileRefs.current[t.id] = el; }} type="file" accept={POVOLENE.join(',')} className="hidden" onChange={(e) => { vyberSubor(t.id, e.target.files?.[0]); e.target.value = ''; }} />
                      <button type="button" onClick={() => fileRefs.current[t.id]?.click()}
                        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); vyberSubor(t.id, e.dataTransfer.files?.[0]); }}
                        className={`w-full rounded-xl border-2 border-dashed p-3 flex items-center gap-3 text-left transition ${t.subor ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                        {t.nahlad ? <img src={t.nahlad} alt="" className="w-12 h-12 object-contain rounded bg-slate-100 shrink-0" /> : t.subor ? <FileImage className="w-8 h-8 text-emerald-600 shrink-0" /> : <Upload className="w-7 h-7 text-slate-400 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-700 truncate">{t.subor ? t.subor.name : 'Nahrať obrázok alebo súbor (PDF, AI, EPS)'}</span>
                          <span className="block text-[11px] text-slate-400">{t.subor ? 'Kliknutím súbor vymeníte (PDF/AI/EPS sa pošlú tak, ako sú)' : 'Obrázok (PNG, JPG, SVG) sa vloží priamo na produkt — môžete ho posúvať a meniť. ' + `Kliknite alebo pretiahnite súbor (${POVOLENE.join(', ')}, max. ${MAX_MB} MB). Najlepšie vektor alebo PNG s priehľadným pozadím.`}</span>
                        </span>
                      </button>
                      <p className="mt-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">Text a logo pridajte priamo na produkt (nástroje sú pri ňom) a nastavte im veľkosť — cena sa spočíta podľa rozmerov motívu. Prerušovaný obdĺžnik je len náznak maximálneho rozmeru. Bez motívu stačí zadať rozmery vyššie.</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Sekcia>

          <Sekcia cislo="4" nazov="Technológia potlače">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PORADIE_TECH.map((k) => (
                <Volba key={k} aktivna={technologia === k} disabled={!techDostupne.includes(k)} onClick={() => setTechnologia(k)}
                  podtext={techDostupne.includes(k) ? TECH[k].popis : (k === 'sublimacia' ? (!jePolyester ? 'Sublimácia sa robí len na 100 % polyester alebo zmesi polyestru — vybraný textil je bavlna.' : 'Sublimácia sa robí len na bielu a svetlú látku.') : 'Pre tento produkt nie je dostupná.')}>
                  {TECH[k].nazov}{k === 'sietotlac' && nast.minKs.sietotlac > 1 && <span className="text-[10px] font-medium text-slate-400">od {nast.minKs.sietotlac} ks</span>}
                </Volba>
              ))}
            </div>
            {technologia !== 'dtf' && <p className="text-[11px] text-slate-600">Symboly (smajlíky, hviezdičky, šípky…) sú dostupné len pri DTF potlači.</p>}
            {technologia === 'rezany' && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Rezaný transfer sa vyrezáva z jednofarebnej fólie — používajte plné tvary a texty. Fotografie a jemné prechody nejdú; na ne je lepší DTF.</p>}
            {technologia === 'sietotlac' && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Sieťotlač je vhodná na jednoduché plné plochy a texty. Každá farba navyše = ďalšie sito (vyššia cena). Fotografie a farebné prechody patria do DTF.</p>}
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
                {produkt.kategoria !== 'siltovka' && <button type="button" onClick={() => setTabulka(true)} className="text-xs font-semibold text-indigo-700 hover:text-indigo-600 underline">Zobraziť veľkostnú tabuľku</button>}
                <p className="text-xs text-slate-500">Spolu: <strong>{pocetKs} ks</strong>{pocetKs < minKs && <span className="text-rose-600"> — minimálny odber pre {TECH[technologia].nazov.toLowerCase()} je {minKs} ks.</span>}</p>
              </>
            )}
          </Sekcia>

          {cena?.urovne && <MnozstevneZlavy urovne={cena.urovne} pocetKs={pocetKs} b2bPercent={cena.zlavaB2bPercent} b2bKod={b2b.kod} />}
          <div className="space-y-3">
          <CenaSuhrn cena={cena} chyba={chyba || (!pripravene && pocetKs < minKs ? `Zadajte aspoň ${minKs} ks.` : '')} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi}
            chybaObjednavky={chybaObj} potvrdenie={potvrdenie} zakazane={chybajuSubory || !pripravene || prekrocene || nezaradene > 0} poznamkaZakazane={prekrocene ? 'Niektorý motív je väčší než maximálny rozmer pre svoje umiestnenie (rukáv max. 10 × 10 cm). Zmenšite ho — objednávku nie je možné odoslať.' : nezaradene > 0 ? 'Na produkte máte motív mimo potlače (napr. na chrbte bez pridanej potlače). Pridajte potlač s týmto umiestnením alebo motív zmažte.' : 'Pred objednávkou pridajte grafiku ku každej potlači.'} riadky={riadky} />
          <p className="text-[11px] text-slate-400 text-center">{vlastnyTextil ? 'Cena je len za potlač (vlastný textil). ' : 'V cene je textil aj potlač. '}Platba kartou cez Shopify.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
