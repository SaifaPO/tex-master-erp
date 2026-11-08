import { createPortal } from 'react-dom';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Type, Shapes, Image as ImageIcon, Eraser, Copy, Trash2, ArrowUp, ArrowDown, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Palette, PenTool, X } from 'lucide-react';
import KniznicaGrafik from '../KniznicaGrafik';
import { nacitajGoogleFonty } from '../loadGoogleFonts';
import { vytvorEngine, SYMBOLY, FONTY_PREDVOLENE, VZORY_POZADIA, svgDoDataUri } from './plochaEngine';

// Spoločný editor „líce + rub“ (stolové vlajky, šnúrky na krk). Vracia dve časti cez render-prop children({ nastroje, plocha }):
// `nastroje` = ľavý panel (strana, pozadie, text, symboly, obrázok, knižnica grafík, úprava objektu), `plocha` = pracovná plocha s plátnami.
// `casti` (pole dĺžok v mm) = tlač v samostatných častiach vedľa seba na jednej ploche (napr. šnúrka 70 + 12 cm) — zobrazia sa ako samostatné rámy s medzerou na strih.
// `jednaStrana` = len jedna plocha (rub sa skryje), `priehladne` = bez bieleho pozadia (priehľadný export, napr. sieťotlač).
// Cez ref: exportuj() -> { front, back (Blob PNG ≈300 DPI), json }, nahlad(), pocetObjektov(), nastavRozmer().
const PlochaEditor = forwardRef(function PlochaEditor({
  sirkaMm, vyskaMm, tvar = null, ppm = 2, rozlozenie = 'vedla', nazvyStran = ['Líce', 'Rub'], spadavkaMm = 0, casti = null, medzeraCastiMm = 10,
  fonty = [], grafiky = [], symboly = SYMBOLY, jednaStrana = false, priehladne = false, podkladFarba = null, onZmena = null, maxVyskaVh = 0.3, popisRozmeru = null,
  podkladUrl = null, jedenPohlad = false, bezSymbolov = false, okno = false, zony = null, aktivnaZona = null, popisVkladania = null, children,
}, ref) {
  const wrapFront = useRef(null), wrapBack = useRef(null), vonkajsi = useRef(null);
  const guideRefs = useRef({});
  const onZmenaRef = useRef(onZmena);
  useEffect(() => { onZmenaRef.current = onZmena; }, [onZmena]);
  const engineRef = useRef(null);
  const [strana, setStrana] = useState('front');
  const [vybrany, setVybrany] = useState(null);
  const [zoomMod, setZoomMod] = useState('fit'); // 'fit' | číslo
  const [zoomFit, setZoomFit] = useState(1);
  const [text, setText] = useState('');
  const [font, setFont] = useState(FONTY_PREDVOLENE[0]);
  const [kurziva, setKurziva] = useState(false);
  const [farbaTextu, setFarbaTextu] = useState('#000000');
  const [farbaObrysu, setFarbaObrysu] = useState('#ffffff');
  const [hrubkaObrysu, setHrubkaObrysu] = useState(0);
  const [pozadieFarba, setPozadieFarba] = useState('#ffffff');
  const [zalozka, setZalozka] = useState('symboly'); // 'symboly' | 'kniznica'
  // `okno`: nástroje (text, logá, obrázok + úprava vybraného objektu) sú v samostatnom plávajúcom okne (na mobile spodný panel); motív sa upravuje priamo na produkte
  const [oknoOtv, setOknoOtv] = useState(false); // nástroje sa otvoria až keď ich zákazník chce (tlačidlo Nástroje) alebo keď vyberie objekt
  const [oknoPoz, setOknoPoz] = useState(null);
  const tah = useRef(null);
  const zacniTah = (ev) => {
    if (ev.target.closest('button')) return;
    const poz = oknoPoz || { x: 0, y: 0 };
    tah.current = { sx: ev.clientX, sy: ev.clientY, x: poz.x, y: poz.y };
    const pohyb = (m) => { if (!tah.current) return; setOknoPoz({ x: Math.max(0, Math.min(window.innerWidth - 120, tah.current.x + m.clientX - tah.current.sx)), y: Math.max(0, Math.min(window.innerHeight - 60, tah.current.y + m.clientY - tah.current.sy)) }); };
    const koniec = () => { tah.current = null; window.removeEventListener('pointermove', pohyb); window.removeEventListener('pointerup', koniec); };
    window.addEventListener('pointermove', pohyb); window.addEventListener('pointerup', koniec);
  };
  useEffect(() => { if (okno && !oknoPoz && typeof window !== 'undefined') setOknoPoz({ x: Math.max(8, window.innerWidth - 22 * 16 - 20), y: 100 }); }, [okno, oknoPoz]);
  // úzky displej (mobil/tablet na výšku): plocha sa zmenší tak, aby sa zmestila nad ovládacie prvky (líce aj rub sú stále vidno naraz)
  const [uzky, setUzky] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  useEffect(() => { const f = () => setUzky(window.innerWidth < 1024); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const jednaPlocha = jednaStrana || jedenPohlad; // jedenPohlad = produkt (tričko) sa ukazuje po jednej strane (spredu / zozadu); inak sú líce aj rub vidno naraz
  const sirkaPx = Math.round(sirkaMm * ppm), vyskaPx = Math.round(vyskaMm * ppm);
  const pod = rozlozenie === 'pod';
  const MEDZERA = 40;
  const celkovaSirka = (pod || jednaPlocha) ? sirkaPx : sirkaPx * 2 + MEDZERA;
  const celkovaVyska = (pod && !jednaPlocha) ? vyskaPx * 2 + MEDZERA + 24 : vyskaPx + 24;
  const zoom = zoomMod === 'fit' ? zoomFit : zoomMod;

  // inicializácia Fabric plátien (raz); canvasy sa vytvárajú imperatívne, aby ich React neprepisoval
  useEffect(() => {
    const mk = (wrap) => { const c = document.createElement('canvas'); wrap.insertBefore(c, wrap.firstChild); return c; };
    const elFront = mk(wrapFront.current), elBack = mk(wrapBack.current);
    const engine = vytvorEngine({
      elFront, elBack, ppm, pozadie: priehladne ? null : '#ffffff', onZmena: () => onZmenaRef.current?.(),
      onVyber: (info) => setVybrany(info),
      onZrusVyber: () => setVybrany(null),
      onPrichytenie: (s, v, h) => {
        const g = guideRefs.current;
        if (g[`${s}-v`]) g[`${s}-v`].style.display = v ? 'block' : 'none';
        if (g[`${s}-h`]) g[`${s}-h`].style.display = h ? 'block' : 'none';
      },
    });
    engineRef.current = engine;
    // posúvanie priblíženej plochy: ťahanie za prázdne miesto (myš aj prst) posúva pohľad; ťahanie za objekt ho posúva po plátne
    const pan = { on: false, x: 0, y: 0, sl: 0, st: 0 };
    const bod = (ev) => (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
    [engine.platna.front, engine.platna.back].forEach((c) => {
      c.on('mouse:down', (o) => {
        if (o.target) return;
        const el = vonkajsi.current; if (!el || (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)) return;
        const p = bod(o.e); pan.on = true; pan.x = p.clientX; pan.y = p.clientY; pan.sl = el.scrollLeft; pan.st = el.scrollTop;
        c.selection = false; c.defaultCursor = 'grabbing';
      });
      c.on('mouse:move', (o) => {
        if (!pan.on) return; const el = vonkajsi.current; if (!el) return; const p = bod(o.e);
        el.scrollLeft = pan.sl - (p.clientX - pan.x); el.scrollTop = pan.st - (p.clientY - pan.y);
      });
      c.on('mouse:up', () => { if (pan.on) { pan.on = false; c.selection = true; c.defaultCursor = 'default'; } });
    });
    engine.setRozmer(sirkaMm, vyskaMm, tvar);
    return () => { engine.dispose(); engineRef.current = null; elFront.remove(); elBack.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // zmena rozmeru / tvaru
  useEffect(() => {
    engineRef.current?.setRozmer(sirkaMm, vyskaMm, tvar);
    engineRef.current?.calcOffset();
  }, [sirkaMm, vyskaMm, tvar]);

  useEffect(() => { engineRef.current?.setStrana(strana); }, [strana]);
  // úchyty objektov musia byť dosť veľké aj pri zmenšenom zobrazení (mobil): ~22 px na obrazovke
  useEffect(() => { engineRef.current?.nastavOvladace((uzky ? 26 : 20) / Math.max(zoom, 0.15)); }, [zoom, uzky, vybrany]);
  useEffect(() => { if (okno && vybrany) setOknoOtv(true); }, [okno, !!vybrany]); // eslint-disable-line react-hooks/exhaustive-deps
  // zóny (potlačové plochy na produkte) + zóna, do ktorej sa práve vkladá; po výbere zóny sa plocha priblíži na ňu
  useEffect(() => { engineRef.current?.nastavZony(zony || []); }, [zony]);
  useEffect(() => {
    engineRef.current?.nastavVkladanie(aktivnaZona || null);
    const z = aktivnaZona && zony ? zony.find((x) => x.kod === aktivnaZona) : null;
    if (!z) return undefined;
    setStrana(z.strana);
    const el = vonkajsi.current; if (!el) return undefined;
    const zoomZ = Math.max(zoomFit, Math.min(1.4, (el.clientWidth - 24) / (z.w * 1.5), (el.clientHeight - 24) / (z.h * 1.5)));
    setZoomMod(zoomZ);
    const t = setTimeout(() => el.scrollTo({ left: Math.max(0, z.cx * zoomZ - el.clientWidth / 2 + 12), top: Math.max(0, (z.cy + 24) * zoomZ - el.clientHeight / 2 + 12), behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktivnaZona]);
  useEffect(() => { nacitajGoogleFonty([...FONTY_PREDVOLENE, ...fonty.map((f) => f.nazov || f)]); }, [fonty]);
  useEffect(() => { engineRef.current?.calcOffset(); }, [zoom, strana, uzky]);

  // "fit" zoom podľa šírky kontajnera
  const prepocitajFit = useCallback(() => {
    const el = vonkajsi.current; if (!el) return;
    const dostupne = el.clientWidth - (uzky ? 24 : 48);
    // na mobile sa plocha zmestí aj do výšky (≈ 40 % obrazovky), aby ostalo miesto na ovládacie prvky a bolo vidieť zmeny bez scrollovania
    const limitVyska = uzky ? (window.innerHeight * maxVyskaVh - 8) / celkovaVyska : (jedenPohlad ? (window.innerHeight * 0.7 - 8) / celkovaVyska : Infinity);
    // úzke dlhé plochy (šnúrky) by na mobile boli len pár pixelov vysoké — zväčší sa na čitateľnú výšku a plocha sa dá posúvať do strán
    const minCitatelne = uzky ? 110 / celkovaVyska : 0;
    setZoomFit(Math.max(0.05, Math.min(1, Math.max(minCitatelne, Math.min(dostupne / celkovaSirka, limitVyska)))));
  }, [celkovaSirka, celkovaVyska, uzky, jedenPohlad, maxVyskaVh]);
  useLayoutEffect(() => {
    prepocitajFit();
    const ro = new ResizeObserver(prepocitajFit);
    if (vonkajsi.current) ro.observe(vonkajsi.current);
    return () => ro.disconnect();
  }, [prepocitajFit]);

  useImperativeHandle(ref, () => ({
    exportuj: (opts) => engineRef.current.exportuj(opts),
    nacitajFront: (json, hotovo) => engineRef.current?.nacitajFront(json, hotovo),
    zivyNahlad: (px) => engineRef.current?.zivyNahlad(px) || null,
    exportujOrezane: (opts) => engineRef.current?.exportujOrezane(opts) || null,
    nahlad: () => engineRef.current?.nahlad(),
    pocetObjektov: () => engineRef.current?.pocetObjektov() || 0,
    zona: (kod, opts) => engineRef.current?.zona(kod, opts) || null,
    nezaradene: () => engineRef.current?.nezaradene?.() || 0,
    velkostMm: (mm) => engineRef.current?.velkostMm?.(mm),
    pridajObrazok: (file, kod) => {
      const en = engineRef.current; if (!en) return;
      const z = kod && zony ? zony.find((x) => x.kod === kod) : null;
      if (z) { setStrana(z.strana); en.nastavVkladanie(kod); setTimeout(() => en.nastavVkladanie(null), 2000); }
      en.pridajObrazokZoSuboru(file);
    },
    odstranZonu: (kod) => engineRef.current?.odstranZonu(kod),
    presunZonu: (a, b) => engineRef.current?.presunZonu(a, b),
  }), []);

  const e = () => engineRef.current;
  const zoznamFontov = [...new Set([...FONTY_PREDVOLENE, ...fonty.map((f) => f.nazov || f)])];

  const nastroje = (
    <div className="space-y-4">
      {vybrany && (
        // mobil: panel úpravy je prilepený dole (spodný panel), plocha ostáva hore — zmeny farby, písma či obrysu vidno hneď, bez scrollovania
        <div className={`bg-indigo-50 border border-indigo-200 p-3 space-y-2.5 ${uzky && !okno ? 'fixed inset-x-0 bottom-0 z-50 max-h-[40vh] overflow-y-auto overflow-x-hidden rounded-t-2xl border-t-2 shadow-[0_-8px_24px_rgba(0,0,0,0.18)]' : 'rounded-xl'}`}>
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-semibold text-indigo-800 text-xs uppercase tracking-wider">{vybrany.typ === 'text' ? 'Úprava textu' : 'Úprava objektu'}</h3>
            <span className="text-xs bg-white px-2 py-0.5 rounded border border-indigo-100 font-mono text-indigo-800 whitespace-nowrap">{vybrany.sirkaMm} × {vybrany.vyskaMm} mm</span>
            {uzky && !okno && <button type="button" onClick={() => e()?.zrusVyber()} className="ml-auto px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">Hotovo</button>}
          </div>
          {vybrany.typ === 'text' && (
            <div className="space-y-2 pb-2.5 border-b border-indigo-200">
              <textarea rows={2} value={vybrany.text || ''} onChange={(ev) => e()?.upravText({ text: ev.target.value })} className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <select value={vybrany.font} onChange={(ev) => e()?.upravText({ font: ev.target.value })} className="text-sm border border-slate-300 rounded-lg p-2 bg-white" style={{ fontFamily: vybrany.font }}>
                  {[...new Set([vybrany.font, ...zoznamFontov])].map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <button type="button" onClick={() => e()?.upravText({ kurziva: !vybrany.kurziva })} className={`border border-slate-300 rounded-lg font-serif italic text-sm ${vybrany.kurziva ? 'bg-slate-200' : 'bg-white'}`}>Kurzíva</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[11px] text-slate-500 block mb-0.5">Farba písma</label><input type="color" value={String(vybrany.farba).startsWith('#') ? vybrany.farba : '#000000'} onChange={(ev) => e()?.upravText({ farba: ev.target.value })} className="w-full h-9 rounded cursor-pointer" /></div>
                <div><label className="text-[11px] text-slate-500 block mb-0.5">Farba obrysu</label><input type="color" value={String(vybrany.obrys).startsWith('#') ? vybrany.obrys : '#ffffff'} onChange={(ev) => e()?.upravText({ obrys: ev.target.value, ...(vybrany.hrubkaMm > 0 ? {} : { hrubkaMm: 1 }) })} className="w-full h-9 rounded cursor-pointer" /></div>
              </div>
              <div>
                <label className="text-xs text-slate-600 flex justify-between mb-0.5">Hrúbka obrysu <span>{vybrany.hrubkaMm > 0 ? `${vybrany.hrubkaMm} mm` : 'bez obrysu'}</span></label>
                <input type="range" min={0} max={10} step={0.5} value={vybrany.hrubkaMm || 0} onChange={(ev) => e()?.upravText({ hrubkaMm: Number(ev.target.value) })} className="w-full accent-indigo-600" />
                <p className="text-[10px] text-slate-400">Obrys je vždy pod písmom, takže ho nezjedá.</p>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-600 flex justify-between mb-0.5">Veľkosť <span>{vybrany.sirkaMm} × {vybrany.vyskaMm} mm</span></label>
            <input type="range" min={5} max={Math.max(vybrany.maxMm || 200, vybrany.sirkaMm)} step={1} value={vybrany.sirkaMm} onChange={(ev) => e()?.velkostMm(Number(ev.target.value))} className="w-full accent-indigo-600" />
          </div>
          <div>
            <label className="text-xs text-slate-600 flex justify-between mb-0.5">Rotácia <span>{vybrany.uhol}°</span></label>
            <input type="range" min={0} max={360} value={vybrany.uhol} onChange={(ev) => e()?.otoc(Number(ev.target.value))} className="w-full accent-indigo-600" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => e()?.stredH()} className="bg-white border border-slate-300 rounded py-1.5 text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><AlignHorizontalJustifyCenter className="w-3.5 h-3.5" /> Stred X</button>
            <button type="button" onClick={() => e()?.stredV()} className="bg-white border border-slate-300 rounded py-1.5 text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> Stred Y</button>
            <button type="button" onClick={() => e()?.dopredu()} className="bg-white border border-slate-300 rounded py-1.5 text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><ArrowUp className="w-3.5 h-3.5" /> Dopredu</button>
            <button type="button" onClick={() => e()?.dozadu()} className="bg-white border border-slate-300 rounded py-1.5 text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><ArrowDown className="w-3.5 h-3.5" /> Dozadu</button>
            <button type="button" onClick={() => e()?.duplikuj()} className="bg-white border border-slate-300 rounded py-1.5 text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Duplikovať</button>
            <button type="button" onClick={() => { e()?.zmaz(); setVybrany(null); }} className="bg-rose-600 hover:bg-rose-700 text-white rounded py-1.5 text-xs flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Zmazať</button>
          </div>
        </div>
      )}

      {popisVkladania && <p className="text-xs font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">Vkladáte do: {popisVkladania}</p>}
      {!jednaPlocha && <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Kam vložiť nový objekt?</label>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {[['front', nazvyStran[0]], ['back', nazvyStran[1]]].map(([k, n]) => (
            <button key={k} type="button" onClick={() => setStrana(k)} className={`flex-1 py-1.5 text-sm font-semibold rounded transition ${strana === k ? 'bg-white text-indigo-600 shadow border border-indigo-200' : 'text-slate-500 hover:text-slate-800 border border-transparent'}`}>Na {n.toLowerCase()}</button>
          ))}
        </div>
      </div>}

      {!priehladne && <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-500" /> Pozadie (aktívna strana)</h3>
        <div className="grid grid-cols-6 gap-1.5">
          {VZORY_POZADIA.map((v) => (
            <button key={v.id} type="button" title={v.nazov} onClick={() => e()?.nastavPozadieVzor(v.svg)} className="h-9 rounded border border-slate-300 hover:border-indigo-500 shadow-sm overflow-hidden" style={{ backgroundImage: `url("${svgDoDataUri(v.svg)}")`, backgroundSize: v.id === 't12' ? 'cover' : '18px' }} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input type="color" value={pozadieFarba} onChange={(ev) => { setPozadieFarba(ev.target.value); e()?.nastavPozadieFarbu(ev.target.value); }} className="w-10 h-8 rounded cursor-pointer" title="Jednofarebné pozadie" />
          <button type="button" onClick={() => { setPozadieFarba('#ffffff'); e()?.vymazPozadie(); }} className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs py-2 rounded-lg hover:bg-slate-100 font-medium flex items-center justify-center gap-1"><Eraser className="w-3.5 h-3.5" /> Biele pozadie</button>
        </div>
      </div>}

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Type className="w-4 h-4 text-indigo-500" /> Pridať text</h3>
        <textarea rows={2} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Váš text…" className="w-full text-sm border border-slate-300 rounded-lg p-2" />
        <div className="grid grid-cols-2 gap-2">
          <select value={font} onChange={(ev) => setFont(ev.target.value)} className="text-sm border border-slate-300 rounded-lg p-2" style={{ fontFamily: font }}>
            {zoznamFontov.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
          <button type="button" onClick={() => setKurziva((v) => !v)} className={`border border-slate-300 rounded-lg font-serif italic text-sm ${kurziva ? 'bg-slate-200' : 'bg-white'}`}>Kurzíva</button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-[11px] text-slate-500 block mb-0.5">Farba</label><input type="color" value={farbaTextu} onChange={(ev) => setFarbaTextu(ev.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
          <div className="flex-1"><label className="text-[11px] text-slate-500 block mb-0.5">Obrys</label><input type="color" value={farbaObrysu} onChange={(ev) => setFarbaObrysu(ev.target.value)} className="w-full h-8 rounded cursor-pointer" /></div>
          <div className="flex-1"><label className="text-[11px] text-slate-500 block mb-0.5">Hrúbka (mm)</label><input type="number" min={0} max={10} step={0.5} value={hrubkaObrysu} onChange={(ev) => setHrubkaObrysu(Math.min(10, Math.max(0, Number(ev.target.value) || 0)))} className="w-full h-8 rounded border border-slate-300 p-1 text-sm" /></div>
        </div>
        <button type="button" onClick={() => { e()?.pridajText({ text, font, farba: farbaTextu, obrys: farbaObrysu, hrubkaObrysu, kurziva }); setText(''); }} disabled={!text.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm">+ Vložiť text</button>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        {bezSymbolov ? (
          <h3 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Knižnica grafík a log</h3>
        ) : grafiky.length > 0 ? (
          <div className="flex bg-slate-200/70 rounded-lg p-0.5 mb-2">
            {[['symboly', 'Symboly'], ['kniznica', 'Knižnica grafík a log']].map(([k, n]) => (
              <button key={k} type="button" onClick={() => setZalozka(k)} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${zalozka === k ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {k === 'symboly' ? <Shapes className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />} {n}
              </button>
            ))}
          </div>
        ) : (
          <h3 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-2"><Shapes className="w-4 h-4 text-indigo-500" /> Symboly</h3>
        )}
        {!bezSymbolov && (zalozka === 'symboly' || grafiky.length === 0) ? (
          <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {symboly.map((s) => <button key={s} type="button" onClick={() => e()?.pridajText({ text: s, symbol: true })} className="h-10 text-2xl bg-white border border-slate-200 hover:bg-slate-100 rounded-md flex items-center justify-center">{s}</button>)}
          </div>
        ) : (
          <KniznicaGrafik bezNadpisu grafiky={grafiky} onVloz={(url, farba) => e()?.pridajObrazokZUrl(url, farba)} />
        )}
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Obrázok / logo</h3>
        <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 text-sm text-slate-600 font-medium">
          Kliknite pre nahratie (PNG/JPG)
          <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) e()?.pridajObrazokZoSuboru(f); }} />
        </label>
      </div>

    </div>
  );

  const plocha = (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-3 sm:px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2 sm:gap-3 flex-wrap bg-slate-50">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-700 hidden sm:inline">Plocha pre dizajn</span>
          {(uzky || jedenPohlad) && !jednaStrana && (
            <span className="flex bg-slate-200/70 rounded-lg p-0.5">
              {[['front', nazvyStran[0]], ['back', nazvyStran[1]]].map(([k, n]) => (
                <button key={k} type="button" onClick={() => setStrana(k)} className={`px-3 py-1 rounded-md font-semibold ${strana === k ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>{n}</button>
              ))}
            </span>
          )}
          {!podkladUrl && <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{sirkaMm} × {vyskaMm} mm</span>}
          {popisRozmeru && <span className="text-slate-600 font-medium">{popisRozmeru}</span>}
          {casti && casti.length > 1 && <span className="text-slate-500 hidden sm:inline">Tlač v {casti.length} častiach — medzi nimi šrafovaná medzera {medzeraCastiMm} mm na strih</span>}
          {spadavkaMm > 0 && <span className="text-slate-500 hidden sm:flex items-center gap-2"><span className="inline-block w-3 h-3 border-2 border-red-500 border-dashed" /> okraj výroby <span className="inline-block w-3 h-3 border border-green-600 border-dotted ml-1" /> bezpečná zóna ({spadavkaMm} mm)</span>}
        </div>
        <div className="flex items-center gap-2">
        {okno && <button type="button" onClick={() => setOknoOtv((v) => !v)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${oknoOtv ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300'}`}><PenTool className="w-3.5 h-3.5" /> Nástroje</button>}
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">
          {[['fit', 'Fit'], [0.25, '25 %'], [0.5, '50 %'], [1, '100 %']].map(([z, n]) => (
            <button key={n} type="button" onClick={() => setZoomMod(z)} className={`px-2.5 py-1 rounded font-medium ${zoomMod === z ? 'bg-white shadow' : 'text-slate-600 hover:bg-white'}`}>{n}</button>
          ))}
        </div>
        </div>
      </div>
      <div ref={vonkajsi} className={`overflow-auto p-3 lg:p-6 ${jedenPohlad ? 'max-h-[46vh] lg:max-h-[72vh]' : ''}`} style={podkladFarba ? { backgroundColor: podkladFarba } : { backgroundColor: '#e5e5f7', backgroundImage: 'linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' }}>
        <div style={{ width: celkovaSirka * zoom, height: celkovaVyska * zoom, margin: '0 auto' }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: celkovaSirka, height: celkovaVyska, display: 'flex', flexDirection: pod ? 'column' : 'row', gap: MEDZERA, alignItems: 'flex-start' }}>
            {[['front', wrapFront, nazvyStran[0]], ['back', wrapBack, nazvyStran[1]]].map(([k, r, n]) => (
              <div key={k} style={{ width: sirkaPx, paddingTop: 24, display: (jednaStrana && k === 'back') || (jedenPohlad && k !== strana) ? 'none' : undefined }} className="relative">
                {!jednaPlocha && <span className={`absolute top-0 left-0 text-xs font-bold px-2 py-0.5 rounded ${strana === k ? 'bg-indigo-600 text-white' : 'bg-white/90 text-slate-600'}`}>{n}</span>}
                <div ref={r} className="relative" style={{ width: sirkaPx, height: vyskaPx, filter: podkladUrl ? 'none' : (strana === k ? 'drop-shadow(0 0 10px rgba(79,70,229,0.55))' : 'drop-shadow(0 6px 10px rgba(0,0,0,0.12))'), opacity: strana === k ? 1 : 0.7, transition: 'opacity .2s' }} onMouseDown={() => setStrana(k)}>
                  {podkladUrl && podkladUrl[k] && <img src={podkladUrl[k]} alt="" draggable={false} className="absolute inset-0 w-full h-full select-none pointer-events-none" style={{ zIndex: 0 }} />}
                  {casti && casti.length > 0 ? (
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {casti.map((dl, i) => {
                        const lavo = (casti.slice(0, i).reduce((s, x) => s + x, 0) + i * medzeraCastiMm) * ppm;
                        return (
                          <React.Fragment key={i}>
                            {i > 0 && <div className="absolute top-0 bottom-0" style={{ left: lavo - medzeraCastiMm * ppm, width: medzeraCastiMm * ppm, background: 'repeating-linear-gradient(45deg, rgba(100,116,139,.75) 0 4px, rgba(226,232,240,.9) 4px 8px)' }} />}
                            <div className="absolute top-0 bottom-0" style={{ left: lavo, width: dl * ppm, border: '2px dashed rgba(255,0,0,.6)' }}>
                              {spadavkaMm > 0 && <div className="absolute" style={{ inset: spadavkaMm * ppm, border: '1px dotted rgba(0,150,0,.8)' }} />}
                              <span className="absolute left-1 top-0.5 text-[11px] font-bold text-red-600 bg-white/85 px-1 rounded" style={{ fontSize: Math.min(vyskaPx * 0.6, 11 / Math.max(zoom, 0.01)) }}>Časť {i + 1} · {dl / 10} cm</span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (spadavkaMm > 0 && <div className="absolute inset-0 pointer-events-none z-10" style={{ border: '2px dashed rgba(255,0,0,.6)' }}><div className="absolute" style={{ inset: spadavkaMm * ppm, border: '1px dotted rgba(0,150,0,.8)' }} /></div>)}
                  <div ref={(el) => { guideRefs.current[`${k}-v`] = el; }} className="absolute pointer-events-none z-20" style={{ display: 'none', background: '#3b82f6', width: 1, height: '100%', left: '50%', top: 0 }} />
                  <div ref={(el) => { guideRefs.current[`${k}-h`] = el; }} className="absolute pointer-events-none z-20" style={{ display: 'none', background: '#3b82f6', height: 1, width: '100%', top: '50%', left: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const oknoEl = okno && oknoOtv && typeof document !== 'undefined' ? createPortal(
    <div className={uzky ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[48vh] flex flex-col bg-white border-t-2 border-indigo-300 rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.18)]' : 'fixed z-[60] w-[22rem] max-h-[80vh] flex flex-col bg-white border border-slate-300 rounded-2xl shadow-2xl'}
      style={!uzky && oknoPoz ? { left: oknoPoz.x, top: oknoPoz.y } : undefined}>
      <div onPointerDown={uzky ? undefined : zacniTah} className={`px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex items-center justify-between select-none ${uzky ? '' : 'cursor-move touch-none'}`}>
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><PenTool className="w-3.5 h-3.5 text-indigo-500" /> Nástroje motívu {uzky ? '' : <span className="font-normal text-slate-400">(okno sa dá presunúť)</span>}</span>
        <button type="button" onClick={() => { setOknoOtv(false); e()?.zrusVyber(); }} className="p-1 rounded hover:bg-slate-200 text-slate-600" aria-label="Zavrieť nástroje"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto overflow-x-hidden p-3">{nastroje}</div>
    </div>, document.body) : null;

  return children({ nastroje: okno ? null : nastroje, plocha: okno ? <>{plocha}{oknoEl}</> : plocha });
});

export default PlochaEditor;
