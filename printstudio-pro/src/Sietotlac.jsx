import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Minus, Plus, Send, CheckCircle2, Moon, Sun, Upload, Trash2, FileImage, ChevronDown, PenTool } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';
import TrickoEditor from './TrickoEditor';

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

  const [tricko, setTricko] = useState(null); // produkt (tričko) s fotkami a pozíciami potlačových plôch — editor motívov je priamo na ňom
  const [farbaHex, setFarbaHex] = useState('#ffffff');
  const [aktivnaId, setAktivnaId] = useState(null); // vybraná potlač = zóna, do ktorej sa vkladá text / logo
  const edRef = useRef(null);
  const [suhlas, setSuhlas] = useState(false); // potvrdenie: potlač na textil dodaný zákazníkom
  const zivy = useCallback((out) => setTlace((l) => l.map((t) => (out[t.id] ? { ...t, ...out[t.id] } : t))), []);
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
        if (u) { const prva = { id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: d.efekty[0]?.kod || 'klasicka', subor: null, nahlad: null }; setTlace([prva]); setAktivnaId(prva.id); }
        try {
          const r = await supabase.functions.invoke('potlac-textilu', { body: { akcia: 'cennik' } });
          const pr = r.data?.produkty || [];
          const p = pr.find((x) => x.kod === 'tricko-panske') || pr.find((x) => x.kategoria === 'tricko');
          if (p) setTricko(p);
        } catch { /* editor na produkte nie je dostupný */ }
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
    const nova = { id: noveId(), umiestnenie: u.kod, sirka: u.vychodziaSirkaCm, vyska: u.vychodziaVyskaCm, farby: 1, efekt: efekty[0]?.kod || 'klasicka', subor: null, nahlad: null };
    setTlace((l) => [...l, nova]); setAktivnaId(nova.id);
  };
  const zmenUmiestnenie = (id, kod) => {
    const u = umiestnenia.find((x) => x.kod === kod);
    const stara = tlace.find((x) => x.id === id);
    if (u) uprav(id, { umiestnenie: kod, ...(stara?.maNavrh ? {} : { sirka: Math.min(u.vychodziaSirkaCm, u.maxSirkaCm), vyska: Math.min(u.vychodziaVyskaCm, u.maxVyskaCm) }) });
    if (stara?.maNavrh) setTimeout(() => edRef.current?.presunZonu(stara.umiestnenie, kod), 250);
    setAktivnaId(id);
  };
  const zmazTlac = (id) => {
    const t = tlace.find((x) => x.id === id);
    if (t) edRef.current?.odstranZonu(t.umiestnenie);
    setTlace((l) => l.filter((x) => x.id !== id));
    if (aktivnaId === id) setAktivnaId(tlace.find((x) => x.id !== id)?.id || null);
  };
  const vyberSubor = (id, f) => {
    if (!f) return;
    const pripona = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!POVOLENE.includes(pripona)) { window.alert(`Nahrajte prosím súbor vo formáte: ${POVOLENE.join(', ')}.`); return; }
    if (f.size > MAX_MB * 1024 * 1024) { window.alert(`Súbor je príliš veľký (max. ${MAX_MB} MB).`); return; }
    if (jeObrazok(f) && edRef.current) { setAktivnaId(id); setTimeout(() => edRef.current?.pridajObrazok(f), 200); return; } // obrázok sa vloží priamo na tričko (dá sa posúvať, otáčať, meniť veľkosť)
    uprav(id, { subor: f, nahlad: null, maNavrh: false });
  };

  const teloCeny = useMemo(() => ({
    material, tmavy, dveVelkosti, pocetKs, osobnyOdber, b2bKod: b2b.kod,
    tlace: tlace.map((t) => ({ umiestnenie: t.umiestnenie, sirkaCm: t.sirka, vyskaCm: t.vyska, farby: t.farby, efekt: t.efekt })),
  }), [material, tmavy, dveVelkosti, pocetKs, osobnyOdber, b2b.kod, tlace]);
  const { cena, chyba } = useCenaNahlad(supabase, FUNKCIA, teloCeny, !!nast && nast.aktivny !== false && tlace.length > 0);

  const nahrajSubory = async (zoznam = tlace) => {
    const sk = crypto.randomUUID();
    const vysledok = [];
    for (const t of zoznam) {
      if (!t.subor) { vysledok.push({ suborCesta: null, suborNazov: null }); continue; }
      const cesta = `sietotlac/${sk}/${t.umiestnenie}_${t.subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(cesta, t.subor, { contentType: t.subor.type || undefined });
      if (error) throw new Error('Súbor sa nepodarilo nahrať: ' + error.message);
      vysledok.push({ suborCesta: cesta, suborNazov: t.subor.name });
    }
    return vysledok;
  };
  const telo = (subory, zoznam = tlace) => ({ ...teloCeny, tlace: zoznam.map((t, i) => ({ umiestnenie: t.umiestnenie, sirkaCm: t.sirka, vyskaCm: t.vyska, farby: t.farby, efekt: t.efekt, ...subory[i] })) });
  // pred objednávkou sa z motívov na tričku vytvoria tlačové PNG (orezané na motív)
  const dokonciNavrhy = async () => {
    const hotove = (await edRef.current?.dokonci()) || {};
    return tlace.map((t) => (hotove[t.id] ? { ...t, ...hotove[t.id] } : t));
  };

  const chybajuSubory = tlace.some((t) => !t.subor && !t.maNavrh);
  const objednat = async () => {
    if (chybajuSubory) { setChybaObj('Nahrajte prosím grafiku ku každej potlači alebo si ju navrhnite.'); return; }
    if (!suhlas) { setChybaObj('Potvrďte prosím, že ide o potlač na textil dodaný vami.'); return; }
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const zoznam = await dokonciNavrhy();
      if (zoznam.some((t) => !t.subor)) throw new Error('Motív je prázdny — pridajte text, symbol alebo grafiku.');
      const subory = await nahrajSubory(zoznam);
      const d = await volaj(telo(subory, zoznam));
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
      <div className="px-4 pt-3"><div className="max-w-6xl mx-auto rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs sm:text-sm text-indigo-900 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span><strong>Potlač na textil dodaný vami (zákazníkom).</strong> Cena je len za potlač — textil nám doručíte sami.</span>
        <a href="/?typ=potlac" className="font-bold underline hover:text-indigo-700">Chcem potlač aj s textilom od nás (tričká, mikiny…) →</a>
      </div></div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          {tricko ? (
            <TrickoEditor ref={edRef} supabase={supabase} produkt={tricko} farbaHex={farbaHex} umiestnenia={umiestnenia} tlace={tlace} aktivnaId={aktivnaId} onZivy={zivy}>
              {({ nastroje, plocha }) => (
                <div className="space-y-3">
                  {/* mobil: tričko s motívmi je prilepené hore, nástroje sú pod ním — zmenu vidno hneď bez scrollovania */}
                  <div className="sticky top-16 z-30 lg:static -mx-4 px-4 pt-1 pb-2 lg:mx-0 lg:p-0 bg-slate-50/95 backdrop-blur lg:bg-transparent lg:backdrop-blur-none">{plocha}</div>
                  <details open className="bg-white rounded-2xl border border-slate-200 p-3">
                    <summary className="text-sm font-bold text-slate-800 cursor-pointer">Nástroje: text, symboly, grafiky, obrázok</summary>
                    <div className="mt-3">{nastroje}</div>
                  </details>
                </div>
              )}
            </TrickoEditor>
          ) : <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3">Editor na tričku sa nepodarilo načítať — grafiku môžete nahrať ku každej potlači nižšie.</p>}
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
                  <Volba aktivna={!tmavy} onClick={() => { setTmavy(false); setFarbaHex('#ffffff'); }}><Sun className="w-4 h-4" /> Svetlý</Volba>
                  <Volba aktivna={tmavy} onClick={() => { setTmavy(true); setFarbaHex('#1e2a4a'); }}><Moon className="w-4 h-4" /> Tmavý</Volba>
                </div>
              </div>
            </div>
            {tricko && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Farba trička vo vizualizácii (len na náhľad)</label>
                <div className="flex flex-wrap gap-2">
                  {(tricko.farby || []).map((f) => (
                    <button key={f.hex} type="button" title={f.nazov} aria-label={f.nazov} onClick={() => { setFarbaHex(f.hex); const n = parseInt(f.hex.slice(1), 16); setTmavy((0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 < 0.5); }}
                      className={`w-8 h-8 rounded-full border-2 transition ${farbaHex === f.hex ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-300'}`} style={{ background: f.hex }} />
                  ))}
                </div>
              </div>
            )}
            {tmavy && <p className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2.5">Na tmavý textil sa tlačí v dvoch vrstvách (podklad + farba), aby farby dobre kryli. Je to zohľadnené v cene.</p>}
            {material === 'polyester' && nast.polyesterPriplatokPercent > 0 && <p className="text-xs text-slate-500">Na polyester počítame príplatok {nast.polyesterPriplatokPercent} %.</p>}
          </Sekcia>

          <Sekcia cislo="2" nazov={`Potlače na jednom kuse (${tlace.length})`}
            akcia={<button type="button" onClick={pridajTlac} disabled={volneUmiestnenia.length === 0 || tlace.length >= 6} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Pridať potlač</button>}>
            <p className="text-xs text-slate-500">Napríklad malé logo na srdci a veľká potlač na chrbte, prípadne aj na rukávoch. Každá potlač má vlastný rozmer, počet farieb a grafiku.</p>
            <div className="space-y-3">
              {tlace.map((t, i) => {
                const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
                const efektObj = efekty.find((x) => x.kod === t.efekt);
                const sirkaChyba = u && (t.sirka > u.maxSirkaCm || t.vyska > u.maxVyskaCm);
                return (
                  <div key={t.id} onClick={() => setAktivnaId(t.id)} className={`rounded-xl border p-3 space-y-3 cursor-pointer ${aktivnaId === t.id ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-300' : 'border-slate-200 bg-slate-50/60'}`}>
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
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (cm)</label><NumberInput disabled={!!t.maNavrh} min="1" max={u?.maxSirkaCm} step="0.5" value={t.sirka} onChange={(v) => uprav(t.id, { sirka: Math.min(u?.maxSirkaCm || 43, Math.max(1, v)) })} fallback={10} className={pole} /></div>
                        <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (cm)</label><NumberInput disabled={!!t.maNavrh} min="1" max={u?.maxVyskaCm} step="0.5" value={t.vyska} onChange={(v) => uprav(t.id, { vyska: Math.min(u?.maxVyskaCm || 58, Math.max(1, v)) })} fallback={10} className={pole} /></div>
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
                    {t.maNavrh && <p className="text-[11px] text-emerald-700 flex items-center gap-2">{t.nahlad && <img src={t.nahlad} alt="" className="h-8 object-contain rounded bg-slate-100" />}Rozmer sa nastavil automaticky podľa motívu na tričku ({t.sirka} × {t.vyska} cm).</p>}
                    {t.presah && <p className="text-xs text-rose-600">Motív presahuje vyznačenú plochu — časť mimo plochy sa nevytlačí.</p>}
                    {sirkaChyba && <p className="text-xs text-rose-600">Rozmer presahuje maximum pre toto umiestnenie ({u.maxSirkaCm} × {u.maxVyskaCm} cm).</p>}
                    <div>
                      <input ref={(el) => { fileRefs.current[t.id] = el; }} type="file" accept={POVOLENE.join(',')} className="hidden" onChange={(e) => { vyberSubor(t.id, e.target.files?.[0]); e.target.value = ''; }} />
                      <button type="button" onClick={() => fileRefs.current[t.id]?.click()}
                        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); vyberSubor(t.id, e.dataTransfer.files?.[0]); }}
                        className={`w-full rounded-xl border-2 border-dashed p-3 flex items-center gap-3 text-left transition ${t.subor ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}>
                        {t.nahlad ? <img src={t.nahlad} alt="" className="w-12 h-12 object-contain rounded bg-slate-100 shrink-0" /> : t.subor ? <FileImage className="w-8 h-8 text-emerald-600 shrink-0" /> : <Upload className="w-7 h-7 text-slate-400 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-700 truncate">{t.subor ? t.subor.name : 'Nahrať obrázok alebo súbor (PDF, AI, EPS)'}</span>
                          <span className="block text-[11px] text-slate-400">{t.subor ? 'Kliknutím súbor vymeníte (PDF/AI/EPS sa pošlú tak, ako sú)' : 'Obrázok (PNG, JPG, SVG) sa vloží priamo na tričko — môžete ho posúvať a meniť. ' + `Kliknite alebo pretiahnite súbor (${POVOLENE.join(', ')}, max. ${MAX_MB} MB). Najlepšie vektor alebo PNG s priehľadným pozadím.`}</span>
                        </span>
                      </button>
                      <p className="mt-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">Text a logo pridajte priamo na tričko — vybraná potlač je zvýraznená, nástroje sú pri tričku. Motív môžete ťahať, otáčať, duplikovať, mazať a meniť poradie; rozmery vidíte v mm.</p>
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
            chybaObjednavky={chybaObj} potvrdenie={potvrdenie} zakazane={chybajuSubory || !suhlas} poznamkaZakazane={chybajuSubory ? 'Pred objednávkou pridajte grafiku ku každej potlači (nahrajte súbor alebo si ju navrhnite).' : 'Potvrďte, že textil dodáte vy.'} riadky={riadky}>
            <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={suhlas} onChange={(e) => setSuhlas(e.target.checked)} className="mt-0.5" /><span>Potvrdzujem, že ide o potlač na <strong>textil dodaný mnou</strong> (cena je len za potlač).</span></label>
          </CenaSuhrn>

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
