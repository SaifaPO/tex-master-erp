import { renderClubCrest } from './erbRenderer';
// Kreslenie 2D textúry dresu na canvas — portované z 3d_konfigurator_dresov.html.
// Čisté funkcie parametrizované `configState` (pozri dresPresets.js DEFAULT_CONFIG_STATE) —
// žiadny globálny stav, žiadna závislosť na DOM mimo dodaného 2D kontextu.

// Poistka pre dlhý text (názov tímu, meno hráča) — zmenší font tak, aby sa zaručene zmestil
// do bezpečnej šírky namiesto pretečenia mimo dielu. `medzeraPismenPx` (letter-spacing) sa
// nastaví ešte pred meraním, aby sa do odhadu šírky počítala aj ona.
function fitTextWidth(c, text, maxWidth, baseFontPx, fontFamily, weight = 'bold', medzeraPismenPx = 0) {
  c.letterSpacing = `${medzeraPismenPx}px`;
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
// fonty. Obrys sa dá úplne vypnúť (obrysZapnuty) alebo mu nastaviť hrúbku v mm. `skala` (1 =
// text v základnej veľkosti) hrúbku úmerne zmenší, keď sa text musel zmenšiť, aby sa zmestil —
// inak by pri veľmi dlhom (a teda drobnom) texte bol nastavený obrys neprimerane hrubý a
// nezodpovedal by nastavenej hodnote v mm.
function strokeAndFillText(c, text, x, y, textCfg, skala = 1) {
  if (textCfg.obrysZapnuty !== false) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.miterLimit = 1;
    c.lineWidth = Math.max(1, (textCfg.obrysHrubkaMm ?? 3) * PX_PER_MM * skala);
    c.strokeStyle = textCfg.farbaObrysu;
    c.strokeText(text, x, y);
  }
  c.fillStyle = textCfg.farbaTextu;
  c.fillText(text, x, y);
}

// Číslo dresu má vlastné farby nezávislé od mena/nápisov — výplň + až dva vrstvené obrysy
// (klasický efekt "biele číslo, čierny vnútorný obrys, farebný vonkajší obrys"). Techniku
// vrstvenia obrysov (od najširšieho po najužší, výplň naposledy navrchu) vyžaduje canvas API —
// strokeText kreslí ťah vycentrovaný na obryse písmena, takže každá ďalšia (užšia) vrstva
// prekryje vnútornú polovicu tej pod ňou a zostane viditeľný len prstenec correct šírky.
function strokeAndFillCislo(c, text, x, y, cisloCfg, skala = 1) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.miterLimit = 1;
  const t1 = Math.max(0, (cisloCfg.obrys1HrubkaMm ?? 0)) * PX_PER_MM * skala;
  const t2 = cisloCfg.zobrazitObrys2 ? Math.max(0, (cisloCfg.obrys2HrubkaMm ?? 0)) * PX_PER_MM * skala : 0;
  if (t2 > 0) {
    c.strokeStyle = cisloCfg.farbaObrys2;
    c.lineWidth = 2 * (t1 + t2);
    c.strokeText(text, x, y);
  }
  if (t1 > 0) {
    c.strokeStyle = cisloCfg.farbaObrys1;
    c.lineWidth = 2 * t1;
    c.strokeText(text, x, y);
  }
  c.fillStyle = cisloCfg.farbaVypln;
  c.fillText(text, x, y);
}

