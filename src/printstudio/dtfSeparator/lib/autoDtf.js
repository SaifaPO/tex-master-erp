// Rezim "Auto priprava na DTF" — jedno kliknutie: (1) odstrani pozadie (alebo pouzije existujuce priehladne pozadie),
// (2) plne farebne plochy nechá PLNÉ (bez bodiek), (3) všetky mäkké prechody priehľadnosti — žiara, tieň, glow, vyblednutie
// do stratena — prevedie na halftone bodky (DTF netlačí polopriehľadné pixely pekne, biely podklad pod nimi robí "hmlu").
// Tenké antialiasingové okraje (1–2 px) sa nerastrujú — ostanú hladké; rastruje sa len široký mäkký pás.
import { renderHalftoneFromCoverage } from './halftone.js';
import { computeForegroundMask } from './dtgFullColor.js';
import { applyChoke, renderWhiteUnderbase } from './separation.js';

// Box blur (separabilny, priemer v okne) na Float32Array — pouziva sa pri "prepocitat existujuci raster"
function boxBlur(src, width, height, radius) {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    let sum = 0, cnt = 0;
    const row = y * width;
    for (let x = 0; x <= Math.min(r, width - 1); x++) { sum += src[row + x]; cnt++; }
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / cnt;
      const addX = x + r + 1, subX = x - r;
      if (addX < width) { sum += src[row + addX]; cnt++; }
      if (subX >= 0) { sum -= src[row + subX]; cnt--; }
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0, cnt = 0;
    for (let y = 0; y <= Math.min(r, height - 1); y++) { sum += tmp[y * width + x]; cnt++; }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / cnt;
      const addY = y + r + 1, subY = y - r;
      if (addY < height) { sum += tmp[addY * width + x]; cnt++; }
      if (subY >= 0) { sum -= tmp[subY * width + x]; cnt--; }
    }
  }
  return out;
}

// Erozia binarnej masky o r px (obdlzniky), okraj obrazka sa berie ako "plno" — aby sa zhluk pri okraji neorezal
function erodeBinary(mask, width, height, r) {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let zeros = 0;
    for (let x = 0; x <= Math.min(r, width - 1); x++) if (!mask[row + x]) zeros++;
    for (let x = 0; x < width; x++) {
      tmp[row + x] = zeros === 0 ? 1 : 0;
      const addX = x + r + 1, subX = x - r;
      if (addX < width && !mask[row + addX]) zeros++;
      if (subX >= 0 && !mask[row + subX]) zeros--;
    }
  }
  for (let x = 0; x < width; x++) {
    let zeros = 0;
    for (let y = 0; y <= Math.min(r, height - 1); y++) if (!tmp[y * width + x]) zeros++;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = zeros === 0 ? 1 : 0;
      const addY = y + r + 1, subY = y - r;
      if (addY < height && !tmp[addY * width + x]) zeros++;
      if (subY >= 0 && !tmp[subY * width + x]) zeros--;
    }
  }
  return out;
}

export function renderAutoDtf(sourceCanvas, params) {
  const { width, height } = sourceCanvas;
  const n = width * height;
  const imageData = sourceCanvas.getContext('2d').getImageData(0, 0, width, height);
  const { data } = imageData;

  // 1) priehladnost: existujuce alfa, alebo odhad pozadia z rohov (ak obrazok nema priehladnost)
  const alpha = new Float32Array(n);
  let semi = 0;
  for (let i = 3, p = 0; p < n; i += 4, p++) { alpha[p] = data[i] / 255; if (data[i] < 250) semi++; }
  const hasTransparency = semi / n > 0.01;
  let backgroundMode = 'ponechané (obrázok je priehľadný)';
  if (!hasTransparency && params.autoBackground) {
    const mask = computeForegroundMask(imageData, { enabled: true, tolerance: params.tolerance, feather: params.feather });
    for (let p = 0; p < n; p++) alpha[p] *= mask[p];
    backgroundMode = 'odstránené podľa farby rohov';
  } else if (!hasTransparency) {
    backgroundMode = 'bez zmeny (odstránenie vypnuté)';
  }

  const cellSize = Math.max(2, Math.round(params.outputDpi / params.lpi));
  // 2) volitelne: prepocitat uz existujuci raster (jemne rozmazanie priehladnosti, potom sa rastruje nanovo)
  let a = alpha;
  if (params.descreen) a = boxBlur(alpha, width, height, cellSize * 0.8);

  // 3) plna farba vs. mäkký prechod
  const lo = 0.03;
  const hi = Math.min(0.995, Math.max(0.5, params.solidThreshold ?? 0.97));
  const soft = new Uint8Array(n);
  let solidCount = 0, softCount = 0, clearCount = 0;
  for (let p = 0; p < n; p++) {
    if (a[p] >= hi) solidCount++;
    else if (a[p] > lo) { soft[p] = 1; softCount++; } else clearCount++;
  }
  // siroky mäkký pás = pixely, ktore su "hlboko" v mäkkej zone (nie tenky antialiasing okraj)
  const edgeR = Math.max(1, Math.round(cellSize * 0.6));
  const softCore = erodeBinary(soft, width, height, edgeR);

  // pokrytie pre bodky: mäkké pixely = ich priehladnost, plne pixely = 1 (aby bodky pri okraji plnej plochy rástli plynule)
  const coverage = new Float32Array(n);
  for (let p = 0; p < n; p++) coverage[p] = a[p] >= hi ? 1 : (a[p] > lo ? a[p] : 0);
  const stencil = renderHalftoneFromCoverage(coverage, width, height, {
    lpi: params.lpi, outputDpi: params.outputDpi, angleDeg: params.angleDeg, dotShape: params.dotShape, algorithm: params.algorithm,
    inkColor: '#000000', background: null
  });
  const stData = stencil.getContext('2d').getImageData(0, 0, width, height).data;

  // 4) výsledok: farba z originalu, alfa = plná / bodky (v hlbokej mäkkej zone) / pôvodný jemný okraj (tenký antialiasing)
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const octx = out.getContext('2d');
  const outImg = octx.createImageData(width, height);
  const o = outImg.data;
  const finalAlpha = new Float32Array(n);
  let dotted = 0;
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let al;
    if (a[p] >= hi) al = 1;
    else if (a[p] <= lo) al = 0;
    else if (softCore[p]) { al = stData[i + 3] / 255; dotted++; }
    else al = a[p] > 0.5 ? a[p] : 0; // tenký okraj: antialiasing nad 50 % ostane, slabý lem (ktorý by v bielom podklade tvoril obrys) sa zahodí
    finalAlpha[p] = al;
    o[i] = data[i]; o[i + 1] = data[i + 1]; o[i + 2] = data[i + 2];
    o[i + 3] = Math.round(al * 255);
  }
  octx.putImageData(outImg, 0, 0);

  // 5) biely podklad = tvar vysledku (bodky + plne plochy), s choke
  let white = null;
  if (params.whiteBase?.enabled) {
    const choked = applyChoke(finalAlpha, width, height, params.whiteBase.chokePx ?? 1, params.whiteBase.threshold ?? 0.04);
    white = renderWhiteUnderbase(choked, width, height);
  }

  const pct = (v) => Math.round((v / n) * 1000) / 10;
  return {
    composite: out, white, dotStencil: stencil,
    stats: { plnaFarbaPct: pct(solidCount), prechodyPct: pct(dotted), priehladnePct: pct(clearCount), pozadie: backgroundMode }
  };
}
