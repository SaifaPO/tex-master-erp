import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Download, RefreshCw, Eye, EyeOff, Wand2 } from 'lucide-react';
import ImageTracer from 'imagetracerjs';
import { setPngDpi } from './dtfSeparator/lib/pngDpi.js';

// Vektorizér obrázkov: rastrový obrázok (PNG/JPG) -> SVG krivky po farbách. Beží celý v prehliadači (knižnica imagetracerjs),
// súbor nikam neodchádza a nie je limit počtu obrázkov. Vhodné na logá, ploché grafiky, siluety, podklady pre rezané fólie,
// výšivku a laser. Fotky a veľmi jemné detaily vyjdú horšie než pri AI vektorizácii (to by bolo platené API).
const MIN_LONG_SIDE = 900;   // malé obrázky sa pred trasovaním zväčšia (hladšie krivky)
const MAX_LONG_SIDE = 1600;  // veľké sa zmenšia (rýchlosť)

const PRESETY = [
  { id: 'logo', label: 'Logo / ploché farby', colors: 8, ltres: 1, qtres: 1, pathomit: 8, blur: 0, popis: 'Čisté logá, nápisy, ploché ilustrácie.' },
  { id: 'silueta', label: 'Silueta (1–2 farby)', colors: 2, ltres: 1, qtres: 1, pathomit: 16, blur: 1, popis: 'Čiernobiele logá, podklady na rezanie fólie a laser.' },
  { id: 'detail', label: 'Detailná kresba', colors: 16, ltres: 0.5, qtres: 0.5, pathomit: 2, blur: 0, popis: 'Viac farieb a jemnejšie krivky, väčší SVG súbor.' },
  { id: 'foto', label: 'Fotka (veľa farieb)', colors: 32, ltres: 0.5, qtres: 0.5, pathomit: 4, blur: 0, popis: 'Efekt „vektorovej maľby“. Výsledok je veľký a nie vždy čistý.' }
];

const farbaCss = (c) => `rgba(${c.r},${c.g},${c.b},${(c.a ?? 255) / 255})`;
const farbaHex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// Pripravi canvas pre trasovanie (zvacsi male / zmensi velke obrazky)
function pripravCanvas(img) {
  const longSide = Math.max(img.width, img.height);
  const scale = Math.min(MAX_LONG_SIDE / longSide, Math.max(1, MIN_LONG_SIDE / longSide));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

// Vlastny vypocet palety (k-means so "vzdialenym" vyberom startovych farieb): na rozdiel od nahodneho/mriezkoveho vzorkovania
// v knizniciach zachyti aj male, ale vyrazne farby (napr. maly zlty napis na velkej cervenej plohe).
function vypocitajPaletu(imgd, n) {
  const { data } = imgd;
  const bins = new Map();
  let maPriehladne = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { maPriehladne = true; continue; }
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    let b = bins.get(key);
    if (!b) { b = { r: 0, g: 0, b: 0, n: 0 }; bins.set(key, b); }
    b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
  }
  const pts = [...bins.values()].map(b => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n })).sort((x, y) => y.n - x.n);
  const pal = [];
  if (pts.length) {
    const k = Math.max(1, Math.min(n - (maPriehladne ? 1 : 0), pts.length));
    const d2 = (p, c) => (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
    const cent = [{ r: pts[0].r, g: pts[0].g, b: pts[0].b }];
    const minD = pts.map(p => d2(p, cent[0]));
    while (cent.length < k) {
      let best = 0, bestScore = -1;
      for (let i = 0; i < pts.length; i++) { const sc = minD[i] * Math.sqrt(pts[i].n); if (sc > bestScore) { bestScore = sc; best = i; } }
      cent.push({ r: pts[best].r, g: pts[best].g, b: pts[best].b });
      for (let i = 0; i < pts.length; i++) minD[i] = Math.min(minD[i], d2(pts[i], cent[cent.length - 1]));
    }
    for (let it = 0; it < 6; it++) {
      const acc = cent.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
      for (const p of pts) {
        let ci = 0, cd = Infinity;
        for (let c = 0; c < cent.length; c++) { const d = d2(p, cent[c]); if (d < cd) { cd = d; ci = c; } }
        const a = acc[ci]; a.r += p.r * p.n; a.g += p.g * p.n; a.b += p.b * p.n; a.n += p.n;
      }
      acc.forEach((a, c) => { if (a.n > 0) cent[c] = { r: a.r / a.n, g: a.g / a.n, b: a.b / a.n }; });
    }
    cent.forEach(c => pal.push({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: 255 }));
  }
  if (maPriehladne || !pal.length) pal.push({ r: 0, g: 0, b: 0, a: 0 });
  return pal;
}

