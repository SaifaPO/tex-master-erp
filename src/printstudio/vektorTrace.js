// Vlastný vektorizátor (bez cudzích knižníc): obrázok -> farebné vrstvy -> hladké Bézierove krivky.
// Postup: 1) každý pixel dostane najbližšiu farbu z palety, 2) maska každej farby sa jemne rozmaže (odstráni "schody" po pixeloch)
// a obrys sa nájde v polovici prechodu (marching squares, presnosť pod pixel), 3) obrys sa rozdelí v ostrých rohoch
// a každý úsek sa preloží krivkou (Schneiderov algoritmus) alebo rovnou čiarou. Výsledok: rovné hrany ostanú rovné,
// rohy ostré a oblé tvary hladké, namiesto pôvodných "zalomených" čiar po pixeloch.

const T = 0.5;

// ---------- pomocné: Gaussovo rozmazanie ----------
function gaussJadro(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; s += v; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { k, r };
}
function rozmaz(f, w, h, sigma) {
  const { k, r } = gaussJadro(sigma);
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) { const xi = x + i; if (xi >= 0 && xi < w) s += f[row + xi] * k[i + r]; }
      tmp[row + x] = s;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) { const yi = y + i; if (yi >= 0 && yi < h) s += tmp[yi * w + x] * k[i + r]; }
      out[y * w + x] = s;
    }
  }
  return out;
}

// ---------- marching squares ----------
// hrany bunky: 0 = horná, 1 = pravá, 2 = dolná, 3 = ľavá
const STREDY = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
const ROHY = [[0, 0], [1, 0], [1, 1], [0, 1]]; // TL, TR, BR, BL
// pre každý prípad (4 bity: TL=1, TR=2, BR=4, BL=8) zoznam úsekov [hrana1, hrana2]; sedlá (5, 10) sa riešia zvlášť podľa stredu
const PRIPADY = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]],
  11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]],
};
// úsek orientujeme tak, aby "vnútro" bolo vždy na rovnakej strane
function orientuj(pripad, e1, e2) {
  const [m1x, m1y] = STREDY[e1], [m2x, m2y] = STREDY[e2];
  const dx = m2x - m1x, dy = m2y - m1y;
  // referenčný roh: spoločný roh oboch hrán, pri protiľahlých hranách ľavý horný
  let ref = 0;
  const pair = [e1, e2].sort().join('');
  if (pair === '01') ref = 1; else if (pair === '12') ref = 2; else if (pair === '23') ref = 3; else if (pair === '03') ref = 0;
  const [rx, ry] = ROHY[ref];
  const cross = dx * (ry - m1y) - dy * (rx - m1x);
  const vnutri = (pripad >> ref) & 1;
  const strana = cross * (vnutri ? 1 : -1);
  return strana < 0 ? [e2, e1] : [e1, e2];
}
const TABULKA = (() => {
  const t = [];
  for (let c = 0; c < 16; c++) {
    if (c === 5 || c === 10) { t.push(null); continue; }
    t.push((PRIPADY[c] || []).map(([a, b]) => orientuj(c, a, b)));
  }
  return t;
})();
function usekySedla(pripad, stredVnutri) {
  let pary;
  if (pripad === 5) pary = stredVnutri ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
  else pary = stredVnutri ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
  return pary.map(([a, b]) => orientuj(pripad, a, b));
}

