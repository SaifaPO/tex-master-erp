// Spoločné jadro 2D editora potlače „líce + rub“ (stolové vlajky, šnúrky na krk…) postavené na Fabric.js.
// Dve plátna (líce, rub), tvar výrezu (clipPath), text, symboly, obrázky, vzory pozadia, prichytávanie na stred a export tlačových PNG
// s priehľadnosťou mimo tvaru (≈ 300 DPI). Žiadne React — ovláda sa z PlochaEditor.jsx.
import { fabric } from 'fabric';

export const SYMBOLY = ['⭐', '❤️', '⚽', '🏆', '🥇', '🏒', '🏀', '🛡️', '⚔️', '🦅', '🦁', '⚓', '⚙️', '🎓', '👑', '🎵', '🍀', '✌️', '🐾', '☀️', '☕', '⚡', '🔥', '🚀', '💎'];

export const FONTY_PREDVOLENE = ['Inter', 'Roboto', 'Montserrat', 'Oswald', 'Playfair Display', 'Poppins', 'Raleway', 'Ubuntu', 'Merriweather', 'Caveat'];

export const VZORY_POZADIA = [
  { id: 't1', nazov: 'Modrá', svg: '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="#1e3a8a"/></svg>' },
  { id: 't2', nazov: 'Šachovnica', svg: '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="#ffffff"/><path d="M0,0 h10 v10 h-10 z M10,10 h10 v10 h-10 z" fill="#000000"/></svg>' },
  { id: 't3', nazov: 'Pruhy', svg: '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#ffffff"/><path d="M-10,10 l20,-20 M0,40 l40,-40 M30,50 l20,-20" stroke="#ef4444" stroke-width="10"/></svg>' },
  { id: 't4', nazov: 'Bodky', svg: '<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="30" fill="#0f172a"/><circle cx="15" cy="15" r="5" fill="#e2e8f0"/></svg>' },
  { id: 't5', nazov: 'Karbón', svg: '<svg width="12" height="12" xmlns="http://www.w3.org/2000/svg"><rect width="12" height="12" fill="#1f2937"/><path d="M-1,1 l3,-3 M0,12 l12,-12 M11,13 l3,-3" stroke="#111827" stroke-width="2"/></svg>' },
  { id: 't6', nazov: 'Cik-cak', svg: '<svg width="30" height="15" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="15" fill="#fce7f3"/><path d="M0,7.5 L7.5,0 L22.5,15 L30,7.5" stroke="#db2777" stroke-width="3" fill="none"/></svg>' },
  { id: 't7', nazov: 'Srdcia', svg: '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#fbcfe8"/><path d="M20,15 A5,5 0 0,0 10,15 C10,22 20,28 20,28 C20,28 30,22 30,15 A5,5 0 0,0 20,15" fill="#be185d"/></svg>' },
  { id: 't8', nazov: 'Hviezdy', svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="#1e40af"/><polygon points="25,5 31,18 45,18 34,26 38,40 25,31 12,40 16,26 5,18 19,18" fill="#fbbf24" transform="scale(0.5) translate(25,25)"/></svg>' },
  { id: 't9', nazov: 'Diamanty', svg: '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="#064e3b"/><polygon points="10,0 20,10 10,20 0,10" fill="#10b981"/></svg>' },
  { id: 't10', nazov: 'Bezpečnostné', svg: '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#fbbf24"/><path d="M-10,10 l20,-20 M0,40 l40,-40 M30,50 l20,-20" stroke="#000000" stroke-width="12"/></svg>' },
  { id: 't11', nazov: 'Konfety', svg: '<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="60" fill="#ffffff"/><circle cx="10" cy="10" r="4" fill="#3b82f6"/><circle cx="50" cy="20" r="3" fill="#ef4444"/><rect x="20" y="40" width="8" height="8" fill="#10b981" transform="rotate(45 24 44)"/><circle cx="40" cy="50" r="5" fill="#f59e0b"/></svg>' },
  { id: 't12', nazov: 'Zlato', svg: '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#ca8a04"/><stop offset="100%" stop-color="#fef08a"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>' },
];

export const svgDoDataUri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');

// Tvary výrezu (clipPath v absolútnych súradniciach plátna), w a h sú rozmery plátna v px
export const TVARY_VYREZU = {
  shield: (w, h) => new fabric.Path(`M 0 0 L ${w} 0 L ${w} ${h * 0.75} Q ${w / 2} ${h} 0 ${h * 0.75} Z`, { absolutePositioned: true }),
  pentagon: (w, h) => new fabric.Polygon([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h * 0.75 }, { x: w / 2, y: h }, { x: 0, y: h * 0.75 }], { absolutePositioned: true }),
  rectangle: (w, h) => new fabric.Path(`M 0 0 L ${w} 0 L ${w} ${h * 0.8} Q ${w / 2} ${h * 1.15} 0 ${h * 0.8} Z`, { absolutePositioned: true }),
  triangle: (w, h) => new fabric.Polygon([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w / 2, y: h }], { absolutePositioned: true }),
};