// Meno hráča je voľný text — zákazník doň môže napísať čokoľvek, aj celý dlhý názov klubu.
// Jednoduché úmerné zmenšovanie by pri veľmi dlhom texte spravilo písmo neúmerne malé.
// Namiesto toho: ak by muselo ísť pod ~60% základnej veľkosti a text sa dá rozdeliť podľa
// medzery, prejde sa na dva riadky (obe rovnako veľké, podľa toho, ktorý riadok potrebuje
// menšie písmo). Ak medzera v texte nie je (jedno dlhé slovo), zostáva jeden riadok zmenšený.
// `spodnyOkrajY` je PEVNÝ bod, na ktorom vždy sedí SPODOK textu (jeden riadok alebo posledný
// z dvoch) — vďaka tomu medzera medzi menom a číslom pod ním nikdy neskáče, nech je meno
// akokoľvek dlhé/krátke alebo na jeden/dva riadky.
function renderMenoText(c, text, centerX, spodnyOkrajY, maxWidth, baseFontPx, textCfg) {
  const medzeraPismen = textCfg.pismenaMedzeraPx || 0;
  const jedenRiadok = fitTextWidth(c, text, maxWidth, baseFontPx, textCfg.fontRodina, 'bold', medzeraPismen);
  const MIN_JEDEN_RIADOK = baseFontPx * 0.6;
  c.textBaseline = 'alphabetic';
  if (jedenRiadok >= MIN_JEDEN_RIADOK || !text.includes(' ')) {
    strokeAndFillText(c, text, centerX, spodnyOkrajY, textCfg, jedenRiadok / baseFontPx);
    return;
  }

  const slova = text.split(' ');
  let najlepsiSplit = 1, najlepsiRozdiel = Infinity;
  for (let i = 1; i < slova.length; i++) {
    const l1 = slova.slice(0, i).join(' ').length;
    const l2 = slova.slice(i).join(' ').length;
    const rozdiel = Math.abs(l1 - l2);
    if (rozdiel < najlepsiRozdiel) { najlepsiRozdiel = rozdiel; najlepsiSplit = i; }
  }
  const riadok1 = slova.slice(0, najlepsiSplit).join(' ');
  const riadok2 = slova.slice(najlepsiSplit).join(' ');
  const velkost1 = fitTextWidth(c, riadok1, maxWidth, baseFontPx * 0.8, textCfg.fontRodina, 'bold', medzeraPismen);
  const velkost2 = fitTextWidth(c, riadok2, maxWidth, baseFontPx * 0.8, textCfg.fontRodina, 'bold', medzeraPismen);
  const finalnaVelkost = Math.min(velkost1, velkost2);
  const skala = finalnaVelkost / baseFontPx;
  const medzeraRiadkov = finalnaVelkost * 1.05;
  c.font = `bold ${finalnaVelkost}px "${textCfg.fontRodina}", sans-serif`;
  strokeAndFillText(c, riadok1, centerX, spodnyOkrajY - medzeraRiadkov, textCfg, skala);
  c.font = `bold ${finalnaVelkost}px "${textCfg.fontRodina}", sans-serif`;
  strokeAndFillText(c, riadok2, centerX, spodnyOkrajY, textCfg, skala);
}

