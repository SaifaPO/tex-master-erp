// Kreslenie 2D textúry dresu na canvas — portované z 3d_konfigurator_dresov.html.
// Čisté funkcie parametrizované `configState` (pozri dresPresets.js DEFAULT_CONFIG_STATE) —
// žiadny globálny stav, žiadna závislosť na DOM mimo dodaného 2D kontextu.

// Poistka pre dlhý text (názov tímu, meno hráča) — zmenší font tak, aby sa zaručene zmestil
// do bezpečnej šírky namiesto pretečenia mimo dielu.
function fitTextWidth(c, text, maxWidth, baseFontPx, fontFamily, weight = 'bold') {
  let size = baseFontPx;
  while (size > 18) {
    c.font = `${weight} ${size}px "${fontFamily}", sans-serif`;
    if (c.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

// Presné umiestnenie strihových dielov na 2048×2048 plátne — zmerané priamo z UV súradníc
// kúpeného modelu (jersey-base.glb) a z referenčnej textúry výrobcu (diffuse_1001.png), nie
// odhadnuté. Zlomky (frakcie 0..1) sú nezávislé od skutočnej veľkosti plátna.
const R = (fx0, fy0, fx1, fy1) => ({ fx0, fy0, fx1, fy1 });
const PANELY = {
  predok: R(0.0396, 0.0771, 0.5054, 0.6909),
  zadok: R(0.5381, 0.0771, 0.9849, 0.6909),
  rukavLavy: R(0.0151, 0.7422, 0.3682, 0.9053),
  rukavPravy: R(0.4961, 0.7422, 0.8877, 0.9229),
  manzetaLava: R(0.0269, 0.9131, 0.3569, 0.9321),
  manzetaPrava: R(0.5088, 0.9321, 0.8745, 0.9531),
  lemDole: R(0.1650, 0.9663, 0.5967, 0.9849),
  golierKus1: R(0.3271, 0.7583, 0.4097, 0.7749),
  golierKus2: R(0.4233, 0.8066, 0.5088, 0.8237),
  golierKus3: R(0.3809, 0.8882, 0.4663, 0.9053),
};

function toPx(rect, W, H) {
  return {
    x: rect.fx0 * W,
    y: rect.fy0 * H,
    w: (rect.fx1 - rect.fx0) * W,
    h: (rect.fy1 - rect.fy0) * H,
  };
}

export function updateJerseyTexture(ctx, canvas, configState) {
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = configState.farby.zakladna;
  ctx.fillRect(0, 0, W, H);

  const predok = toPx(PANELY.predok, W, H);
  const zadok = toPx(PANELY.zadok, W, H);

  renderPattern(ctx, predok.x, predok.y, predok.w, predok.h, false, configState);
  renderPattern(ctx, zadok.x, zadok.y, zadok.w, zadok.h, true, configState);
  renderSleeves(ctx, W, H, configState);
  renderFrontDetails(ctx, predok.x, predok.y, predok.w, predok.h, configState);
  renderBackDetails(ctx, zadok.x, zadok.y, zadok.w, zadok.h, configState);
  renderCollarDecorations(ctx, W, H, configState);
}

function renderPattern(c, x, y, w, h, isBack, configState) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();

  const pType = configState.vzor;
  const pColor = configState.farby.vzor;
  const aColor = configState.farby.akcent;

  if (pType === 'stripes') {
    const num = 7;
    const sW = w / num;
    for (let i = 0; i < num; i++) {
      if (i % 2 === 1) {
        c.fillStyle = pColor;
        c.fillRect(x + i * sW, y, sW, h);
        c.fillStyle = aColor;
        c.fillRect(x + i * sW + sW * 0.85, y, sW * 0.15, h);
      }
    }
  } else if (pType === 'hoops') {
    const num = 8;
    const hH = h / num;
    for (let j = 0; j < num; j++) {
      if (j % 2 === 1) {
        c.fillStyle = pColor;
        c.fillRect(x, y + j * hH, w, hH);
        c.fillStyle = aColor;
        c.fillRect(x, y + j * hH + hH - 12, w, 12);
      }
    }
  } else if (pType === 'sash') {
    c.fillStyle = pColor;
    c.beginPath();
    if (!isBack) {
      c.moveTo(x + w * 0.15, y);
      c.lineTo(x + w * 0.55, y);
      c.lineTo(x + w * 0.95, y + h);
      c.lineTo(x + w * 0.55, y + h);
    } else {
      c.moveTo(x + w * 0.85, y);
      c.lineTo(x + w * 0.45, y);
      c.lineTo(x + w * 0.05, y + h);
      c.lineTo(x + w * 0.45, y + h);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = aColor;
    c.lineWidth = 14;
    c.stroke();
  } else if (pType === 'honeycomb') {
    c.fillStyle = pColor;
    c.strokeStyle = aColor;
    c.lineWidth = 3;
    const hexR = 48;
    const hexH = hexR * Math.sqrt(3);
    for (let hx = x - hexR; hx < x + w + hexR; hx += hexR * 3) {
      for (let hy = y - hexH; hy < y + h + hexH; hy += hexH) {
        drawHex(c, hx, hy, hexR);
        drawHex(c, hx + hexR * 1.5, hy + hexH / 2, hexR);
      }
    }
  } else if (pType === 'chevron') {
    for (let k = 0; k < 6; k++) {
      c.fillStyle = (k % 2 === 0) ? pColor : aColor;
      c.beginPath();
      const cy = y + k * (h / 6) * 0.9;
      c.moveTo(x, cy);
      c.lineTo(x + w / 2, cy + 140);
      c.lineTo(x + w, cy);
      c.lineTo(x + w, cy + 100);
      c.lineTo(x + w / 2, cy + 240);
      c.lineTo(x, cy + 100);
      c.closePath();
      c.fill();
    }
  } else if (pType === 'gradient') {
    const grad = c.createLinearGradient(x, y + h * 0.1, x, y + h * 0.95);
    grad.addColorStop(0, configState.farby.zakladna);
    grad.addColorStop(0.5, pColor);
    grad.addColorStop(1, aColor);
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
  } else if (pType === 'modern') {
    c.fillStyle = pColor;
    for (let b = 0; b < 45; b++) {
      c.fillRect(x + ((b * 137) % (w - 120)), y + ((b * 251) % (h - 80)), 60 + (b % 4) * 40, 15 + (b % 3) * 12);
    }
  } else if (pType === 'camo') {
    c.fillStyle = pColor;
    for (let p = 0; p < 20; p++) {
      c.beginPath();
      c.moveTo(x + ((p * 223) % w), y + ((p * 367) % h));
      c.lineTo(x + ((p * 223) % w) + 120, y + ((p * 367) % h) + 40);
      c.lineTo(x + ((p * 223) % w) + 80, y + ((p * 367) % h) + 160);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

function drawHex(c, cx, cy, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = cx + r * Math.cos(angle);
    const hy = cy + r * Math.sin(angle);
    if (i === 0) c.moveTo(hx, hy);
    else c.lineTo(hx, hy);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

// Rukávy, manžety a spodný lem sú u tohto modelu (skutočný CLO3D strih) samostatné strihové
// kusy s vlastnými UV oblasťami dole na plátne — presné súradnice zmerané priamo z UV dát
// modelu (pozri PANELY vyššie), nie odhadnuté.
function renderSleeves(c, W, H, configState) {
  const lavy = toPx(PANELY.rukavLavy, W, H);
  const pravy = toPx(PANELY.rukavPravy, W, H);
  const manzetaL = toPx(PANELY.manzetaLava, W, H);
  const manzetaP = toPx(PANELY.manzetaPrava, W, H);
  const lem = toPx(PANELY.lemDole, W, H);

  c.fillStyle = configState.farby.rukava;
  c.fillRect(lavy.x, lavy.y, lavy.w, lavy.h);
  c.fillRect(pravy.x, pravy.y, pravy.w, pravy.h);

  c.fillStyle = configState.farby.golier;
  c.fillRect(manzetaL.x, manzetaL.y, manzetaL.w, manzetaL.h);
  c.fillRect(manzetaP.x, manzetaP.y, manzetaP.w, manzetaP.h);
  c.fillRect(lem.x, lem.y, lem.w, lem.h);

  if (configState.loga.zobrazitOdznakRukav) {
    c.save();
    const bX = pravy.x + pravy.w * 0.5;
    const bY = pravy.y + pravy.h * 0.5;
    const r = Math.min(pravy.w, pravy.h) * 0.28;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(bX, bY, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#020617';
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = '#1e3a8a';
    c.font = `bold ${Math.round(r * 0.55)}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('PRO', bX, bY - r * 0.12);
    c.restore();
  }
}

function renderFrontDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;

  if (configState.loga.zobrazitErb) {
    renderClubCrest(c, x + w * 0.68, y + h * 0.32, 80, configState);
  }

  if (configState.loga.zobrazitBrandLogo) {
    renderBrandLogo(c, x + w * 0.32, y + h * 0.32, configState);
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVpredu && configState.text.cisloHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.cisloHraca, w * 0.35, 110, configState.text.fontRodina, 'bold');
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 14;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.33);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.cisloHraca, centerX, y + h * 0.33);
    c.restore();
  }

  if (configState.text.zobrazitTimText && configState.text.timText) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.timText, w * 0.42, 85, configState.text.fontRodina, '800');
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 16;
    c.strokeText(configState.text.timText, centerX, y + h * 0.54);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.timText, centerX, y + h * 0.54);
    c.restore();
  }
}

function renderBackDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;

  if (configState.text.zobrazitMeno && configState.text.menoHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const meno = configState.text.menoHraca.toUpperCase();
    fitTextWidth(c, meno, w * 0.42, 95, configState.text.fontRodina, 'bold');
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 16;
    c.strokeText(meno, centerX, y + h * 0.28);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(meno, centerX, y + h * 0.28);
    c.restore();
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVzadu && configState.text.cisloHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.cisloHraca, w * 0.5, 360, configState.text.fontRodina, 'bold');
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 32;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.strokeStyle = configState.farby.akcent;
    c.lineWidth = 6;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.restore();
  }
}

function renderClubCrest(c, cx, cy, size, configState) {
  c.save();
  if (configState.loga.typErbu === 'custom' && configState.loga.vlastnyErbImg) {
    try {
      c.drawImage(configState.loga.vlastnyErbImg, cx - size / 2, cy - size / 2, size, size);
      c.restore();
      return;
    } catch (e) { /* obrázok sa ešte nenačítal — vykresli sa pri ďalšej aktualizácii */ }
  }

  c.translate(cx, cy);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, -size * 0.5);
  c.lineTo(size * 0.45, -size * 0.35);
  c.lineTo(size * 0.45, size * 0.1);
  c.bezierCurveTo(size * 0.45, size * 0.45, 0, size * 0.65, 0, size * 0.65);
  c.bezierCurveTo(0, size * 0.65, -size * 0.45, size * 0.45, -size * 0.45, size * 0.1);
  c.lineTo(-size * 0.45, -size * 0.35);
  c.closePath();
  c.fill();
  c.strokeStyle = configState.farby.akcent;
  c.lineWidth = 6;
  c.stroke();

  c.fillStyle = configState.farby.vzor;
  c.beginPath();
  c.arc(0, 0, size * 0.28, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#ffffff';
  c.font = `bold ${Math.floor(size * 0.35)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const symbol = configState.loga.typErbu === 'star' ? '⭐' : (configState.loga.typErbu === 'eagle' ? '🦅' : (configState.loga.typErbu === 'crown' ? '👑' : '🛡️'));
  c.fillText(symbol, 0, 0);
  c.restore();
}

function renderBrandLogo(c, cx, cy, configState) {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = configState.text.farbaTextu;
  c.strokeStyle = configState.text.farbaObrysu;
  c.lineWidth = 4;

  if (configState.loga.brandIcon === 'swoosh') {
    c.beginPath();
    c.moveTo(-35, 10);
    c.quadraticCurveTo(5, 25, 40, -20);
    c.quadraticCurveTo(0, 5, -35, 10);
    c.fill();
    c.stroke();
  } else if (configState.loga.brandIcon === 'geometric') {
    c.beginPath();
    c.moveTo(0, -25);
    c.lineTo(25, 0);
    c.lineTo(0, 25);
    c.lineTo(-25, 0);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    c.font = '900 30px "Chakra Petch", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SPZ', 0, 0);
  }
  c.restore();
}

// Tri malé samostatné strihové kúsky (goliera/väzby) — presné súradnice z UV dát modelu.
function renderCollarDecorations(c, W, H, configState) {
  c.fillStyle = configState.farby.golier;
  ['golierKus1', 'golierKus2', 'golierKus3'].forEach((key) => {
    const r = toPx(PANELY[key], W, H);
    c.fillRect(r.x, r.y, r.w, r.h);
  });
}
