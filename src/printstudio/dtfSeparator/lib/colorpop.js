// Rezim "ColorPop" — viacfarebny halftone (inspirovane pluginom ColorPop Halftones).
// Obrazok sa prevedie na tonalny rozsah 0..1 (svetle -> tmave) a ten sa namapuje na paletu 2-5 farieb.
// Paleta je zoradena od NAJSVETLEJSEJ po NAJTMAVSIU. Najsvetlejsia farba je plna podkladova plocha, kazda dalsia farba je
// vlastna halftone vrstva (bodky), ktora rastie s tmavsim tonom a prekryva predchadzajucu. Vysledok = plynuly viacfarebny raster.
// "Knock-out": najtmavsia farba sa miesto kreslenia VYMAZE (diery -> garment presvita), alebo sa vynecha svetla podkladova plocha.
// Vsetko cisto klientske (Canvas 2D), pouziva rovnake bodkovacie funkcie ako halftone.js.
import { renderHalftoneFromCoverage } from './halftone.js';
import { computeForegroundMask } from './dtgFullColor.js';
import { applyChoke, renderWhiteUnderbase } from './separation.js';

// Palety su od najsvetlejsej po najtmavsiu farbu.
export const COLORPOP_PALETTES = [
  { name: 'Západ slnka', colors: ['#ffe9a8', '#ff9a3c', '#e8366f', '#4a1d6b'] },
  { name: 'Oceán', colors: ['#e0f7fa', '#4dd0e1', '#1e88e5', '#0d1b4c'] },
  { name: 'Retro tričko', colors: ['#f4e4c1', '#e8a33d', '#c8472b', '#2b2b4a'] },
  { name: 'Neón', colors: ['#fff700', '#00f5ff', '#ff2bd6', '#2a0a4a'] },
  { name: 'Oheň', colors: ['#fff3b0', '#ff9e00', '#e63600', '#3a0a00'] },
  { name: 'Les', colors: ['#eaf5d3', '#9ccc65', '#2e7d32', '#0b2e1a'] },
  { name: 'Cukrík', colors: ['#fff0f6', '#ffb3d1', '#ff5fa2', '#7a1f5c'] },
  { name: 'Miami', colors: ['#fff6d6', '#2de2e6', '#ff3f8e', '#2b0f54'] },
  { name: 'Vaporwave', colors: ['#fdf2ff', '#7df9ff', '#ff71ce', '#3b1f6e'] },
  { name: 'Lava', colors: ['#fff1c9', '#ffc000', '#ff4500', '#2a0a0a'] },
  { name: 'Jeseň', colors: ['#f6e7c8', '#d9a441', '#a8481f', '#3b1d10'] },
  { name: 'Ľad', colors: ['#f4fbff', '#a6dcf5', '#4a90d9', '#12356b'] },
  { name: 'Pastel', colors: ['#fffaf0', '#ffd6e0', '#c3b1e1', '#7aa5d2'] },
  { name: 'Čerešňa', colors: ['#fff0f0', '#ff8a8a', '#d3122d', '#4a0710'] },
  { name: 'Hrozno', colors: ['#f7ecff', '#c08bff', '#7a2fd0', '#260a52'] },
  { name: 'Mäta', colors: ['#f0fff8', '#7fe8c0', '#17a589', '#0b3a39'] },
  { name: 'Zlato & čierna', colors: ['#fff3c2', '#ffc928', '#b8860b', '#111111'] },
  { name: 'Tyrkys & oranž', colors: ['#fff4dc', '#ff9248', '#14a3a8', '#0a2d3d'] },
  { name: 'Azúrová & purpurová', colors: ['#ffffff', '#00c8ff', '#ff2d95'] },
  { name: 'Mono modrá', colors: ['#e8f2ff', '#5aa0ff', '#0b3d91'] },
  { name: 'Mono červená', colors: ['#ffecec', '#ff5a5a', '#8a0a0a'] },
  { name: 'Mono zelená', colors: ['#ecffe8', '#59d45a', '#0a5a1a'] },
  { name: 'Mono fialová', colors: ['#f6eaff', '#b265ff', '#3d0a7a'] },
  { name: 'Mono oranžová', colors: ['#fff1e0', '#ff9a2e', '#8a3c00'] },
  { name: 'Sépia', colors: ['#f5ecd8', '#c49a62', '#4a2e14'] },
  { name: 'Čiernobiela', colors: ['#ffffff', '#000000'] },
  { name: 'Dvojfarba červená/modrá', colors: ['#ff3b3b', '#1b2cc1'] },
  { name: 'Dvojfarba žltá/čierna', colors: ['#ffd400', '#111111'] }
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hexToRgb = (hex) => {
  const h = String(hex || '#000000').replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
};

// params: { palette:[hex...] (svetla->tmava), knockout:'none'|'darkest'|'lightest', lpi, outputDpi, angleDeg, spreadAngles,
//           dotShape, algorithm, blackPoint, whitePoint, invert, backgroundRemoval, whiteBase }
export function renderColorPop(sourceCanvas, params) {
  const { width, height } = sourceCanvas;
  const colors = (params.palette && params.palette.length >= 2 ? params.palette : ['#ffffff', '#000000']).slice(0, 6);
  const n = colors.length;
  const knockout = params.knockout || 'none';
  const { blackPoint = 0, whitePoint = 255, invert = false } = params;

  const imageData = sourceCanvas.getContext('2d').getImageData(0, 0, width, height);
  const fg = computeForegroundMask(imageData, params.backgroundRemoval);
  const { data } = imageData;
  const range = Math.max(1, whitePoint - blackPoint);
  const count = width * height;
  const pos = new Float32Array(count);   // 0 = najsvetlejsia farba ... n-1 = najtmavsia
  const alpha = new Float32Array(count); // priehladnost zdroja * maska odstranenia pozadia
  for (let i = 0, p = 0; p < count; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = clamp01((lum - blackPoint) / range);
    pos[p] = (invert ? v : 1 - v) * (n - 1);
    alpha[p] = (data[i + 3] / 255) * fg[p];
  }

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');

  // 1) podkladova plocha najsvetlejsej farby (pri knock-oute svetlej sa vynecha -> svetle miesta su priehladne)
  if (knockout !== 'lightest') {
    const [r, g, b] = hexToRgb(colors[0]);
    const base = ctx.createImageData(width, height);
    for (let p = 0, i = 0; p < count; p++, i += 4) {
      base.data[i] = r; base.data[i + 1] = g; base.data[i + 2] = b;
      base.data[i + 3] = Math.round(alpha[p] * 255);
    }
    ctx.putImageData(base, 0, 0);
  }

  // 2) postupne halftone vrstvy dalsich farieb (k = 1..n-1), kazda s mierne inym uhlom pre menej moire
  for (let k = 1; k < n; k++) {
    const grid = new Float32Array(count);
    for (let p = 0; p < count; p++) grid[p] = clamp01(pos[p] - (k - 1)) * alpha[p];
    const angle = (params.angleDeg || 0) + (params.spreadAngles ? (k - 1) * 15 : 0);
    const layer = renderHalftoneFromCoverage(grid, width, height, { ...params, inkColor: colors[k], angleDeg: angle % 90, background: null });
    ctx.globalCompositeOperation = (knockout === 'darkest' && k === n - 1) ? 'destination-out' : 'source-over';
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';

  // 3) biely podklad podla viditelnej plochy vysledku (rovnako ako pri DTF/DTG rezime)
  let white = null;
  if (params.whiteBase?.enabled) {
    const od = ctx.getImageData(0, 0, width, height).data;
    const presence = new Float32Array(count);
    for (let p = 0, i = 3; p < count; p++, i += 4) presence[p] = od[i] / 255;
    const choked = applyChoke(presence, width, height, params.whiteBase.chokePx ?? 1, params.whiteBase.threshold ?? 0.04);
    white = renderWhiteUnderbase(choked, width, height);
  }

  return { composite: out, white };
}
