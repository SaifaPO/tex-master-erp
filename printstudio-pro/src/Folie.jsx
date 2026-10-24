import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Thermometer, Layers, Hand, Droplets, AlertTriangle } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';

const BUCKET = 'print-designs';
const POVOLENE = ['.pdf', '.eps', '.ai', '.svg', '.dxf'];
const MAX_VYKRESLENYCH = 400;

// Tri úrovne služby (cena sa počíta na serveri)
const UROVNE = [
  { kod: 'rez', nazov: 'Len rezaná fólia', popis: 'Fóliu vyrežeme podľa vášho súboru. Vylúpanie (odstránenie prebytočnej fólie okolo motívov) si urobíte sami.' },
  { kod: 'vylupanie', nazov: 'Rezaná a vylúpaná', popis: 'Fóliu vyrežeme a prebytočnú fóliu okolo motívov za vás odstránime (vylúpime).' },
  { kod: 'plny', nazov: 'Full servis', popis: 'Vyrežeme, vylúpime a motívy vám dodáme aj nastrihané — jednotlivé kusy pripravené na použitie.' },
];

// Rozloženie motívov na rolke (rovnaká logika ako na serveri): normálna / otočená orientácia, vyberie sa kratšia dĺžka
function rozlozenie(w, h, ks, pracSirka, medzera) {
  const skus = (sirka, vyska) => {
    if (sirka > pracSirka) return null;
    const cols = Math.max(1, Math.floor(pracSirka / (sirka + medzera)));
    const rows = Math.ceil(ks / cols);
    return { cols, rows, dlzkaMm: rows * (vyska + medzera), itemW: sirka, itemH: vyska };
  };
  const a = skus(w, h), b = skus(h, w);
  if (!a && !b) return null;
  if (a && (!b || a.dlzkaMm <= b.dlzkaMm)) return { ...a, otoceny: false };
  return { ...b, otoceny: true };
}

// Vzhľad vzorky farby podľa druhu fólie (flock, reflexná, metalická, trblietavá)
function stylFarby(trieda, hex) {
  const zaklad = { backgroundColor: hex };
  if (trieda === 'metallic') return { ...zaklad, backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)' };
  if (trieda === 'reflective') return { ...zaklad, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 2px, transparent 2px, transparent 4px)' };
  if (trieda === 'glitter') return { ...zaklad, backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.8) 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '8px 8px' };
  if (trieda === 'flock') return { ...zaklad, backgroundImage: 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15))' };
  return zaklad;
}

// Fotky vzoriek fólií (Siser) uložené v public/folie — názov súboru = kód farby, resp. druh_<kód druhu>. Vlastná fotka z administrácie (foto_url) má prednosť.
const FOTO_FARBY = new Set(['ps_white', 'ps_black', 'ps_red', 'ps_royal', 'ps_green', 'ps_yellow', 'ps_orange', 'ps_grey', 'ps_gold', 'ps_silver', 'g_silver', 'g_gold', 'g_black', 'g_red', 'g_blue', 'g_pink', 'm_gold', 'm_silver', 'm_red', 'm_blue', 'r_silver', 'sb_white', 'sb_yellow', 'f_white', 'f_black', 'f_red', 'f_blue', 'f_yellow', 'f_green']);
const FOTO_DRUHY = new Set(['psfilm', 'glitter', 'electric', 'reflex', 'subli', 'flock']);
const fotoFarby = (c) => (c ? (c.foto_url || (FOTO_FARBY.has(c.kod) ? `/folie/${c.kod}.webp` : null)) : null);
const fotoDruhu = (d) => (d ? (d.foto_url || (FOTO_DRUHY.has(d.kod) ? `/folie/druh_${d.kod}.webp` : null)) : null);

