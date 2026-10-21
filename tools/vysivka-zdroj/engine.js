/* Stitch engine: obrázok -> objekty -> stehy -> DST.
   Všetky súradnice sú v mriežke R px/mm (R = 10 => 1 px = 0,1 mm = 1 jednotka DST). */
(function (root) {
'use strict';
const E = {};
const R = E.R = 10;

E.defaults = {
  fillSpacing: 0.40,   // mm medzi riadkami tatami
  fillStitch: 3.5,     // mm max dĺžka stehu vo výplni
  satinSpacing: 0.38,  // mm hustota satinu
  runLength: 2.5,      // mm dĺžka stehu running
  pullComp: 0.15,      // mm
  underlay: true,
  satinMaxWidth: 2.8,  // mm – užšie tvary sa automaticky šijú satinom
  minArea: 0.8,        // mm² – drobnosti sa odstránia
  holeMax: 25,         // mm² – menšie diery vo veľkých plochách sa prešijú (detail ide navrch)
  bigArea: 200,        // mm² – "veľká plocha"
  trimDist: 3.0,       // mm – dlhší prechod = strih
};

/* ---------------- pomocné ---------------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* ---------------- 1. redukcia farieb ---------------- */
E.quantize = function (rgba, w, h, k, opts = {}) {
  const n = w * h;
  const bg = new Uint8Array(n);
  let hasAlpha = false;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 128) { bg[i] = 1; hasAlpha = true; }
  if (!hasAlpha && opts.removeBg !== false) {
    // nepriehľadný obrázok: pozadie = farba rohov, zaplavíme od okraja
    const corners = [0, w - 1, (h - 1) * w, n - 1];
    const c = [0, 0, 0];
    for (const i of corners) for (let j = 0; j < 3; j++) c[j] += rgba[i * 4 + j] / 4;
    const tol = 40 * 40;
    const close = (i) => {
      const dr = rgba[i * 4] - c[0], dg = rgba[i * 4 + 1] - c[1], db = rgba[i * 4 + 2] - c[2];
      return dr * dr + dg * dg + db * db < tol;
    };
    const st = [];
    for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
    while (st.length) {
      const i = st.pop();
      if (bg[i] || !close(i)) continue;
      bg[i] = 1;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1);
      if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
    }
  }
  // vzorky
  const idx = [];
  for (let i = 0; i < n; i++) if (!bg[i]) idx.push(i);
  const step = Math.max(1, Math.floor(idx.length / 40000));
  const S = [];
  for (let j = 0; j < idx.length; j += step) { const i = idx[j]; S.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]); }
  const r = rng(7);
  // k-means++
  const C = [S[Math.floor(r() * S.length)].slice()];
  const d2 = new Float64Array(S.length);
  while (C.length < k && C.length < S.length) {
    let sum = 0;
    for (let j = 0; j < S.length; j++) {
      let m = Infinity;
      for (const c of C) { const a = S[j][0] - c[0], b = S[j][1] - c[1], e = S[j][2] - c[2]; m = Math.min(m, a * a + b * b + e * e); }
      d2[j] = m; sum += m;
    }
    if (sum === 0) break;
    let t = r() * sum, j = 0;
    for (; j < S.length - 1; j++) { t -= d2[j]; if (t <= 0) break; }
    C.push(S[j].slice());
  }
  const assign = new Int32Array(S.length);
  for (let it = 0; it < 15; it++) {
    const acc = C.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < S.length; j++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < C.length; c++) {
        const a = S[j][0] - C[c][0], b = S[j][1] - C[c][1], e = S[j][2] - C[c][2], d = a * a + b * b + e * e;
        if (d < bd) { bd = d; best = c; }
      }
      assign[j] = best; const q = acc[best]; q[0] += S[j][0]; q[1] += S[j][1]; q[2] += S[j][2]; q[3]++;
    }
    for (let c = 0; c < C.length; c++) if (acc[c][3]) C[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
  }
  const labels = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (bg[i]) continue;
    let best = 0, bd = Infinity;
    for (let c = 0; c < C.length; c++) {
      const a = rgba[i * 4] - C[c][0], b = rgba[i * 4 + 1] - C[c][1], e = rgba[i * 4 + 2] - C[c][2], d = a * a + b * b + e * e;
      if (d < bd) { bd = d; best = c; }
    }
    labels[i] = best;
  }
  const palette = C.map(c => c.map(v => Math.round(v)));
  return { labels, palette };
};

/* ---------------- 2. čistenie ---------------- */
E.modeFilter = function (labels, w, h, nl) {
  const out = new Int16Array(labels);
  const cnt = new Int32Array(nl + 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    cnt.fill(0);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[labels[i + dy * w + dx] + 1]++;
    let best = labels[i] + 1, bc = cnt[best];
    for (let l = 0; l <= nl; l++) if (cnt[l] > bc) { bc = cnt[l]; best = l; }
    if (bc >= 5) out[i] = best - 1;
  }
  return out;
};

E.components = function (labels, w, h) {
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const comps = [];
  const st = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (labels[s] < 0 || comp[s] >= 0) continue;
    const L = labels[s], id = comps.length;
    let sp = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    st[sp++] = s; comp[s] = id;
    while (sp) {
      const i = st[--sp]; area++;
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && comp[i - 1] < 0 && labels[i - 1] === L) { comp[i - 1] = id; st[sp++] = i - 1; }
      if (x < w - 1 && comp[i + 1] < 0 && labels[i + 1] === L) { comp[i + 1] = id; st[sp++] = i + 1; }
      if (y > 0 && comp[i - w] < 0 && labels[i - w] === L) { comp[i - w] = id; st[sp++] = i - w; }
      if (y < h - 1 && comp[i + w] < 0 && labels[i + w] === L) { comp[i + w] = id; st[sp++] = i + w; }
    }
    comps.push({ id, label: L, area, x0, y0, x1, y1, seed: s });
  }
  return { comp, comps };
};

// drobné kúsky pripojíme k najčastejšiemu susedovi
E.removeSmall = function (labels, w, h, minPx) {
  const { comp, comps } = E.components(labels, w, h);
  const out = new Int16Array(labels);
  for (const c of comps) {
    if (c.area >= minPx) continue;
    const cnt = new Map();
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      const i = y * w + x;
      if (comp[i] !== c.id) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h) continue;
        if (comp[j] !== c.id) cnt.set(labels[j], (cnt.get(labels[j]) || 0) + 1);
      }
    }
    let best = -1, bc = -1;
    for (const [l, v] of cnt) if (v > bc) { bc = v; best = l; }
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      const i = y * w + x; if (comp[i] === c.id) out[i] = best;
    }
  }
  return out;
};

/* ---------------- 3. objekty ---------------- */
function distanceTransform(mask, w, h, edgeZero = true) {
  // chamfer 1 / 1.414, vzdialenosť ku najbližšiemu 0
  const d = new Float32Array(w * h);
  const INF = 1e9;
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const D = 1.41421;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); else if (edgeZero) v = Math.min(v, 1);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 1);
      if (x > 0) v = Math.min(v, d[i - w - 1] + D);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
    } else if (edgeZero) v = Math.min(v, 1);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1); else if (edgeZero) v = Math.min(v, 1);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 1);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
      if (x > 0) v = Math.min(v, d[i + w - 1] + D);
    } else if (edgeZero) v = Math.min(v, 1);
    d[i] = v;
  }
  return d;
}

