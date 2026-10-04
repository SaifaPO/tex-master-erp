// Stiahnutie strihu beachvlajky (tvar x velkost) ako vektorove PDF v mierke 1:1 s tromi ciarami:
//   orez (cervena), bezpecna zona (zelena), spadavka (oranzova).
// 1 jednotka v cestach z databazy = 1 cm, strana PDF = viewbox (vlajka + 5 cm okraj na kazdej strane).
// Bez externych kniznic — jednoduchy PDF zapisany rucne (cesty maju len prikazy M, L, Z).

const CM_NA_PT = 72 / 2.54;

function bodyCesty(d) {
  // vrati pole podciest: [[ [x,y], ... ], zatvorena]
  const casti = [];
  let akt = null;
  const tokeny = (d || '').match(/[MLZmlz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0;
  let cmd = null;
  while (i < tokeny.length) {
    const t = tokeny[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') { if (akt) { akt.zatvorena = true; casti.push(akt); akt = null; } }
      continue;
    }
    const x = parseFloat(tokeny[i]);
    const y = parseFloat(tokeny[i + 1]);
    i += 2;
    if (cmd === 'M') { if (akt) casti.push(akt); akt = { body: [[x, y]], zatvorena: false }; cmd = 'L'; }
    else if (akt) akt.body.push([x, y]);
  }
  if (akt) casti.push(akt);
  return casti;
}

function cestaPdf(d, h) {
  const k = CM_NA_PT;
  const f = (n) => (Math.round(n * 1000) / 1000).toString();
  let out = '';
  for (const c of bodyCesty(d)) {
    c.body.forEach(([x, y], idx) => { out += `${f(x * k)} ${f((h - y) * k)} ${idx === 0 ? 'm' : 'l'}\n`; });
    out += c.zatvorena ? 'h S\n' : 'S\n';
  }
  return out;
}

const ascii = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?').replace(/([()\\])/g, '\\$1');

export function vytvorStrihPdf({ tvarNazov, velkostKod, rozmer }) {
  const parts = (rozmer.viewbox || '0 0 100 100').split(/\s+/).map(Number);
  const w = parts[2];
  const h = parts[3];
  const sirkaPt = w * CM_NA_PT;
  const vyskaPt = h * CM_NA_PT;
  const k = CM_NA_PT;

  let obsah = '';
  // spadavka (oranzova), orez (cervena), bezpecna zona (zelena)
  const ciary = [
    { cesta: rozmer.bleed_path, rgb: '0.96 0.62 0.04', hrubka: 0.35, nazov: 'Spadavka (5 cm za orez)' },
    { cesta: rozmer.cut_path, rgb: '0.94 0.27 0.27', hrubka: 0.5, nazov: 'Orez' },
    { cesta: rozmer.safe_path, rgb: '0.06 0.73 0.51', hrubka: 0.35, nazov: 'Bezpecna zona (4 cm dovnutra)' },
  ];
  for (const c of ciary) {
    if (!c.cesta) continue;
    obsah += `${c.rgb} RG\n${c.hrubka} w\n${cestaPdf(c.cesta, h)}`;
  }
  // popisky v hornom okraji (vo vnutri spadavky): nazov, rozmer, legenda
  const popis = ascii(`${tvarNazov} ${velkostKod} - strih 1:1 (1 cm = 1 cm)` + (rozmer.rozmer_popis ? ` - vlajka ${rozmer.rozmer_popis}` : ''));
  const y1 = (h - 1.2) * k;
  const y2 = (h - 2.2) * k;
  const y3 = (h - 3.2) * k;
  const y4 = (h - 4.2) * k;
  obsah += `BT /F1 7 Tf 0 0 0 rg ${1 * k} ${y1} Td (${popis}) Tj ET\n`;
  const legenda = [
    ['0.94 0.27 0.27', 'Orez'],
    ['0.06 0.73 0.51', 'Bezpecna zona'],
    ['0.96 0.62 0.04', 'Spadavka'],
  ];
  [y2, y3, y4].forEach((y, i) => {
    obsah += `${legenda[i][0]} RG 1 w ${1 * k} ${y + 2} m ${2.5 * k} ${y + 2} l S\nBT /F1 7 Tf 0 0 0 rg ${2.9 * k} ${y} Td (${legenda[i][1]}) Tj ET\n`;
  });

  const objekty = [];
  objekty.push('<< /Type /Catalog /Pages 2 0 R >>');
  objekty.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objekty.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${sirkaPt.toFixed(2)} ${vyskaPt.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
  objekty.push(`<< /Length ${obsah.length} >>\nstream\n${obsah}endstream`);
  objekty.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsety = [];
  objekty.forEach((o, i) => { offsety.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekty.length + 1}\n0000000000 65535 f \n`;
  offsety.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objekty.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function stiahniStrihPdf({ tvarKod, tvarNazov, velkostKod, rozmer }) {
  const blob = vytvorStrihPdf({ tvarNazov, velkostKod, rozmer });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `strih-${tvarKod}-${velkostKod}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
