// Presne umiestnenie strihovych dielov na 2048x2048 platne pre 3D dres — DUPLIKAT z
// printstudio-pro/src/dres3d/dresRenderer.js (PANELY) — su to rovnake UV suradnice zmerane
// priamo z modelu (jersey-base.glb), pri zmene strihu/UV uprav OBE miesta rovnako.
// Pouziva sa len na vygenerovanie referencnej sablony pre grafika (Vlajky/Beachvlajky admin
// nema pristup k printstudio-pro projektu, su to dva samostatne Vite projekty).
export const CANVAS_SIZE = 2048;

export const PANELY = [
  { key: 'predok', label: 'PREDOK', fx0: 0.0396, fy0: 0.0771, fx1: 0.5054, fy1: 0.6909 },
  { key: 'zadok', label: 'ZADOK', fx0: 0.5381, fy0: 0.0771, fx1: 0.9849, fy1: 0.6909 },
  { key: 'rukavLavy', label: 'RUKÁV ĽAVÝ', fx0: 0.0151, fy0: 0.7422, fx1: 0.3682, fy1: 0.9053 },
  { key: 'rukavPravy', label: 'RUKÁV PRAVÝ', fx0: 0.4961, fy0: 0.7422, fx1: 0.8877, fy1: 0.9229 },
  { key: 'manzetaLava', label: 'MANŽETA Ľ.', fx0: 0.0269, fy0: 0.9131, fx1: 0.3569, fy1: 0.9321 },
  { key: 'manzetaPrava', label: 'MANŽETA P.', fx0: 0.5088, fy0: 0.9321, fx1: 0.8745, fy1: 0.9531 },
  { key: 'lemDole', label: 'LEM DOLE', fx0: 0.1650, fy0: 0.9663, fx1: 0.5967, fy1: 0.9849 },
  { key: 'golierKus1', label: 'GOLIER 1', fx0: 0.3271, fy0: 0.7583, fx1: 0.4097, fy1: 0.7749 },
  { key: 'golierKus2', label: 'GOLIER 2', fx0: 0.4233, fy0: 0.8066, fx1: 0.5088, fy1: 0.8237 },
  { key: 'golierKus3', label: 'GOLIER 3', fx0: 0.3809, fy0: 0.8882, fx1: 0.4663, fy1: 0.9053 },
];

// Vykresli referencnu sablonu (obrys + nazov kazdeho strihoveho dielu) na dodany canvas —
// pouziva sa aj na nahlad aj na stiahnutie PNG. Priehladne pozadie mimo dielov, aby grafik
// videl presne, kam vzor patri, ked si tuto sablonu importuje ako vodiacu vrstvu.
export function nakresliSablonu(ctx, canvasSize = CANVAS_SIZE) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.save();
  ctx.font = `bold ${Math.round(canvasSize * 0.014)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  PANELY.forEach((p) => {
    const x = p.fx0 * canvasSize;
    const y = p.fy0 * canvasSize;
    const w = (p.fx1 - p.fx0) * canvasSize;
    const h = (p.fy1 - p.fy0) * canvasSize;

    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = Math.max(2, canvasSize * 0.0015);
    ctx.setLineDash([canvasSize * 0.006, canvasSize * 0.004]);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#312e81';
    ctx.fillText(p.label, x + w / 2, y + h / 2);
  });

  ctx.restore();
}
