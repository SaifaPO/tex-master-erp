// Trenírky (shorts) v 3D konfigurátore — zóny, farby a kreslenie textúry.
//
// Model public/models/shorts-base.glb (pozri README.txt) je skutočný CLO3D strih: 38 samostatných
// strihových kusov s neprekrývajúcim sa UV rozvinutím 0..1. Namiesto ručného merania obdĺžnikov (ako pri dresi,
// kde sú kusy veľké a pravidelné) sa tu každý kus zaradí do zóny podľa svojej 3D polohy a veľkosti
// (pás hore, nohavica, lem dole, bočný panel, tenký pásik...) a plátno sa vyfarbí PRESNE podľa UV
// trojuholníkov daného kusu — takže farba nikdy nepretečie na susedný kus.

export const ZONY_TRENIROK = [
  { key: 'noha', cislo: 1, nazov: 'Nohavice (hlavné telo)', popis: 'Predné a zadné diely nohavíc', prevezmeZ: 'zakladna' },
  { key: 'bok', cislo: 2, nazov: 'Bočné panely', popis: 'Široké vložky po boku', prevezmeZ: 'vzor' },
  { key: 'pasik', cislo: 3, nazov: 'Bočné pásiky', popis: 'Tenké pásiky pri švíkoch', prevezmeZ: 'akcent' },
  { key: 'pas', cislo: 4, nazov: 'Pás (gumička)', popis: 'Pás nohavíc', prevezmeZ: 'golier' },
  { key: 'lem', cislo: 5, nazov: 'Lemy nohavíc', popis: 'Spodný lem nohavice', prevezmeZ: 'rukava' },
];

export const DEFAULT_TRENIRKY = {
  prepojit: true, // farby trenírok preberajú farby dresu (zóna → zóna, pozri prevezmeZ vyššie)
  farby: { noha: '#1e3a8a', bok: '#dc2626', pasik: '#f59e0b', pas: '#ffffff', lem: '#1e3a8a' },
};

// Skutočné farby zón trenírok podľa konfigurácie: buď prevzaté z dresu, alebo vlastné.
export function farbyTrenirok(configState) {
  const t = configState.trenirky || DEFAULT_TRENIRKY;
  if (t.prepojit !== false) {
    const out = {};
    ZONY_TRENIROK.forEach((z) => { out[z.key] = configState.farby[z.prevezmeZ] || '#ffffff'; });
    return out;
  }
  return { ...DEFAULT_TRENIRKY.farby, ...(t.farby || {}) };
}

// Zaradenie strihového kusu do zóny podľa 3D rozmerov/polohy (jednotky = cm, model v pôvodnom súradnicovom
// systéme avatara: pás okolo y≈110–114, lemy okolo y≈70–75). Hodnoty zmerané na reálnych dátach modelu.
export function zonaKusu(box) {
  const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y;
  const cy = (box.max.y + box.min.y) / 2;
  if (cy > 107) return 'pas';
  if (sy > 30 && sx > 12) return 'noha';
  if (sy > 30) return 'pasik';
  if (cy < 76 && sy < 6 && sx > 9) return 'lem';
  if (cy < 76) return 'pasik'; // drobné koncovky pásikov pri lemoch
  return 'bok';
}

// Z UV trojuholníkov každej zóny jednorazovo postaví Path2D (potom sa pri zmene farby len znova vyplní).
// meshe: [{ mesh, zona }]; UV sa berie priamo z geometrie (normalizované kvantizované atribúty číta getX/getY správne).
export function postavCestyZon(meshe, W, H) {
  const cesty = {};
  ZONY_TRENIROK.forEach((z) => { cesty[z.key] = new Path2D(); });
  meshe.forEach(({ mesh, zona }) => {
    const geo = mesh.geometry;
    const uv = geo.attributes.uv;
    const idx = geo.index;
    if (!uv) return;
    const path = cesty[zona] || cesty.noha;
    const trojuholnikov = idx ? idx.count / 3 : uv.count / 3;
    for (let t = 0; t < trojuholnikov; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      path.moveTo(uv.getX(a) * W, uv.getY(a) * H);
      path.lineTo(uv.getX(b) * W, uv.getY(b) * H);
      path.lineTo(uv.getX(c) * W, uv.getY(c) * H);
      path.closePath();
    }
  });
  return cesty;
}

// Vykreslí textúru trenírok: každá zóna vyplnená svojou farbou (+ tenký obrys, aby medzi susednými
// trojuholníkmi nevznikli svetlé škáry).
export function vykresliTrenirky(ctx, canvas, cesty, configState) {
  const farby = farbyTrenirok(configState);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ZONY_TRENIROK.forEach((z) => {
    const path = cesty?.[z.key];
    if (!path) return;
    ctx.fillStyle = farby[z.key];
    ctx.strokeStyle = farby[z.key];
    ctx.fill(path);
    ctx.stroke(path);
  });
}
