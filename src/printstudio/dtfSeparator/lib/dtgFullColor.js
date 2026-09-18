// Rezim "DTF/DTG plnofarebne" — na rozdiel od CMYK separacie (separation.js), ktora rozklada obrazok
// do 4 samostatnych sitotlacovych kanalov, tu potrebujeme JEDEN plnofarebny obrazok, ktory len VYZERA
// akoby bol vytlaceny cez halftone raster (bodky), pretoze DTF/DTG tlaciarne su uz samotne CMYK stroje
// a nepotrebuju rucne rozdelenie na kanaly — to je vhodne len pre sietotlac.
//
// Princip: vypocitame rovnaku "kryti" masku ako pri klasickom halftone (halftone.js), pouzijeme ju ako
// stencil (nepriehladne bodky na priehladnom pozadi) a povodny FAREBNY obrazok cez nu "powerclipneme"
// (source-in kompozicia) — vysledok je plnofarebny obrazok viditelny len v tvare/velkosti bodov.
import { computeCoverageGrid, renderHalftoneFromCoverage } from './halftone.js';
import { applyChoke, renderWhiteUnderbase } from './separation.js';

// Odhadne farbu pozadia z priemeru malych oblasti pri vsetkych 4 rohoch obrazka.
function estimateBackgroundColor(data, width, height) {
  const sample = (cx, cy) => {
    let r = 0, g = 0, b = 0, cnt = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const p = (y * width + x) * 4;
        r += data[p]; g += data[p + 1]; b += data[p + 2]; cnt++;
      }
    }
    return cnt > 0 ? [r / cnt, g / cnt, b / cnt] : [255, 255, 255];
  };
  const corners = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)];
  return [0, 1, 2].map(k => corners.reduce((s, c) => s + c[k], 0) / 4);
}

// Vypocita masku popredia (1 = ponechat, 0 = pozadie na odstranenie), s mekkym prechodom (feather)
// v pasme okolo prahu (tolerance), aby okraje obrazka postupne blednuli namiesto ostreho orezu.
export function computeForegroundMask(imageData, opts = {}) {
  const { enabled = false, tolerance = 40, feather = 8 } = opts;
  const { data, width, height } = imageData;
  const n = width * height;
  const mask = new Float32Array(n).fill(1);
  if (!enabled) return mask;
  const bg = estimateBackgroundColor(data, width, height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    let v = (dist - tolerance) / Math.max(1, feather);
    mask[p] = Math.min(1, Math.max(0, v));
  }
  return mask;
}

// Vyrenderuje plnofarebny halftone (jeden kompozitny obrazok) + volitelnu bielu podkladovu vrstvu
// (rovnaky tvar ako viditelne bodky, s nastavitelnym "choke" zmensenim v px).
export function renderDtgFullColor(sourceCanvas, params) {
  const { width, height } = sourceCanvas;
  const srcCtx = sourceCanvas.getContext('2d');
  const imageData = srcCtx.getImageData(0, 0, width, height);

  const { gray } = computeCoverageGrid(imageData, params);
  const fgMask = computeForegroundMask(imageData, params.backgroundRemoval);

  let effectiveGray = gray;
  if (params.backgroundRemoval?.enabled) {
    effectiveGray = new Float32Array(gray.length);
    for (let i = 0; i < gray.length; i++) effectiveGray[i] = gray[i] * fgMask[i];
  }

  // 1) stencil — nepriehladne cierne bodky na priehladnom pozadi, presne v tvare/velkosti halftonu
  const dotStencil = renderHalftoneFromCoverage(effectiveGray, width, height, { ...params, inkColor: '#000000', background: null });

  // 2) do stencilu premietneme aj mekky prechod odstranenia pozadia (aby aj bodky pri okraji blednuli)
  if (params.backgroundRemoval?.enabled) {
    const sctx = dotStencil.getContext('2d');
    const sImg = sctx.getImageData(0, 0, width, height);
    for (let p = 0, i = 0; i < sImg.data.length; i += 4, p++) {
      sImg.data[i + 3] = Math.round(sImg.data[i + 3] * fgMask[p]);
    }
    sctx.putImageData(sImg, 0, 0);
  }

  // 3) "powerclip" — povodny farebny obrazok viditelny len tam, kde je stencil nepriehladny
  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const cctx = composite.getContext('2d');
  if (params.background) {
    cctx.fillStyle = params.background;
    cctx.fillRect(0, 0, width, height);
  }
  cctx.drawImage(dotStencil, 0, 0);
  cctx.globalCompositeOperation = 'source-in';
  cctx.drawImage(sourceCanvas, 0, 0);
  cctx.globalCompositeOperation = 'source-over';

  // 4) biely podklad — rovnaka maska ako viditelne bodky (nie CMYK unia, tu netreba), s choke
  let white = null;
  if (params.whiteBase?.enabled) {
    const stencilData = dotStencil.getContext('2d').getImageData(0, 0, width, height).data;
    const presenceRaw = new Float32Array(width * height);
    for (let p = 0, i = 0; i < stencilData.length; i += 4, p++) presenceRaw[p] = stencilData[i + 3] / 255;
    const choked = applyChoke(presenceRaw, width, height, params.whiteBase.chokePx ?? 1, params.whiteBase.threshold ?? 0.04);
    white = renderWhiteUnderbase(choked, width, height);
  }

  return { composite, white, dotStencil };
}
