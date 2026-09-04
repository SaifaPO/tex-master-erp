import { renderHalftone } from './halftone.js';

// Vygeneruje testovaciu stranku so vzorkami roznych LPI x uhlov, na strednom sedom tone (50%),
// aby sa dalo priamou tlacou zistit, aky jemny raster tlaciaren/DTF folia realne zvladne.
export function generateLpiTestSheet({ lpis = [15, 25, 35, 45, 55], angles = [0, 15, 45], swatchSize = 260, outputDpi = 300, dotShape = 'circle', inkColor = '#000000' }) {
  const cols = angles.length;
  const rows = lpis.length;
  const labelH = 34;
  const padding = 10;
  const cellW = swatchSize + padding;
  const cellH = swatchSize + padding + labelH;

  const canvas = document.createElement('canvas');
  canvas.width = cellW * cols + padding + 160;
  canvas.height = cellH * rows + padding + 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('LPI test sheet — DTF/DTG separátor', padding, 24);

  // Zdrojova "vzorka": jednofarebny 50% sedy stvorec (stredny tón, najviac citlivy na kvalitu raste)
  const src = document.createElement('canvas');
  src.width = swatchSize;
  src.height = swatchSize;
  const sctx = src.getContext('2d');
  sctx.fillStyle = 'rgb(128,128,128)';
  sctx.fillRect(0, 0, swatchSize, swatchSize);

  angles.forEach((angle, ci) => {
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${angle}°`, padding + 160 + ci * cellW + swatchSize / 2 - 10, 40 + labelH - 10);
  });

  lpis.forEach((lpi, ri) => {
    const y = 40 + labelH + ri * cellH;
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${lpi} LPI`, padding, y + swatchSize / 2);

    angles.forEach((angle, ci) => {
      const x = padding + 160 + ci * cellW;
      const halftoned = renderHalftone(src, {
        lpi, outputDpi, angleDeg: angle, dotShape, inkColor,
        algorithm: 'am', blackPoint: 0, whitePoint: 255, invert: false, background: '#ffffff'
      });
      ctx.drawImage(halftoned, x, y);
      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(x, y, swatchSize, swatchSize);
    });
  });

  return canvas;
}
