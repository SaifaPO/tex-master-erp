import * as THREE from 'three';

// Procedurálne textúry švov pre 3D náhľad (čelenky, buffky): plochý šev (flatlock) a lem so zákrytovým stehom (coverstitch).
// Sú to priesvitné prekrytia (alpha) kladené tesne nad povrch látky — pôsobia ako vyvýšený šev a stehy, farba látky zostáva tá z potlače.

function canvasTexture(canvas, { repeatX = 1, repeatY = 1, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  return tex;
}

// Plochý šev (flatlock): široký ~6 mm pás s drobnými priečnymi stehmi (rebríček) a dvomi okrajovými líniami.
// Textúra je úzky pás (šírka = pás, výška = jedna perióda stehov), opakuje sa po výške valca.
export function makeFlatlockTexture(opts = {}) {
  // opts.vnutro: pohlad z vnutra (biely podklad) — stehy su tmavsie, aby boli vidno na bielej
  const nit = opts.vnutro ? 'rgba(71,85,105,0.9)' : 'rgba(255,255,255,0.68)';
  const nitOkraj = opts.vnutro ? 'rgba(71,85,105,0.75)' : 'rgba(255,255,255,0.6)';
  const w = 96, h = 64; // jedna perióda: 4 stehy po 16 px
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);

  // vyvýšený pás — jemný tmavý podklad s presvetlenými okrajmi (dojem hrebeňa)
  const band = g.createLinearGradient(0, 0, w, 0);
  band.addColorStop(0, 'rgba(0,0,0,0.30)');
  band.addColorStop(0.12, 'rgba(255,255,255,0.10)');
  band.addColorStop(0.5, 'rgba(0,0,0,0.10)');
  band.addColorStop(0.88, 'rgba(255,255,255,0.10)');
  band.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = band; g.fillRect(0, 0, w, h);

  // dve okrajové súbežné stehové línie
  g.strokeStyle = nitOkraj; g.lineWidth = 2.2; g.lineCap = 'round';
  [w * 0.18, w * 0.82].forEach((x) => { g.beginPath(); g.moveTo(x, -2); g.lineTo(x, h + 2); g.stroke(); });
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
  [w * 0.18 + 2, w * 0.82 + 2].forEach((x) => { g.beginPath(); g.moveTo(x, -2); g.lineTo(x, h + 2); g.stroke(); });

  // priečne stehy rebríčka
  g.lineWidth = 2.4; g.strokeStyle = nit;
  for (let y = 8; y < h; y += 16) {
    g.beginPath(); g.moveTo(w * 0.2, y + 5); g.lineTo(w * 0.8, y - 5); g.stroke();
  }
  g.lineWidth = 1.4; g.strokeStyle = 'rgba(0,0,0,0.40)';
  for (let y = 8; y < h; y += 16) {
    g.beginPath(); g.moveTo(w * 0.2, y + 7); g.lineTo(w * 0.8, y - 3); g.stroke();
  }
  return canvasTexture(c, opts);
}

// Lem so zákrytovým stehom (coverstitch) — pás vysoký ~2 cm: preložený okraj, dve súbežné rady stehov a tieň preloženia.
// Textúra sa natiahne okolo celého obvodu (jedno U od 0 do 1), preto je široká; horizontálne ju necháme opakovať.
export function makeCoverstitchTexture(opts = {}) {
  const w = 512, h = 128; // h = 2 cm výšky pásu, w = pôvodne 25 cm obvodu (opakuje sa 2×)
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);

  // prešitý lem je o niečo tmavší a trochu "tvrdší"
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, h);
  // preložený okraj (hore) — tieň a svetlý hrebeň
  const fold = g.createLinearGradient(0, 0, 0, h * 0.22);
  fold.addColorStop(0, 'rgba(255,255,255,0.40)');
  fold.addColorStop(0.35, 'rgba(0,0,0,0.30)');
  fold.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fold; g.fillRect(0, 0, w, h * 0.22);

  // dva súbežné rady zákrytového stehu (~0,5 cm od seba), uprostred pásu
  const y1 = h * 0.52, y2 = h * 0.52 + h * 0.2;
  [y1, y2].forEach((y) => {
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(w, y + 1.5); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.88)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    // drobné bodky stehov
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < w; x += 8) { g.fillRect(x, y - 1.2, 1.2, 2.4); }
  });
  // spodný okraj prešitia — jemný tieň
  const lower = g.createLinearGradient(0, h * 0.85, 0, h);
  lower.addColorStop(0, 'rgba(0,0,0,0)');
  lower.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = lower; g.fillRect(0, h * 0.85, w, h * 0.15);

  return canvasTexture(c, { repeatX: 2, repeatY: 1, ...opts });
}

// Materiál prekrytia — priesvitný, bez lesku, mierne nad povrchom (polygonOffset proti z-fightingu).
export function overlayMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.FrontSide, ...extra,
  });
}
