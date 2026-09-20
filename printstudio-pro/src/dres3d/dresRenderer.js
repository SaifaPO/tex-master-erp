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

// Približný prepočet mm na px plátna (2048×2048 = predný/zadný diel na šírku ~55cm — polovica
// obvodu hrude veľkosti L). Presné meradlo vieme doladiť, keď Martin dodá skutočný rozmer
// z vytlačeného vzorku.
const PX_PER_MM = 1.75;

// Obrys textu — pri niektorých fontoch (ostré serify/hroty) miter spoj vytvára "vystrelujúce"
// hroty na rohoch písmen. Zaoblený spoj (round join/cap) tento efekt odstraňuje pre všetky
// fonty. Obrys sa dá úplne vypnúť (obrysZapnuty) alebo mu nastaviť hrúbku v mm.
function strokeAndFillText(c, text, x, y, textCfg) {
  if (textCfg.obrysZapnuty !== false) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.miterLimit = 1;
    c.lineWidth = Math.max(1, (textCfg.obrysHrubkaMm ?? 3) * PX_PER_MM);
    c.strokeStyle = textCfg.farbaObrysu;
    c.strokeText(text, x, y);
  }
  c.fillStyle = textCfg.farbaTextu;
  c.fillText(text, x, y);
}

// Vykreslí obrázok so zachovaním pomeru strán (bez deformácie) tak, aby sa celý zmestil do
// maxW×maxH okolo stredu (cx,cy). Vracia skutočne vykreslené rozmery — potrebné napr. pri
// skladaní viacerých log nad sebou (aby sa vedelo, koľko miesta logo reálne zabralo).
function drawImageFit(c, img, cx, cy, maxW, maxH) {
  if (!img || !img.naturalWidth) return { w: 0, h: 0 };
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.min(maxW / iw, maxH / ih);
  const w = iw * scale, h = ih * scale;
  try { c.drawImage(img, cx - w / 2, cy - h / 2, w, h); } catch (e) { /* obrázok sa ešte nenačítal */ }
  return { w, h };
}

// Rovnaké ako drawImageFit, ale obrázok (očakáva sa čierna kresba na priehľadnom pozadí,
// napr. logo výrobcu) sa najprv prefarbí na zvolenú farbu — používa sa na logá výrobcu, ktoré
// sa musia automaticky prepínať medzi bielou a čiernou podľa svetlosti podkladu.
function drawTintedImageFit(c, img, cx, cy, maxW, maxH, farba) {
  if (!img || !img.naturalWidth) return { w: 0, h: 0 };
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.min(maxW / iw, maxH / ih);
  const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, w, h);
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = farba;
  octx.fillRect(0, 0, w, h);
  try { c.drawImage(off, cx - w / 2, cy - h / 2, w, h); } catch (e) { /* obrázok sa ešte nenačítal */ }
  return { w, h };
}

