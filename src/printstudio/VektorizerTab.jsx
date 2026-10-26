import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Download, RefreshCw, Eye, EyeOff, Wand2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { trasuj, zostavSvgZTd } from './vektorTrace.js';
import { setPngDpi } from './dtfSeparator/lib/pngDpi.js';

// Vektorizér obrázkov: rastrový obrázok (PNG/JPG) -> SVG krivky po farbách. Beží celý v prehliadači (vlastný trasovač vektorTrace.js),
// súbor nikam neodchádza a nie je limit počtu obrázkov. Vhodné na logá, ploché grafiky, siluety, podklady pre rezané fólie,
// výšivku a laser. Fotky a veľmi jemné detaily vyjdú horšie než pri AI vektorizácii (to by bolo platené API).
const MIN_LONG_SIDE = 900;   // malé obrázky sa pred trasovaním zväčšia (hladšie krivky)
const MAX_LONG_SIDE = 1600;  // veľké sa zmenšia (rýchlosť)

const PRESETY = [
  { id: 'logo', label: 'Logo / ploché farby', auto: true, colors: 8, vyhladenie: 1, tolerancia: 0.6, pathomit: 8, rohy: true, popis: 'Čisté logá, nápisy, ploché ilustrácie. Rovné hrany ostanú rovné, rohy ostré.' },
  { id: 'silueta', label: 'Silueta (1–2 farby)', colors: 2, vyhladenie: 1.4, tolerancia: 0.7, pathomit: 16, rohy: true, popis: 'Čiernobiele logá, podklady na rezanie fólie a laser.' },
  { id: 'detail', label: 'Detailná kresba', colors: 16, vyhladenie: 0.7, tolerancia: 0.4, pathomit: 2, rohy: true, popis: 'Viac farieb a jemnejšie krivky, väčší SVG súbor.' },
  { id: 'foto', label: 'Fotka (veľa farieb)', colors: 32, vyhladenie: 0.8, tolerancia: 0.5, pathomit: 4, rohy: false, popis: 'Efekt „vektorovej maľby“. Výsledok je veľký a nie vždy čistý.' }
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
// v knizniciach zachyti aj male, ale vyrazne farby (napr. maly zlty napis na velkej cervenej plohe). Vracia aj pocet pixelov farby.
function zhlukuj(imgd, n) {
  const { data } = imgd;
  const bins = new Map();
  let maPriehladne = false, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { maPriehladne = true; continue; }
    total++;
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    let b = bins.get(key);
    if (!b) { b = { r: 0, g: 0, b: 0, n: 0 }; bins.set(key, b); }
    b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; b.n++;
  }
  const pts = [...bins.values()].map(b => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n })).sort((x, y) => y.n - x.n);
  let cent = [];
  if (pts.length) {
    const k = Math.max(1, Math.min(n - (maPriehladne ? 1 : 0), pts.length));
    const d2 = (p, c) => (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
    cent = [{ r: pts[0].r, g: pts[0].g, b: pts[0].b, n: 0 }];
    const minD = pts.map(p => d2(p, cent[0]));
    while (cent.length < k) {
      let best = 0, bestScore = -1;
      for (let i = 0; i < pts.length; i++) { const sc = minD[i] * Math.sqrt(pts[i].n); if (sc > bestScore) { bestScore = sc; best = i; } }
      cent.push({ r: pts[best].r, g: pts[best].g, b: pts[best].b, n: 0 });
      for (let i = 0; i < pts.length; i++) minD[i] = Math.min(minD[i], d2(pts[i], cent[cent.length - 1]));
    }
    for (let it = 0; it < 6; it++) {
      const acc = cent.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
      for (const p of pts) {
        let ci = 0, cd = Infinity;
        for (let c = 0; c < cent.length; c++) { const d = d2(p, cent[c]); if (d < cd) { cd = d; ci = c; } }
        const a = acc[ci]; a.r += p.r * p.n; a.g += p.g * p.n; a.b += p.b * p.n; a.n += p.n;
      }
      cent = cent.map((c, i) => (acc[i].n > 0 ? { r: acc[i].r / acc[i].n, g: acc[i].g / acc[i].n, b: acc[i].b / acc[i].n, n: acc[i].n } : { ...c, n: 0 }));
    }
  }
  return { cent, maPriehladne, total };
}
const naPaletu = (cent, maPriehladne) => {
  const pal = cent.map(c => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: 255 }));
  if (maPriehladne || !pal.length) pal.push({ r: 0, g: 0, b: 0, a: 0 });
  return pal;
};
function vypocitajPaletu(imgd, n) {
  const { cent, maPriehladne } = zhlukuj(imgd, n);
  return naPaletu(cent, maPriehladne);
}