E.buildObjects = function (labels, w, h, opts) {
  const o = Object.assign({}, E.defaults, opts || {});
  const { comp, comps } = E.components(labels, w, h);
  const PAD = 3;
  const objs = comps.map(c => {
    const bw = c.x1 - c.x0 + 1 + 2 * PAD, bh = c.y1 - c.y0 + 1 + 2 * PAD;
    const ox = c.x0 - PAD, oy = c.y0 - PAD;
    const mask = new Uint8Array(bw * bh);
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++)
      if (comp[y * w + x] === c.id) mask[(y - oy) * bw + (x - ox)] = 1;
    const own = mask.slice();
    // veľké plochy: malé diery prešijeme (detail pôjde navrch)
    if (c.area > o.bigArea * R * R) {
      const out = new Uint8Array(bw * bh);
      const st = [0];
      while (st.length) {
        const i = st.pop(); if (out[i] || mask[i]) continue; out[i] = 1;
        const x = i % bw, y = (i / bw) | 0;
        if (x > 0) st.push(i - 1); if (x < bw - 1) st.push(i + 1);
        if (y > 0) st.push(i - bw); if (y < bh - 1) st.push(i + bw);
      }
      const seen = new Uint8Array(bw * bh);
      for (let s = 0; s < bw * bh; s++) {
        if (mask[s] || out[s] || seen[s]) continue;
        const pix = []; const q = [s]; seen[s] = 1;
        while (q.length) {
          const i = q.pop(); pix.push(i);
          const x = i % bw, y = (i / bw) | 0;
          for (const j of [x > 0 ? i - 1 : -1, x < bw - 1 ? i + 1 : -1, y > 0 ? i - bw : -1, y < bh - 1 ? i + bw : -1])
            if (j >= 0 && !mask[j] && !out[j] && !seen[j]) { seen[j] = 1; q.push(j); }
        }
        if (pix.length < o.holeMax * R * R) for (const i of pix) mask[i] = 1;
      }
    }
    const dt = distanceTransform(mask, bw, bh);
    let area = 0, core = 0, maxdt = 0;
    const half = o.satinMaxWidth / 2 * R;
    for (let i = 0; i < bw * bh; i++) if (mask[i]) { area++; if (dt[i] > half) core++; if (dt[i] > maxdt) maxdt = dt[i]; }
    // guľatá bodka (napr. stred kvietka) nemá zmysluplnú os -> výplň
    const blob = 2 * maxdt > 0.7 * Math.sqrt(area);
    const thin = core < 0.08 * area && !blob;
    return {
      id: c.id, label: c.label, area: c.area, seed: c.seed,
      ox, oy, bw, bh, mask, own, dt,
      autoType: thin ? 'satin' : 'fill',
      cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2,
    };
  });
  return { comp, objs };
};

const inMask = (ob, gx, gy) => {
  const x = Math.floor(gx - ob.ox), y = Math.floor(gy - ob.oy);
  return x >= 0 && y >= 0 && x < ob.bw && y < ob.bh && ob.mask[y * ob.bw + x] === 1;
};
E.inMask = inMask;

/* poradie: objekt ide po objektoch, ktorých plocha ho prekrýva; čo najmenej výmen nití */
E.orderObjects = function (objs, w, colorOrder) {
  const pt = ob => [ob.seed % w + 0.5, Math.floor(ob.seed / w) + 0.5];
  for (const ob of objs) {
    const p = pt(ob);
    ob.covers = objs.filter(q => q !== ob && q.area > ob.area && inMask(q, p[0], p[1]));
    ob.depth = ob.covers.length;
  }
  const rank = new Map(colorOrder.map((l, i) => [l, i]));
  const list = objs.slice().sort((a, b) => a.depth - b.depth || (rank.get(a.label) - rank.get(b.label)) || b.area - a.area);
  const blockColors = [];
  for (const ob of list) {
    let need = -1;
    for (const q of ob.covers) if (q.block !== undefined) need = Math.max(need, q.block);
    let j = -1;
    for (let b = Math.max(need, 0); b < blockColors.length; b++)
      if (blockColors[b] === ob.label && (b > need || blockColors[need] === ob.label)) { j = b; break; }
    if (j < 0) { blockColors.push(ob.label); j = blockColors.length - 1; }
    ob.block = j;
  }
  list.forEach(ob => { delete ob._b; });
  const res = list.sort((a, b) => a.block - b.block || a.depth - b.depth);
  for (const ob of objs) delete ob.block;
  return { order: res, blockColors };
};

/* ---------------- 4. stehy ---------------- */
function fillRows(ob, angleDeg, spacingPx, test) {
  const a = angleDeg * Math.PI / 180;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const cs = [[0, 0], [ob.bw, 0], [0, ob.bh], [ob.bw, ob.bh]];
  let tmin = Infinity, tmax = -Infinity, smin = Infinity, smax = -Infinity;
  for (const [x, y] of cs) {
    const t = x * ux + y * uy, s = x * vx + y * vy;
    tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); smin = Math.min(smin, s); smax = Math.max(smax, s);
  }
  const rows = [];
  for (let s = smin + spacingPx / 2; s < smax; s += spacingPx) {
    const segs = [];
    let inside = false, t0 = 0;
    for (let t = tmin; t <= tmax + 0.5; t += 0.5) {
      const x = s * vx + t * ux, y = s * vy + t * uy;
      const xi = Math.floor(x), yi = Math.floor(y);
      const v = xi >= 0 && yi >= 0 && xi < ob.bw && yi < ob.bh && test(yi * ob.bw + xi);
      if (v && !inside) { inside = true; t0 = t; }
      else if (!v && inside) { inside = false; if (t - 0.5 - t0 >= 2) segs.push([t0, t - 0.5]); }
    }
    rows.push({ s, segs, ri: rows.length });
  }
  return { rows, ux, uy, vx, vy };
}

function groupRuns(rows, connOk) {
  const used = rows.map(r => r.segs.map(() => false));
  const runs = [];
  for (let ri = 0; ri < rows.length; ri++) for (let si = 0; si < rows[ri].segs.length; si++) {
    if (used[ri][si]) continue;
    used[ri][si] = true;
    let prev = rows[ri].segs[si];
    const run = [{ seg: prev, s: rows[ri].s, ri }];
    for (let rj = ri + 1; rj < rows.length; rj++) {
      let nx = -1;
      const sg = rows[rj].segs;
      for (let k = 0; k < sg.length; k++) if (!used[rj][k] && sg[k][0] < prev[1] && sg[k][1] > prev[0]) { nx = k; break; }
      if (nx < 0) break;
      // prechod medzi riadkami ide po okraji: ak by viedol cez medzeru (zárez tvaru), beh ukončíme
      if (connOk && !connOk(prev, rows[rj - 1].s, sg[nx], rows[rj].s, run.length % 2 === 1)) break;
      used[rj][nx] = true; prev = sg[nx]; run.push({ seg: prev, s: rows[rj].s, ri: rj });
    }
    runs.push(run);
  }
  return runs;
}

// vzory výplne = posun vpichov medzi riadkami (zlomok dĺžky stehu)
const PATTERNS = {
  tatami: [0, 1 / 3, 2 / 3],          // klasika, vpichy netvoria čiary
  tatami4: [0, 0.5, 0.25, 0.75],      // jemnejšia, hladšia štruktúra
  brick: [0, 0.5],                    // tehla, výraznejšia textúra
  diagonal: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875], // vpichy tvoria šikmé línie
  wave: [0, 0.15, 0.3, 0.42, 0.5, 0.42, 0.3, 0.15],           // vlnka
  plain: [0],                         // bez posunu, vpichy v rade (viditeľné drážky)
};
E.PATTERNS = Object.keys(PATTERNS);

function runPoints(run, geo, stitchPx, pcPx, pattern, ob) {
  const pts = [];
  const offs = PATTERNS[pattern] || PATTERNS.plain;
  run.forEach((r, i) => {
    let a = r.seg[0] - pcPx, b = r.seg[1] + pcPx;
    if (i % 2) [a, b] = [b, a];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    // vnútorné vpichy na pevnej mriežke: t = k*steh + posun(riadok) -> vzor sedí naprieč celou plochou
    const off = offs[((r.ri % offs.length) + offs.length) % offs.length] * stitchPx;
    const inner = [];
    for (let t = Math.ceil((lo - off) / stitchPx) * stitchPx + off; t < hi; t += stitchPx)
      if (t > lo + 3 && t < hi - 3) inner.push(t);
    if (b < a) inner.reverse();
    const ts = [a, ...inner, b];
    for (const t2 of ts) pts.push([ob.ox + r.s * geo.vx + t2 * geo.ux, ob.oy + r.s * geo.vy + t2 * geo.uy]);
  });
  return pts;
}