// vráti zoznam uzavretých obrysov [{ pts: [[x,y],...], plocha }] v súradniciach poľa (x, y = index políčka)
function obrysyPola(f, fw, fh) {
  const celkom = fw * fh;
  const nxt = new Int32Array(2 * celkom).fill(-1);
  const idHrany = (e, x, y) => {
    if (e === 0) return y * fw + x;                 // horná: vodorovná hrana (x,y)
    if (e === 2) return (y + 1) * fw + x;           // dolná: vodorovná hrana (x,y+1)
    if (e === 1) return celkom + y * fw + (x + 1);  // pravá: zvislá hrana (x+1,y)
    return celkom + y * fw + x;                     // ľavá: zvislá hrana (x,y)
  };
  const startovne = [];
  for (let y = 0; y < fh - 1; y++) {
    for (let x = 0; x < fw - 1; x++) {
      const a = f[y * fw + x], b = f[y * fw + x + 1], c = f[(y + 1) * fw + x + 1], d = f[(y + 1) * fw + x];
      const pripad = (a >= T ? 1 : 0) | (b >= T ? 2 : 0) | (c >= T ? 4 : 0) | (d >= T ? 8 : 0);
      if (pripad === 0 || pripad === 15) continue;
      const useky = pripad === 5 || pripad === 10 ? usekySedla(pripad, (a + b + c + d) / 4 >= T) : TABULKA[pripad];
      for (const [e1, e2] of useky) {
        const i1 = idHrany(e1, x, y);
        nxt[i1] = idHrany(e2, x, y);
        startovne.push(i1);
      }
    }
  }
  const poloha = (id) => {
    if (id < celkom) { // vodorovná hrana medzi (x,y) a (x+1,y)
      const y = Math.floor(id / fw), x = id - y * fw;
      const v0 = f[y * fw + x], v1 = f[y * fw + x + 1];
      return [x + (T - v0) / (v1 - v0), y];
    }
    const k = id - celkom; // zvislá hrana medzi (x,y) a (x,y+1)
    const y = Math.floor(k / fw), x = k - y * fw;
    const v0 = f[y * fw + x], v1 = f[(y + 1) * fw + x];
    return [x, y + (T - v0) / (v1 - v0)];
  };
  const hotove = new Uint8Array(2 * celkom);
  const obrysy = [];
  for (const s of startovne) {
    if (hotove[s]) continue;
    const pts = [];
    let id = s;
    while (id >= 0 && !hotove[id]) {
      hotove[id] = 1;
      pts.push(poloha(id));
      id = nxt[id];
    }
    if (pts.length < 4) continue;
    let plocha = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      plocha += p[0] * q[1] - q[0] * p[1];
    }
    obrysy.push({ pts, plocha: plocha / 2 });
  }
  return obrysy;
}

// ---------- preloženie krivkou (Schneider, Graphics Gems) ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const dlzka = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = dlzka(a) || 1; return [a[0] / l, a[1] / l]; };