// Ktora farba palety je pozadie: priehladne polozky vzdy, pripadne farba najblizsia priemeru styroch rohov
function predvoleneSkryte(td, imgd, odstranitPozadie) {
  const skryte = new Set();
  td.palette.forEach((c, i) => { if ((c.a ?? 255) < 128) skryte.add(i); });
  if (!odstranitPozadie) return skryte;
  const { data, width, height } = imgd;
  const rohy = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => { const p = (y * width + x) * 4; return [data[p], data[p + 1], data[p + 2], data[p + 3]]; });
  if (rohy.some(r => r[3] < 128)) return skryte; // pozadie je uz priehladne
  const avg = [0, 1, 2].map(k => rohy.reduce((s, r) => s + r[k], 0) / 4);
  let best = -1, bestD = Infinity;
  td.palette.forEach((c, i) => {
    if ((c.a ?? 255) < 128) return;
    const d = Math.hypot(c.r - avg[0], c.g - avg[1], c.b - avg[2]);
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best >= 0 && bestD < 60) skryte.add(best);
  return skryte;
}

export default function VektorizerTab() {
  const [img, setImg] = useState(null);           // povodny HTMLImageElement
  const [fileName, setFileName] = useState('');
  const [preset, setPreset] = useState('logo');
  const [colors, setColors] = useState(8);
  const [ltres, setLtres] = useState(1);
  const [qtres, setQtres] = useState(1);
  const [pathomit, setPathomit] = useState(8);
  const [blur, setBlur] = useState(0);
  const [odstranitPozadie, setOdstranitPozadie] = useState(true);
  const [vysledok, setVysledok] = useState(null); // { td, imgd, w, h }
  const [skryte, setSkryte] = useState(new Set());
  const [pocita, setPocita] = useState(false);
  const [chyba, setChyba] = useState('');
  const [previewBg, setPreviewBg] = useState('#ffffff');
  const [sirkaCm, setSirkaCm] = useState(10);
  const [dpi, setDpi] = useState(300);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const urlRef = useRef('');

  const pouziPreset = (id) => {
    const p = PRESETY.find(x => x.id === id);
    if (!p) return;
    setPreset(id); setColors(p.colors); setLtres(p.ltres); setQtres(p.qtres); setPathomit(p.pathomit); setBlur(p.blur);
  };

  const nacitajSubor = (file) => {
    if (!file) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const im = new Image();
    im.onload = () => { setImg(im); setFileName(file.name); setChyba(''); };
    im.onerror = () => setChyba('Obrázok sa nepodarilo načítať (podporované: PNG, JPG, WebP).');
    im.src = url;
  };

  // Vkladanie obrazka zo schranky (Ctrl+V)
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
      if (f) nacitajSubor(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // Trasovanie (debounced), pri kazdej zmene nastavenia
  useEffect(() => {
    if (!img) { setVysledok(null); return undefined; }
    setPocita(true);
    const t = setTimeout(() => {
      try {
        const canvas = pripravCanvas(img);
        const imgd = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const options = { pal: vypocitajPaletu(imgd, colors), numberofcolors: colors, colorquantcycles: 1, ltres, qtres, pathomit, blurradius: blur, blurdelta: 20, colorsampling: 2, strokewidth: 0, roundcoords: 1, layering: 0, viewbox: true };
        const td = ImageTracer.imagedataToTracedata(imgd, options);
        setVysledok({ td, imgd, options, w: canvas.width, h: canvas.height });
        setSkryte(predvoleneSkryte(td, imgd, odstranitPozadie));
        setChyba('');
      } catch (e) {
        setChyba('Vektorizácia zlyhala: ' + (e.message || e));
      }
      setPocita(false);
    }, 350);
    return () => clearTimeout(t);
  }, [img, colors, ltres, qtres, pathomit, blur, odstranitPozadie]);

  const poctyTvarov = useMemo(() => (vysledok ? vysledok.td.layers.map(l => l.filter(p => !p.isholepath).length) : []), [vysledok]);

  // SVG z tracedata: viditelne len vybrane farby (viditelna(i) === true)
  const zostavSvg = (viditelna, sirkaCmExport) => {
    if (!vysledok) return '';
    const kopia = { ...vysledok.td, layers: vysledok.td.layers.map((l, i) => (viditelna(i) ? l : [])) };
    let svg = ImageTracer.getsvgstring(kopia, { ...vysledok.options, viewbox: true, scale: 1 });
    if (sirkaCmExport > 0) {
      const vyska = (sirkaCmExport * vysledok.h) / vysledok.w;
      svg = svg.replace('<svg ', `<svg width="${sirkaCmExport.toFixed(2)}cm" height="${vyska.toFixed(2)}cm" `);
    }
    return svg;
  };

  const svgVsetky = useMemo(() => zostavSvg(i => !skryte.has(i), 0), [vysledok, skryte]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgUrl = useMemo(() => (svgVsetky ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgVsetky) : ''), [svgVsetky]);
  const zaklad = (fileName || 'vektor').replace(/\.[^.]+$/, '');

  const stiahni = (blob, nazov) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nazov;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const stiahniSvg = () => stiahni(new Blob([zostavSvg(i => !skryte.has(i), sirkaCm)], { type: 'image/svg+xml' }), `${zaklad}.svg`);
  const stiahniFarbu = (idx) => stiahni(new Blob([zostavSvg(i => i === idx, sirkaCm)], { type: 'image/svg+xml' }), `${zaklad}_farba${idx + 1}_${farbaHex(vysledok.td.palette[idx]).slice(1)}.svg`);
  const stiahniPng = () => {
    if (!svgVsetky) return;
    const pxW = Math.max(1, Math.round((sirkaCm / 2.54) * dpi));
    const pxH = Math.max(1, Math.round((pxW * vysledok.h) / vysledok.w));
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = pxW; c.height = pxH;
      c.getContext('2d').drawImage(im, 0, 0, pxW, pxH);
      const a = document.createElement('a');
      a.href = setPngDpi(c.toDataURL('image/png'), dpi);
      a.download = `${zaklad}_${sirkaCm}cm_${dpi}dpi.png`;
      a.click();
    };
    im.src = svgUrl;
  };
  const prepniFarbu = (i) => setSkryte(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const velkostKb = svgVsetky ? Math.round(svgVsetky.length / 1024) : 0;

  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wand2 className="h-5 w-5 text-indigo-400" /> Vektorizér obrázkov <span className="text-xs text-slate-500 font-normal">— PNG/JPG → SVG krivky</span></h2>
        <p className="text-xs text-slate-400 mt-1">Premení logo alebo grafiku na vektor (SVG) po farbách. Beží priamo v prehliadači, súbor nikam neodchádza. Hodí sa na rezané fólie, výšivku, laser a tlač. Obrázok môžeš aj vložiť zo schránky (Ctrl+V).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-3">
          {!img ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setDragging(false); nacitajSubor(e.dataTransfer.files?.[0]); }}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-24 cursor-pointer transition-colors ${dragging ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-700 hover:border-indigo-500'}`}
            >
              <Upload className="h-8 w-8 text-slate-500" />
              <span className="text-sm text-slate-400">Klikni a nahraj obrázok, pretiahni ho sem alebo ho vlož (Ctrl+V)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => nacitajSubor(e.target.files[0])} />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-400">
                <span>Pozadie náhľadu:</span>
                {['#ffffff', '#cbd5e1', '#0f172a', '#7f1d1d'].map(c => (
                  <button key={c} onClick={() => setPreviewBg(c)} style={{ backgroundColor: c }} className={`h-6 w-6 rounded-full border-2 ${previewBg === c ? 'border-indigo-400' : 'border-slate-700'}`} />
                ))}
                <input type="color" value={previewBg} onChange={(e) => setPreviewBg(e.target.value)} className="h-6 w-8 bg-transparent border border-slate-700 rounded cursor-pointer" />
                {pocita && <span className="text-[10px] text-indigo-400 flex items-center gap-1 ml-auto pr-2"><RefreshCw className="h-3 w-3 animate-spin" /> vektorizujem…</span>}
              </div>
              {chyba && <p className="text-xs text-rose-400">{chyba}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Originál</p>
                  <div className="rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center" style={{ backgroundColor: previewBg }}>
                    <img src={urlRef.current} alt="originál" className="max-w-full h-auto" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Vektor (SVG){velkostKb ? ` — ${velkostKb} kB` : ''}</p>
                  <div className="rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[120px]" style={{ backgroundColor: previewBg }}>
                    {svgUrl ? <img src={svgUrl} alt="vektor" className="max-w-full h-auto" /> : <span className="text-xs text-slate-500 p-6">…</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => fileRef.current?.click()} className="text-xs text-slate-500 hover:text-slate-300 underline">Nahrať iný obrázok</button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => nacitajSubor(e.target.files[0])} />
            </>
          )}
        </div>

        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 h-fit max-h-[calc(100vh-3rem)] overflow-y-auto">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Predvoľba</label>
            <div className="grid grid-cols-1 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {PRESETY.map(p => (
                <button key={p.id} onClick={() => pouziPreset(p.id)} className={`py-1.5 rounded text-xs font-bold ${preset === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{p.label}</button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{PRESETY.find(p => p.id === preset)?.popis}</p>
          </div>

          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Počet farieb</span><span className="text-white font-mono">{colors}</span></label>
            <input type="range" min="2" max="64" value={colors} onChange={(e) => setColors(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Odstrániť drobné škvrny</span><span className="text-white font-mono">{pathomit}</span></label>
            <input type="range" min="0" max="60" value={pathomit} onChange={(e) => setPathomit(Number(e.target.value))} className="w-full" />
            <p className="text-[9px] text-slate-600">Vyššie číslo = čistejší výsledok, ale zmiznú malé detaily.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Vyhladenie hrán (rozostrenie pred trasovaním)</span><span className="text-white font-mono">{blur}</span></label>
            <input type="range" min="0" max="5" step="1" value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Presnosť čiar</span><span className="text-white font-mono">{ltres}</span></label>
              <input type="range" min="0.1" max="4" step="0.1" value={ltres} onChange={(e) => setLtres(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Presnosť kriviek</span><span className="text-white font-mono">{qtres}</span></label>
              <input type="range" min="0.1" max="4" step="0.1" value={qtres} onChange={(e) => setQtres(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
            <input type="checkbox" checked={odstranitPozadie} onChange={(e) => setOdstranitPozadie(e.target.checked)} className="accent-indigo-600" /> Automaticky skryť farbu pozadia
          </label>

          {vysledok && (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Farby vo vektore (klikni na oko = skryť / zobraziť)</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {vysledok.td.palette.map((c, i) => (
                  <div key={i} className={`flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 ${skryte.has(i) ? 'opacity-50' : ''}`}>
                    <span className="h-5 w-5 rounded border border-slate-600 shrink-0" style={{ background: farbaCss(c) }} />
                    <span className="text-[10px] text-slate-400 font-mono flex-1">{(c.a ?? 255) < 128 ? 'priehľadná' : farbaHex(c)} · {poctyTvarov[i] || 0} tvarov</span>
                    <button onClick={() => prepniFarbu(i)} title={skryte.has(i) ? 'Zobraziť' : 'Skryť'} className="text-slate-400 hover:text-white">{skryte.has(i) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <button onClick={() => stiahniFarbu(i)} title="Stiahnuť len túto farbu ako SVG" className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">SVG</button>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-600">Tlačidlo „SVG“ pri farbe stiahne len tú farbu — hodí sa na rezanie fólie po vrstvách alebo na výšivku.</p>
            </div>
          )}

          <div className="border-t border-slate-800 pt-3 space-y-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Export</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Šírka (cm)</label>
                <input type="number" min="0.5" step="0.5" value={sirkaCm} onChange={(e) => setSirkaCm(Number(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">DPI (pre PNG)</label>
                <input type="number" min="72" max="600" value={dpi} onChange={(e) => setDpi(Number(e.target.value) || 300)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
              </div>
            </div>
            <button onClick={stiahniSvg} disabled={!vysledok} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"><Download className="h-4 w-4" /> Stiahnuť SVG ({sirkaCm} cm)</button>
            <button onClick={stiahniPng} disabled={!vysledok} className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2"><Download className="h-4 w-4" /> Stiahnuť PNG (priehľadné, {dpi} DPI)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