function nearestOrder(runs, start, allowReverse = true) {
  const rest = runs.slice(), out = [];
  let cur = start;
  while (rest.length) {
    let best = Infinity, bi = 0, rev = false;
    rest.forEach((r, i) => {
      let d = dist(cur, r[0]); if (d < best) { best = d; bi = i; rev = false; }
      if (allowReverse) { d = dist(cur, r[r.length - 1]); if (d < best) { best = d; bi = i; rev = true; } }
    });
    let r = rest.splice(bi, 1)[0];
    if (rev) { const t = r.tag; r = r.slice().reverse(); if (t) r.tag = t; }
    out.push(r); cur = r[r.length - 1];
  }
  return out;
}

// vedie úsečka (v súradniciach objektu) cez medzeru aspoň ~0,4 mm? Okraj tvaru (1 px) sa toleruje.
function crossesGap(ob, x0, y0, x1, y1, test) {
  const near = (x, y) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xi = Math.floor(x + dx), yi = Math.floor(y + dy);
      if (xi >= 0 && yi >= 0 && xi < ob.bw && yi < ob.bh && test(yi * ob.bw + xi)) return true;
    }
    return false;
  };
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  let run = 0;
  for (let k = 1; k < n; k++) {
    if (!near(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) { if (++run >= 4) return true; } else run = 0;
  }
  return false;
}
E.crossesGap = crossesGap;

function connChecker(ob, g, test) {
  // je spojnica dvoch koncov riadkov celá vnútri tvaru?
  return (a, sa, b, sb, endSide) => {
    const ta = endSide ? a[1] : a[0], tb = endSide ? b[1] : b[0];
    // konce susedných riadkov musia byť blízko, inak by spoj ležal ako dlhý steh na povrchu
    if (Math.abs(ta - tb) > 15) return false;
    const x0 = sa * g.vx + ta * g.ux, y0 = sa * g.vy + ta * g.uy;
    const x1 = sb * g.vx + tb * g.ux, y1 = sb * g.vy + tb * g.uy;
    return !crossesGap(ob, x0, y0, x1, y1, test);
  };
}

function fillObject(ob, p, start) {
  const runs = [];
  const sp = p.spacing * R, pc = p.pullComp * R;
  const ut = p.underlay ? (p.underlayType || 'fill') : 'none';
  if (ut === 'edge' || ut === 'edge+fill') {
    // obrysový podklad: rovný steh 0,5 mm vnútri okraja
    const inner = Object.assign({}, ob, { mask: ob.mask.map((v, i) => v && ob.dt[i] > 5 ? 1 : 0) });
    const e = runningObject(inner, { stitchLen: 2.5, passes: 1 }, start);
    e.forEach(r => r.tag = 'u');
    runs.push(...e.filter(r => r.length > 2));
  }
  if (ut === 'fill' || ut === 'edge+fill') {
    const t = i => ob.mask[i] && ob.dt[i] > 5;
    const g = fillRows(ob, p.angle + 90, 2.0 * R, t);
    const u = groupRuns(g.rows, connChecker(ob, g, i => ob.mask[i] === 1)).map(r => runPoints(r, g, 3.0 * R, 0, 'plain', ob)).filter(r => r.length > 1);
    u.forEach(r => r.tag = 'u');
    runs.push(...nearestOrder(u, runs.length ? runs[runs.length - 1].slice(-1)[0] : start));
  }
  const fill = i => ob.mask[i] === 1;
  const g = fillRows(ob, p.angle, sp, fill);
  const top = groupRuns(g.rows, connChecker(ob, g, fill)).map(r => runPoints(r, g, p.stitchLen * R, pc, p.pattern || 'tatami', ob)).filter(r => r.length > 1);
  runs.push(...nearestOrder(top, runs.length ? runs[runs.length - 1].slice(-1)[0] : start));
  return runs;
}

/* --- satin: kostra (Zhang-Suen) -> vetvy -> stĺpce --- */
function thinMask(m, w, h) {
  const del = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!m[i]) continue;
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (pass === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; }
        else { if (p2 * p4 * p8 || p2 * p6 * p8) continue; }
        del.push(i);
      }
      for (const i of del) m[i] = 0;
      if (del.length) changed = true;
    }
  }
  // odstránenie "schodov" (pixel s dvoma 4-susedmi tvoriacimi roh)
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!m[i]) continue;
    const n = m[i - w], s = m[i + w], e = m[i + 1], wv = m[i - 1];
    if ((n && e && !m[i + w - 1] && !s && !wv) || (e && s && !m[i - w - 1] && !n && !wv) ||
        (s && wv && !m[i - w + 1] && !n && !e) || (wv && n && !m[i + w + 1] && !s && !e)) m[i] = 0;
  }
}

