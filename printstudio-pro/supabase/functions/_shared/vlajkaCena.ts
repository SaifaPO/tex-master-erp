// Server-side prepočet ceny beachvlajky — MUSÍ zostať zosúladený so vzorcom vo
// src/beachflag/vlajkaCenotvorba.js (zákaznícky konfigurátor) a
// src/printstudio/vlajkaCenotvorba.js (admin testovacia kalkulačka).
// Nikdy sa neverí cene poslanej z klienta — táto funkcia si cenu vždy prepočíta
// nanovo z aktuálnych katalógových riadkov v DB.
export interface VlajkaCenaVstup {
  velkost: { cena: number } | null;
  dokoncenie: { cena: number } | null;
  stoziar: { cena: number } | null;
  doplnky: { cena: number; mnozstvo: number }[];
  expresne: boolean;
  pocetKs: number;
  nastavenia: { expresny_priplatok_percent: number };
  // DPH je odteraz centralna pre cely PrintStudio Pro (pricing_config.dph_percent), nie vlastna
  // kopia vo vlajka_nastavenia — volajuci ju musi zohnat sam a poslat sem.
  dphPercent: number;
}

export function vypocitajCenuVlajky({ velkost, dokoncenie, stoziar, doplnky, expresne, pocetKs, nastavenia, dphPercent }: VlajkaCenaVstup) {
  const cenaVelkosti = Number(velkost?.cena) || 0;
  const cenaDokoncenia = Number(dokoncenie?.cena) || 0;
  const cenaStoziara = Number(stoziar?.cena) || 0;
  const zaklad = cenaVelkosti + cenaDokoncenia + cenaStoziara;

  const doplnkySpolu = (doplnky || []).reduce((sum, d) => sum + (Number(d.cena) || 0) * (Number(d.mnozstvo) || 0), 0);

  const ks = Math.max(1, Number(pocetKs) || 1);
  const subtotal = (zaklad + doplnkySpolu) * ks;

  const expresnyPercent = Number(nastavenia?.expresny_priplatok_percent) || 0;
  const expresnyPriplatok = expresne ? subtotal * (expresnyPercent / 100) : 0;

  const cenaBezDph = subtotal + expresnyPriplatok;

  const dphSuma = cenaBezDph * ((Number(dphPercent) || 0) / 100);

  const cenaSpolu = cenaBezDph + dphSuma;

  return { zaklad, doplnkySpolu, subtotal, expresnyPriplatok, cenaBezDph, dphSuma, cenaSpolu };
}
