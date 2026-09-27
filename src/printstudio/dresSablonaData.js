// Presne umiestnenie strihovych dielov na 2048x2048 platne pre 3D dres — DUPLIKAT z
// printstudio-pro/src/dres3d/dresRenderer.js (PANELY) — su to rovnake UV suradnice zmerane
// priamo z modelu (jersey-base.glb), pri zmene strihu/UV uprav OBE miesta rovnako.
// Pouziva sa len na vygenerovanie referencnej sablony pre grafika (Vlajky/Beachvlajky admin
// nema pristup k printstudio-pro projektu, su to dva samostatne Vite projekty).
export const CANVAS_SIZE = 2048;

// predok/zadok/rukavLavy/rukavPravy maju `path` — realny (nie obdlznikovy) obrys strihu,
// ziskany z realneho CLO3D strihoveho exportu (Martin 2026-09-27, .dxf Pattern2D), premapovany
// z vlastnych suradnic strihu do tychto UV oblasti (zachovana skutocna krivka golierika/priramia,
// len roztiahnuta/posunuta presne do tej istej oblasti, akú predtym zabera obdlznik). Zvysne
// male diely (manzety/lem/golier) realny strih nemaju priradeny (neisté priradenie k malym
// pasikom v .dxf), ostavaju ako jednoduchy obdlznik.
export const PANELY = [
  { key: 'predok', label: 'PREDOK', fx0: 0.0396, fy0: 0.0771, fx1: 0.5054, fy1: 0.6909, path: 'M 1035.1,1414.9 L 1035.1,656.9 L 1035.1,610.7 L 1027.1,603.5 L 1019.5,596.2 L 1012.3,588.7 L 1005.5,581.1 L 999.1,573.2 L 993.1,565.1 L 987.4,556.7 L 982.1,548 L 977.1,538.9 L 972.5,529.4 L 968.2,519.5 L 964.2,509.2 L 960.5,498.3 L 957.2,487 L 954.1,475 L 951.3,462.5 L 948.7,449.3 L 946.5,435.5 L 944.4,421 L 942.6,405.8 L 941.1,389.7 L 939.7,372.9 L 938.6,355.3 L 937.7,336.7 L 936.9,317.3 L 936.4,297 L 936,275.6 L 935.7,253.3 L 935.7,229.9 L 935.7,229.9 L 721,157.9 L 719.3,169.4 L 717.2,180.6 L 714.8,191.3 L 712.2,201.8 L 709.3,211.8 L 706.1,221.5 L 702.6,230.9 L 698.8,239.9 L 694.7,248.4 L 690.3,256.7 L 685.6,264.5 L 680.6,272 L 675.3,279.1 L 669.7,285.8 L 663.8,292.1 L 657.7,298 L 651.1,303.6 L 644.3,308.7 L 637.2,313.5 L 629.8,317.8 L 622,321.8 L 614,325.4 L 605.6,328.5 L 596.9,331.3 L 587.9,333.6 L 578.6,335.5 L 568.9,337.1 L 558.9,338.2 L 548.6,338.9 L 548.6,338.9 L 539.6,338.1 L 530.8,336.9 L 522.2,335.3 L 513.8,333.2 L 505.7,330.6 L 497.8,327.6 L 490.2,324.1 L 482.9,320.3 L 475.8,316 L 469,311.3 L 462.4,306.2 L 456.1,300.7 L 450.2,294.9 L 444.5,288.7 L 439.1,282.1 L 434,275.2 L 429.2,268 L 424.7,260.4 L 420.5,252.5 L 416.6,244.3 L 413.1,235.8 L 409.9,226.9 L 407,217.9 L 404.5,208.5 L 402.3,198.9 L 400.4,189 L 398.9,178.9 L 397.8,168.5 L 397,157.9 L 397,157.9 L 177.8,228.5 L 175.1,436.2 L 190.5,495.7 L 153.5,591.4 L 81.1,609.3 L 81.1,656.9 L 81.1,1415 Z' },
  { key: 'zadok', label: 'ZADOK', fx0: 0.5381, fy0: 0.0771, fx1: 0.9849, fy1: 0.6909, path: 'M 2017.1,1414.9 L 2017.1,656.9 L 2017.1,610.7 L 2006.8,604.8 L 1997.4,598.6 L 1988.6,592.1 L 1980.5,585.3 L 1973.2,578 L 1966.5,570.4 L 1960.4,562.4 L 1954.9,553.9 L 1950,544.9 L 1945.7,535.5 L 1941.9,525.5 L 1938.6,515 L 1935.8,503.9 L 1933.4,492.2 L 1931.5,479.9 L 1930,467 L 1928.9,453.4 L 1928.2,439.2 L 1927.8,424.2 L 1927.7,408.4 L 1927.8,392 L 1928.3,374.7 L 1929,356.6 L 1929.9,337.7 L 1931,318 L 1932.3,297.3 L 1933.7,275.8 L 1935.2,253.3 L 1936.8,229.9 L 1936.8,229.9 L 1722.4,157.9 L 1697.8,176 L 1668.5,184.2 L 1610.1,191.4 L 1551.4,194.6 L 1515.7,192.7 L 1480,189.8 L 1444.5,184.4 L 1410.8,171.7 L 1403.8,165.7 L 1398.6,157.9 L 1179.6,228.5 L 1181.7,433.4 L 1192.3,495.7 L 1174.4,591.4 L 1102,609.3 L 1102,656.9 L 1102,1415 Z' },
  { key: 'rukavLavy', label: 'RUKÁV ĽAVÝ', fx0: 0.0151, fy0: 0.7422, fx1: 0.3682, fy1: 0.9053, path: 'M 730.4,1854.1 L 754.1,1701.1 L 691.7,1683.2 L 634.4,1652.4 L 583.3,1611.4 L 532.8,1570.4 L 476.2,1539.1 L 412.1,1521.6 L 402.7,1520.8 L 393.3,1520 L 379.3,1520.4 L 365.3,1521.4 L 351.4,1523.4 L 309.3,1535.3 L 260,1557.3 L 227.8,1577.8 L 214.9,1587.2 L 127.4,1652.3 L 30.9,1701.7 L 55.7,1854.1 Z' },
  { key: 'rukavPravy', label: 'RUKÁV PRAVÝ', fx0: 0.4961, fy0: 0.7422, fx1: 0.8877, fy1: 0.9229, path: 'M 1042.2,1890.1 L 1016,1720.7 L 1085.1,1700.8 L 1148.7,1666.7 L 1205.4,1621.3 L 1261.4,1575.8 L 1324.1,1541.2 L 1395.3,1521.8 L 1405.7,1520.9 L 1416.1,1520 L 1431.7,1520.4 L 1447.2,1521.5 L 1462.6,1523.7 L 1509.3,1537 L 1563.9,1561.3 L 1599.6,1584 L 1614,1594.5 L 1711.1,1666.6 L 1818,1721.3 L 1790.6,1890.1 Z' },
  { key: 'manzetaLava', label: 'MANŽETA Ľ.', fx0: 0.0269, fy0: 0.9131, fx1: 0.3569, fy1: 0.9321 },
  { key: 'manzetaPrava', label: 'MANŽETA P.', fx0: 0.5088, fy0: 0.9321, fx1: 0.8745, fy1: 0.9531 },
  { key: 'lemDole', label: 'LEM DOLE', fx0: 0.1650, fy0: 0.9663, fx1: 0.5967, fy1: 0.9849 },
  { key: 'golierKus1', label: 'GOLIER 1', fx0: 0.3271, fy0: 0.7583, fx1: 0.4097, fy1: 0.7749 },
  { key: 'golierKus2', label: 'GOLIER 2', fx0: 0.4233, fy0: 0.8066, fx1: 0.5088, fy1: 0.8237 },
  { key: 'golierKus3', label: 'GOLIER 3', fx0: 0.3809, fy0: 0.8882, fx1: 0.4663, fy1: 0.9053 },
];

// Vykresli referencnu sablonu (obrys + nazov kazdeho strihoveho dielu) na dodany canvas —
// pouziva sa aj na nahlad aj na stiahnutie PNG. Priehladne pozadie mimo dielov, aby grafik
// videl presne, kam vzor patri, ked si tuto sablonu importuje ako vodiacu vrstvu. `path` (ak
// existuje) je uz zapisany v absolutnych suradniciach pre CANVAS_SIZE=2048 — canvasSize sa tu
// preto nemeni (appka ho vzdy vola s 2048).
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

    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = Math.max(2, canvasSize * 0.0015);
    ctx.setLineDash(p.path ? [] : [canvasSize * 0.006, canvasSize * 0.004]);
    if (p.path) {
      const region = new Path2D(p.path);
      ctx.fill(region);
      ctx.stroke(region);
    } else {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    ctx.fillStyle = '#312e81';
    ctx.fillText(p.label, x + w / 2, y + h / 2);
  });

  ctx.restore();
}