function skeletonPaths(ob, sc = 1) {
  const w = ob.bw, h = ob.bh;
  const m = new Uint8Array(ob.mask);
  thinMask(m, w, h);
  const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const ring = [-w, -w + 1, 1, w + 1, w, w - 1, -1, -w - 1];
  const B = new Uint8Array(w * h), CN = new Uint8Array(w * h);
  for (let i = w; i < w * h - w; i++) {
    if (!m[i]) continue;
    let b = 0, c = 0;
    for (let k = 0; k < 8; k++) { b += m[i + ring[k]]; if (!m[i + ring[k]] && m[i + ring[(k + 1) % 8]]) c++; }
    B[i] = b; CN[i] = c;
  }
  const isNode = i => B[i] <= 1 || CN[i] >= 3;
  const visited = new Uint8Array(w * h);
  const paths = [];
  const seenEdge = new Set();
  const nbs = i => {
    const r = [];
    for (const d of N8) if (m[i + d]) r.push(i + d);
    // 4-susedia prv
    r.sort((a, b) => (Math.abs(a - i) === 1 || Math.abs(a - i) === w ? 0 : 1) - (Math.abs(b - i) === 1 || Math.abs(b - i) === w ? 0 : 1));
    return r;
  };
  const walk = (start, first) => {
    const path = [start];
    let prev = start, cur = first;
    for (;;) {
      path.push(cur);
      if (isNode(cur)) break;
      visited[cur] = 1;
      let next = -1;
      for (const q of nbs(cur)) {
        if (q === prev || path.length > 2 && q === path[path.length - 3]) continue;
        if (isNode(q) && q !== start) { next = q; break; }
        if (q === start && path.length > 3) { next = q; break; }
        if (!visited[q] && !isNode(q)) { next = q; break; }
      }
      if (next < 0) break;
      prev = cur; cur = next;
      if (cur === start) { path.push(cur); break; }
    }
    return path;
  };
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || !isNode(i)) continue;
    if (B[i] === 0) { paths.push([i]); continue; }
    for (const q of nbs(i)) {
      if (isNode(q)) {
        const key = Math.min(i, q) + ':' + Math.max(i, q);
        if (seenEdge.has(key)) continue; seenEdge.add(key);
        paths.push([i, q]); continue;
      }
      if (visited[q]) continue;
      paths.push(walk(i, q));
    }
  }
  // čisté cykly
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || visited[i] || isNode(i)) continue;
    const nb = nbs(i);
    if (!nb.length) continue;
    visited[i] = 1;
    const p = [i];
    let prev = i, cur = nb[0];
    while (cur !== i && !visited[cur]) {
      p.push(cur); visited[cur] = 1;
      let next = -1;
      for (const q of nbs(cur)) if (q !== prev && (!visited[q] || (q === i && p.length > 3))) { next = q; break; }
      if (next < 0) break;
      prev = cur; cur = next;
    }
    if (cur === i) p.push(i);
    paths.push(p);
  }
  // zhluky uzlových pixelov = uzly grafu
  const parent = new Map();
  const find = a => { let r = a; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(a) !== r) { const n = parent.get(a); parent.set(a, r); a = n; } return r; };
  for (let i = 0; i < w * h; i++) if (m[i] && isNode(i)) parent.set(i, i);
  for (const i of parent.keys()) for (const d of N8) { const q = i + d; if (parent.has(q)) { const x = find(i), y = find(q); if (x !== y) parent.set(x, y); } }
  const cl = i => parent.has(i) ? find(i) : i;
  const res = [];
  const N = w * h;
  for (const p of paths) {
    if (p.length < 2) continue;
    const free0 = B[p[0]] <= 1, free1 = B[p[p.length - 1]] <= 1;
    const pts = p.map(i => [i % w + 0.5, Math.floor(i / w) + 0.5]);
    let L = 0; for (let k = 1; k < pts.length; k++) L += dist(pts[k - 1], pts[k]);
    if ((free0 || free1) && L < 6 * sc) continue;
    // výbežok kostry do rohu: voľná vetva kratšia ako ~polovica šírky ťahu pri uzle
    if (free0 !== free1) {
      const nodeDt = ob.dt[free0 ? p[p.length - 1] : p[0]] || 0;
      if (L < 1.4 * nodeDt) continue;
    }
    const n0 = cl(p[0]), n1 = cl(p[p.length - 1]);
    const loop = p.length > 4 && p[0] === p[p.length - 1];
    if (n0 === n1 && !loop && L < 10 * sc) continue;          // spojka vnútri jedného uzla
    if (!free0 && !free1 && L < 3 * sc && !loop) continue;
    // ostré rohy v ťahu (B, Z, E, 4…): vetvu rozrežeme, roh dostane pokosový rez
    const corners = findCorners(p, pts, ob.dt, loop, sc);
    const pieces = [];
    if (!corners.length) pieces.push({ pix: p, a: n0, b: n1, loop });
    else if (loop) {
      const q = p.slice(0, -1), c0 = corners[0];
      const rot = q.slice(c0).concat(q.slice(0, c0 + 1));
      const cs = corners.map(c => (c - c0 + q.length) % q.length).sort((x, y) => x - y);
      cs.push(rot.length - 1);
      for (let j = 0; j < cs.length - 1; j++) pieces.push({ pix: rot.slice(cs[j], cs[j + 1] + 1), a: N + rot[cs[j]], b: N + rot[cs[j + 1]], loop: false });
    } else {
      const cs = [0].concat(corners, [p.length - 1]);
      for (let j = 0; j < cs.length - 1; j++) pieces.push({
        pix: p.slice(cs[j], cs[j + 1] + 1),
        a: j === 0 ? n0 : N + p[cs[j]], b: j === cs.length - 2 ? n1 : N + p[cs[j + 1]], loop: false });
    }
    for (const pc of pieces) {
      const pp = pc.pix.map(i => [i % w + 0.5, Math.floor(i / w) + 0.5]);
      let Lp = 0; for (let k = 1; k < pp.length; k++) Lp += dist(pp[k - 1], pp[k]);
      res.push({ pts: simplify(pp, 0.8 * sc), pix: pc.pix, n0: pc.a, n1: pc.b, loop: pc.loop, L: Lp,
                 end0: ob.dt[pc.pix[0]] || 0, end1: ob.dt[pc.pix[pc.pix.length - 1]] || 0 });
    }
  }
  // voľný koniec = uzol, z ktorého po orezaní vedie len jedna vetva
  const deg = new Map();
  for (const b of res) { deg.set(b.n0, (deg.get(b.n0) || 0) + 1); deg.set(b.n1, (deg.get(b.n1) || 0) + 1); }
  for (const b of res) { b.free0 = deg.get(b.n0) === 1; b.free1 = deg.get(b.n1) === 1; }
  return res;
}

// indexy ostrých zlomov na pixelovej kostre (uhol nad ~50° v okne ~ šírky ťahu)
function findCorners(p, pts, dt, loop, sc = 1) {
  const n = loop ? p.length - 1 : p.length;
  if (n < 8 * sc) return [];
  const at = i => loop ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const ang = new Float32Array(n), win = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const wi = Math.max(4 * sc, Math.min(14 * sc, Math.round((dt[p[i]] || 5 * sc) * 0.8)));
    win[i] = wi;
    if (!loop && (i < wi || i > n - 1 - wi)) continue;
    const a = at(i - wi), b = at(i), c = at(i + wi);
    const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
    const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
    if (!n1 || !n2) continue;
    ang[i] = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2))));
  }
  const TH = 50 * Math.PI / 180, out = [];
  for (let i = 0; i < n; i++) {
    if (ang[i] < TH) continue;
    let isMax = true;
    for (let j = -win[i]; j <= win[i] && isMax; j++) {
      if (!j) continue;
      const k = loop ? ((i + j) % n + n) % n : i + j;
      if (k < 0 || k >= n) continue;
      if (ang[k] > ang[i] || (ang[k] === ang[i] && j < 0)) isMax = false;
    }
    if (!isMax) continue;
    // nie príliš blízko koncov vetvy (tam rieši tvar uzol)
    if (!loop) { const e = Math.max(win[i], 6 * sc); if (i < e || i > n - 1 - e) continue; }
    out.push(i);
  }
  return out;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const f = pts[0], l = pts[pts.length - 1];
  if (pts.length > 4 && Math.abs(f[0] - l[0]) < 1e-6 && Math.abs(f[1] - l[1]) < 1e-6) {
    // uzavretá slučka: zjednodušíme dve polovice zvlášť
    const mid = pts.length >> 1;
    return simplify(pts.slice(0, mid + 1), tol).concat(simplify(pts.slice(mid), tol).slice(1));
  }
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let md = 0, mi = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function polyline(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1];
  const closed = pts.length > 3 && dist(pts[0], pts[pts.length - 1]) < 1e-6;
  const at = d => {
    if (closed && L > 0) d = ((d % L) + L) % L;
    d = Math.max(0, Math.min(L, d));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1e-9, t = (d - cum[lo]) / seg;
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  };
  return { L, at, closed };
}

function extendPts(pts, d0, d1) {
  const p = pts.slice();
  const ext = (a, b, d) => { const vx = a[0] - b[0], vy = a[1] - b[1], n = Math.hypot(vx, vy) || 1; return [a[0] + vx / n * d, a[1] + vy / n * d]; };
  if (d0 && p.length > 1) p.unshift(ext(p[0], p[1], d0));
  if (d1 && p.length > 1) p.push(ext(p[p.length - 1], p[p.length - 2], d1));
  return p;
}

// rozdelenie tvaru medzi vetvy kostry (geodeticky najbližšia vetva) => rezné čiary v spojoch
function partitionByBranch(ob, branches) {
  const w = ob.bw, N = ob.bw * ob.bh;
  const reg = new Int32Array(N).fill(-1), dd = new Int32Array(N).fill(0x3fffffff);
  const buckets = [];
  const push = (i, d) => { (buckets[d] || (buckets[d] = [])).push(i); };
  branches.forEach((br, k) => {
    const pix = br.pix, s0 = pix.length > 4 ? 1 : 0, s1 = pix.length > 4 ? pix.length - 1 : pix.length;
    for (let j = s0; j < s1; j++) { const i = pix[j]; if (dd[i] > 0) { dd[i] = 0; reg[i] = k; push(i, 0); } }
  });
  const nb = [[-1, 5], [1, 5], [-w, 5], [w, 5], [-w - 1, 7], [-w + 1, 7], [w - 1, 7], [w + 1, 7]];
  for (let d = 0; d < buckets.length; d++) {
    const Bk = buckets[d]; if (!Bk) continue;
    for (const i of Bk) {
      if (dd[i] !== d) continue;
      const x = i % w;
      for (const [o, c] of nb) {
        const j = i + o;
        if (j < 0 || j >= N || !ob.mask[j] || Math.abs(j % w - x) > 1) continue;
        const nd = d + c;
        if (nd < dd[j]) { dd[j] = nd; reg[j] = reg[i]; push(j, nd); }
      }
    }
    buckets[d] = null;
  }
  return reg;
}

