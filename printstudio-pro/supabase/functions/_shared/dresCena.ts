// Server-side prepočet ceny 3D dresu — MUSÍ zostať zosúladený so vzorcom vo
// src/dres3d/dres3dCenotvorba.js (zákaznícky konfigurátor).
// Nikdy sa neverí cene poslanej z klienta — táto funkcia si cenu vždy prepočíta
// nanovo z aktuálnych katalógových riadkov v DB.
export interface DresZlava {
  min_pocet: number;
  zlava_percent: number;
}

export interface DresCenaVstup {
  zakladnaCena: number;
  priplatokMaterial: number;
  pocetHracov: number;
  zlavy: DresZlava[];
}

export function najdiZlavuPreMnozstvo(zlavy: DresZlava[], pocet: number): number {
  const vyhovujuce = (zlavy || [])
    .filter((z) => pocet >= Number(z.min_pocet))
    .sort((a, b) => Number(b.min_pocet) - Number(a.min_pocet));
  return vyhovujuce.length ? Number(vyhovujuce[0].zlava_percent) : 0;
}

export function vypocitajCenuDresu({ zakladnaCena, priplatokMaterial, pocetHracov, zlavy }: DresCenaVstup) {
  const zakladnaCenaNum = Number(zakladnaCena) || 0;
  const priplatokNum = Number(priplatokMaterial) || 0;
  const jednotkovaCenaPredZlavou = zakladnaCenaNum + priplatokNum;
  const pocet = Math.max(1, Number(pocetHracov) || 1);
  const zlavaPercent = najdiZlavuPreMnozstvo(zlavy, pocet);
  const jednotkovaCena = jednotkovaCenaPredZlavou * (1 - zlavaPercent / 100);
  const cenaSpolu = jednotkovaCena * pocet;

  return { jednotkovaCenaPredZlavou, zlavaPercent, jednotkovaCena, pocet, cenaSpolu };
}