function bez(ctrl, t) {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [b0 * ctrl[0][0] + b1 * ctrl[1][0] + b2 * ctrl[2][0] + b3 * ctrl[3][0], b0 * ctrl[0][1] + b1 * ctrl[1][1] + b2 * ctrl[2][1] + b3 * ctrl[3][1]];
}
function bezD1(c, t) {
  const u = 1 - t;
  return [
    3 * u * u * (c[1][0] - c[0][0]) + 6 * u * t * (c[2][0] - c[1][0]) + 3 * t * t * (c[3][0] - c[2][0]),
    3 * u * u * (c[1][1] - c[0][1]) + 6 * u * t * (c[2][1] - c[1][1]) + 3 * t * t * (c[3][1] - c[2][1]),
  ];
}
function bezD2(c, t) {
  const u = 1 - t;
  return [
    6 * u * (c[2][0] - 2 * c[1][0] + c[0][0]) + 6 * t * (c[3][0] - 2 * c[2][0] + c[1][0]),
    6 * u * (c[2][1] - 2 * c[1][1] + c[0][1]) + 6 * t * (c[3][1] - 2 * c[2][1] + c[1][1]),
  ];
}
function parametre(P) {
  const u = [0];
  for (let i = 1; i < P.length; i++) u.push(u[i - 1] + dlzka(sub(P[i], P[i - 1])));
  const c = u[u.length - 1] || 1;
  return u.map(v => v / c);
}
function generujBezier(P, u, t1, t2) {
  const n = P.length;
  const p0 = P[0], p3 = P[n - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i], s = 1 - t;
    const b1 = 3 * s * s * t, b2 = 3 * s * t * t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const tmp = sub(P[i], add(mul(p0, s * s * s + b1), mul(p3, b2 + t * t * t)));
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const seg = dlzka(sub(p3, p0));
  let al = 0, ar = 0;
  if (Math.abs(det) > 1e-12) { al = (x0 * c11 - x1 * c01) / det; ar = (c00 * x1 - c01 * x0) / det; }
  if (al < 1e-6 * seg || ar < 1e-6 * seg || !isFinite(al) || !isFinite(ar)) { al = seg / 3; ar = seg / 3; }
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}
function preparametrizuj(c, P, u) {
  return u.map((t, i) => {
    const d = sub(bez(c, t), P[i]);
    const d1 = bezD1(c, t), d2 = bezD2(c, t);
    const num = dot(d, d1), den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.min(1, Math.max(0, t - num / den));
  });
}
function maxChyba(c, P, u) {
  let m = 0, idx = Math.floor(P.length / 2);
  for (let i = 1; i < P.length - 1; i++) {
    const d = sub(bez(c, u[i]), P[i]);
    const e = dot(d, d);
    if (e > m) { m = e; idx = i; }
  }
  return [m, idx];
}
function fitCubic(P, t1, t2, err, out) {
  if (P.length === 2) {
    const d = dlzka(sub(P[1], P[0])) / 3;
    out.push([P[0], add(P[0], mul(t1, d)), add(P[1], mul(t2, d)), P[1]]);
    return;
  }
  let u = parametre(P);
  let c = generujBezier(P, u, t1, t2);
  let [m, idx] = maxChyba(c, P, u);
  if (m < err) { out.push(c); return; }
  if (m < err * 16) {
    for (let it = 0; it < 4; it++) {
      u = preparametrizuj(c, P, u);
      c = generujBezier(P, u, t1, t2);
      [m, idx] = maxChyba(c, P, u);
      if (m < err) { out.push(c); return; }
    }
  }
  idx = Math.min(P.length - 2, Math.max(1, idx));
  const stred = norm(sub(P[idx - 1], P[idx + 1]));
  fitCubic(P.slice(0, idx + 1), t1, stred, err, out);
  fitCubic(P.slice(idx), mul(stred, -1), t2, err, out);
}

// ---------- obrys -> SVG cesta ----------
const f2 = (v) => { const s = (Math.round(v * 100) / 100).toString(); return s === '-0' ? '0' : s; };

function najdiRohy(pts, k, uholStupne) {
  const n = pts.length;
  const prah = (uholStupne * Math.PI) / 180;
  const zmena = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = sub(pts[i], pts[(i - k + n * 4) % n]);
    const b = sub(pts[(i + k) % n], pts[i]);
    const la = dlzka(a), lb = dlzka(b);
    if (la < 1e-6 || lb < 1e-6) continue;
    let c = dot(a, b) / (la * lb);
    c = Math.max(-1, Math.min(1, c));
    zmena[i] = Math.acos(c);
  }
  const rohy = [];
  for (let i = 0; i < n; i++) {
    if (zmena[i] < prah) continue;
    let max = true;
    for (let j = -k; j <= k && max; j++) { if (j !== 0 && zmena[(i + j + n * 4) % n] > zmena[i]) max = false; else if (j < 0 && zmena[(i + j + n * 4) % n] === zmena[i]) max = false; }
    if (max) rohy.push(i);
  }
  return rohy;
}