// tenké tvary spracujeme v 2× rozlíšení s vyhladeným obrysom (hladšia kostra, rovnejšie okraje)
function upscaleObject(ob, sc) {
  const w = ob.bw, h = ob.bh, W = w * sc, H = h * sc;
  const f = new Float32Array(w * h), g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = ob.mask[i];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    g[i] = (f[i] * 2 + (x > 0 ? f[i - 1] : 0) + (x < w - 1 ? f[i + 1] : 0)) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    f[i] = (g[i] * 2 + (y > 0 ? g[i - w] : 0) + (y < h - 1 ? g[i + w] : 0)) / 4;
  }
  const m = new Uint8Array(W * H);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x = (X + 0.5) / sc - 0.5, y = (Y + 0.5) / sc - 0.5;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(x))), y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, x - x0)), ty = Math.max(0, Math.min(1, y - y0));
    const v = (f[y0 * w + x0] * (1 - tx) + f[y0 * w + x1] * tx) * (1 - ty) + (f[y1 * w + x0] * (1 - tx) + f[y1 * w + x1] * tx) * ty;
    // pôvodný pixel tvaru nesmie zmiznúť (tenké ťahy by sa pretrhli)
    const orig = ob.mask[Math.min(h - 1, (Y / sc) | 0) * w + Math.min(w - 1, (X / sc) | 0)];
    m[Y * W + X] = v >= 0.5 || (orig && v >= 0.3) ? 1 : 0;
  }
  return { bw: W, bh: H, ox: 0, oy: 0, mask: m, own: m, dt: distanceTransform(m, W, H), label: ob.label };
}

function satinObject(ob, p, start) {
  let maxdt = 0; for (let i = 0; i < ob.dt.length; i++) if (ob.mask[i] && ob.dt[i] > maxdt) maxdt = ob.dt[i];
  const sc = maxdt < 16 && ob.bw * ob.bh < 1.5e6 ? 2 : 1;
  if (sc === 1) return satinCore(ob, p, start, 1, ob);
  return satinCore(upscaleObject(ob, sc), p, start, sc, ob);
}