// --- AUTOMATICKY POCET FARIEB ---
// Najde skutocne odlisne farby loga: 16 zhlukov sa zluci podla vnimanej vzdialenosti (Lab), "prechodove" farby po okrajoch tvarov
// (zmes dvoch vacsich farieb, napr. ruzova medzi cervenou a bielou) sa zahodia a drobne odtiene sa pripoja k najblizsej hlavnej farbe.
// Vyrazne, ale male farby (napr. maly zlaty napis) zostanu.
function naLab(c) {
  const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const r = f(c.r), g = f(c.g), b = f(c.b);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const h = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * h(y) - 16, 500 * (h(x) - h(y)), 200 * (h(y) - h(z))];
}
const dE = (a, b) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
function vzdialenostOdUsecky(p, a, b) {
  const ab = [b.lab[0] - a.lab[0], b.lab[1] - a.lab[1], b.lab[2] - a.lab[2]];
  const ap = [p.lab[0] - a.lab[0], p.lab[1] - a.lab[1], p.lab[2] - a.lab[2]];
  const dl = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / dl));
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}
function zluc(cl, i, j) {
  const a = cl[i], b = cl[j], n = a.n + b.n || 1;
  const m = { r: (a.r * a.n + b.r * b.n) / n, g: (a.g * a.n + b.g * b.n) / n, b: (a.b * a.n + b.b * b.n) / n, n: a.n + b.n };
  m.lab = naLab(m);
  cl.splice(j, 1); cl.splice(i, 1, m);
}
function automatickaPaleta(imgd) {
  const { cent, maPriehladne, total } = zhlukuj(imgd, 16);
  let cl = cent.filter(c => c.n > 0).map(c => ({ ...c, lab: naLab(c) }));
  // 1) velmi podobne odtiene -> jedna farba
  for (;;) {
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const d = dE(cl[i], cl[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
    if (bd < 18 && bi >= 0) zluc(cl, bi, bj); else break;
  }
  // 2) prechodove (anti-aliasing) farby: lezia na usecke medzi dvoma vacsimi farbami
  for (;;) {
    cl.sort((x, y) => y.n - x.n);
    let odstran = -1;
    for (let i = cl.length - 1; i >= 2 && odstran < 0; i--) {
      const c = cl[i];
      if (c.n > total * 0.3) continue;
      for (let a = 0; a < cl.length && odstran < 0; a++) for (let b = a + 1; b < cl.length; b++) {
        if (a === i || b === i || cl[a].n < c.n || cl[b].n < c.n) continue;
        if (dE(cl[a], cl[b]) > 25 && vzdialenostOdUsecky(c, cl[a], cl[b]) < 14) { odstran = i; break; }
      }
    }
    if (odstran < 0) break;
    let najblizsia = -1, nd = Infinity;
    cl.forEach((c, k) => { if (k === odstran) return; const d = dE(c, cl[odstran]); if (d < nd) { nd = d; najblizsia = k; } });
    zluc(cl, najblizsia, odstran);
  }
  // 3) drobne farby (< 0,15 % plochy) sa pripoja k najblizsej, ak su si dost podobne; vyrazne male farby ostavaju
  for (;;) {
    cl.sort((x, y) => y.n - x.n);
    let spoj = null;
    for (let i = cl.length - 1; i >= 1 && !spoj; i--) {
      if (cl[i].n >= total * 0.0015) continue;
      let najblizsia = -1, nd = Infinity;
      cl.forEach((c, k) => { if (k === i) return; const d = dE(c, cl[i]); if (d < nd) { nd = d; najblizsia = k; } });
      if (nd < 40) spoj = [najblizsia, i];
    }
    if (!spoj) break;
    zluc(cl, spoj[0], spoj[1]);
  }
  cl.sort((x, y) => y.n - x.n);
  cl = cl.slice(0, 12);
  return { pal: naPaletu(cl, maPriehladne), pocet: cl.length };
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

// Náhľad so zoomom a posunom (koliesko = priblíženie k ukazovateľu, ťahanie = posun). Oba náhľady (originál aj vektor) sa hýbu spolu,
// aby sa dali porovnať detaily na rovnakom mieste.
function ZoomNahlad({ zoom, setZoom, bg, children, vyska = 460 }) {
  const ref = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const naKoliesko = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left - r.width / 2, sy = e.clientY - r.top - r.height / 2;
      setZoom((p) => {
        const z2 = Math.min(32, Math.max(1, p.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        if (z2 === 1) return { z: 1, x: 0, y: 0 };
        const k = z2 / p.z;
        return { z: z2, x: sx - k * (sx - p.x), y: sy - k * (sy - p.y) };
      });
    };
    el.addEventListener('wheel', naKoliesko, { passive: false });
    return () => el.removeEventListener('wheel', naKoliesko);
  }, [setZoom]);
  return (
    <div ref={ref} className={`relative rounded-xl overflow-hidden border border-slate-800 select-none ${zoom.z > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ backgroundColor: bg, height: vyska, touchAction: 'none' }}
      onPointerDown={(e) => { if (zoom.z <= 1) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX - zoom.x, y: e.clientY - zoom.y }; }}
      onPointerMove={(e) => { if (drag.current) setZoom((p) => ({ ...p, x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => setZoom((p) => (p.z > 1 ? { z: 1, x: 0, y: 0 } : { z: 4, x: 0, y: 0 }))}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}

export default function VektorizerTab() {
  const [img, setImg] = useState(null);           // povodny HTMLImageElement
  const [fileName, setFileName] = useState('');
  const [preset, setPreset] = useState('logo');
  const [colors, setColors] = useState(8);
  const [autoFarby, setAutoFarby] = useState(true);   // počet farieb sa nájde automaticky (odlišné farby loga)
  const [najdeneFarby, setNajdeneFarby] = useState(0);
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });  // spoločný zoom a posun oboch náhľadov
  const [vyhladenie, setVyhladenie] = useState(1);   // rozmazanie masky farby (px) – odstráni „schody“ po pixeloch
  const [tolerancia, setTolerancia] = useState(0.6);  // max. odchýlka krivky od obrysu (px)
  const [ostreRohy, setOstreRohy] = useState(true);
  const [vyrovnat, setVyrovnat] = useState(true);
  const [uholVyrovnania, setUholVyrovnania] = useState(3);
  const [pathomit, setPathomit] = useState(8);
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
    setPreset(id); setAutoFarby(!!p.auto); setColors(p.colors); setVyhladenie(p.vyhladenie); setTolerancia(p.tolerancia); setPathomit(p.pathomit); setOstreRohy(p.rohy);
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
        const ap = autoFarby ? automatickaPaleta(imgd) : null;
        const pal = ap ? ap.pal : vypocitajPaletu(imgd, colors);
        setNajdeneFarby(ap ? ap.pocet : 0);
        const td = trasuj(imgd, pal, { vyhladenie, tolerancia, pathomit, ostreRohy, vyrovnat, uholVyrovnania });
        setVysledok({ td, imgd, w: canvas.width, h: canvas.height });
        setSkryte(predvoleneSkryte(td, imgd, odstranitPozadie));
        setChyba('');
      } catch (e) {
        setChyba('Vektorizácia zlyhala: ' + (e.message || e));
      }
      setPocita(false);
    }, 350);
    return () => clearTimeout(t);
  }, [img, colors, autoFarby, vyhladenie, tolerancia, pathomit, ostreRohy, vyrovnat, uholVyrovnania, odstranitPozadie]);

  const poctyTvarov = useMemo(() => (vysledok ? vysledok.td.layers.map(l => l.filter(p => !p.isholepath).length) : []), [vysledok]);

  // SVG z tracedata: viditelne len vybrane farby (viditelna(i) === true)
  const zostavSvg = (viditelna, sirkaCmExport, obrys = 0) => {
    if (!vysledok) return '';
    let svg = zostavSvgZTd(vysledok.td, viditelna, { obrys });
    if (sirkaCmExport > 0) {
      const vyska = (sirkaCmExport * vysledok.h) / vysledok.w;
      svg = svg.replace('<svg ', `<svg width="${sirkaCmExport.toFixed(2)}cm" height="${vyska.toFixed(2)}cm" `);
    }
    return svg;
  };

  const svgCisty = useMemo(() => zostavSvg(i => !skryte.has(i), 0), [vysledok, skryte]); // eslint-disable-line react-hooks/exhaustive-deps
  // náhľad a PNG: jemný okraj v rovnakej farbe zakryje škáry medzi susednými farbami
  const svgVsetky = useMemo(() => zostavSvg(i => !skryte.has(i), 0, 0.5), [vysledok, skryte]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const velkostKb = svgCisty ? Math.max(1, Math.round(svgCisty.length / 1024)) : 0;

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
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <button onClick={() => setZoom((p) => ({ z: Math.max(1, p.z / 1.5), x: p.z / 1.5 <= 1 ? 0 : p.x, y: p.z / 1.5 <= 1 ? 0 : p.y }))} title="Oddialiť" className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"><ZoomOut className="h-4 w-4" /></button>
                <button onClick={() => setZoom((p) => ({ ...p, z: Math.min(32, p.z * 1.5) }))} title="Priblížiť" className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"><ZoomIn className="h-4 w-4" /></button>
                <button onClick={() => setZoom({ z: 1, x: 0, y: 0 })} title="Celý obrázok" className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white"><Maximize className="h-4 w-4" /></button>
                <span className="font-mono text-white">{Math.round(zoom.z * 100)} %</span>
                <span className="text-[10px] text-slate-500">koliesko = priblíženie · ťahanie = posun · dvojklik = 400 % / späť · originál a vektor sa hýbu spolu</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Originál</p>
                  <ZoomNahlad zoom={zoom} setZoom={setZoom} bg={previewBg}>
                    <img src={urlRef.current} alt="originál" draggable={false} className="max-w-full max-h-full object-contain" />
                  </ZoomNahlad>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Vektor (SVG){velkostKb ? ` — ${velkostKb} kB` : ''}</p>
                  <ZoomNahlad zoom={zoom} setZoom={setZoom} bg={previewBg}>
                    {svgUrl ? <img src={svgUrl} alt="vektor" draggable={false} className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-500 p-6">…</span>}
                  </ZoomNahlad>
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
            <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer mb-1.5">
              <input type="checkbox" checked={autoFarby} onChange={(e) => setAutoFarby(e.target.checked)} className="accent-indigo-600" /> Počet farieb nájsť automaticky
              {autoFarby && najdeneFarby > 0 && <span className="ml-auto text-[10px] font-mono text-indigo-300">nájdených {najdeneFarby}</span>}
            </label>
            <div className={autoFarby ? 'opacity-40 pointer-events-none' : ''}>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Počet farieb</span><span className="text-white font-mono">{colors}</span></label>
              <input type="range" min="2" max="64" value={colors} onChange={(e) => setColors(Number(e.target.value))} className="w-full" />
            </div>
            <p className="text-[9px] text-slate-600">Automaticky = program nájde skutočne odlišné farby loga (bez prechodových odtieňov po okrajoch). Ak niečo chýba alebo prebýva, vypni a nastav počet ručne.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Odstrániť drobné škvrny</span><span className="text-white font-mono">{pathomit}</span></label>
            <input type="range" min="0" max="60" value={pathomit} onChange={(e) => setPathomit(Number(e.target.value))} className="w-full" />
            <p className="text-[9px] text-slate-600">Vyššie číslo = čistejší výsledok, ale zmiznú malé detaily.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Vyhladenie hrán</span><span className="text-white font-mono">{vyhladenie.toFixed(1)}</span></label>
            <input type="range" min="0.6" max="4" step="0.1" value={vyhladenie} onChange={(e) => setVyhladenie(Number(e.target.value))} className="w-full" />
            <p className="text-[9px] text-slate-600">Vyššie číslo = hladšie a „pokojnejšie“ krivky (odstráni zúbky z nekvalitného obrázka), ale jemné detaily a rohy sa viac zaoblia.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Presnosť kriviek (px)</span><span className="text-white font-mono">{tolerancia.toFixed(1)}</span></label>
            <input type="range" min="0.2" max="3" step="0.1" value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} className="w-full" />
            <p className="text-[9px] text-slate-600">Nižšie číslo = presnejšie sleduje obrys (viac bodov), vyššie = menej bodov a jednoduchšie krivky.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
            <input type="checkbox" checked={ostreRohy} onChange={(e) => setOstreRohy(e.target.checked)} className="accent-indigo-600" /> Zachovať ostré rohy a rovné hrany
          </label>
          {ostreRohy && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
                <input type="checkbox" checked={vyrovnat} onChange={(e) => setVyrovnat(e.target.checked)} className="accent-indigo-600" /> Vyrovnať vodorovné a zvislé hrany
              </label>
              {vyrovnat && (
                <>
                  <label className="text-[11px] text-slate-400 flex justify-between"><span>Vyrovnať hrany odchýlené do</span><span className="text-white font-mono">{uholVyrovnania}°</span></label>
                  <input type="range" min="1" max="10" step="0.5" value={uholVyrovnania} onChange={(e) => setUholVyrovnania(Number(e.target.value))} className="w-full" />
                  <p className="text-[9px] text-slate-600">Hrana, ktorá je o niekoľko stupňov od vodorovnej alebo zvislej (napr. šikmý vrch písmena T), sa urobí presne rovná. Zvýš, ak je logo nakrivo viac. Zníž, ak je šikmina zámerná.</p>
                </>
              )}
            </div>
          )}
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
