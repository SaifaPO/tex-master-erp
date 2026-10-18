// Generátor klubového znaku (erbu) pre 3D dresy aj trenírky. Kreslí sa na 2D plátno do štvorca `size` so stredom (cx, cy).
// Možnosti (configState.loga) — všetko voliteľné, staré konfigurácie (len typErbu + erbText) fungujú ďalej:
//   erbTvar/typErbu  kruh | ovál | štít | erb | hexagon | kosoštvorec | štít2
//   erbFarbaVnutro, erbVnutroDruha, erbVnutroVzor (plne | pruhy | polka | diagonala | sachovnica)
//   erbFarbaLemovka, erbLemovkaHrubka (mm), erbLemovka2Farba, erbLemovka2Hrubka (mm — vonkajšia druhá lemovka)
//   erbText (až 3 riadky, oddelené \n), erbFont, erbFarbaText, erbTextObrys, erbTextVelkost
//   erbObjekt (none | lopta | kopacka | pohar | hviezda | koruna | vavrin), erbObjektPoz (hore | stred | dole), erbObjektVelkost, erbObjektFarba
//   erbObrazok (vlastný obrázok, napr. erb obce, vložený dovnútra znaku), erbObrazokVelkost
// vlastnyErbImg + typErbu === 'custom' = celý znak je hotový nahraný obrázok (ako doteraz).

const NOMINAL_MM = 66; // pri tejto veľkosti znaku (≈116 px na hrudi) zodpovedá hrúbka lemovky v mm

export const ERB_TVARY = [
  { id: 'kruh', nazov: 'Kruh' },
  { id: 'stit', nazov: 'Štít' },
  { id: 'stit2', nazov: 'Štít 2' },
  { id: 'erb', nazov: 'Erb' },
  { id: 'ovál', nazov: 'Ovál' },
  { id: 'hexagon', nazov: 'Šesťuholník' },
  { id: 'kosostvorec', nazov: 'Kosoštvorec' },
];

export const ERB_VZORY_VNUTRA = [
  { id: 'plne', nazov: 'Jedna farba' },
  { id: 'pruhy', nazov: 'Zvislé pruhy' },
  { id: 'polka', nazov: 'Rozdelený na polovicu' },
  { id: 'diagonala', nazov: 'Diagonála' },
  { id: 'sachovnica', nazov: 'Šachovnica' },
];

export const ERB_OBJEKTY = [
  { id: 'none', nazov: 'Žiadny', ikona: '—' },
  { id: 'lopta', nazov: 'Lopta', ikona: '⚽' },
  { id: 'kopacka', nazov: 'Kopačka', ikona: '👟' },
  { id: 'pohar', nazov: 'Pohár', ikona: '🏆' },
  { id: 'hviezda', nazov: 'Hviezda', ikona: '★' },
  { id: 'koruna', nazov: 'Koruna', ikona: '👑' },
  { id: 'vavrin', nazov: 'Vavrínový veniec', ikona: '🌿' },
];

function cestaTvaru(c, tvar, s) {
  c.beginPath();
  if (tvar === 'stit' || tvar === 'erb') {
    c.moveTo(0, -s * 0.5);
    c.lineTo(s * 0.45, -s * 0.35);
    c.lineTo(s * 0.45, s * 0.1);
    c.bezierCurveTo(s * 0.45, s * 0.45, 0, s * 0.65, 0, s * 0.65);
    c.bezierCurveTo(0, s * 0.65, -s * 0.45, s * 0.45, -s * 0.45, s * 0.1);
    c.lineTo(-s * 0.45, -s * 0.35);
    c.closePath();
  } else if (tvar === 'stit2') {
    // klasický futbalový štít — rovný vrch, zaoblené rohy, špicatý spodok
    const w = s * 0.46, t = -s * 0.5, r = s * 0.1;
    c.moveTo(-w + r, t); c.lineTo(w - r, t); c.quadraticCurveTo(w, t, w, t + r);
    c.lineTo(w, s * 0.12); c.quadraticCurveTo(w, s * 0.42, 0, s * 0.62);
    c.quadraticCurveTo(-w, s * 0.42, -w, s * 0.12);
    c.lineTo(-w, t + r); c.quadraticCurveTo(-w, t, -w + r, t);
    c.closePath();
  } else if (tvar === 'ovál') {
    c.ellipse(0, 0, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
  } else if (tvar === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * s * 0.5, y = Math.sin(a) * s * 0.5;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  } else if (tvar === 'kosostvorec') {
    c.moveTo(0, -s * 0.55); c.lineTo(s * 0.5, 0); c.lineTo(0, s * 0.55); c.lineTo(-s * 0.5, 0);
    c.closePath();
  } else {
    c.arc(0, 0, s * 0.5, 0, Math.PI * 2);
  }
}

function vyplnVnutro(c, tvar, s, farba1, farba2, vzor) {
  c.save();
  cestaTvaru(c, tvar, s);
  c.fillStyle = farba1;
  c.fill();
  if (vzor && vzor !== 'plne') {
    c.clip();
    c.fillStyle = farba2;
    const x0 = -s * 0.6, w = s * 1.2;
    if (vzor === 'pruhy') {
      const n = 5;
      for (let i = 0; i < n; i += 2) c.fillRect(x0 + (w / n) * (i + 1) - w / n, -s, w / n, s * 2);
    } else if (vzor === 'polka') {
      c.fillRect(0, -s, s, s * 2);
    } else if (vzor === 'diagonala') {
      c.beginPath(); c.moveTo(-s, s); c.lineTo(s, -s); c.lineTo(s, s); c.closePath(); c.fill();
    } else if (vzor === 'sachovnica') {
      const n = 4, q = (s * 1.2) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) c.fillRect(x0 + i * q, -s * 0.6 + j * q, q, q);
    }
  }
  c.restore();
}

