// Trenírky (shorts) v 3D konfigurátore — zóny, farby a kreslenie textúry.
//
// Model public/models/shorts-base.glb (pozri README.txt) je skutočný CLO3D strih: 38 samostatných
// strihových kusov s neprekrývajúcim sa UV rozvinutím 0..1. Namiesto ručného merania obdĺžnikov (ako pri dresi,
// kde sú kusy veľké a pravidelné) sa tu každý kus zaradí do zóny podľa svojej 3D polohy a veľkosti
// (pás hore, nohavica, lem dole, bočný panel, tenký pásik...) a plátno sa vyfarbí PRESNE podľa UV
// trojuholníkov daného kusu — takže farba nikdy nepretečie na susedný kus.

export const ZONY_TRENIROK = [
  { key: 'noha', cislo: 1, nazov: 'Nohavice (hlavné telo)', popis: 'Predné a zadné diely nohavíc', prevezmeZ: 'zakladna' },
  { key: 'bok', cislo: 2, nazov: 'Bočné panely', popis: 'Široké vložky po boku', prevezmeZ: 'vzor' },
  { key: 'pasik', cislo: 3, nazov: 'Bočné pásiky', popis: 'Tenké pásiky pri švíkoch', prevezmeZ: 'akcent' },
  { key: 'pas', cislo: 4, nazov: 'Pás (gumička)', popis: 'Pás nohavíc', prevezmeZ: 'golier' },
  { key: 'lem', cislo: 5, nazov: 'Lemy nohavíc', popis: 'Spodný lem nohavice', prevezmeZ: 'rukava' },
];

import * as THREE from 'three';
import { renderClubCrest, drawTintedImageFit, kontrastnaFarba, logoPredVyrobcu } from './dresRenderer';

export const DEFAULT_TRENIRKY = {
  prepojit: true, // farby trenírok preberajú farby dresu (zóna → zóna, pozri prevezmeZ vyššie)
  farby: { noha: '#1e3a8a', bok: '#dc2626', pasik: '#f59e0b', pas: '#ffffff', lem: '#1e3a8a' },
  // Logá a číslo na prednej strane nohavíc (strany sú z pohľadu nositeľa): logo výrobcu je vždy na ľavej nohe (rovnako veľké ako na drese),
  // klubový erb (ten z hrude dresu) je predvolene na pravej nohe a malé číslo na ľavej nohe nad logom výrobcu. Zákazník to môže vypnúť
  // alebo vymeniť (číslo na pravú nohu → erb sa presunie na ľavú nohu nad logo výrobcu).
  erbZobrazit: true,
  cisloZobrazit: true,
  cisloNoha: 'lava', // 'lava' | 'prava'
};

// Skutočné farby zón trenírok podľa konfigurácie: buď prevzaté z dresu, alebo vlastné.
export function farbyTrenirok(configState) {
  const t = configState.trenirky || DEFAULT_TRENIRKY;
  if (t.prepojit !== false) {
    const out = {};
    ZONY_TRENIROK.forEach((z) => { out[z.key] = configState.farby[z.prevezmeZ] || '#ffffff'; });
    return out;
  }
  return { ...DEFAULT_TRENIRKY.farby, ...(t.farby || {}) };
}

// Zaradenie strihového kusu do zóny podľa 3D rozmerov/polohy (jednotky = cm, model v pôvodnom súradnicovom
// systéme avatara: pás okolo y≈110–114, lemy okolo y≈70–75). Hodnoty zmerané na reálnych dátach modelu.
export function zonaKusu(box) {
  const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y;
  const cy = (box.max.y + box.min.y) / 2;
  if (cy > 107) return 'pas';
  if (sy > 30 && sx > 12) return 'noha';
  if (sy > 30) return 'pasik';
  if (cy < 76 && sy < 6 && sx > 9) return 'lem';
  if (cy < 76) return 'pasik'; // drobné koncovky pásikov pri lemoch
  return 'bok';
}

// Z UV trojuholníkov každej zóny jednorazovo postaví Path2D (potom sa pri zmene farby len znova vyplní).
// meshe: [{ mesh, zona }]; UV sa berie priamo z geometrie (normalizované kvantizované atribúty číta getX/getY správne).
export function postavCestyZon(meshe, W, H) {
  const cesty = {};
  ZONY_TRENIROK.forEach((z) => { cesty[z.key] = new Path2D(); });
  meshe.forEach(({ mesh, zona }) => {
    const geo = mesh.geometry;
    const uv = geo.attributes.uv;
    const idx = geo.index;
    if (!uv) return;
    const path = cesty[zona] || cesty.noha;
    const trojuholnikov = idx ? idx.count / 3 : uv.count / 3;
    for (let t = 0; t < trojuholnikov; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      path.moveTo(uv.getX(a) * W, uv.getY(a) * H);
      path.lineTo(uv.getX(b) * W, uv.getY(b) * H);
      path.lineTo(uv.getX(c) * W, uv.getY(c) * H);
      path.closePath();
    }
  });
  return cesty;
}