// Biela na tmavom podklade, čierna na svetlom — podľa vnímanej svetlosti (luminance) farby.
function kontrastnaFarba(hex) {
  if (!hex) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

// Fixné logo výrobcu (logo_pred.png / logo_zad.png) — permanentné, zákazník ho nemôže vypnúť
// ani nahradiť, len (pri prednom) presunúť. Dodané ako čierna kresba na priehľadnom pozadí,
// preto sa vždy prefarbí na bielu/čiernu podľa podkladu (pozri drawTintedImageFit).
const logoPredVyrobcu = new Image();
const logoZadVyrobcu = new Image();
export const logaVyrobcuReady = Promise.all([
  new Promise((resolve) => { logoPredVyrobcu.onload = resolve; logoPredVyrobcu.onerror = resolve; }),
  new Promise((resolve) => { logoZadVyrobcu.onload = resolve; logoZadVyrobcu.onerror = resolve; }),
]);
logoPredVyrobcu.src = '/models/logo-pred.png';
logoZadVyrobcu.src = '/models/logo-zad.png';

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
  // Farby na drese pôsobili vyblednuto — mierne zvýšená sýtosť celej kresby (aplikuje sa na
  // všetko, čo sa odteraz na plátno nakreslí, kým sa filter znova nezmení/nevypne).
  ctx.filter = 'saturate(1.1)';

  ctx.fillStyle = configState.farby.zakladna;
  ctx.fillRect(0, 0, W, H);

  const predok = toPx(PANELY.predok, W, H);
  const zadok = toPx(PANELY.zadok, W, H);

  const maVlastnyVzor = configState.vzor === 'vlastny' && configState.vlastnyVzorObrazky;
  if (maVlastnyVzor) {
    renderVlastnyVzor(ctx, W, H, configState);
  } else {
    renderPattern(ctx, predok.x, predok.y, predok.w, predok.h, false, configState);
    renderPattern(ctx, zadok.x, zadok.y, zadok.w, zadok.h, true, configState);
  }
  renderSleeves(ctx, W, H, configState, maVlastnyVzor);
  renderFrontDetails(ctx, predok.x, predok.y, predok.w, predok.h, configState);
  renderBackDetails(ctx, zadok.x, zadok.y, zadok.w, zadok.h, configState);
  renderCollarDecorations(ctx, W, H, configState);
}

// Vlastný (nahraný) vzor — 3 voliteľné PNG vrstvy s priehľadnosťou (základ/vzor/akcent),
// pripravené adminom presne podľa šablóny rozloženia dresu (celé 2048×2048 plátno naraz,
// vrátane rukávov — nie len predok/zadok). Každá vrstva sa vyfarbí zvolenou farbou danej zóny
// (rovnaký princíp ako farebné vrstvy skladov v grafickom softvéri) a poskladá na seba.
function renderVlastnyVzor(c, W, H, configState) {
  const obr = configState.vlastnyVzorObrazky;
  const vrstvy = [
    { img: obr.zaklad, farba: configState.farby.zakladna },
    { img: obr.vzor, farba: configState.farby.vzor },
    { img: obr.akcent, farba: configState.farby.akcent },
  ];
  vrstvy.forEach(({ img, farba }) => {
    if (!img) return;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, W, H);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = farba;
    octx.fillRect(0, 0, W, H);
    c.drawImage(off, 0, 0);
  });
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
function renderSleeves(c, W, H, configState, maVlastnyVzor) {
  const lavy = toPx(PANELY.rukavLavy, W, H);
  const pravy = toPx(PANELY.rukavPravy, W, H);
  const manzetaL = toPx(PANELY.manzetaLava, W, H);
  const manzetaP = toPx(PANELY.manzetaPrava, W, H);
  const lem = toPx(PANELY.lemDole, W, H);

  // Pri vlastnom nahranom vzore už rukávy vyfarbil renderVlastnyVzor (celé plátno naraz) —
  // tu sa prekresľuje len manžeta/lem/logá, aby sa neprekryl nahraný dizajn.
  if (!maVlastnyVzor) {
    c.fillStyle = configState.farby.rukava;
    c.fillRect(lavy.x, lavy.y, lavy.w, lavy.h);
    c.fillRect(pravy.x, pravy.y, pravy.w, pravy.h);
  }

  c.fillStyle = configState.farby.golier;
  c.fillRect(manzetaL.x, manzetaL.y, manzetaL.w, manzetaL.h);
  c.fillRect(manzetaP.x, manzetaP.y, manzetaP.w, manzetaP.h);
  c.fillRect(lem.x, lem.y, lem.w, lem.h);

  // Ľubovoľný počet log na každom rukáve, poukladaných nad sebou v poradí `poradie`
  // (0 = najvyššie). `velkost` je násobok "normálnej" veľkosti (1 = normálna, zadané
  // posuvníkom 0.5–2) — nie absolútna hodnota, aby nové logo vždy vyzeralo primerane veľké
  // hneď po pridaní. Rozostup medzi logami je nastaviteľný v mm a skladanie sa počíta vždy
  // nanovo zo skutočných (fit) rozmerov, takže zväčšenie jedného loga automaticky odsunie
  // ostatné — nemôžu sa prekryť.
  const rukavLoga = configState.loga.rukavLoga || [];
  const medzeraPx = (configState.loga.rukavMedzeraMm ?? 6) * PX_PER_MM;
  ['lavy', 'pravy'].forEach((strana) => {
    const panel = strana === 'lavy' ? lavy : pravy;
    const baseH = panel.h * 0.42;
    const maxW = panel.w * 0.8;
    const loga = rukavLoga.filter((l) => l.strana === strana && l.img).sort((a, b) => a.poradie - b.poradie);
    const rozmery = loga.map((logo) => {
      const iw = logo.img.naturalWidth || 1, ih = logo.img.naturalHeight || 1;
      const targetH = baseH * (logo.velkost ?? 1);
      const scale = Math.min(maxW / iw, targetH / ih);
      return { logo, w: iw * scale, h: ih * scale };
    });
    const totalH = rozmery.reduce((s, r) => s + r.h, 0) + medzeraPx * Math.max(0, rozmery.length - 1);
    const cx = panel.x + panel.w / 2;
    let cursorY = panel.y + panel.h / 2 - totalH / 2;
    rozmery.forEach(({ logo, w: lw, h: lh }) => {
      const cy = cursorY + lh / 2;
      try { c.drawImage(logo.img, cx - lw / 2, cy - lh / 2, lw, lh); } catch (e) { /* obrázok sa ešte nenačítal */ }
      cursorY += lh + medzeraPx;
    });
  });
}

function renderFrontDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;
  const erbX = x + w * 0.68;
  const erbY = y + h * 0.32;
  const erbSize = 116; // 80 * 1.2 o niečo štedrejšie, aby zväčšenie bolo naozaj vidieť aj pri vlastnom nahratom logu s okrajmi

  if (configState.loga.zobrazitErb) {
    renderClubCrest(c, erbX, erbY, erbSize, configState);
  }

  // Logo výrobcu vpredu — fixné, zákazník ho nemôže vypnúť ani nahradiť, len presunúť.
  // Dodané ako čierna kresba na priehľadnom pozadí, preto sa vždy prefarbí podľa podkladu.
  const logoPredPoz = configState.loga.logoPredPozicia || 'zaklad';
  const logoPredX = logoPredPoz.startsWith('stred') ? centerX : x + w * 0.32;
  const logoPredY = logoPredPoz.endsWith('vyssie') ? y + h * 0.32 * 0.8 : y + h * 0.32;
  const logoPredFarba = kontrastnaFarba(configState.farby.zakladna);
  const logoPredRozmery = drawTintedImageFit(c, logoPredVyrobcu, logoPredX, logoPredY, w * 0.28, h * 0.09, logoPredFarba);

  if (configState.text.zobrazitCislo && configState.text.cisloVpredu && configState.text.cisloHraca) {
    const poz = configState.text.cisloVpreduPozicia || 'stred';
    let cx = centerX, cy = y + h * 0.33;
    if (poz === 'pod_erb') { cx = erbX; cy = erbY + erbSize * 0.75; }
    else if (poz === 'pod_logo') { cx = logoPredX; cy = logoPredY + logoPredRozmery.h / 2 + 40; }
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.cisloHraca, w * 0.35, 127, configState.text.fontRodina, 'bold'); // 110 * 1.15
    strokeAndFillText(c, configState.text.cisloHraca, cx, cy, configState.text);
    c.restore();
  }

  if (configState.text.zobrazitTimText && configState.text.timText) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.timText, w * 0.42, 85, configState.text.fontRodina, '800');
    strokeAndFillText(c, configState.text.timText, centerX, y + h * 0.54 * 0.85, configState.text); // o 15% vyššie
    c.restore();
  }
}

function renderBackDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;
  const menoY = y + h * 0.28 * 0.8; // o 20% vyššie
  const cisloY = y + h * 0.54 * 0.8; // o 20% vyššie

  // Logo výrobcu na krku vzadu — úplne fixné, zákazník doň nijako nezasahuje.
  const logoZadFarba = kontrastnaFarba(configState.farby.zakladna);
  drawTintedImageFit(c, logoZadVyrobcu, centerX, y + h * 0.06, w * 0.3, h * 0.05, logoZadFarba);

  if (configState.text.zobrazitMeno && configState.text.menoHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const meno = configState.text.menoHraca.toUpperCase();
    fitTextWidth(c, meno, w * 0.42, 95, configState.text.fontRodina, 'bold');
    strokeAndFillText(c, meno, centerX, menoY, configState.text);
    c.restore();
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVzadu && configState.text.cisloHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitTextWidth(c, configState.text.cisloHraca, w * 0.5, 414, configState.text.fontRodina, 'bold'); // 360 * 1.15
    strokeAndFillText(c, configState.text.cisloHraca, centerX, cisloY, configState.text);
    if (configState.text.obrysZapnuty !== false) {
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.strokeStyle = configState.farby.akcent;
      c.lineWidth = 6;
      c.strokeText(configState.text.cisloHraca, centerX, cisloY);
    }
    c.restore();
  }
}

// Generátor "blank" klubového znaku — zákazník napíše vlastný text (napr. "FC TORNAĽA"),
// ktorý sa vykreslí do zvoleného tvaru (kruh/štít/erb/ovál). Ak má nahraté vlastné logo
// (typErbu === 'custom'), použije sa namiesto generátora.
function renderClubCrest(c, cx, cy, size, configState) {
  c.save();
  if (configState.loga.typErbu === 'custom' && configState.loga.vlastnyErbImg) {
    drawImageFit(c, configState.loga.vlastnyErbImg, cx, cy, size, size);
    c.restore();
    return;
  }

  c.translate(cx, cy);
  const tvar = configState.loga.typErbu || 'kruh';

  c.fillStyle = '#ffffff';
  c.beginPath();
  if (tvar === 'stit' || tvar === 'erb') {
    c.moveTo(0, -size * 0.5);
    c.lineTo(size * 0.45, -size * 0.35);
    c.lineTo(size * 0.45, size * 0.1);
    c.bezierCurveTo(size * 0.45, size * 0.45, 0, size * 0.65, 0, size * 0.65);
    c.bezierCurveTo(0, size * 0.65, -size * 0.45, size * 0.45, -size * 0.45, size * 0.1);
    c.lineTo(-size * 0.45, -size * 0.35);
    c.closePath();
  } else if (tvar === 'ovál') {
    c.ellipse(0, 0, size * 0.5, size * 0.38, 0, 0, Math.PI * 2);
  } else {
    c.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  }
  c.fill();
  c.strokeStyle = configState.farby.akcent;
  c.lineWidth = 6;
  c.stroke();

  if (tvar === 'erb') {
    // dekoratívny vnútorný prstenec, aby sa "erb" vizuálne odlíšil od jednoduchého štítu
    c.beginPath();
    c.arc(0, 0, size * 0.34, 0, Math.PI * 2);
    c.strokeStyle = configState.farby.vzor;
    c.lineWidth = 4;
    c.stroke();
  }

  c.fillStyle = configState.farby.vzor;
  c.font = `900 ${Math.floor(size * 0.19)}px "${configState.text.fontRodina}", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const text = (configState.loga.erbText || 'FC').toUpperCase();
  const maxW = size * (tvar === 'ovál' ? 0.85 : 0.7);
  let fontSize = Math.floor(size * 0.19);
  while (fontSize > 8 && c.measureText(text).width > maxW) {
    fontSize -= 1;
    c.font = `900 ${fontSize}px "${configState.text.fontRodina}", sans-serif`;
  }
  c.fillText(text, 0, size * 0.02);
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