function satinCore(ob, p, start, sc, src) {
  const w = ob.bw, h = ob.bh;
  const sp = p.spacing * R * sc, pc = p.pullComp * R * sc;
  const branches = skeletonPaths(ob, sc).filter(b => b.pts.length >= 2);
  if (!branches.length) return [];
  const reg = partitionByBranch(ob, branches);
  const idx = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); return xi >= 0 && yi >= 0 && xi < w && yi < h ? yi * w + xi : -1; };
  const insideK = (k, x, y) => { const i = idx(x, y); return i >= 0 && ob.mask[i] === 1 && reg[i] === k; };
  const ut = p.underlay ? (p.underlayType || 'center') : 'none';
  const toG = q => [src.ox + q[0] / sc, src.oy + q[1] / sc];
  const cov = new Uint8Array(w * h);
  const mark = (a, b, r) => {
    const L = dist(a, b), n = Math.max(1, Math.ceil(L * 2)), ri = Math.ceil(r);
    for (let s = 0; s <= n; s++) {
      const x = a[0] + (b[0] - a[0]) * s / n, y = a[1] + (b[1] - a[1]) * s / n;
      for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const i = idx(x + dx, y + dy); if (i >= 0) cov[i] = 1;
      }
    }
  };

  // ---- stĺpce každej vetvy ----
  const data = branches.map((br, k) => {
    const core = polyline(br.pts);
    const e0 = br.loop ? 0 : Math.min(35 * sc, br.free0 ? br.end0 + 3 * sc : br.end0 * 1.25 + 2 * sc);
    const e1 = br.loop ? 0 : Math.min(35 * sc, br.free1 ? br.end1 + 3 * sc : br.end1 * 1.25 + 2 * sc);
    const ext = polyline(br.loop ? br.pts : extendPts(br.pts, e0, e1));
    // smer stehov pri koncoch "zmrazíme": kostra sa pri uzloch ohýba a stehy by sa rozbiehali do vejára
    const f0 = br.loop ? 0 : e0 + br.end0 * 1.1, f1 = br.loop ? ext.L : ext.L - (e1 + br.end1 * 1.1);
    const tangent = d => {
      let dc = d;
      if (!br.loop) dc = f0 <= f1 ? Math.max(f0, Math.min(f1, d)) : (f0 + f1) / 2;
      const a = ext.at(dc - 8 * sc), b = ext.at(dc + 8 * sc);
      let tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty);
      if (!n) { const A = ext.at(0), Bp = ext.at(ext.L); tx = Bp[0] - A[0]; ty = Bp[1] - A[1]; n = Math.hypot(tx, ty) || 1; }
      return [tx / n, ty / n];
    };
    const cols = [];
    for (let d = 0; d <= ext.L - (br.loop ? sp * 0.5 : 0); d += sp) {
      const c = ext.at(d);
      if (!insideK(k, c[0], c[1])) continue;
      const [tx, ty] = tangent(d), nx = -ty, ny = tx;
      let d0 = 0, d1 = 0;
      const st = 0.25 * sc, lim = 45 * sc;
      while (d0 < lim && insideK(k, c[0] - nx * (d0 + st), c[1] - ny * (d0 + st))) d0 += st;
      while (d1 < lim && insideK(k, c[0] + nx * (d1 + st), c[1] + ny * (d1 + st))) d1 += st;
      if (d0 + d1 < 2.5 * sc) continue;
      cols.push({ a: [c[0] - nx * d0, c[1] - ny * d0], b: [c[0] + nx * d1, c[1] + ny * d1], n: [nx, ny], w: d0 + d1 });
    }
    // príliš dlhé stĺpce (artefakty v spojoch) vynecháme, pokryje ich doplnková výplň
    if (cols.length > 4) {
      const ws = cols.map(c => c.w).sort((x, y) => x - y), med = ws[ws.length >> 1];
      for (let j = cols.length - 1; j >= 0; j--) if (cols[j].w > 2.5 * med + 4 * sc) cols.splice(j, 1);
    }
    const r = Math.max(sc, sp * 0.75);
    cols.forEach((c, j) => { mark(c.a, c.b, r); if (j) mark(cols[j - 1].b, c.a, r); });
    // stredová os (podklad / presun), len vo vlastnej oblasti
    const center = [];
    if (core.L > 6 * sc) {
      for (let d = 3 * sc; d < core.L - 3 * sc; d += 20 * sc) center.push(core.at(d));
      center.push(core.at(core.L - 3 * sc));
    }
    const cen = center.filter(q => { const i = idx(q[0], q[1]); return i >= 0 && ob.mask[i] && reg[i] === k && ob.dt[i] > sc; });
    return { cols, cen, br };
  });

  if (E.debug) E._dbg = { branches, data, sc };
  // ---- doplnková výplň nepokrytých miest (špičky V, A, M, ostré rohy) ----
  const patches = [];
  {
    const seen = new Uint8Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (!ob.mask[s] || cov[s] || seen[s]) continue;
      const pix = [], q = [s]; seen[s] = 1;
      while (q.length) {
        const i = q.pop(); pix.push(i);
        const x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
          if (j >= 0 && j < w * h && ob.mask[j] && !cov[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
      if (pix.length < 25 * sc * sc) continue;              // < 0,25 mm² zakryje kompenzácia ťahu
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (const i of pix) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      x0 = Math.max(0, x0 - 2 * sc); y0 = Math.max(0, y0 - 2 * sc); x1 = Math.min(w - 1, x1 + 2 * sc); y1 = Math.min(h - 1, y1 + 2 * sc);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mk = new Uint8Array(bw * bh);
      for (const i of pix) { const x = i % w, y = (i / w) | 0; mk[(y - y0) * bw + x - x0] = 1; }
      // o 1 px rozšíriť (v rámci tvaru), aby výplň presahovala pod satin
      const mk2 = mk.slice();
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        if (mk[y * bw + x]) continue;
        const gi = (y + y0) * w + x + x0;
        if (!ob.mask[gi]) continue;
        if ((x > 0 && mk[y * bw + x - 1]) || (x < bw - 1 && mk[y * bw + x + 1]) || (y > 0 && mk[(y - 1) * bw + x]) || (y < bh - 1 && mk[(y + 1) * bw + x])) mk2[y * bw + x] = 1;
      }
      const sub = E.makeObject(mk2, bw, bh, x0, y0, ob.label);
      // smer výplne podľa susedného satinu (riadky rovnobežne so stehmi stĺpca), aby záplata nadväzovala
      let angle = 45;
      {
        const cnt = new Map();
        for (const i of pix) if (reg[i] >= 0) cnt.set(reg[i], (cnt.get(reg[i]) || 0) + 1);
        let bk = -1, bc = 0; for (const [k, v] of cnt) if (v > bc) { bc = v; bk = k; }
        if (bk >= 0 && data[bk].cols.length) {
          let cx = 0, cy = 0; for (const i of pix) { cx += i % w; cy += (i / w) | 0; } cx /= pix.length; cy /= pix.length;
          let best = null, bd = Infinity;
          for (const c of data[bk].cols) { const m = [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2], d = dist(m, [cx, cy]); if (d < bd) { bd = d; best = c; } }
          if (best) angle = Math.atan2(best.n[1], best.n[0]) * 180 / Math.PI;
        }
      }
      const runs = fillObject(sub, { spacing: sp / R, stitchLen: Math.min(2.5, p.stitchLen || 2.5) * sc, pullComp: 0.1 * sc, underlay: false, angle, pattern: 'tatami' }, [0, 0])
        .map(r => { const q = r.map(toG); q.tag = 'p'; return q; });
      patches.push(...runs.filter(r => r.length > 1));
    }
  }

  // ---- výstupné behy jednej vetvy: OUT (podklad X→Y) a BACK (satin Y→X) ----
  const inset = (a, b, frac) => {
    const wd = dist(a, b), ins = Math.min(3.5 * sc, wd * frac), ux = (b[0] - a[0]) / (wd || 1), uy = (b[1] - a[1]) / (wd || 1);
    return [[a[0] + ux * ins, a[1] + uy * ins], [b[0] - ux * ins, b[1] - uy * ins]];
  };
  const split = (p.splitLen || 0) * R * sc;
  function OUT(k, fwd) {
    const D = data[k];
    const cols = fwd ? D.cols : D.cols.slice().reverse();
    const cen = fwd ? D.cen : D.cen.slice().reverse();
    const every = Math.max(1, Math.round(20 * sc / sp));
    const sub = cols.filter((_, j) => j % every === 0 || j === cols.length - 1);
    const L = sub.map(c => inset(c.a, c.b, 0.25)[0]), Rr = sub.map(c => inset(c.a, c.b, 0.25)[1]);
    const zig = sub.map((c, j) => inset(c.a, c.b, 0.2)[j % 2]);
    const centerOrLeft = cen.length > 1 ? cen : L;
    let pts;
    if (ut === 'edge') pts = L.concat(Rr.slice().reverse(), centerOrLeft);
    else if (ut === 'edge+zigzag') pts = L.concat(Rr.slice().reverse(), zig);
    else if (ut === 'zigzag') pts = zig.length > 1 ? zig : centerOrLeft;
    else if (ut === 'none') { pts = []; for (let j = 0; j < centerOrLeft.length; j += 2) pts.push(centerOrLeft[j]); if (centerOrLeft.length) pts.push(centerOrLeft[centerOrLeft.length - 1]); }
    else pts = centerOrLeft;
    return pts.map(toG);
  }
  function BACK(k, fwd) {
    const D = data[k];
    const cols = fwd ? D.cols.slice().reverse() : D.cols;
    const sat = [];
    cols.forEach((c, j) => {
      const pa = [c.a[0] - c.n[0] * pc, c.a[1] - c.n[1] * pc], pb = [c.b[0] + c.n[0] * pc, c.b[1] + c.n[1] * pc];
      const pair = [toG(pa), toG(pb)];
      const splitG = split / sc;
      for (let t = 0; t < 2; t++) {
        const q = pair[t], prev = t === 0 ? (sat.length ? sat[sat.length - 1] : null) : pair[0];
        if (prev && splitG > 0 && dist(prev, q) > splitG) {
          const n = Math.ceil(dist(prev, q) / splitG);
          for (let m = 1; m < n; m++) { const f = (m + (j % 2 ? 0.25 : -0.25)) / n; sat.push([prev[0] + (q[0] - prev[0]) * f, prev[1] + (q[1] - prev[1]) * f]); }
        }
        sat.push(q);
      }
    });
    return sat;
  }

  // ---- poradie: prechod stromom vetiev (podklad tam, satin späť) => presuny vedú pod nešitými časťami ----
  const adj = new Map();
  const addA = (n, k) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(k); };
  branches.forEach((b, k) => { addA(b.n0, k); if (b.n1 !== b.n0) addA(b.n1, k); });
  const nodePos = new Map();
  branches.forEach(b => {
    if (!nodePos.has(b.n0)) nodePos.set(b.n0, b.pts[0]);
    if (!nodePos.has(b.n1)) nodePos.set(b.n1, b.pts[b.pts.length - 1]);
  });
  const used = new Uint8Array(branches.length), seenN = new Set();
  const out = patches.slice();
  let cur = out.length ? out[out.length - 1][out[out.length - 1].length - 1] : start;
  const visit = X => {
    seenN.add(X);
    for (;;) {
      const cand = (adj.get(X) || []).filter(k => !used[k] && data[k].cols.length >= 2);
      if (!cand.length) break;
      // najprv vetvy vedúce do ešte nenavštívených uzlov (strom), slučky nakoniec
      cand.sort((a, b) => {
        const ya = branches[a].n0 === X ? branches[a].n1 : branches[a].n0, yb = branches[b].n0 === X ? branches[b].n1 : branches[b].n0;
        return (seenN.has(ya) ? 1 : 0) - (seenN.has(yb) ? 1 : 0);
      });
      const k = cand[0]; used[k] = 1;
      const fwd = branches[k].n0 === X;
      const Y = fwd ? branches[k].n1 : branches[k].n0;
      const o_ = OUT(k, fwd); o_.tag = 'u'; out.push(o_);
      if (!seenN.has(Y)) visit(Y);
      const b_ = BACK(k, fwd); b_.tag = 's'; out.push(b_);
    }
  };
  for (;;) {
    let bestN = null, bd = Infinity;
    for (const [n, ks] of adj) {
      if (!ks.some(k => !used[k] && data[k].cols.length >= 2)) continue;
      const q = toG(nodePos.get(n)), dd = dist(q, cur);
      if (dd < bd) { bd = dd; bestN = n; }
    }
    if (bestN === null) break;
    visit(bestN);
    const last = out[out.length - 1]; if (last && last.length) cur = last[last.length - 1];
  }
  return out.filter(r => r.length > 0);
}