// Predné panely nohavíc: pre každú nohu (z pohľadu nositeľa; model je otočený čelom k +z, ľavá noha nositeľa má +x) sa z vrcholov
// vypočíta lineárne zobrazenie 3D súradníc (cm) → UV, aby sa logá dali umiestniť na presné miesto na nohe v cm. Plátno je vykreslené
// vzpriamene (u rastie s x, v klesá s y), takže stačí posun a mierka.
export function vypocitajPanelyNoh(meshe) {
  const panely = {};
  const v = new THREE.Vector3();
  meshe.forEach(({ mesh, zona }) => {
    if (zona !== 'noha') return;
    const box = new THREE.Box3().setFromObject(mesh);
    const cz = (box.min.z + box.max.z) / 2;
    if (cz <= 0) return; // zadné diely
    const cx = (box.min.x + box.max.x) / 2;
    const noha = cx > 0 ? 'lava' : 'prava';
    const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    if (!pos || !uv) return;
    let n = 0, sx = 0, sy = 0, su = 0, sv = 0, sxx = 0, syy = 0, sxu = 0, syv = 0;
    for (let k = 0; k < pos.count; k++) {
      v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(mesh.matrixWorld);
      const u = uv.getX(k), w = uv.getY(k);
      n++; sx += v.x; sy += v.y; su += u; sv += w; sxx += v.x * v.x; syy += v.y * v.y; sxu += v.x * u; syv += v.y * w;
    }
    const ax = (n * sxu - sx * su) / (n * sxx - sx * sx || 1);
    const bx = (su - ax * sx) / n;
    const ay = (n * syv - sy * sv) / (n * syy - sy * sy || 1);
    const by = (sv - ay * sy) / n;
    panely[noha] = { ax, bx, ay, by, xmin: box.min.x, xmax: box.max.x, ymin: box.min.y, ymax: box.max.y, cx, cy: (box.min.y + box.max.y) / 2 };
  });
  return panely;
}

// Kto kde je na prednej strane nohavíc: [{ noha, typ, yOffset }] — yOffset je výška stredu prvku nad spodnou základnou čiarou (cm).
const LOGO_VYROBCU_CM = { w: 6.0, h: 2.6 };
const ERB_CM = 6.0;
const CISLO_VYSKA_CM = 7.0;
export function rozlozenieLogaTrenirok(t) {
  const cisloNoha = t?.cisloNoha === 'prava' ? 'prava' : 'lava';
  const erbNoha = cisloNoha === 'lava' ? 'prava' : 'lava';
  const polozky = [{ noha: 'lava', typ: 'vyrobca', yOffset: 0 }];
  const GAP = 1.2;
  const nadVyrobcom = (vyskaCm) => LOGO_VYROBCU_CM.h / 2 + GAP + vyskaCm / 2;
  if (t?.cisloZobrazit !== false) {
    polozky.push({ noha: cisloNoha, typ: 'cislo', yOffset: cisloNoha === 'lava' ? nadVyrobcom(CISLO_VYSKA_CM) : 3 });
  }
  if (t?.erbZobrazit !== false) {
    polozky.push({ noha: erbNoha, typ: 'erb', yOffset: erbNoha === 'lava' ? nadVyrobcom(ERB_CM) : 3 });
  }
  return polozky;
}

// Text pre objednávku (výroba vie, kde majú byť logá).
export function popisLogaTrenirok(t) {
  const polozky = rozlozenieLogaTrenirok(t);
  const nazov = (n) => (n === 'lava' ? 'ľavá noha' : 'pravá noha');
  const out = { _logo_vyrobcu: 'ľavá noha vpredu (rovnaká veľkosť ako na drese)' };
  const e = polozky.find(p => p.typ === 'erb'); const c = polozky.find(p => p.typ === 'cislo');
  out._erb = e ? `${nazov(e.noha)} vpredu${e.noha === 'lava' ? ' (nad logom výrobcu)' : ''}` : 'bez erbu';
  out._cislo_vpredu = c ? `malé číslo, ${nazov(c.noha)} vpredu${c.noha === 'lava' ? ' (nad logom výrobcu)' : ''}` : 'bez čísla';
  return out;
}

