// Automatické prefarbenie bielej fotky produktu (tričko, mikina…) na ľubovoľnú farbu — jedna biela fotka stačí, nemusia sa nahrávať fotky pre každú farbu.
// Postup: (1) z fotky sa vystrihne produkt (biele pozadie spojené s okrajom fotky), (2) zo svetlosti pixelov sa vezme tieňovanie (záhyby, švy),
// (3) tieňovanie sa vynásobí zvolenou farbou. Biela farba = pôvodná fotka bez zásahu.
const MAX_SIRKA = 900;
const cache = new Map();

function nacitajObraz(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Fotku produktu sa nepodarilo načítať.'));
    img.src = url;
  });
}

async function pripravFotku(url) {
  const img = await nacitajObraz(url);
  const w = Math.min(MAX_SIRKA, img.naturalWidth), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const n = w * h;
  const lum = new Float32Array(n);
  const pozadie = new Uint8Array(n); // 1 = pozadie spojené s okrajom
  for (let i = 0; i < n; i++) lum[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
  const jeBiele = (i) => d[i * 4] >= 251 && d[i * 4 + 1] >= 251 && d[i * 4 + 2] >= 251;
  // záplava od okrajov fotky
  const zasobnik = new Int32Array(n);
  let sp = 0;
  const pridaj = (x, y) => { const i = y * w + x; if (!pozadie[i] && jeBiele(i)) { pozadie[i] = 1; zasobnik[sp++] = i; } };
  for (let x = 0; x < w; x++) { pridaj(x, 0); pridaj(x, h - 1); }
  for (let y = 0; y < h; y++) { pridaj(0, y); pridaj(w - 1, y); }
  while (sp > 0) {
    const i = zasobnik[--sp]; const x = i % w, y = (i - x) / w;
    if (x > 0) pridaj(x - 1, y); if (x < w - 1) pridaj(x + 1, y); if (y > 0) pridaj(x, y - 1); if (y < h - 1) pridaj(x, y + 1);
  }
  // priemerná svetlosť produktu (= "100 % tieňovanie")
  let suma = 0, pocet = 0;
  for (let i = 0; i < n; i++) if (!pozadie[i]) { suma += lum[i]; pocet++; }
  const priemer = pocet ? suma / pocet : 232;
  // okraj: pixely susediace s pozadím dostanú čiastočnú priehľadnosť (vyhladenie hrany)
  const alfa = new Uint8Array(n).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (pozadie[i]) { alfa[i] = 0; continue; }
      const susedPozadie = (x > 0 && pozadie[i - 1]) || (x < w - 1 && pozadie[i + 1]) || (y > 0 && pozadie[i - w]) || (y < h - 1 && pozadie[i + w]);
      if (susedPozadie) alfa[i] = Math.round(Math.min(1, Math.max(0.25, (255 - lum[i]) / Math.max(8, 255 - priemer))) * 255);
    }
  }
  return { w, h, url, lum, alfa, priemer, povodna: c };
}

export function pripravFotkuCache(url) {
  if (!cache.has(url)) cache.set(url, pripravFotku(url).catch((e) => { cache.delete(url); throw e; }));
  return cache.get(url);
}

function hexNaRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Vráti data URL prefarbenej fotky (PNG s priehľadným pozadím mimo produktu). Pre bielu vráti pôvodnú fotku.
export function vyfarbiFotku(prep, hex) {
  const [r, g, b] = hexNaRgb(hex);
  if (r > 245 && g > 245 && b > 245) return prep.url;
  const { w, h, lum, alfa, priemer } = prep;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const tmava = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
  for (let i = 0; i < w * h; i++) {
    const a = alfa[i];
    if (a === 0) continue;
    const s = Math.min(1.12, Math.max(0.78, lum[i] / priemer));
    const s2 = 1 + (s - 1) * 2.4; // zosilnenie záhybov (tmavé farby by inak vyzerali ploché)
    const lift = tmava ? Math.max(0, s2 - 1) * 90 : 0; // svetlá na tmavých farbách
    o[i * 4] = Math.max(0, Math.min(255, r * s2 + lift));
    o[i * 4 + 1] = Math.max(0, Math.min(255, g * s2 + lift));
    o[i * 4 + 2] = Math.max(0, Math.min(255, b * s2 + lift));
    o[i * 4 + 3] = a;
  }
  ctx.putImageData(out, 0, 0);
  return c.toDataURL('image/png');
}
