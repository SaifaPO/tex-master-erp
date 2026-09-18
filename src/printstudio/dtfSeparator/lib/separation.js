// Viacfarebna (CMYK / simulovany proces) separacia + biely podklad (underbase) s choke.
import { renderHalftoneFromCoverage } from './halftone.js';

// Standardne uhly rastra pre 4 kanaly (ofsetova konvencia) — minimalizuju moire pri prekryti.
export const DEFAULT_CHANNEL_ANGLES = { c: 15, m: 75, y: 0, k: 45 };
export const CHANNEL_INK_COLORS = { c: '#00AEEF', m: '#EC008C', y: '#FFF200', k: '#000000' };
export const CHANNEL_LABELS = { c: 'Azúrová (C)', m: 'Purpurová (M)', y: 'Žltá (Y)', k: 'Čierna (K)' };

// Rozlozi ImageData na 4 kryti mriezky C/M/Y/K (0..1 kazda), naivnou GCR konverziou.
export function computeCmykGrids(imageData, { blackPoint = 0, whitePoint = 255 } = {}) {
  const { data, width, height } = imageData;
  const n = width * height;
  const c = new Float32Array(n), m = new Float32Array(n), y = new Float32Array(n), k = new Float32Array(n);
  const range = Math.max(1, whitePoint - blackPoint);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const levels = (v) => Math.min(1, Math.max(0, (v - blackPoint) / range));
    const r = levels(data[i]), g = levels(data[i + 1]), b = levels(data[i + 2]);
    const alpha = data[i + 3] / 255;
    const kk = 1 - Math.max(r, g, b);
    const denom = 1 - kk || 1e-6;
    c[p] = kk >= 1 ? 0 : ((1 - r - kk) / denom) * alpha;
    m[p] = kk >= 1 ? 0 : ((1 - g - kk) / denom) * alpha;
    y[p] = kk >= 1 ? 0 : ((1 - b - kk) / denom) * alpha;
    k[p] = kk * alpha;
  }
  return { c, m, y, k, width, height };
}

// Zjednotene "je tu atrament" pokrytie (pravdepodobnostna unia kanalov) — zaklad pre biely podklad.
export function computeInkPresence(grids) {
  const { c, m, y, k, width, height } = grids;
  const presence = new Float32Array(width * height);
  for (let p = 0; p < presence.length; p++) {
    presence[p] = 1 - (1 - c[p]) * (1 - m[p]) * (1 - y[p]) * (1 - k[p]);
  }
  return presence;
}

// Choke (zmensenie o N px) pomocou jednoducheho box-min filtra (erozia) na binarnej maske.
export function applyChoke(presence, width, height, chokePx, threshold = 0.04) {
  if (chokePx <= 0) {
    const out = new Float32Array(presence.length);
    for (let p = 0; p < out.length; p++) out[p] = presence[p] > threshold ? 1 : 0;
    return out;
  }
  const binary = new Uint8Array(presence.length);
  for (let p = 0; p < presence.length; p++) binary[p] = presence[p] > threshold ? 1 : 0;
  const out = new Float32Array(presence.length);
  const r = Math.round(chokePx);
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      let on = binary[yy * width + xx];
      if (on) {
        outer:
        for (let dy = -r; dy <= r; dy++) {
          const ny = yy + dy;
          if (ny < 0 || ny >= height) { on = 0; break; }
          for (let dx = -r; dx <= r; dx++) {
            const nx = xx + dx;
            if (nx < 0 || nx >= width || !binary[ny * width + nx]) { on = 0; break outer; }
          }
        }
      }
      out[yy * width + xx] = on;
    }
  }
  return out;
}

// Vykresli bielu podkladovu vrstvu (solidna maska, bez halftonu — beznejsie pre underbase pri DTF/DTG).
export function renderWhiteUnderbase(presence, width, height) {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let p = 0; p < presence.length; p++) {
    const v = presence[p];
    imgData.data[p * 4] = 255;
    imgData.data[p * 4 + 1] = 255;
    imgData.data[p * 4 + 2] = 255;
    imgData.data[p * 4 + 3] = Math.round(v * 255);
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

// Vykresli halftone pre kazdy zo 4 kanalov (vlastny uhol, spolocne LPI/tvar/algoritmus) + volitelnu bielu podkladovu vrstvu.
export function renderSeparation(sourceCanvas, { lpi, outputDpi, dotShape, algorithm, blackPoint, whitePoint, channelAngles, whiteBase }) {
  const { width, height } = sourceCanvas;
  const srcCtx = sourceCanvas.getContext('2d');
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const grids = computeCmykGrids(imageData, { blackPoint, whitePoint });

  const channels = {};
  for (const ch of ['c', 'm', 'y', 'k']) {
    channels[ch] = renderHalftoneFromCoverage(grids[ch], width, height, {
      lpi, outputDpi, dotShape, algorithm,
      angleDeg: channelAngles[ch],
      inkColor: CHANNEL_INK_COLORS[ch]
    });
  }

  let white = null;
  if (whiteBase?.enabled) {
    const presence = computeInkPresence(grids);
    const choked = applyChoke(presence, width, height, whiteBase.chokePx ?? 1, whiteBase.threshold ?? 0.04);
    white = renderWhiteUnderbase(choked, width, height);
  }

  // Kompozit (nahlad) — subtraktivne zlozenie vsetkych kanalov nad bielym/zvolenym pozadim.
  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const cctx = composite.getContext('2d');
  cctx.fillStyle = whiteBase?.previewBackground || '#ffffff';
  cctx.fillRect(0, 0, width, height);
  if (white) { cctx.drawImage(white, 0, 0); }
  cctx.globalCompositeOperation = 'multiply';
  cctx.drawImage(channels.c, 0, 0);
  cctx.drawImage(channels.m, 0, 0);
  cctx.drawImage(channels.y, 0, 0);
  cctx.drawImage(channels.k, 0, 0);
  cctx.globalCompositeOperation = 'source-over';

  return { channels, white, composite };
}