// Vykreslí obrázok so zachovaním pomeru strán (bez deformácie) tak, aby sa celý zmestil do
// maxW×maxH okolo stredu (cx,cy). Vracia skutočne vykreslené rozmery — potrebné napr. pri
// skladaní viacerých log nad sebou (aby sa vedelo, koľko miesta logo reálne zabralo).
export function drawImageFit(c, img, cx, cy, maxW, maxH) {
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
export function drawTintedImageFit(c, img, cx, cy, maxW, maxH, farba) {
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
export function kontrastnaFarba(hex) {
  if (!hex) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

// Fixné logo výrobcu (logo_pred.png / logo_zad.png) — permanentné, zákazník ho nemôže vypnúť
// ani nahradiť, len (pri prednom) presunúť. Dodané ako čierna kresba na priehľadnom pozadí,
// preto sa vždy prefarbí na bielu/čiernu podľa podkladu (pozri drawTintedImageFit).
export const logoPredVyrobcu = new Image();
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
  lemDole: R(0.1650, 0.9663, 0.5967, 0.9849), // v skutočnosti rebrový golier okolo krku (nie spodný lem dresu)
  // spodný lem tela — pás mimo predku/zadku, vyfarbený základnou farbou (UV z modelu: v ≈ -0.294…-0.275)
  spodokPredok: R(0.0400, 0.7059, 0.5050, 0.7251),
  spodokZadok: R(0.5380, 0.7059, 0.9850, 0.7251),
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

// Rozsah, o koľko max. sa dá logo odtiahnuť od základnej pozície (frakcia šírky/výšky
// panelu, ktorému patrí) — bráni odtiahnutiu úplne mimo dielu pri ťahaní na 3D modeli.
const MAX_OFFSET_FRAC = 0.4;
export function orezOffset(v) {
  return Math.max(-MAX_OFFSET_FRAC, Math.min(MAX_OFFSET_FRAC, v || 0));
}

// Farba šitia — jedna pre všetko (lemovací prúžok na krku a spodku, dvojité prešitie manžiet a spodku). Auto = farba goliera/lemov.
export function farbaSitia(configState) {
  const s = configState.sitie;
  return s && s.mod === 'vlastna' && /^#[0-9a-f]{6}$/i.test(s.farba || '') ? s.farba : configState.farby.golier;
}

// Dvojité prešitie (dva súbežné rady stehov) pozdĺž pásu — rovnaké ako na skutočnom drese na konci rukávov a na spodku.
// Pás je v textúre rozvinutý vodorovne (dlhšia strana = dĺžka švu), rady idú po jeho dlhšej strane.
function kresliDvojiteSitie(c, r, farba, dlzkaStehuPx) {
  const lw = Math.max(1.3, r.h * 0.07);
  [0.36, 0.64].forEach((pos) => {
    const y = r.y + r.h * pos;
    c.save();
    c.lineWidth = lw; c.lineCap = 'butt';
    c.setLineDash([dlzkaStehuPx, dlzkaStehuPx * 0.7]);
    c.strokeStyle = 'rgba(0,0,0,0.38)';
    c.beginPath(); c.moveTo(r.x, y + lw * 0.8); c.lineTo(r.x + r.w, y + lw * 0.8); c.stroke();
    c.strokeStyle = farba;
    c.beginPath(); c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); c.stroke();
    c.restore();
  });
}

export function updateJerseyTexture(ctx, canvas, configState) {
  const W = canvas.width;
  const H = canvas.height;
  // Zbiera sa počas kreslenia (rovnaké súradnice, aké sa naozaj vykreslili) — použije sa v
  // ThreeViewport na hit-test pri ťahaní loga priamo na 3D modeli myšou (pozri handleDragStart).
  const regions = [];

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
  renderSleeves(ctx, W, H, configState, maVlastnyVzor, regions);
  renderFrontDetails(ctx, predok.x, predok.y, predok.w, predok.h, configState, regions);
  renderBackDetails(ctx, zadok.x, zadok.y, zadok.w, zadok.h, configState);
  renderCollarDecorations(ctx, W, H, configState);

  return regions;
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
function renderSleeves(c, W, H, configState, maVlastnyVzor, regions) {
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
  // dvojité prešitie na konci rukávov, na spodku dresu a na golieri (pokračuje aj vpredu)
  const nit = farbaSitia(configState);
  kresliDvojiteSitie(c, manzetaL, nit, 3);
  kresliDvojiteSitie(c, manzetaP, nit, 3);
  kresliDvojiteSitie(c, lem, nit, 5);
  kresliDvojiteSitie(c, toPx(PANELY.spodokPredok, W, H), nit, 5);
  kresliDvojiteSitie(c, toPx(PANELY.spodokZadok, W, H), nit, 5);

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
    const baseCx = panel.x + panel.w / 2;
    let cursorY = panel.y + panel.h / 2 - totalH / 2;
    rozmery.forEach(({ logo, w: lw, h: lh }) => {
      const baseCy = cursorY + lh / 2;
      // Doladenie ťahaním priamo na 3D modeli (offsetX/offsetY sú frakcie šírky/výšky rukáva)
      // sa pripočíta k automaticky vypočítanej (naskladanej) pozícii.
      const cx = baseCx + orezOffset(logo.offsetX) * panel.w;
      const cy = baseCy + orezOffset(logo.offsetY) * panel.h;
      try { c.drawImage(logo.img, cx - lw / 2, cy - lh / 2, lw, lh); } catch (e) { /* obrázok sa ešte nenačítal */ }
      if (regions) regions.push({ dragId: `rukav:${logo.id}`, cx, cy, w: lw, h: lh, panelW: panel.w, panelH: panel.h });
      cursorY += lh + medzeraPx;
    });
  });
}

// Logo klubu, logo výrobcu a číslo na hrudi sú o 1 cm vyššie (Martin 2026-10-18).
const HRUD_POSUN_HORE_PX = 10 * PX_PER_MM;
// Chrbát: menovka o 9 cm vyššie, číslo o 7,5 cm vyššie (medzera meno–číslo o 1,5 cm väčšia).
const MENO_POSUN_HORE_PX = 90 * PX_PER_MM; // 3 cm + 10 cm − 4 cm = 9 cm vyššie než pôvodne (Martin 2026-10-18)
const MEDZERA_MENO_CISLO_PX = 31 * PX_PER_MM;

function renderFrontDetails(c, x, y, w, h, configState, regions) {
  const centerX = x + w / 2;
  const erbOffset = configState.loga.erbOffset || { x: 0, y: 0 };
  const erbX = x + w * 0.68 + orezOffset(erbOffset.x) * w;
  const erbY = y + h * 0.32 - HRUD_POSUN_HORE_PX + orezOffset(erbOffset.y) * h;
  const erbSize = 116; // 80 * 1.2 o niečo štedrejšie, aby zväčšenie bolo naozaj vidieť aj pri vlastnom nahratom logu s okrajmi
  const cislo = configState.cislo || {};
  const medzeraPismen = configState.text.pismenaMedzeraPx || 0;

  if (configState.loga.zobrazitErb) {
    renderClubCrest(c, erbX, erbY, erbSize, configState);
    if (regions) regions.push({ dragId: 'erb', cx: erbX, cy: erbY, w: erbSize, h: erbSize, panelW: w, panelH: h });
  }

  // Logo výrobcu vpredu — fixné, zákazník ho nemôže vypnúť ani nahradiť, len presunúť.
  // Dodané ako čierna kresba na priehľadnom pozadí, preto sa vždy prefarbí podľa podkladu.
  const logoPredPoz = configState.loga.logoPredPozicia || 'zaklad';
  const logoPredOffset = configState.loga.logoPredOffset || { x: 0, y: 0 };
  const logoPredX = (logoPredPoz.startsWith('stred') ? centerX : x + w * 0.32) + orezOffset(logoPredOffset.x) * w;
  const logoPredY = (logoPredPoz.endsWith('vyssie') ? y + h * 0.32 * 0.8 : y + h * 0.32) - HRUD_POSUN_HORE_PX + orezOffset(logoPredOffset.y) * h;
  const logoPredFarba = kontrastnaFarba(configState.farby.zakladna);
  // o 65% menšie ako pôvodne, potom ešte o 15% väčšie (w*0.098*1.15, h*0.0315*1.15)
  const logoPredRozmery = drawTintedImageFit(c, logoPredVyrobcu, logoPredX, logoPredY, w * 0.1127, h * 0.0362, logoPredFarba);
  if (regions) regions.push({ dragId: 'logoPred', cx: logoPredX, cy: logoPredY, w: logoPredRozmery.w, h: logoPredRozmery.h, panelW: w, panelH: h });

  if (configState.text.zobrazitCislo && configState.text.cisloVpredu && configState.text.cisloHraca) {
    const poz = configState.text.cisloVpreduPozicia || 'stred';
    let cx = centerX, cy = y + h * 0.33 - HRUD_POSUN_HORE_PX;
    if (poz === 'pod_erb') { cx = erbX; cy = erbY + erbSize * 0.75; }
    else if (poz === 'pod_logo') { cx = logoPredX; cy = logoPredY + logoPredRozmery.h / 2 + 40; }
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const cisloBaseFont = 146; // 127 * 1.15
    const cisloVelkost = fitTextWidth(c, configState.text.cisloHraca, w * 0.35, cisloBaseFont, configState.text.fontRodina, 'bold', medzeraPismen);
    strokeAndFillCislo(c, configState.text.cisloHraca, cx, cy, cislo, cisloVelkost / cisloBaseFont);
    c.restore();
  }

  if (configState.text.zobrazitTimText && configState.text.timText) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const timBaseFont = 85;
    const timVelkost = fitTextWidth(c, configState.text.timText, w * 0.42, timBaseFont, configState.text.fontRodina, '800', medzeraPismen);
    strokeAndFillText(c, configState.text.timText, centerX, y + h * 0.54 * 0.85, configState.text, timVelkost / timBaseFont); // o 15% vyššie
    c.restore();
  }

  if (configState.text.zobrazitNapisPodCislom && configState.text.napisPodCislom) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const podBaseFont = 85;
    const podVelkost = fitTextWidth(c, configState.text.napisPodCislom, w * 0.42, podBaseFont, configState.text.fontRodina, '800', medzeraPismen);
    strokeAndFillText(c, configState.text.napisPodCislom, centerX, y + h * 0.65, configState.text, podVelkost / podBaseFont);
    c.restore();
  }
}

function renderBackDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;
  const cislo = configState.cislo || {};
  const medzeraPismen = configState.text.pismenaMedzeraPx || 0;

  // Meno má PEVNÝ kotevný bod na spodku textu a číslo pod ním PEVNÝ kotevný bod na vrchu —
  // medzera medzi nimi je vždy rovnaká (fixný GAP), nech je meno akokoľvek dlhé/krátke alebo
  // na jeden/dva riadky. Predtým mali obe polia nezávislé stredové pozície, takže sa medzera
  // medzi nimi menila podľa dĺžky mena.
  const menoSpodokY = y + h * 0.34 - MENO_POSUN_HORE_PX;
  const GAP_PX = MEDZERA_MENO_CISLO_PX;
  const cisloVrchY = menoSpodokY + GAP_PX;

  // Logo výrobcu na krku vzadu — úplne fixné, zákazník doň nijako nezasahuje. O 45% menšie,
  // potom ešte o 15% nižšie (y + h*0.06*1.15).
  const logoZadFarba = kontrastnaFarba(configState.farby.zakladna);
  drawTintedImageFit(c, logoZadVyrobcu, centerX, y + h * 0.069, w * 0.165, h * 0.0275, logoZadFarba);

  if (configState.text.zobrazitMeno && configState.text.menoHraca) {
    c.save();
    c.textAlign = 'center';
    const meno = configState.text.menoHraca.toUpperCase();
    // o 15% väčšie (95->109) a o 30% širší priestor (0.42->0.546) — pri veľmi dlhom texte sa
    // namiesto neúmerného zmenšenia prejde na dva riadky (renderMenoText).
    renderMenoText(c, meno, centerX, menoSpodokY, w * 0.546, 109, configState.text);
    c.restore();
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVzadu && configState.text.cisloHraca) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const cisloBaseFont = 476; // 414 * 1.15
    const cisloVelkost = fitTextWidth(c, configState.text.cisloHraca, w * 0.5, cisloBaseFont, configState.text.fontRodina, 'bold', medzeraPismen);
    strokeAndFillCislo(c, configState.text.cisloHraca, centerX, cisloVrchY, cislo, cisloVelkost / cisloBaseFont);
    c.restore();
  }
}