function nakresliCisloNaNohu(ctx, text, cx, cy, vyskaPx, pxPerCm, configState, farbaPodkladu) {
  const cislo = configState.cislo || {};
  const px = vyskaPx * 1.18; // výška číslic ~ 0,85 em pri písme Teko
  ctx.save();
  ctx.font = `bold ${px}px "${configState.text.fontRodina}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.miterLimit = 1;
  const mmPx = pxPerCm / 10;
  const t1 = Math.max(0, cislo.obrys1HrubkaMm ?? 0) * mmPx * 0.5;
  const t2 = cislo.zobrazitObrys2 ? Math.max(0, cislo.obrys2HrubkaMm ?? 0) * mmPx * 0.5 : 0;
  if (t2 > 0) { ctx.strokeStyle = cislo.farbaObrys2; ctx.lineWidth = 2 * (t1 + t2); ctx.strokeText(text, cx, cy); }
  if (t1 > 0) { ctx.strokeStyle = cislo.farbaObrys1; ctx.lineWidth = 2 * t1; ctx.strokeText(text, cx, cy); }
  // ak by výplň splynula s farbou nohavíc, použije sa kontrastná
  const vypln = cislo.farbaVypln || '#ffffff';
  const lum = (hex) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  ctx.fillStyle = (/^#[0-9a-f]{6}$/i.test(vypln) && Math.abs(lum(vypln) - lum(farbaPodkladu)) < 0.2 && t1 === 0) ? kontrastnaFarba(farbaPodkladu) : vypln;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// Logá + číslo na prednej strane nohavíc — o 8 cm nižšie než pôvodne a posunuté k vonkajšiemu okraju nohavice
// (k bočnému pásu) o 3 cm, no tak, aby medzi logom a bočným pásom ostali aspoň 2 cm (Martin 2026-10-18).
const TRENIRKY_POSUN_DOLE_CM = 8;
const TRENIRKY_POSUN_DO_STRANY_CM = 3;
const TRENIRKY_ODSTUP_OD_PASU_CM = 2;
const POLSIRKA_CM = { vyrobca: LOGO_VYROBCU_CM.w / 2, erb: ERB_CM / 2, cislo: 3.3 };

// Logá + číslo na prednej strane nohavíc.
function nakresliLogaTrenirok(ctx, canvas, panely, configState, farbaNohy) {
  if (!panely) return;
  const t = configState.trenirky || DEFAULT_TRENIRKY;
  const W = canvas.width, H = canvas.height;
  rozlozenieLogaTrenirok(t).forEach((p) => {
    const pan = panely[p.noha];
    if (!pan) return;
    const pxPerCmX = Math.abs(pan.ax) * W, pxPerCmY = Math.abs(pan.ay) * H;
    const pxPerCm = (pxPerCmX + pxPerCmY) / 2;
    const yZaklad = pan.ymin + 0.27 * (pan.ymax - pan.ymin) - TRENIRKY_POSUN_DOLE_CM; // spodná základná čiara loga výrobcu (cm)
    // von = smer k bočnému pásu (ľavá noha nositeľa má +x, pravá -x)
    const von = p.noha === 'lava' ? 1 : -1;
    const hranicaPasu = von > 0 ? pan.xmax : pan.xmin;
    const najdalej = hranicaPasu - von * (TRENIRKY_ODSTUP_OD_PASU_CM + (POLSIRKA_CM[p.typ] || 3));
    const xChcene = pan.cx + von * TRENIRKY_POSUN_DO_STRANY_CM;
    const xs = von > 0 ? Math.min(xChcene, najdalej) : Math.max(xChcene, najdalej);
    const ys = yZaklad + p.yOffset;
    const px = (pan.ax * xs + pan.bx) * W;
    const py = (pan.ay * ys + pan.by) * H;
    if (p.typ === 'vyrobca') {
      drawTintedImageFit(ctx, logoPredVyrobcu, px, py, LOGO_VYROBCU_CM.w * pxPerCm, LOGO_VYROBCU_CM.h * pxPerCm, kontrastnaFarba(farbaNohy));
    } else if (p.typ === 'erb') {
      ctx.save();
      renderClubCrest(ctx, px, py, ERB_CM * pxPerCm, configState);
      ctx.restore();
    } else if (p.typ === 'cislo') {
      const text = String(configState.text.cisloHraca || '').trim();
      if (text) nakresliCisloNaNohu(ctx, text, px, py, CISLO_VYSKA_CM * pxPerCm, pxPerCm, configState, farbaNohy);
    }
  });
}

// Vykreslí textúru trenírok: každá zóna vyplnená svojou farbou (+ tenký obrys, aby medzi susednými
// trojuholníkmi nevznikli svetlé škáry).
export function vykresliTrenirky(ctx, canvas, cesty, configState, panely = null) {
  const farby = farbyTrenirok(configState);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ZONY_TRENIROK.forEach((z) => {
    const path = cesty?.[z.key];
    if (!path) return;
    ctx.fillStyle = farby[z.key];
    ctx.strokeStyle = farby[z.key];
    ctx.fill(path);
    ctx.stroke(path);
  });
  nakresliLogaTrenirok(ctx, canvas, panely, configState, farby.noha);
}
