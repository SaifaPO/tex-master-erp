// Jadro halftone/separacneho vypoctu — cisto klientske (Canvas 2D), ziadne DB volania.
// Tri rezimy:
//  - 'am'     : klasicky rastrovany (Amplitude Modulated) bod s rotaciou o zvoleny uhol, velkost bodu podla krytia
//  - 'bayer'  : usporiadany (ordered) dithering cez 8x8 Bayer maticu — viditelna textura, rychly
//  - 'floyd'  : chybova difuzia (Floyd-Steinberg) — jemne prechody, bez pravidelneho vzoru, uhol sa neaplikuje

const BAYER_8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21]
].map(row => row.map(v => (v + 0.5) / 64));

// Levels (cierny/biely bod) + prevod na "kryti" 0..1 (0 = ziadny atrament/biela, 1 = plny atrament)
// invert: true pre normalny obrazok (tmave miesta = viac atramentu)
export function computeCoverageGrid(imageData, { blackPoint = 0, whitePoint = 255, invert = false } = {}) {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  const range = Math.max(1, whitePoint - blackPoint);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const alpha = data[i + 3] / 255;
    let v = (lum - blackPoint) / range;
    v = Math.min(1, Math.max(0, v));
    let coverage = invert ? v : 1 - v;
    coverage *= alpha; // priehladne pixely = ziadny atrament
    gray[p] = coverage;
  }
  return { gray, width, height };
}

function sampleBox(gray, width, height, cx, cy, radius) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  if (x1 < x0 || y1 < y0) return 0;
  let sum = 0, n = 0;
  const stepX = Math.max(1, Math.floor((x1 - x0) / 4));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
  for (let y = y0; y <= y1; y += stepY) {
    for (let x = x0; x <= x1; x += stepX) {
      sum += gray[y * width + x];
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

function drawDot(ctx, shape, px, py, coverage, cellSize, angleRad, inkColor) {
  if (coverage <= 0.004) return;
  ctx.fillStyle = inkColor;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angleRad);
  const half = (cellSize / 2) * Math.sqrt(coverage);
  switch (shape) {
    case 'square':
      ctx.fillRect(-half, -half, half * 2, half * 2);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -half); ctx.lineTo(half, 0); ctx.lineTo(0, half); ctx.lineTo(-half, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ellipse': {
      const rx = half * 1.3, ry = half * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'line': {
      const thickness = Math.max(0.6, cellSize * coverage);
      ctx.fillRect(-cellSize * 0.48, -thickness / 2, cellSize * 0.96, thickness);
      break;
    }
    case 'circle':
    default:
      ctx.beginPath();
      ctx.arc(0, 0, half, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

function renderAm(ctx, gray, width, height, { lpi, outputDpi, angleDeg, dotShape, inkColor }) {
  const cellSize = Math.max(2, Math.round(outputDpi / lpi));
  const angleRad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(angleRad), uy = Math.sin(angleRad);
  const vx = -Math.sin(angleRad), vy = Math.cos(angleRad);
  const cx = width / 2, cy = height / 2;
  const maxR = Math.ceil(Math.sqrt(cx * cx + cy * cy) / cellSize) + 1;
  for (let i = -maxR; i <= maxR; i++) {
    for (let j = -maxR; j <= maxR; j++) {
      const px = cx + i * cellSize * ux + j * cellSize * vx;
      const py = cy + i * cellSize * uy + j * cellSize * vy;
      if (px < -cellSize || py < -cellSize || px > width + cellSize || py > height + cellSize) continue;
      const coverage = sampleBox(gray, width, height, px, py, cellSize / 2);
      drawDot(ctx, dotShape, px, py, coverage, cellSize, angleRad, inkColor);
    }
  }
}

function renderBayer(ctx, gray, width, height, { lpi, outputDpi, angleDeg, dotShape, inkColor }) {
  const cellSize = Math.max(2, Math.round(outputDpi / lpi));
  const angleRad = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(angleRad), uy = Math.sin(angleRad);
  const vx = -Math.sin(angleRad), vy = Math.cos(angleRad);
  const cx = width / 2, cy = height / 2;
  const maxR = Math.ceil(Math.sqrt(cx * cx + cy * cy) / cellSize) + 1;
  for (let i = -maxR; i <= maxR; i++) {
    for (let j = -maxR; j <= maxR; j++) {
      const px = cx + i * cellSize * ux + j * cellSize * vx;
      const py = cy + i * cellSize * uy + j * cellSize * vy;
      if (px < -cellSize || py < -cellSize || px > width + cellSize || py > height + cellSize) continue;
      const coverage = sampleBox(gray, width, height, px, py, cellSize / 2);
      const threshold = BAYER_8[((i % 8) + 8) % 8][((j % 8) + 8) % 8];
      if (coverage > threshold) drawDot(ctx, dotShape, px, py, 1, cellSize * 0.92, angleRad, inkColor);
    }
  }
}

function renderFloyd(ctx, gray, width, height, { lpi, outputDpi, dotShape, inkColor }) {
  const cellSize = Math.max(2, Math.round(outputDpi / lpi));
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const cells = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      cells[gy * gridW + gx] = sampleBox(gray, width, height, gx * cellSize + cellSize / 2, gy * cellSize + cellSize / 2, cellSize / 2);
    }
  }
  for (let gy = 0; gy < gridH; gy++) {
    const leftToRight = gy % 2 === 0;
    for (let gxi = 0; gxi < gridW; gxi++) {
      const gx = leftToRight ? gxi : gridW - 1 - gxi;
      const idx = gy * gridW + gx;
      const old = cells[idx];
      const on = old >= 0.5 ? 1 : 0;
      const err = old - on;
      const dir = leftToRight ? 1 : -1;
      if (gx + dir >= 0 && gx + dir < gridW) cells[idx + dir] += err * 7 / 16;
      if (gy + 1 < gridH) {
        if (gx - dir >= 0 && gx - dir < gridW) cells[idx - dir + gridW] += err * 3 / 16;
        cells[idx + gridW] += err * 5 / 16;
        if (gx + dir >= 0 && gx + dir < gridW) cells[idx + dir + gridW] += err * 1 / 16;
      }
      if (on) drawDot(ctx, dotShape, gx * cellSize + cellSize / 2, gy * cellSize + cellSize / 2, 1, cellSize * 0.92, 0, inkColor);
    }
  }
}

// Hlavna funkcia — vykresli halftone separaciu zdrojoveho canvasu do noveho vystupneho canvasu.
export function renderHalftone(sourceCanvas, params) {
  const { width, height } = sourceCanvas;
  const srcCtx = sourceCanvas.getContext('2d');
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const { gray } = computeCoverageGrid(imageData, params);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (params.background) {
    ctx.fillStyle = params.background;
    ctx.fillRect(0, 0, width, height);
  }

  if (params.algorithm === 'bayer') renderBayer(ctx, gray, width, height, params);
  else if (params.algorithm === 'floyd') renderFloyd(ctx, gray, width, height, params);
  else renderAm(ctx, gray, width, height, params);

  return out;
}