function runningObject(ob, p, start) {
  // obrys (Moore tracing) vonkajšej hranice, steh každých runLength
  const w = ob.bw, h = ob.bh, m = ob.mask;
  let s = -1;
  for (let i = 0; i < w * h; i++) if (m[i]) { s = i; break; }
  if (s < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  let x = s % w, y = (s / w) | 0, dir = 7;
  const pts = [[x + 0.5, y + 0.5]];
  for (let guard = 0; guard < 4 * w * h; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = x + dirs[d][0], ny = y + dirs[d][1];
      if (at(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; }
    }
    if (!found) break;
    if (x === s % w && y === ((s / w) | 0) && pts.length > 2) break;
    pts.push([x + 0.5, y + 0.5]);
  }
  pts.push(pts[0]);
  const sm = simplify(pts, 0.7);
  const pl = polyline(sm);
  const out = [];
  const step = p.stitchLen * R;
  for (let d = 0; d < pl.L; d += step) out.push(pl.at(d));
  out.push(pl.at(pl.L));
  let run = out.map(q => [ob.ox + q[0], ob.oy + q[1]]);
  if (p.passes === 3) run = run.concat(run.slice().reverse().slice(1), run.slice(1));
  return [run];
}

E.objectParams = function (ob, ov, globalOpts) {
  const g = Object.assign({}, E.defaults, globalOpts || {});
  const type = (ov && ov.type) || ob.autoType;
  const base = {
    type,
    angle: ob.label % 2 ? -45 : 45,
    spacing: type === 'satin' ? g.satinSpacing : g.fillSpacing,
    stitchLen: type === 'running' ? g.runLength : g.fillStitch,
    pullComp: g.pullComp,
    underlay: g.underlay,
    underlayType: type === 'satin' ? 'center' : 'fill',
    pattern: g.pattern || 'tatami',
    splitLen: type === 'satin' ? (g.splitLen ?? 7) : 0,
    passes: 1,
  };
  if (ov) for (const k of Object.keys(ov)) if (ov[k] !== undefined && k !== 'type') base[k] = ov[k];
  if (ov && ov.type && ov.type !== ob.autoType && ov.spacing === undefined)
    base.spacing = type === 'satin' ? g.satinSpacing : g.fillSpacing;
  if (ov && ov.type && ov.stitchLen === undefined) base.stitchLen = type === 'running' ? g.runLength : g.fillStitch;
  // typ podkladu musí patriť k typu stehu
  const okU = type === 'satin' ? ['center', 'edge', 'zigzag', 'edge+zigzag'] : ['fill', 'edge', 'edge+fill'];
  if (!okU.includes(base.underlayType)) base.underlayType = type === 'satin' ? 'center' : 'fill';
  if (type === 'satin' && base.splitLen === 0 && !(ov && ov.splitLen === 0)) base.splitLen = g.splitLen ?? 7;
  return base;
};

// objekt z ľubovoľnej masky (text, lem)
E.makeObject = function (mask, bw, bh, ox, oy, label, extra) {
  const o = Object.assign({}, E.defaults, extra && extra.opts || {});
  const dt = distanceTransform(mask, bw, bh);
  let area = 0, core = 0, maxdt = 0, sx = 0, sy = 0;
  const half = o.satinMaxWidth / 2 * R;
  for (let i = 0; i < bw * bh; i++) if (mask[i]) {
    area++; if (dt[i] > half) core++; if (dt[i] > maxdt) maxdt = dt[i];
    sx += i % bw; sy += (i / bw) | 0;
  }
  const blob = 2 * maxdt > 0.7 * Math.sqrt(area);
  const thin = core < 0.08 * area && !blob;
  return Object.assign({
    id: -1, label, area, seed: -1, ox, oy, bw, bh, mask, own: mask, dt,
    autoType: thin ? 'satin' : 'fill', maxWidthMM: 2 * maxdt / R,
    cx: ox + sx / Math.max(1, area), cy: oy + sy / Math.max(1, area),
  }, extra || {});
};

// lem: prstenec okolo viditeľného tvaru (polovica šírky von, polovica dnu => prekryje okraj)
E.borderObject = function (src, widthMM, label, opts) {
  const half = widthMM / 2 * R;
  const pad = Math.ceil(half) + 3;
  const bw = src.bw + 2 * pad, bh = src.bh + 2 * pad;
  const m = new Uint8Array(bw * bh);
  for (let y = 0; y < src.bh; y++) for (let x = 0; x < src.bw; x++) if (src.own[y * src.bw + x]) m[(y + pad) * bw + x + pad] = 1;
  const din = distanceTransform(m, bw, bh);
  const inv = m.map(v => 1 - v);
  const dout = distanceTransform(inv, bw, bh, false);
  const ring = new Uint8Array(bw * bh);
  for (let i = 0; i < bw * bh; i++) ring[i] = (m[i] && din[i] <= half) || (!m[i] && dout[i] <= half) ? 1 : 0;
  return E.makeObject(ring, bw, bh, src.ox - pad, src.oy - pad, label, { isBorder: true, opts });
};

E._skel = skeletonPaths;
E.stitchObject = function (ob, params, start) {
  if (params.type === 'satin') {
    const r = satinObject(ob, params, start);
    const n = r.reduce((a, x) => a + x.length, 0);
    // drobná bodka bez stredovej osi -> výplň
    if (n >= 6) return r;
    return fillObject(ob, Object.assign({}, params, { spacing: E.defaults.fillSpacing, stitchLen: E.defaults.fillStitch, underlay: false }), start);
  }
  if (params.type === 'running') return runningObject(ob, params, start);
  return fillObject(ob, params, start);
};

/* ---------------- 5. zostavenie programu ---------------- */
// cmd: {t:'s'|'j'|'trim'|'cc', x, y, c (index nite), o (id objektu)}
E.assemble = function (order, stitchesFor, threadOf, opts) {
  const g = Object.assign({}, E.defaults, opts || {});
  const cmds = [];
  let cur = null, curThread = null, curObj = null;
  const trimPx = g.trimDist * R;
  const lockAt = (p, q) => {
    // uzlík: 2 drobné stehy tam a späť
    const vx = q[0] - p[0], vy = q[1] - p[1], n = Math.hypot(vx, vy) || 1;
    const a = [p[0] + vx / n * 2, p[1] + vy / n * 2];
    return [a, p];
  };
  let prevS = null, lastS = null;
  let curTag = null;
  const pushS = (p, th, o) => { const c = { t: 's', x: p[0], y: p[1], c: th, o, k: curTag }; cmds.push(c); prevS = lastS; lastS = c; };
  const trim = (th) => {
    if (!cur) return;
    // ukončovací uzlík
    if (prevS && lastS) { const b = [prevS.x, prevS.y]; const o = lastS.o; for (const q of lockAt(cur, b)) pushS(q, th, o); }
    cmds.push({ t: 'trim', x: cur[0], y: cur[1], c: th });
  };
  for (const ob of order) {
    const th = threadOf(ob);
    if (th === null) continue;
    const runs = stitchesFor(ob, cur || [ob.ox, ob.oy]);
    if (!runs.length) continue;
    if (curThread !== null && th !== curThread) {
      trim(curThread);
      cmds.push({ t: 'cc', x: cur[0], y: cur[1], c: th });
      cur = null;
    }
    curThread = th;
    for (const run of runs) {
      if (run.length < 2) continue;
      curTag = 'tr';
      const p0 = run[0];
      let needJump = !cur;
      let travel = false;
      if (cur) {
        const gap = dist(cur, p0);
        // v rámci jedného tvaru sa presunieme krátkymi stehmi (prekryje ich ďalšia výplň), inak strih
        const limit = curObj === ob.id ? 2 * trimPx : trimPx;
        if (gap > limit) needJump = true;
        else if (gap > 0.5) {
          // priamy prechod len ak vedie vnútri tvaru
          if (crossesGap(ob, cur[0] - ob.ox, cur[1] - ob.oy, p0[0] - ob.ox, p0[1] - ob.oy, i => ob.mask[i] === 1)) needJump = true;
          else travel = gap > 25;
        }
      }
      if (!needJump && travel) {
        const n = Math.ceil(dist(cur, p0) / 25);
        for (let k = 1; k < n; k++) pushS([cur[0] + (p0[0] - cur[0]) * k / n, cur[1] + (p0[1] - cur[1]) * k / n], th, ob.id);
      }
      if (needJump) {
        if (cur) trim(th);
        cmds.push({ t: 'j', x: p0[0], y: p0[1], c: th });
        pushS(p0, th, ob.id);
        for (const q of lockAt(p0, run[1])) pushS(q, th, ob.id);
      }
      const inObj = i => ob.mask[i] === 1;
      curTag = run.tag || 'r';
      for (let k = 0; k < run.length; k++) {
        const p = run[k];
        // poistka: steh cez medzeru (napr. v rohu písmena) -> strih a skok namiesto viditeľnej nite
        if (k > 0 && cur && dist(cur, p) > 10 && crossesGap(ob, cur[0] - ob.ox, cur[1] - ob.oy, p[0] - ob.ox, p[1] - ob.oy, inObj)) {
          trim(th);
          cmds.push({ t: 'j', x: p[0], y: p[1], c: th });
          pushS(p, th, ob.id);
          if (run[k + 1]) for (const q of lockAt(p, run[k + 1])) pushS(q, th, ob.id);
        } else pushS(p, th, ob.id);
        cur = p;
      }
      cur = run[run.length - 1];
      curObj = ob.id;
    }
  }
  if (cur) trim(curThread);
  return cmds;
};

E.stats = function (cmds, threads, speed, trimSec = 2.5, ccSec = 4) {
  let st = 0, trims = 0, cc = 0, jumps = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const per = new Map();
  let prev = null;
  for (const c of cmds) {
    if (c.t === 's') {
      st++;
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
      const e = per.get(c.c) || { stitches: 0, len: 0 };
      e.stitches++;
      if (prev && prev.t === 's') e.len += Math.hypot(c.x - prev.x, c.y - prev.y);
      per.set(c.c, e);
    } else if (c.t === 'trim') trims++;
    else if (c.t === 'cc') cc++;
    else if (c.t === 'j') jumps++;
    prev = c;
  }
  const minutes = st / speed + (trims * trimSec + cc * ccSec) / 60;
  const perColor = [...per.entries()].map(([c, e]) => ({
    thread: c, stitches: e.stitches,
    meters: (e.len / R / 1000) * 1.1 + e.stitches * 0.0004,
  }));
  return {
    stitches: st, trims, colorChanges: cc, jumps, minutes,
    widthMM: st ? (x1 - x0) / R : 0, heightMM: st ? (y1 - y0) / R : 0,
    perColor,
  };
};

// stehy, ktoré vedú mimo svojho objektu (na výšivke by boli viditeľné)
E.badStitches = function (cmds, objById) {
  const bad = [];
  let prev = null;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c.t === 's') {
      if (prev && prev.t === 's' && prev.o === c.o) {
        const ob = objById(c.o);
        const L = Math.hypot(c.x - prev.x, c.y - prev.y);
        if (ob && L > 4) {
          const n = Math.ceil(L);
          let out = 0, run = 0;
          for (let k = 2; k < n - 1; k++) {
            const x = prev.x + (c.x - prev.x) * k / n, y = prev.y + (c.y - prev.y) * k / n;
            if (!inMask(ob, x, y) && !inMask(ob, x + 1, y) && !inMask(ob, x - 1, y) && !inMask(ob, x, y + 1) && !inMask(ob, x, y - 1)) { run++; out = Math.max(out, run); }
            else run = 0;
          }
          if (out >= 3) bad.push({ i, x0: prev.x, y0: prev.y, x1: c.x, y1: c.y, o: c.o, len: L / R });
        }
      }
      prev = c;
    } else prev = (c.t === 'j') ? c : null;
  }
  return bad;
};

