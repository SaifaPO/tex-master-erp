// Klientský náhľad ceny 3D dresu. Zrkadlené server-side v
// supabase/functions/_shared/dresCena.ts — server túto cenu nikdy neprevezme priamo z klienta,
// len ju použije na živý náhľad pred odoslaním objednávky.

export function najdiZlavuPreMnozstvo(zlavy, pocet) {
  const vyhovujuce = (zlavy || [])
    .filter(z => Number(pocet) >= Number(z.min_pocet))
    .sort((a, b) => Number(b.min_pocet) - Number(a.min_pocet));
  return vyhovujuce.length ? Number(vyhovujuce[0].zlava_percent) : 0;
}

export function vypocitajCenuDresu({ zakladnaCena, priplatokMaterial = 0, pocetHracov = 1, zlavy = [] }) {
  const zakladnaCenaNum = Number(zakladnaCena) || 0;
  const priplatokNum = Number(priplatokMaterial) || 0;
  const jednotkovaCenaPredZlavou = zakladnaCenaNum + priplatokNum;
  const pocet = Math.max(1, Number(pocetHracov) || 1);
  const zlavaPercent = najdiZlavuPreMnozstvo(zlavy, pocet);
  const jednotkovaCena = jednotkovaCenaPredZlavou * (1 - zlavaPercent / 100);
  const cenaSpolu = jednotkovaCena * pocet;

  return {
    jednotkovaCenaPredZlavou,
    zlavaPercent,
    jednotkovaCena,
    pocet,
    cenaSpolu,
  };
}