// Generátor klubového znaku je v erbRenderer.js (tvary, farby vnútra a lemoviek, viacriadkový text, objekty, vlastný obrázok).
export { renderClubCrest };

// Tri malé samostatné strihové kúsky (goliera/väzby) — presné súradnice z UV dát modelu.
function renderCollarDecorations(c, W, H, configState) {
  const nit = farbaSitia(configState);
  // golierKus1 = pás na konci rukávov (farba goliera + dvojité prešitie); golierKus2 = lemovací prúžok na krku a golierKus3 =
  // prúžok na spodku dresu — tie sú v modeli samotné "šitie", preto majú farbu šitia.
  c.fillStyle = configState.farby.golier;
  const manzeta = toPx(PANELY.golierKus1, W, H);
  c.fillRect(manzeta.x, manzeta.y, manzeta.w, manzeta.h);
  kresliDvojiteSitie(c, manzeta, nit, 2);
  c.fillStyle = nit;
  ['golierKus2', 'golierKus3'].forEach((key) => {
    const r = toPx(PANELY[key], W, H);
    c.fillRect(r.x, r.y, r.w, r.h);
  });
}

// Vnútro dresu (biela podšívka): veľkostný transfer pod lemovacím prúžkom na krku zadného dielca. Pohľad je zvnútra,
// preto je nápis zrkadlený (zvonku by sa čítal obrátene). Zatiaľ fiktívny text — neskôr sa doplní skutočná veľkosť.
export function kresliVnutroDresu(canvas, velkostText = 'XL') {
  const W = canvas.width, H = canvas.height;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);
  const zadok = toPx(PANELY.zadok, W, H);
  const cx = zadok.x + zadok.w / 2, cy = zadok.y + zadok.h * 0.095;
  c.save();
  c.translate(cx, cy);
  c.scale(-1, 1);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#9ca3af';
  c.font = '700 22px Inter, Arial, sans-serif';
  c.fillText('JERSEY SIZE', 0, -26);
  c.font = '800 66px Inter, Arial, sans-serif';
  c.fillText(velkostText, 0, 20);
  c.restore();
}
