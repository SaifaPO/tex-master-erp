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
  // „Zaoblená“: obdĺžnik s rovnými bokmi a dole polkruh (polomer = polovica šírky), napojený priamo na boky
  rectangle: (w, h) => { const r = Math.min(w / 2, h); return new fabric.Path(`M 0 0 L ${w} 0 L ${w} ${h - r} A ${w / 2} ${r} 0 0 1 0 ${h - r} Z`, { absolutePositioned: true }); },
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

export function vytvorEngine({ elFront, elBack, elDalsie = {}, ppm = 2, pozadie = '#ffffff', onVyber, onZrusVyber, onZmena, onPrichytenie }) {
  const opts = { preserveObjectStacking: true, objectCaching: false, selection: true };
  const front = new fabric.Canvas(elFront, opts);
  const back = new fabric.Canvas(elBack, opts);
  front.backgroundColor = pozadie;
  back.backgroundColor = pozadie;
  const platna = { front, back };
  // ďalšie strany (napr. šiltovka: ľavý a pravý bok) — každá má vlastné plátno
  Object.entries(elDalsie).forEach(([k, el]) => { const c = new fabric.Canvas(el, opts); c.backgroundColor = pozadie; platna[k] = c; });
  const vsetky = () => Object.values(platna);
  vsetky().forEach((c) => { if (c.wrapperEl) { c.wrapperEl.style.position = 'relative'; c.wrapperEl.style.zIndex = '1'; } }); // plátno je nad podkladovým obrázkom produktu
  let aktivna = 'front';
  let rozmer = { w: 100, h: 100 }; // px

  const dajAktivne = () => platna[aktivna];

  // ZÓNY (potlačové plochy na produkte, napr. hruď / chrbát / rukáv): obdĺžnik so stredom (cx, cy), rozmermi (w, h) v px plátna a natočením (rot).
  // Objekt patrí do zóny (vlastnosť `zona`), nedá sa vytiahnuť von, magneticky sa centruje na stred zóny aj produktu a z jeho obsahu sa robí tlač.
  let zony = [];
  let vkladanie = null; // kód zóny, do ktorej sa vkladajú nové objekty
  const zonaPodla = (kod) => zony.find((z) => z.kod === kod);
  const naLokal = (z, x, y) => { const th = ((z.rot || 0) * Math.PI) / 180, c = Math.cos(-th), s = Math.sin(-th); const dx = x - z.cx, dy = y - z.cy; return { x: dx * c - dy * s, y: dx * s + dy * c }; };
  const zLokalu = (z, lx, ly) => { const th = ((z.rot || 0) * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th); return { x: z.cx + lx * c - ly * s, y: z.cy + lx * s + ly * c }; };
  // Zóny sú len NÁZNAK maximálneho rozmeru — nie sú klikateľné ani nútené. Objekt sa priradí k zóne podľa polohy (najbližšia na tej istej strane).
  const priradZonu = (obj, strana) => {
    const st = obj.getCenterPoint(); let najlepsia = null, d0 = Infinity;
    zony.filter((z) => z.strana === strana).forEach((z) => {
      const l = naLokal(z, st.x, st.y);
      const d = Math.hypot(Math.max(0, Math.abs(l.x) - z.w / 2), Math.max(0, Math.abs(l.y) - z.h / 2));
      if (d < d0) { d0 = d; najlepsia = z; }
    });
    obj.zona = najlepsia ? najlepsia.kod : undefined;
  };
  const priradVsetky = () => { Object.entries(platna).forEach(([s, c]) => c.getObjects().forEach((o) => { if (!zonaPodla(o.zona)) priradZonu(o, s); })); };
  const info = (obj) => ({
    sirkaMm: Math.round(obj.getScaledWidth() / ppm), vyskaMm: Math.round(obj.getScaledHeight() / ppm),
    maxMm: Math.round(((obj.zona && zonaPodla(obj.zona)) ? Math.max(zonaPodla(obj.zona).w, zonaPodla(obj.zona).h) * 1.15 : Math.max(rozmer.w, rozmer.h) * 0.9) / ppm),
    uhol: ((Math.round(obj.angle || 0) % 360) + 360) % 360,
    typ: obj.type === 'i-text' || obj.type === 'text' ? 'text' : 'obrazok',
    ...((obj.type === 'i-text' || obj.type === 'text') ? {
      text: obj.text, font: obj.fontFamily, farba: obj.fill || '#000000', obrys: obj.stroke || '#ffffff',
      hrubkaMm: obj.stroke ? Math.round((obj.strokeWidth || 0) / (2 * ppm) * 10) / 10 : 0, kurziva: obj.fontStyle === 'italic',
    } : {}),
  });

  Object.entries(platna).forEach(([strana, canvas]) => {
    const vyber = (e) => onVyber?.(info(e.selected[0]), strana);
    canvas.on('selection:created', vyber);
    canvas.on('selection:updated', vyber);
    canvas.on('selection:cleared', () => onZrusVyber?.());
    const transform = (e) => {
      const obj = e.target; if (!obj) return;
      const stred = obj.getCenterPoint();
      const snap = 12 * Math.max(1, ppm / 2);
      let v = false, h = false;
      const z = obj.zona && zonaPodla(obj.zona);
      const cielX = [canvas.width / 2], cielY = [canvas.height / 2];
      if (z) { cielX.push(z.cx); cielY.push(z.cy); }
      for (const cx of cielX) if (Math.abs(stred.x - cx) < snap) { obj.set({ left: cx + (obj.left - stred.x) }); v = true; break; }
      for (const cy of cielY) if (Math.abs(stred.y - cy) < snap) { obj.set({ top: cy + (obj.top - stred.y) }); h = true; break; }
      onPrichytenie?.(strana, v, h);
      onVyber?.(info(obj), strana);
    };
    canvas.on('object:moving', transform);
    canvas.on('object:scaling', transform);
    canvas.on('object:rotating', (e) => onVyber?.(info(e.target), strana));
    canvas.on('text:changed', (e) => onVyber?.(info(e.target), strana)); // úprava textu priamo na plátne (dvojklik)
    canvas.on('mouse:up', () => onPrichytenie?.(strana, false, false));
    // nenápadný náznak maximálnej plochy + živý rozmer vybraného objektu v mm priamo na plátne
    canvas.on('object:modified', (e) => { if (e.target && e.target.type !== 'activeSelection') priradZonu(e.target, strana); });
    canvas.on('after:render', () => {
      const ctx = canvas.contextContainer; if (!ctx) return;
      zony.filter((z) => z.strana === strana).forEach((z) => {
        ctx.save(); ctx.translate(z.cx, z.cy); ctx.rotate(((z.rot || 0) * Math.PI) / 180);
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(100,116,139,0.5)';
        ctx.strokeRect(-z.w / 2, -z.h / 2, z.w, z.h); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(100,116,139,0.85)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(z.popis || z.kod, -z.w / 2 + 3, -z.h / 2 - 4);
        ctx.restore();
      });
      const o = canvas.getActiveObject();
      if (o && o.type !== 'activeSelection') {
        const bb = o.getBoundingRect(true, true);
        const txt = `${Math.round(o.getScaledWidth() / ppm)} × ${Math.round(o.getScaledHeight() / ppm)} mm`;
        ctx.save(); ctx.font = 'bold 13px sans-serif'; const w = ctx.measureText(txt).width + 12;
        const x = Math.max(2, Math.min(canvas.width - w - 2, bb.left + bb.width / 2 - w / 2)), y = Math.min(canvas.height - 22, bb.top + bb.height + 8);
        ctx.fillStyle = 'rgba(15,23,42,0.9)'; ctx.fillRect(x, y, w, 19); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, x + w / 2, y + 13.5); ctx.restore();
      }
    });
    ['object:added', 'object:removed', 'object:modified', 'text:changed'].forEach((ev) => canvas.on(ev, () => onZmena?.()));
  });

  // nový objekt sa vloží do prvej voľnej zóny na zobrazenej strane (inak do prvej); používateľ ho potom posunie, kam chce
  const zonaPreVlozenie = () => {
    const pref = vkladanie && zonaPodla(vkladanie); if (pref) { aktivna = pref.strana; return pref; }
    const zs = zony.filter((z) => z.strana === aktivna); if (!zs.length) return null;
    return zs.find((z) => !platna[aktivna].getObjects().some((o) => o.zona === z.kod)) || zs[0];
  };
  const pridaj = (obj) => {
    const z = zonaPreVlozenie();
    if (z) obj.set({ left: z.cx, top: z.cy, originX: 'center', originY: 'center', angle: z.rot || 0, zona: z.kod });
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
      vsetky().forEach((c) => {
        c.setWidth(w); c.setHeight(h);
        c.clipPath = tvar && TVARY_VYREZU[tvar] ? TVARY_VYREZU[tvar](w, h) : null;
        c.requestRenderAll();
      });
      return rozmer;
    },
    calcOffset() { vsetky().forEach((c) => c.calcOffset()); },
    pridajText({ text, font = 'Inter', farba = '#000000', obrys = '#ffffff', hrubkaObrysu = 0, kurziva = false, symbol = false, velkostMm = null }) {
      if (!text) return;
      const c = dajAktivne();
      const t = new fabric.IText(text, {
        left: c.width / 2, top: c.height / 2, originX: 'center', originY: 'center',
        fontFamily: symbol ? 'sans-serif' : font, fill: farba,
        fontSize: velkostMm ? velkostMm * ppm : (zonaPreVlozenie() ? (symbol ? Math.max(14, Math.min(zonaPreVlozenie().w, zonaPreVlozenie().h) * 0.55) : Math.max(12, Math.min(zonaPreVlozenie().h * 0.3, 40 * ppm))) : Math.max(14, Math.min(c.height * 0.4, 40 * (ppm / 2)) * (symbol ? 1.5 : 1))),
        fontStyle: kurziva && !symbol ? 'italic' : 'normal',
        stroke: hrubkaObrysu > 0 ? obrys : null, strokeWidth: hrubkaObrysu * 2 * ppm, paintFirst: 'stroke', strokeLineJoin: 'round', strokeUniform: true,
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
          const zz = zonaPreVlozenie();
          const scale = Math.min(((zz ? zz.w : c.width) * 0.7) / w, ((zz ? zz.h : c.height) * 0.7) / h);
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
    // úprava už vloženého textu (vybraný objekt): text, písmo, farba, obrys (hrúbka v mm VIDITEĽNÁ pod písmenami — obrys sa kreslí pod výplň),
    // kurzíva. Obrys je vždy pod písmom, takže ho nezjedá.
    upravText({ text, font, farba, obrys, hrubkaMm, kurziva }) {
      const c = dajAktivne(); const o = c.getActiveObject();
      if (!o || (o.type !== 'i-text' && o.type !== 'text')) return;
      if (text !== undefined) o.set('text', text);
      if (font !== undefined) o.set('fontFamily', font);
      if (farba !== undefined) o.set('fill', farba);
      if (kurziva !== undefined) o.set('fontStyle', kurziva ? 'italic' : 'normal');
      const nova = hrubkaMm !== undefined ? hrubkaMm : (o.stroke ? (o.strokeWidth || 0) / (2 * ppm) : 0);
      const farbaObrysu = obrys !== undefined ? obrys : (o.stroke || '#ffffff');
      o.set({ stroke: nova > 0 ? farbaObrysu : null, strokeWidth: nova * 2 * ppm, paintFirst: 'stroke', strokeLineJoin: 'round', strokeUniform: true });
      if (obrys !== undefined && !(nova > 0)) o.set('stroke', null);
      o.dirty = true; o.setCoords(); c.requestRenderAll(); onVyber?.(info(o), aktivna); onZmena?.();
    },
    zrusVyber() { vsetky().forEach((c) => { c.discardActiveObject(); c.requestRenderAll(); }); },
    nastavPozadieVzor(svg) {
      const c = dajAktivne();
      fabric.Image.fromURL(svgDoDataUri(svg), (img) => {
        c.backgroundColor = new fabric.Pattern({ source: img.getElement(), repeat: 'repeat' });
        c.requestRenderAll(); this.onZmenaPozadia?.(); onZmena?.();
      });
    },
    nastavPozadieFarbu(farba) { const c = dajAktivne(); c.backgroundColor = farba; c.requestRenderAll(); onZmena?.(); },
    vymazPozadie() { this.nastavPozadieFarbu(pozadie || '#ffffff'); },
    zmaz() { const c = dajAktivne(); c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); },
    stredH() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.centerH(); o.setCoords(); c.requestRenderAll(); } },
    stredV() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.centerV(); o.setCoords(); c.requestRenderAll(); } },
    // posuvník veľkosti: šírka vybraného objektu v mm (pomer strán sa zachová)
    velkostMm(mm) { const c = dajAktivne(); const o = c.getActiveObject(); if (!o || !(mm > 0)) return; const stred = o.getCenterPoint(); o.scaleToWidth(mm * ppm); o.setPositionByOrigin(stred, 'center', 'center'); o.setCoords(); c.requestRenderAll(); onVyber?.(info(o), aktivna); onZmena?.(); },
    // väčšie úchyty na rohoch (dotyk) — veľkosť v px plátna, prepočítaná podľa priblíženia
    nastavOvladace(px) { const p = Math.max(10, Math.round(px)); fabric.Object.prototype.cornerSize = p; fabric.Object.prototype.touchCornerSize = p * 2; fabric.Object.prototype.padding = Math.round(p * 0.3); vsetky().forEach((c) => { c.getObjects().forEach((o) => { o.cornerSize = p; o.touchCornerSize = p * 2; o.padding = Math.round(p * 0.3); o.setCoords(); }); c.requestRenderAll(); }); },
    otoc(uhol) { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { o.set('angle', uhol); o.setCoords(); c.requestRenderAll(); onVyber?.(info(o), aktivna); } },
    dopredu() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { c.bringForward(o); c.requestRenderAll(); } },
    dozadu() { const c = dajAktivne(); const o = c.getActiveObject(); if (o) { c.sendBackwards(o); c.requestRenderAll(); } },
    duplikuj() {
      const c = dajAktivne(); const o = c.getActiveObject(); if (!o) return;
      o.clone((k) => { k.set({ left: o.left + 20 * ppm, top: o.top + 10 * ppm, evented: true }); c.add(k); c.setActiveObject(k); c.requestRenderAll(); }, ['zona']);
    },
    pocetObjektov: () => vsetky().reduce((n, c) => n + c.getObjects().length, 0),
    // Tlačové PNG pre líce a rub (≈ 300 DPI, mimo tvaru priehľadné) + JSON stavu na pripadnú reprodukciu
    // maxPx = voliteľný strop na dlhšiu stranu výstupu (veľké plochy by inak prekročili limit plátna prehliadača, najmä na mobile)
    async exportuj({ maxPx = Infinity } = {}) {
      front.discardActiveObject(); back.discardActiveObject(); front.renderAll(); back.renderAll();
      const nasobok = Math.min(300 / 25.4 / ppm, maxPx / Math.max(rozmer.w, rozmer.h));
      const naBlob = async (canvas) => { const url = canvas.toDataURL({ format: 'png', multiplier: nasobok }); return fetch(url).then((r) => r.blob()); };
      return {
        front: await naBlob(front), back: await naBlob(back),
        json: { front: front.toJSON(), back: back.toJSON(), sirkaPx: rozmer.w, vyskaPx: rozmer.h, ppm },
      };
    },
    // Načíta uložený stav líca (JSON z exportuj().json.front) — na opätovnú úpravu návrhu
    nacitajFront(json, hotovo) {
      front.loadFromJSON(json, () => { front.requestRenderAll(); onZmena?.(); hotovo?.(); });
    },
    odstranZonu(kod) { vsetky().forEach((c) => { c.getObjects().filter((o) => o.zona === kod).forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); }); },
    presunZonu(stary, novy) {
      const zs = zonaPodla(stary), zn = zonaPodla(novy);
      vsetky().forEach((c) => {
        c.getObjects().filter((o) => o.zona === stary).forEach((o) => {
          o.set({ zona: novy });
          if (zn) { o.set({ left: zn.cx, top: zn.cy, angle: (o.angle || 0) - ((zs && zs.rot) || 0) + (zn.rot || 0) }); o.setCoords(); }
        });
        c.requestRenderAll();
      });
    },
    nastavZony(z) { zony = z || []; priradVsetky(); vsetky().forEach((c) => c.requestRenderAll()); },
    nezaradene() { return vsetky().reduce((n, c) => n + c.getObjects().filter((o) => !zonaPodla(o.zona)).length, 0); },
    nastavVkladanie(kod) { vkladanie = kod || null; }, // len krátkodobo (nahratie obrázka ku konkrétnej potlači); inak sa objekt priraďuje podľa polohy
    // Obsah jednej zóny vykreslený v súradniciach zóny (rotácia zóny sa odstráni — rukáv sa tlačí rovno), orezaný na motív. Vracia dataURL + rozmer v mm.
    async zona(kod, { maxPx = 4096, malyPx = 0 } = {}) {
      const z = zonaPodla(kod); if (!z) return null;
      const objs = platna[z.strana].getObjects().filter((o) => o.zona === kod);
      if (!objs.length) return null;
      const V = Math.ceil(Math.max(front.width, front.height) * 2.5);
      const sc = new fabric.StaticCanvas(null, { width: V, height: V });
      const th = ((z.rot || 0) * Math.PI) / 180, cos = Math.cos(-th), sin = Math.sin(-th);
      await Promise.all(objs.map((o) => new Promise((res) => o.clone((k) => {
        const p = o.getCenterPoint(); const dx = p.x - z.cx, dy = p.y - z.cy;
        k.set({ originX: 'center', originY: 'center', left: V / 2 + dx * cos - dy * sin, top: V / 2 + dx * sin + dy * cos, angle: (o.angle || 0) - (z.rot || 0), evented: false, selectable: false });
        sc.add(k); res();
      }))));
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      sc.getObjects().forEach((k) => { const bb = k.getBoundingRect(true, true); l = Math.min(l, bb.left); t = Math.min(t, bb.top); r = Math.max(r, bb.left + bb.width); b = Math.max(b, bb.top + bb.height); });
      const presah = (r - l) > z.w + 1 || (b - t) > z.h + 1; // motív je väčší než maximálny rozmer (nič sa neoreže, len upozornenie)
      l = Math.max(0, l); t = Math.max(0, t); r = Math.min(V, r); b = Math.min(V, b);
      if (r - l < 1 || b - t < 1) { sc.dispose(); return null; }
      const dlzsia = Math.max(r - l, b - t);
      const nasobok = malyPx ? Math.min(2, malyPx / dlzsia) : Math.min(300 / 25.4 / ppm, maxPx / dlzsia);
      const url = sc.toDataURL({ format: 'png', left: l, top: t, width: r - l, height: b - t, multiplier: nasobok });
      sc.dispose();
      return { url, sirkaMm: (r - l) / ppm, vyskaMm: (b - t) / ppm, presah };
    },
    // Obsah plátna (spoločný obdĺžnik všetkých objektov) — veľkosť potlače sa pri sieťotlači určí PODĽA MOTÍVU, nič sa neoreže
    obsah() {
      const objs = front.getObjects();
      if (!objs.length) return null;
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      objs.forEach((o) => { const bb = o.getBoundingRect(true, true); l = Math.min(l, bb.left); t = Math.min(t, bb.top); r = Math.max(r, bb.left + bb.width); b = Math.max(b, bb.top + bb.height); });
      l = Math.max(0, l); t = Math.max(0, t); r = Math.min(rozmer.w, r); b = Math.min(rozmer.h, b);
      if (r - l < 1 || b - t < 1) return null;
      return { left: l, top: t, width: r - l, height: b - t, sirkaMm: (r - l) / ppm, vyskaMm: (b - t) / ppm };
    },
    // Malý náhľad motívu orezaný na obsah (živý náhľad na tričku počas kreslenia) + rozmer v mm
    zivyNahlad(maxPx = 360) {
      const bb = this.obsah(); if (!bb) return null;
      const url = front.toDataURL({ format: 'png', left: bb.left, top: bb.top, width: bb.width, height: bb.height, multiplier: Math.min(2, maxPx / Math.max(bb.width, bb.height)) });
      return { nahlad: url, sirkaMm: bb.sirkaMm, vyskaMm: bb.vyskaMm, json: front.toJSON() };
    },
    // Tlačový PNG orezaný na obsah (priehľadné pozadie), bez zrušenia výberu objektu
    async exportujOrezane({ maxPx = 4096 } = {}) {
      const bb = this.obsah(); if (!bb) return null;
      const nasobok = Math.min(300 / 25.4 / ppm, maxPx / Math.max(bb.width, bb.height));
      const url = front.toDataURL({ format: 'png', left: bb.left, top: bb.top, width: bb.width, height: bb.height, multiplier: nasobok });
      const blob = await fetch(url).then((r) => r.blob());
      return { blob, sirkaMm: bb.sirkaMm, vyskaMm: bb.vyskaMm, json: front.toJSON() };
    },
    // Rýchly náhľad (malé PNG) na zobrazenie v objednávke / zhrnutí
    nahlad() {
      front.discardActiveObject(); back.discardActiveObject(); front.renderAll(); back.renderAll();
      return { front: front.toDataURL({ format: 'png', multiplier: 1 }), back: back.toDataURL({ format: 'png', multiplier: 1 }) };
    },
    dispose() { vsetky().forEach((c) => c.dispose()); },
  };
}