export default function Folie({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [nast, setNast] = useState(null);
  const [druhy, setDruhy] = useState([]);
  const [farby, setFarby] = useState([]);
  const [druh, setDruh] = useState('');
  const [farba, setFarba] = useState('');
  const [sirka, setSirka] = useState(150);
  const [vyska, setVyska] = useState(100);
  const [pocetKs, setPocetKs] = useState(10);
  const [uroven, setUroven] = useState('vylupanie'); // rez = len rezana folia, vylupanie = + vylupame, plny = full servis (vylupane a nastrihane)
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const [subor, setSubor] = useState(null);
  const [drag, setDrag] = useState(false);
  const b2b = useB2bKod(supabase);
  const [bezi, setBezi] = useState(false);
  const [chybaObj, setChybaObj] = useState('');
  const [potvrdenie, setPotvrdenie] = useState('');
  const fileRef = useRef(null);
  const rolkaRef = useRef(null);
  const [sirkaPlochy, setSirkaPlochy] = useState(600);

  useEffect(() => {
    if (!supabase) { setChybaNacitania('Supabase klient nie je nakonfigurovaný.'); setNacitava(false); return; }
    (async () => {
      const [n, d, f] = await Promise.all([
        supabase.from('folie_nastavenia_verejny').select('*').maybeSingle(),
        supabase.from('folie_druhy_verejny').select('*').order('poradie'),
        supabase.from('folie_farby').select('*').order('poradie'),
      ]);
      if (n.error || !n.data) { setChybaNacitania('Objednávka rezaných fólií ešte nie je pripravená (chýba migrácia migration_stolove_snurky_folie.sql).'); setNacitava(false); return; }
      setNast(n.data); setDruhy(d.data || []); setFarby(f.data || []);
      setDruh(d.data?.[0]?.kod || '');
      setFarba(f.data?.find((x) => x.druh_kod === d.data?.[0]?.kod)?.kod || '');
      setNacitava(false);
    })();
  }, [supabase]);

  useEffect(() => {
    const el = rolkaRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setSirkaPlochy(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [nacitava]);

  const druhObj = druhy.find((x) => x.kod === druh);
  const farbyDruhu = farby.filter((x) => x.druh_kod === druh);
  const farbaObj = farby.find((x) => x.kod === farba);
  const pracSirka = Number(nast?.pracovna_sirka_mm) || 490;
  const medzera = Number(nast?.medzera_mm) || 5;
  const minRozmer = Number(nast?.min_rozmer_mm) || 10;
  const roz = useMemo(() => (sirka >= minRozmer && vyska >= minRozmer ? rozlozenie(sirka, vyska, pocetKs, pracSirka, medzera) : null), [sirka, vyska, pocetKs, pracSirka, medzera, minRozmer]);
  const rozmerChyba = sirka < minRozmer || vyska < minRozmer ? `Minimálny rozmer grafiky je ${minRozmer} mm.` : (!roz ? `Grafika sa nezmestí na rolku — jeden z rozmerov musí byť najviac ${pracSirka} mm.` : '');

  const zmenDruh = (kod) => {
    setDruh(kod);
    const prva = farby.find((x) => x.druh_kod === kod);
    if (!farby.find((x) => x.kod === farba && x.druh_kod === kod)) setFarba(prva?.kod || '');
  };

  const { cena, chyba } = useCenaNahlad(supabase, 'folie-create-draft-order', { druh, farba, sirkaMm: sirka, vyskaMm: vyska, pocetKs, uroven, osobnyOdber, b2bKod: b2b.kod, urovne: true }, !!(druh && farba) && !rozmerChyba);

  const vyberSubor = (f) => {
    if (!f) return;
    if (!POVOLENE.some((x) => f.name.toLowerCase().endsWith(x))) { window.alert('Prosím nahrajte vektorový formát (PDF, EPS, AI, SVG, DXF).'); return; }
    setSubor(f);
  };

  const objednat = async () => {
    if (!subor) { setChybaObj('Nahrajte prosím vektorový súbor.'); return; }
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const cesta = `folie/${crypto.randomUUID()}/${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(cesta, subor, { contentType: subor.type || undefined });
      if (upErr) throw new Error('Súbor sa nepodarilo nahrať: ' + upErr.message);
      const { data, error } = await supabase.functions.invoke('folie-create-draft-order', {
        body: { druh, farba, sirkaMm: sirka, vyskaMm: vyska, pocetKs, uroven, osobnyOdber, b2bKod: b2b.kod, suborNazov: subor.name, suborCesta: cesta },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Server nevrátil odpoveď.');
      setPotvrdenie(`Objednávka bola vytvorená — ${Number(data.cenaSpolu).toFixed(2)} €. Presmerúvam na platbu…`);
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setChybaObj('Objednávku sa nepodarilo odoslať: ' + e.message);
    } finally { setBezi(false); }
  };

  if (nacitava) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (chybaNacitania) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chybaNacitania}</div>;
  if (nast?.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Objednávanie rezaných fólií je dočasne vypnuté.</div>;

  // vizualizácia rolky: 1 mm = mierka px
  const mierka = Math.max(0.2, Math.min(1.5, (sirkaPlochy - 24) / (pracSirka + 20)));
  const dlzkaPx = roz ? (roz.dlzkaMm + medzera) * mierka : 120;
  const polozky = [];
  if (roz) {
    const sirkaRiadku = roz.cols * roz.itemW + (roz.cols - 1) * medzera;
    const x0 = (pracSirka - sirkaRiadku) / 2;
    let nakreslene = 0;
    for (let r = 0; r < roz.rows && nakreslene < Math.min(pocetKs, MAX_VYKRESLENYCH); r++) {
      for (let c = 0; c < roz.cols && nakreslene < Math.min(pocetKs, MAX_VYKRESLENYCH); c++) {
        polozky.push({ x: x0 + c * (roz.itemW + medzera), y: medzera + r * (roz.itemH + medzera), k: nakreslene++ });
      }
    }
  }

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Rezané fólie" subtitle="Vektorový vyrezávaný transfer na textil" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {nast.info_text && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{nast.info_text}</p>}

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[26rem_1fr] gap-5 items-start">
        <aside className="space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">1. Vektorový súbor</h3>
            <div onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); vyberSubor(e.dataTransfer.files?.[0]); }}
              className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition ${drag ? 'border-indigo-500 bg-indigo-50' : subor ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-300 bg-slate-50'}`}>
              <FileText className="w-9 h-9 mx-auto text-slate-400 mb-1" />
              <p className="text-sm font-medium text-slate-700">{subor ? subor.name : 'Kliknite alebo pretiahnite súbor'}</p>
              <p className="text-xs text-slate-400 mt-1">Akceptované: .pdf, .eps, .ai, .svg, .dxf</p>
              <input ref={fileRef} type="file" accept={POVOLENE.join(',')} className="hidden" onChange={(e) => { vyberSubor(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <p className="text-xs bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-lg p-2.5">Súbor musí byť vo <strong>vektorovom formáte</strong> a všetky texty musia byť <strong>prevedené na krivky</strong>.</p>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">2. Rozmery grafiky a počet</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Šírka (mm)</label><NumberInput min={minRozmer} step="1" value={sirka} onChange={setSirka} fallback={minRozmer} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium" /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Výška (mm)</label><NumberInput min={minRozmer} step="1" value={vyska} onChange={setVyska} fallback={minRozmer} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-medium" /></div>
            </div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Požadovaný počet kusov</label><NumberInput min="1" step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.max(1, Math.round(v)))} fallback={1} className="w-full border border-slate-300 rounded-lg p-2.5 text-lg font-bold" /></div>
            {rozmerChyba && <p className="text-xs text-rose-600 flex gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> {rozmerChyba}</p>}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">3. Typ fólie a farba</h3>
            <select value={druh} onChange={(e) => zmenDruh(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white font-medium">
              {druhy.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}
            </select>
            {druhObj && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex">
                  {fotoDruhu(druhObj) && <img src={fotoDruhu(druhObj)} alt={druhObj.nazov} className="w-32 object-cover shrink-0" />}
                  <div className="p-2.5 text-[11px] text-slate-600 space-y-1.5">
                    <p className="italic text-slate-800 leading-tight">{druhObj.popis}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {druhObj.hrubka && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1"><Layers className="w-3 h-3 text-indigo-500" /> {druhObj.hrubka}</span>}
                      {druhObj.tlak && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded">Tlak: {druhObj.tlak}</span>}
                      {druhObj.odtrhnutie && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1"><Hand className="w-3 h-3 text-indigo-500" /> {druhObj.odtrhnutie}</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-indigo-50/60 p-2 border-t border-slate-200 flex justify-around text-xs text-indigo-900 font-bold">
                  <span className="flex items-center gap-1.5"><Thermometer className="w-4 h-4" /> {druhObj.teplota} / {druhObj.cas}</span>
                  <span className="flex items-center gap-1.5"><Droplets className="w-4 h-4" /> {druhObj.pranie}</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 flex justify-between"><span>Výber farby</span><span className="font-bold text-indigo-700">{farbaObj?.nazov}</span></label>
              <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[56px] max-h-72 overflow-y-auto">
                {farbyDruhu.map((c) => (
                  <button key={c.kod} type="button" title={c.nazov} onClick={() => setFarba(c.kod)} className={`${fotoFarby(c) ? 'w-11 h-11 rounded-lg' : 'w-8 h-8 rounded-full'} cursor-pointer transition hover:scale-110`}
                    style={{ ...(fotoFarby(c) ? { backgroundColor: c.hex, backgroundImage: `url(${fotoFarby(c)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : stylFarby(druhObj?.trieda, c.hex)), border: farba === c.kod ? '2px solid #4f46e5' : (c.hex.toUpperCase() === '#FFFFFF' ? '1px solid #e5e7eb' : '2px solid transparent'), boxShadow: farba === c.kod ? '0 0 0 3px rgba(79,70,229,0.3)' : '0 1px 3px rgba(0,0,0,0.1)' }} />
                ))}
              </div>
              {fotoFarby(farbaObj) && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={fotoFarby(farbaObj)} alt={farbaObj.nazov} className="w-full h-28 object-cover" />
                  <span className="absolute left-2 bottom-2 text-[11px] font-bold bg-white/90 text-slate-800 px-2 py-0.5 rounded">{druhObj?.nazov} · {farbaObj.nazov}</span>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-800 mb-1">4. Úroveň služby</h3>
            {UROVNE.map((u) => (
              <label key={u.kod} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${uroven === u.kod ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="uroven" checked={uroven === u.kod} onChange={() => setUroven(u.kod)} className="w-4 h-4 mt-1" />
                <span><span className="block text-sm font-semibold text-slate-800">{u.nazov}</span><span className="block text-xs text-slate-500 mt-0.5">{u.popis}</span></span>
              </label>
            ))}
          </section>
        </aside>

        <section className="space-y-5 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">Uloženie na rolke</span>
              <span className="bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600">Šírka rolky: <strong>{(Number(nast.sirka_rolky_mm) || 500) / 10} cm</strong> · rezacia šírka: <strong className="text-indigo-600">{pracSirka / 10} cm</strong></span>
              {roz && <span className="text-slate-500">Spotreba: <strong className="text-slate-800">{((roz.dlzkaMm + medzera) / 1000).toFixed(2)} bm</strong> · {roz.cols} v rade × {roz.rows} radov{roz.otoceny ? ' (otočené)' : ''}</span>}
            </div>
            <div ref={rolkaRef} className="p-4 overflow-auto max-h-[70vh]" style={{ backgroundColor: '#e2e8f0' }}>
              {roz ? (
                <div className="relative bg-white mx-auto shadow-lg" style={{ width: (pracSirka + 20) * mierka, height: dlzkaPx + 6 }}>
                  <div className="absolute left-0 top-0 bottom-0 bg-slate-100 border-r border-dashed border-slate-300" style={{ width: 10 * mierka }} />
                  <div className="absolute right-0 top-0 bottom-0 bg-slate-100 border-l border-dashed border-slate-300" style={{ width: 10 * mierka }} />
                  <div className="absolute" style={{ left: 10 * mierka, top: 0 }}>
                    {polozky.map((p) => (
                      <div key={p.k} className="absolute rounded-sm" style={{ left: p.x * mierka, top: p.y * mierka, width: roz.itemW * mierka, height: roz.itemH * mierka, ...(fotoFarby(farbaObj) ? { backgroundColor: farbaObj.hex, backgroundImage: `url(${fotoFarby(farbaObj)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : stylFarby(druhObj?.trieda, farbaObj?.hex || '#3b82f6')), opacity: 0.9, border: '1px solid rgba(0,0,0,0.25)' }} />
                    ))}
                  </div>
                  {pocetKs > MAX_VYKRESLENYCH && <p className="absolute bottom-1 left-2 text-[10px] text-slate-500">Zobrazených prvých {MAX_VYKRESLENYCH} kusov.</p>}
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center text-rose-600 text-sm"><AlertTriangle className="w-8 h-8 mb-2" />{rozmerChyba || 'Zadajte rozmery grafiky.'}</div>
              )}
            </div>
          </div>
          <div className="max-w-xl">
            <CenaSuhrn cena={cena} chyba={chyba} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi} chybaObjednavky={chybaObj} potvrdenie={potvrdenie}
              zakazane={!subor || !!rozmerChyba} poznamkaZakazane={!subor ? 'Najprv nahrajte vektorový súbor.' : ''}
              riadky={[['Fólia', `${druhObj?.nazov || '—'}`], ['Farba', farbaObj?.nazov || '—'], ['Rozmer', `${sirka} × ${vyska} mm`], ['Počet kusov', `${pocetKs} ks`], ['Služba', UROVNE.find((u) => u.kod === uroven)?.nazov || '—'], ...(cena?.nastrihanieBezDph > 0 ? [['Z toho nastrihanie', `${Number(cena.nastrihanieBezDph).toFixed(2)} € bez DPH`]] : [])]}>
              {cena?.dlzkaBm != null && <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Spotreba materiálu</span><span className="font-mono text-slate-100">{cena.dlzkaBm} bm</span></div>}
            </CenaSuhrn>
          </div>
          <MnozstevneZlavy urovne={cena?.urovne} pocetKs={pocetKs} b2bPercent={b2b.zlavaPercent} b2bKod={b2b.kod} />
        </section>
      </main>
    </div>
  );
}