// Ostré rohy po rozmazaní vyzerajú zaoblene. Tu sa rohy vrátia: z oboch strán rohu sa preloží priamka (z bodov mimo
// zaoblenia) a roh sa dá do ich priesečníka. Body v zaoblení sa nahradia jediným ostrým vrcholom.
function spresniRohy(pts, rohy, k, maxPosun) {
  const n = pts.length;
  if (!rohy.length) return { pts, rohy };
  const od = (i) => ((i % n) + n) % n;
  const priamka = (idxs) => {
    const p = idxs.map(i => pts[od(i)]);
    const mx = p.reduce((s, q) => s + q[0], 0) / p.length, my = p.reduce((s, q) => s + q[1], 0) / p.length;
    let sxx = 0, syy = 0, sxy = 0;
    p.forEach(q => { const dx = q[0] - mx, dy = q[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { m: [mx, my], d: [Math.cos(th), Math.sin(th)] };
  };
  const vrcholy = new Map(); // index rohu -> nový vrchol
  rohy.forEach((c, r) => {
    const predch = rohy[(r - 1 + rohy.length) % rohy.length], nasl = rohy[(r + 1) % rohy.length];
    const medzeraPred = rohy.length === 1 ? n : od(c - predch) || n, medzeraZa = rohy.length === 1 ? n : od(nasl - c) || n;
    const dostup = Math.min(medzeraPred, medzeraZa) / 2; // max. rozsah bodov na priamku
    if (dostup < k + 3) return;
    const hore = Math.min(Math.floor(dostup), 3 * k);
    const A = [], B = [];
    for (let i = k + 1; i <= hore; i++) { A.push(c - i); B.push(c + i); }
    if (A.length < 3) return;
    const la = priamka(A), lb = priamka(B);
    const det = la.d[0] * lb.d[1] - la.d[1] * lb.d[0];
    if (Math.abs(det) < 0.2) return; // takmer rovnobežné – nie je to roh
    const t = ((lb.m[0] - la.m[0]) * lb.d[1] - (lb.m[1] - la.m[1]) * lb.d[0]) / det;
    const v = [la.m[0] + t * la.d[0], la.m[1] + t * la.d[1]];
    if (Math.hypot(v[0] - pts[c][0], v[1] - pts[c][1]) > maxPosun) return;
    vrcholy.set(c, v);
  });
  if (!vrcholy.size) return { pts, rohy };
  const zahodit = new Uint8Array(n);
  vrcholy.forEach((v, c) => { for (let j = -k + 1; j <= k - 1; j++) if (j !== 0) zahodit[od(c + j)] = 1; });
  const np = [], nr = [];
  for (let i = 0; i < n; i++) {
    if (zahodit[i]) continue;
    if (vrcholy.has(i)) { nr.push(np.length); np.push(vrcholy.get(i)); }
    else { if (rohy.includes(i)) nr.push(np.length); np.push(pts[i]); }
  }
  return { pts: np, rohy: nr };
}

function useky(pts, rohy, k, tol) {
  // vráti zoznam prvkov cesty: { line: [p0, p1] } alebo { cubic: [p0,c1,c2,p1] }
  const n = pts.length;
  const out = [];
  const err = tol * tol;
  const spracuj = (ia, ib, uzavrety) => {
    // body od ia po ib (cyklicky), ib môže byť == ia (celý obvod)
    const P = [];
    let i = ia;
    for (;;) {
      P.push(pts[i]);
      if (i === ib && P.length > 1) break;
      i = (i + 1) % n;
      if (P.length > n + 1) break;
    }
    if (P.length < 2) return;
    const m = Math.max(1, Math.min(k, Math.floor((P.length - 1) / 3)));
    const t1 = norm(sub(P[Math.min(m, P.length - 1)], P[0]));
    const t2 = norm(sub(P[Math.max(0, P.length - 1 - m)], P[P.length - 1]));
    // rovná čiara?
    const a = P[0], b = P[P.length - 1];
    const ab = sub(b, a), lab = dlzka(ab);
    let maxD = 0;
    if (lab > 1e-6) {
      for (let q = 1; q < P.length - 1; q++) { const d = Math.abs(ab[0] * (P[q][1] - a[1]) - ab[1] * (P[q][0] - a[0])) / lab; if (d > maxD) maxD = d; }
    } else maxD = Infinity;
    // dlhá hrana môže mať po rozmazaní/šume odchýlku pod ~1 px a pritom je zjavne rovná — tolerancia rastie s dĺžkou
    if (maxD < tol * 0.6 + 0.4 + 0.002 * lab) { out.push({ line: [a, b] }); return; }
    const kr = [];
    fitCubic(P, t1, t2, err, kr);
    kr.forEach(c => out.push({ cubic: c }));
  };
  if (rohy.length === 0) {
    // hladký uzavretý obrys: rozdelíme v dvoch protiľahlých bodoch, tangenty zhodné
    const i0 = 0, i1 = Math.floor(n / 2);
    const tan = (i) => norm(sub(pts[(i + k) % n], pts[(i - k + n * 4) % n]));
    const t0 = tan(i0), tm = tan(i1);
    const sluckaA = []; const sluckaB = [];
    const zber = (from, to, o) => { for (let i = from; ; i = (i + 1) % n) { o.push(pts[i]); if (i === to) break; } };
    zber(i0, i1, sluckaA); zber(i1, i0, sluckaB);
    const kr = [];
    fitCubic(sluckaA, t0, mul(tm, -1), err, kr);
    fitCubic(sluckaB, tm, mul(t0, -1), err, kr);
    kr.forEach(c => out.push({ cubic: c }));
    return out;
  }
  for (let r = 0; r < rohy.length; r++) {
    const ia = rohy[r], ib = rohy[(r + 1) % rohy.length];
    spracuj(ia, ib, true);
  }
  return out;
}
// Vyrovnanie: rovný úsek, ktorý sa od vodorovnej/zvislej líši o pár stupňov (šum, skosenie po rozmazaní), sa urobí presne vodorovný/zvislý.
// Koncové body sú spoločné pre susedné úseky, takže sa posúvajú spolu (aj s riadiacimi bodmi priľahlých kriviek) — tvar ostane súvislý.
function vyrovnajUseky(us, uholStupne) {
  const m = us.length;
  if (m < 3 || !us.some(u => u.line)) return us;
  const start = (u) => (u.line ? u.line[0] : u.cubic[0]);
  const koniec = (u) => (u.line ? u.line[1] : u.cubic[3]);
  // vrchol j = začiatok úseku j (= koniec úseku j-1); ak sa obrys nespája, nič nemeníme
  for (let j = 0; j < m; j++) {
    const a = koniec(us[j]), b = start(us[(j + 1) % m]);
    if (Math.abs(a[0] - b[0]) > 1e-3 || Math.abs(a[1] - b[1]) > 1e-3) return us;
  }
  const V = us.map(u => [start(u)[0], start(u)[1]]);
  const orig = V.map(v => [v[0], v[1]]);
  const s = Math.sin((uholStupne * Math.PI) / 180);
  for (let prechod = 0; prechod < 4; prechod++) {
    for (let j = 0; j < m; j++) {
      if (!us[j].line) continue;
      const p = V[j], q = V[(j + 1) % m];
      const dx = q[0] - p[0], dy = q[1] - p[1], dl = Math.hypot(dx, dy);
      if (dl < 4) continue;
      if (Math.abs(dy) <= dl * s) { const y = (p[1] + q[1]) / 2; p[1] = y; q[1] = y; }
      else if (Math.abs(dx) <= dl * s) { const x = (p[0] + q[0]) / 2; p[0] = x; q[0] = x; }
    }
  }
  return us.map((u, j) => {
    const p = V[j], q = V[(j + 1) % m];
    if (u.line) return { line: [p, q] };
    const dp = [p[0] - orig[j][0], p[1] - orig[j][1]];
    const dq = [q[0] - orig[(j + 1) % m][0], q[1] - orig[(j + 1) % m][1]];
    const c = u.cubic;
    return { cubic: [p, [c[1][0] + dp[0], c[1][1] + dp[1]], [c[2][0] + dq[0], c[2][1] + dq[1]], q] };
  });
}

function cestaZUsekov(us) {
  if (!us.length) return '';
  const start = us[0].line ? us[0].line[0] : us[0].cubic[0];
  let d = `M${f2(start[0])} ${f2(start[1])}`;
  for (const u of us) {
    if (u.line) d += `L${f2(u.line[1][0])} ${f2(u.line[1][1])}`;
    else d += `C${f2(u.cubic[1][0])} ${f2(u.cubic[1][1])} ${f2(u.cubic[2][0])} ${f2(u.cubic[2][1])} ${f2(u.cubic[3][0])} ${f2(u.cubic[3][1])}`;
  }
  return d + 'Z';
}

// ---------- verejné rozhranie ----------
// imgd: ImageData, pal: [{r,g,b,a}] (priehľadná farba má a < 128), nastavenia:
//   vyhladenie – sigma rozmazania masky v pixeloch (0.6–4), tolerancia – maximálna odchýlka krivky od obrysu v pixeloch,
//   pathomit – škvrny menšie ako cca (pathomit × 2) px² sa zahodia, ostreRohy – zachovať ostré rohy
export function trasuj(imgd, pal, { vyhladenie = 1, tolerancia = 0.7, pathomit = 8, ostreRohy = true, uholRohu = 52, vyrovnat = true, uholVyrovnania = 3 } = {}) {
  const { width: w, height: h, data } = imgd;
  const opaque = [];
  let tIdx = -1;
  pal.forEach((c, i) => { if ((c.a ?? 255) < 128) tIdx = i; else opaque.push(i); });
  const kandidati = opaque.length ? opaque : pal.map((_, i) => i);
  const cache = new Int16Array(32768).fill(-1);
  const labels = new Uint8Array(w * h);
  for (let p = 0, q = 0; q < w * h; p += 4, q++) {
    if (data[p + 3] < 128 && tIdx >= 0) { labels[q] = tIdx; continue; }
    const key = ((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3);
    let li = cache[key];
    if (li < 0) {
      let bd = Infinity;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      for (const ci of kandidati) {
        const c = pal[ci];
        const dr = r - c.r, dg = g - c.g, db = b - c.b;
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bd) { bd = d; li = ci; }
      }
      cache[key] = li;
    }
    labels[q] = li;
  }
  const sigma = Math.max(0.6, vyhladenie);
  const { r: polomer } = gaussJadro(sigma);
  const pad = polomer + 3;
  const k = Math.max(3, Math.round(2 + sigma * 1.5));
  const minPlocha = pathomit * 2;
  const layers = pal.map((_, ci) => {
    if (ci === tIdx) return [];
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) if (labels[row + x] === ci) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return [];
    const fw = x1 - x0 + 1 + 2 * pad, fh = y1 - y0 + 1 + 2 * pad;
    let f = new Float32Array(fw * fh);
    for (let y = y0; y <= y1; y++) {
      const src = y * w, dst = (y - y0 + pad) * fw + pad - x0;
      for (let x = x0; x <= x1; x++) if (labels[src + x] === ci) f[dst + x] = 1;
    }
    f = rozmaz(f, fw, fh, sigma);
    const kont = obrysyPola(f, fw, fh);
    const cesty = [];
    for (const o of kont) {
      if (Math.abs(o.plocha) < minPlocha) continue;
      // súradnice poľa -> súradnice obrázka (stred pixelu = +0.5)
      const pts = o.pts.map(([x, y]) => [x - pad + x0 + 0.5, y - pad + y0 + 0.5]);
      let rohy = ostreRohy ? najdiRohy(pts, k, uholRohu) : [];
      let body = pts;
      if (rohy.length) ({ pts: body, rohy } = spresniRohy(pts, rohy, k, 2 + sigma * 2.5));
      let us = useky(body, rohy, k, tolerancia);
      if (ostreRohy && vyrovnat) us = vyrovnajUseky(us, uholVyrovnania);
      const d = cestaZUsekov(us);
      if (d) cesty.push({ d, isholepath: o.plocha < 0 });
    }
    return cesty;
  });
  return { palette: pal, layers, width: w, height: h };
}

const hexFarby = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// SVG z výsledku: viditelna(i) rozhoduje, ktoré farby sa zahrnú; obrys = jemný okraj rovnakej farby (len na náhľad/PNG: zakryje
// biele škáry medzi susednými farbami pri vykresľovaní), pre rezanie/výšivku sa sťahuje čisté SVG bez okraja.
export function zostavSvgZTd(td, viditelna, { obrys = 0 } = {}) {
  let telo = '';
  td.layers.forEach((vrstva, i) => {
    if (!viditelna(i) || !vrstva.length || (td.palette[i].a ?? 255) < 128) return;
    const fill = hexFarby(td.palette[i]);
    const d = vrstva.map(p => p.d).join('');
    telo += `<path fill="${fill}" fill-rule="evenodd"${obrys > 0 ? ` stroke="${fill}" stroke-width="${obrys}" stroke-linejoin="round"` : ''} d="${d}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${td.width} ${td.height}">${telo}</svg>`;
}