// ---------- futbalové objekty (jednoduché vektorové tvary v jednotkách veľkosti objektu u, stred (0,0)) ----------
function kresliObjekt(c, typ, u, farba) {
  c.save();
  c.fillStyle = farba; c.strokeStyle = farba; c.lineJoin = 'round'; c.lineCap = 'round';
  if (typ === 'lopta') {
    c.beginPath(); c.arc(0, 0, u * 0.5, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = Math.max(1, u * 0.04); c.strokeStyle = '#111827'; c.stroke();
    c.fillStyle = '#111827';
    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    c.beginPath();
    for (let i = 0; i < 5; i++) { const [x, y] = p(u * 0.17, -Math.PI / 2 + (Math.PI * 2 * i) / 5); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.closePath(); c.fill();
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
      const [x1, y1] = p(u * 0.17, a), [x2, y2] = p(u * 0.34, a);
      c.moveTo(x1, y1); c.lineTo(x2, y2);
      const [x3, y3] = p(u * 0.5, a + 0.12), [x4, y4] = p(u * 0.5, a - 0.12);
      c.moveTo(x2, y2); c.lineTo(x3, y3); c.moveTo(x2, y2); c.lineTo(x4, y4);
    }
    c.lineWidth = Math.max(1, u * 0.035); c.stroke();
  } else if (typ === 'kopacka') {
    // silueta kopačky z boku (špička vpravo)
    c.beginPath();
    c.moveTo(-u * 0.5, -u * 0.18);
    c.lineTo(-u * 0.12, -u * 0.22);
    c.quadraticCurveTo(u * 0.05, -u * 0.05, u * 0.3, -u * 0.04);
    c.quadraticCurveTo(u * 0.5, 0, u * 0.5, u * 0.12);
    c.lineTo(u * 0.5, u * 0.2);
    c.lineTo(-u * 0.5, u * 0.2);
    c.closePath(); c.fill();
    c.fillStyle = '#111827';
    [-0.38, -0.16, 0.12, 0.36].forEach((x) => { c.fillRect(u * x - u * 0.035, u * 0.2, u * 0.07, u * 0.1); });
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, u * 0.025);
    c.beginPath(); c.moveTo(-u * 0.05, -u * 0.12); c.lineTo(u * 0.05, -u * 0.02); c.moveTo(u * 0.08, -u * 0.12); c.lineTo(u * 0.17, -u * 0.02); c.stroke();
  } else if (typ === 'pohar') {
    c.beginPath();
    c.moveTo(-u * 0.28, -u * 0.45); c.lineTo(u * 0.28, -u * 0.45);
    c.quadraticCurveTo(u * 0.28, u * 0.08, 0, u * 0.12);
    c.quadraticCurveTo(-u * 0.28, u * 0.08, -u * 0.28, -u * 0.45);
    c.closePath(); c.fill();
    c.lineWidth = Math.max(1.5, u * 0.07);
    c.beginPath(); c.arc(-u * 0.3, -u * 0.28, u * 0.15, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(u * 0.3, -u * 0.28, u * 0.15, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
    c.fillRect(-u * 0.05, u * 0.1, u * 0.1, u * 0.2);
    c.fillRect(-u * 0.22, u * 0.3, u * 0.44, u * 0.14);
  } else if (typ === 'hviezda') {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 5, r = i % 2 ? u * 0.22 : u * 0.5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill();
  } else if (typ === 'koruna') {
    c.beginPath();
    c.moveTo(-u * 0.5, u * 0.3); c.lineTo(-u * 0.5, -u * 0.25); c.lineTo(-u * 0.25, 0); c.lineTo(0, -u * 0.4);
    c.lineTo(u * 0.25, 0); c.lineTo(u * 0.5, -u * 0.25); c.lineTo(u * 0.5, u * 0.3); c.closePath(); c.fill();
    c.fillStyle = '#ffffff';
    [-0.5, 0, 0.5].forEach((x, i) => { c.beginPath(); c.arc(u * x * (i === 1 ? 1 : 0.96), i === 1 ? -u * 0.42 : -u * 0.27, u * 0.06, 0, Math.PI * 2); c.fill(); });
  } else if (typ === 'vavrin') {
    // dve vetvičky listov po kružnici (otvorené hore), listy v smere obvodu
    [1, -1].forEach((strana) => {
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) * ((Math.PI * 0.8) / 9);
        c.save();
        c.scale(strana, 1);
        c.translate(Math.sin(t) * u * 0.42, Math.cos(t) * u * 0.42);
        c.rotate(-t - Math.PI / 2);
        c.beginPath(); c.ellipse(0, 0, u * 0.07, u * 0.15, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    });
  }
  c.restore();
}

function kresliObrazokFit(c, img, cx, cy, w, h) {
  const k = Math.min(w / img.width, h / img.height);
  c.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
}

export function renderClubCrest(c, cx, cy, size, configState) {
  const L = configState.loga || {};
  c.save();
  if (L.typErbu === 'custom' && L.vlastnyErbImg) {
    kresliObrazokFit(c, L.vlastnyErbImg, cx, cy, size, size);
    c.restore();
    return;
  }

  c.translate(cx, cy);
  const tvar = L.erbTvar || L.typErbu || 'kruh';
  const f = configState.farby;
  const px = (mm) => (size * mm) / NOMINAL_MM;

  // 1) vnútro
  vyplnVnutro(c, tvar, size, L.erbFarbaVnutro || '#ffffff', L.erbVnutroDruha || f.vzor, L.erbVnutroVzor || 'plne');

  // 2) lemovky (vnútorná, potom vonkajšia druhá)
  const lem1 = L.erbLemovkaHrubka ?? 3.4;
  const lem2 = L.erbLemovka2Hrubka ?? 0;
  if (lem2 > 0) {
    cestaTvaru(c, tvar, size);
    c.strokeStyle = L.erbLemovka2Farba || '#000000';
    c.lineWidth = px(lem1) + px(lem2) * 2; c.lineJoin = 'round';
    c.stroke();
  }
  if (lem1 > 0) {
    cestaTvaru(c, tvar, size);
    c.strokeStyle = L.erbFarbaLemovka || f.akcent;
    c.lineWidth = px(lem1); c.lineJoin = 'round';
    c.stroke();
  }
  if (tvar === 'erb') {
    c.beginPath(); c.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    c.strokeStyle = f.vzor; c.lineWidth = Math.max(1.5, size * 0.035); c.stroke();
  }

  // 3) vlastný obrázok dovnútra (napr. erb obce)
  if (L.erbObrazok) {
    const k = (L.erbObrazokVelkost ?? 1) * 0.62;
    kresliObrazokFit(c, L.erbObrazok, 0, -size * 0.04, size * k, size * k);
  }

  // 4) objekt a text — rozloženie podľa polohy objektu
  const text = String(L.erbText ?? 'FC').toUpperCase().split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 3);
  const objekt = L.erbObjekt && L.erbObjekt !== 'none' ? L.erbObjekt : null;
  const poz = L.erbObjektPoz || 'hore';
  const objVelkost = size * 0.34 * (L.erbObjektVelkost ?? 1);
  let textStredY = size * 0.02, textVyska = size * 0.5;
  if (objekt) {
    if (poz === 'hore') { textStredY = size * 0.17; textVyska = size * 0.34; }
    else if (poz === 'dole') { textStredY = -size * 0.13; textVyska = size * 0.34; }
    else { textStredY = size * 0.3; textVyska = size * 0.2; }
  }
  if (objekt) {
    const farbaObj = L.erbObjektFarba || f.akcent;
    if (poz === 'dole') { c.save(); c.translate(0, size * 0.25); kresliObjekt(c, objekt, objVelkost, farbaObj); c.restore(); }
    else if (poz === 'stred') { c.save(); c.translate(0, -size * 0.06); kresliObjekt(c, objekt, objVelkost * 1.15, farbaObj); c.restore(); }
    else { c.save(); c.translate(0, -size * 0.2); kresliObjekt(c, objekt, objVelkost, farbaObj); c.restore(); }
  }
  if (text.length) {
    const fontRodina = L.erbFont || configState.text.fontRodina;
    const maxW = size * (tvar === 'ovál' ? 0.82 : tvar === 'kosostvorec' ? 0.5 : 0.7);
    const riadkov = text.length;
    let fs = Math.floor((textVyska / (riadkov * 1.02)) * (L.erbTextVelkost ?? 1));
    fs = Math.min(fs, Math.floor(size * 0.24 * (L.erbTextVelkost ?? 1)));
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const nastavFont = () => { c.font = `900 ${fs}px "${fontRodina}", sans-serif`; };
    nastavFont();
    while (fs > 7 && text.some((r) => c.measureText(r).width > maxW)) { fs -= 1; nastavFont(); }
    const riadok = fs * 1.02;
    const y0 = textStredY - ((riadkov - 1) * riadok) / 2;
    text.forEach((r, i) => {
      const y = y0 + i * riadok;
      if (L.erbTextObrys) { c.lineJoin = 'round'; c.strokeStyle = L.erbTextObrys; c.lineWidth = Math.max(2, fs * 0.16); c.strokeText(r, 0, y); }
      c.fillStyle = L.erbFarbaText || f.vzor;
      c.fillText(r, 0, y);
    });
  }
  c.restore();
}
