// Doteraz sa fonty z admin tabulky "fonty" pouzivali priamo ako CSS font-family na Fabric.js
// textovych objektoch, ale NIKDY sa nikde skutocne nenacitali (ziadny <link> na Google Fonts,
// ziadne @font-face) — ak font nebol nahodou uz systemovy (Arial, Impact...), prehliadac ho
// ticho nahradil predvolenym pismom bez akehokolvek varovania. Tato funkcia to napraví: pre
// dany zoznam nazvov fontov (z tabulky "fonty") pripoji <link> na Google Fonts CSS2 API.
// Neznáme/systemove nazvy (napr. Arial, Impact) Google jednoducho ignoruje, nic sa nepokazi.
const nacitaneRodiny = new Set();

export function nacitajGoogleFonty(nazvyFontov) {
  const nove = (nazvyFontov || []).filter((n) => n && !nacitaneRodiny.has(n));
  if (nove.length === 0) return;
  nove.forEach((n) => nacitaneRodiny.add(n));

  const families = nove
    .map((n) => `family=${encodeURIComponent(n).replace(/%20/g, '+')}:wght@400;700`)
    .join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}