// Prefarbenie jednofarebného obrázka (ikona z knižnice) na zvolenú farbu
function prefarbi(img, farba) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = farba; g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function vytvorEngine({ elFront, elBack, ppm = 2, onVyber, onZrusVyber, onZmena, onPrichytenie }) {
  const opts = { preserveObjectStacking: true, objectCaching: false, selection: true };
  const front = new fabric.Canvas(elFront, opts);
  const back = new fabric.Canvas(elBack, opts);
  front.backgroundColor = '#ffffff';
  back.backgroundColor = '#ffffff';
  const platna = { front, back };
  let aktivna = 'front';
  let rozmer = { w: 100, h: 100 }; // px

  const dajAktivne = () => platna[aktivna];
  const info = (obj) => ({
    sirkaMm: Math.round(obj.getScaledWidth() / ppm), vyskaMm: Math.round(obj.getScaledHeight() / ppm),
    uhol: ((Math.round(obj.angle || 0) % 360) + 360) % 360,
  });

  [front, back].forEach((canvas, i) => {
    const strana = i === 0 ? 'front' : 'back';
    const vyber = (e) => onVyber?.(info(e.selected[0]), strana);
    canvas.on('selection:created', vyber);
    canvas.on('selection:updated', vyber);
    canvas.on('selection:cleared', () => onZrusVyber?.());
    const transform = (e) => {
      const obj = e.target; if (!obj) return;
      const stred = obj.getCenterPoint();
      const snap = 12 * Math.max(1, ppm / 2);
      let v = false, h = false;
      if (Math.abs(stred.x - canvas.width / 2) < snap) { obj.set({ left: canvas.width / 2 + (obj.left - stred.x) }); v = true; }
      if (Math.abs(stred.y - canvas.height / 2) < snap) { obj.set({ top: canvas.height / 2 + (obj.top - stred.y) }); h = true; }
      onPrichytenie?.(strana, v, h);
      onVyber?.(info(obj), strana);
    };
    canvas.on('object:moving', transform);
    canvas.on('object:scaling', transform);
    canvas.on('object:rotating', (e) => onVyber?.(info(e.target), strana));
    canvas.on('mouse:up', () => onPrichytenie?.(strana, false, false));
    ['object:added', 'object:removed', 'object:modified'].forEach((ev) => canvas.on(ev, () => onZmena?.()));
  });

  const pridaj = (obj) => {
    const c = dajAktivne();
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll();
  };

  return {
    platna,
    setStrana(s) { aktivna = s; },
    getStrana: () => aktivna,
    // rozmer v mm + voliteľný tvar výrezu
    setRozmer(sirkaMm, vyskaMm, tvar = null) {
      const w = Math.round(sirkaMm * ppm), h = Math.round(vyskaMm * ppm);
      rozmer = { w, h };
      [front, back].forEach((c) => {
        c.setWidth(w); c.setHeight(h);
        c.clipPath = tvar && TVARY_VYREZU[tvar] ? TVARY_VYREZU[tvar](w, h) : null;
        c.requestRenderAll();
      });
      return rozmer;
    },
    calcOffset() { front.calcOffset(); back.calcOffset(); },
    pridajText({ text, font = 'Inter', farba = '#000000', obrys = '#ffffff', hrubkaObrysu = 0, kurziva = false, symbol = false, velkostMm = null }) {
      if (!text) return;
      const c = dajAktivne();
      const t = new fabric.IText(text, {
        left: c.width / 2, top: c.height / 2, originX: 'center', originY: 'center',
        fontFamily: symbol ? 'sans-serif' : font, fill: farba,
        fontSize: velkostMm ? velkostMm * ppm : Math.max(14, Math.min(c.height * 0.4, 40 * (ppm / 2)) * (symbol ? 1.5 : 1)),
        fontStyle: kurziva && !symbol ? 'italic' : 'normal',
        stroke: hrubkaObrysu > 0 ? obrys : null, strokeWidth: hrubkaObrysu * (ppm / 2), paintFirst: 'stroke',
      });
      pridaj(t);
    },
    pridajObrazokZUrl(url, farba = null) {
      return new Promise((resolve) => {
        const el = new Image(); el.crossOrigin = 'anonymous';
        el.onload = () => {
          const zdroj = farba ? prefarbi(el, farba) : el;
          const c = dajAktivne();
          const w = zdroj.width, h = zdroj.height;
          const scale = Math.min((c.width * 0.8) / w, (c.height * 0.8) / h);
          const img = new fabric.Image(zdroj, { left: c.width / 2, top: c.height / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
          pridaj(img); resolve(true);
        };
        el.onerror = () => resolve(false);
        el.src = url;
      });
    },
    pridajObrazokZoSuboru(file) {
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = (e) => this.pridajObrazokZUrl(e.target.result).then(resolve);
        r.readAsDataURL(file);
      });
    },
    nastavPozadieVzor(svg) {
      const c = dajAktivne();
      fabric.Image.fromURL(svgDoDataUri(svg), (img) => {
        c.backgroundColor = new fabric.Pattern({ source: img.getElement(), repeat: 'repeat' });
        c.requestRenderAll(); this.onZmenaPozadia?.(); onZmena?.();
      });
    },
    nastavPozadieFarbu(farba) { const c = dajAktivne(); c.backgroundColor = farba; c.requestRenderAll(); onZmena?.(); },
    vymazPozadie() { this.nastavPozadieFarbu('#ffffff'); },
    zmaz() { const c = dajAktivne(); c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); },
    stredH() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.centerH(); o.setCoords(); c.requestRenderAll(); } },
    stredV() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.centerV(); o.setCoords(); c.requestRenderAll(); } },
    otoc(uhol) { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.set('angle', uhol); o.setCoords(); c.requestRenderAll(); onVyber?.(info(o), aktivna); } },
    dopredu() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { c.bringForward(o); c.requestRenderAll(); } },
    dozadu() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { c.sendBackwards(o); c.requestRenderAll(); } },
    duplikuj() {
      const c = dajAktivne(); const o = c.getActiveObject(); if (!o) return;
      o.clone((k) => { k.set({ left: o.left + 20 * ppm, top: o.top + 10 * ppm, evented: true }); c.add(k); c.setActiveObject(k); c.requestRenderAll(); });
    },
    pocetObjektov: () => front.getObjects().length + back.getObjects().length,
    // Tlačové PNG pre líce a rub (≈ 300 DPI, mimo tvaru priehľadné) + JSON stavu na pripadnú reprodukciu
    async exportuj() {
      front.discardActiveObject(); back.discardActiveObject(); front.renderAll(); back.renderAll();
      const nasobok = 300 / 25.4 / ppm;
      const naBlob = async (canvas) => { const url = canvas.toDataURL({ format: 'png', multiplier: nasobok }); return fetch(url).then((r) => r.blob()); };
      return {
        front: await naBlob(front), back: await naBlob(back),
        json: { front: front.toJSON(), back: back.toJSON(), sirkaPx: rozmer.w, vyskaPx: rozmer.h, ppm },
      };
    },
    // Rýchly náhľad (malé PNG) na zobrazenie v objednávke / zhrnutí
    nahlad() {
      front.discardActiveObject(); back.discardActiveObject(); front.renderAll(); back.renderAll();
      return { front: front.toDataURL({ format: 'png', multiplier: 1 }), back: back.toDataURL({ format: 'png', multiplier: 1 }) };
    },
    dispose() { front.dispose(); back.dispose(); },
  };
}