/* ---------------- 6. DST ---------------- */
function dstRecord(dx, dy, flags) {
  let b0 = 0, b1 = 0, b2 = 0x03;
  let x = dx, y = -dy; // DST: +y hore
  if (x > 40) { b2 |= 0x04; x -= 81; } if (x < -40) { b2 |= 0x08; x += 81; }
  if (x > 13) { b1 |= 0x04; x -= 27; } if (x < -13) { b1 |= 0x08; x += 27; }
  if (x > 4) { b0 |= 0x04; x -= 9; } if (x < -4) { b0 |= 0x08; x += 9; }
  if (x > 1) { b1 |= 0x01; x -= 3; } if (x < -1) { b1 |= 0x02; x += 3; }
  if (x > 0) { b0 |= 0x01; x -= 1; } if (x < 0) { b0 |= 0x02; x += 1; }
  if (y > 40) { b2 |= 0x20; y -= 81; } if (y < -40) { b2 |= 0x10; y += 81; }
  if (y > 13) { b1 |= 0x20; y -= 27; } if (y < -13) { b1 |= 0x10; y += 27; }
  if (y > 4) { b0 |= 0x20; y -= 9; } if (y < -4) { b0 |= 0x10; y += 9; }
  if (y > 1) { b1 |= 0x80; y -= 3; } if (y < -1) { b1 |= 0x40; y += 3; }
  if (y > 0) { b0 |= 0x80; y -= 1; } if (y < 0) { b0 |= 0x40; y += 1; }
  return [b0, b1, b2 | flags];
}

E.writeDST = function (cmds, name = 'DESIGN') {
  const recs = [];
  const st = cmds.filter(c => c.t === 's');
  if (!st.length) return new Uint8Array(512);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of st) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
  let px = 0, py = 0;
  let mnx = 0, mxx = 0, mny = 0, mxy = 0;
  const move = (tx, ty, flags) => {
    // rozdelenie dlhých presunov na kroky <= 121
    let dx = tx - px, dy = ty - py;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 121));
    let ax = px, ay = py;
    for (let k = 1; k <= n; k++) {
      const nx = Math.round(px + dx * k / n), ny = Math.round(py + dy * k / n);
      recs.push(dstRecord(nx - ax, ny - ay, flags));
      ax = nx; ay = ny;
    }
    px = ax; py = ay;
    mnx = Math.min(mnx, px); mxx = Math.max(mxx, px); mny = Math.min(mny, py); mxy = Math.max(mxy, py);
  };
  let colors = 0;
  for (const c of cmds) {
    const tx = Math.round(c.x) - cx, ty = Math.round(c.y) - cy;
    if (c.t === 's') move(tx, ty, 0);
    else if (c.t === 'j') move(tx, ty, 0x80);
    else if (c.t === 'trim') { recs.push(dstRecord(2, 2, 0x80), dstRecord(-4, -4, 0x80), dstRecord(2, 2, 0x80)); }
    else if (c.t === 'cc') { recs.push([0, 0, 0xC3]); colors++; }
  }
  recs.push([0, 0, 0xF3]);
  const hdr = new Uint8Array(512).fill(0x20);
  const pad = (v, n) => String(v).padStart(n, ' ');
  const sgn = v => (v >= 0 ? '+' : '-') + pad(Math.abs(v), 5);
  const txt = 'LA:' + name.slice(0, 16).padEnd(16, ' ') + '\r' +
    'ST:' + pad(recs.length, 7) + '\r' + 'CO:' + pad(colors, 3) + '\r' +
    '+X:' + pad(mxx, 5) + '\r' + '-X:' + pad(-mnx, 5) + '\r' +
    '+Y:' + pad(-mny, 5) + '\r' + '-Y:' + pad(mxy, 5) + '\r' +
    'AX:' + sgn(px) + '\r' + 'AY:' + sgn(-py) + '\r' +
    'MX:+    0\r' + 'MY:+    0\r' + 'PD:******\r';
  for (let i = 0; i < txt.length; i++) hdr[i] = txt.charCodeAt(i);
  hdr[txt.length] = 0x1A;
  const out = new Uint8Array(512 + recs.length * 3);
  out.set(hdr, 0);
  recs.forEach((r, i) => out.set(r, 512 + i * 3));
  return out;
};

if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.StitchEngine = E;
})(this);
