// Vypočíta cenu beachvlajky — táto kópia MUSÍ zostať zosúladená s
// src/printstudio/vlajkaCenotvorba.js v hlavnej ERP appke (admin testovacia kalkulačka)
// a s printstudio-pro/supabase/functions/_shared/vlajkaCena.ts (server-side prepočet pri objednávke).
// Na rozdiel od potlače na oblečení tu NEJDE o cm² formulu — každá veľkosť má plochú cenu,
// doplnky sa počítajú za kus × množstvo, celok sa násobí počtom kusov, potom expres, potom DPH.
export function vypocitajCenuVlajky({ velkost, dokoncenie, stoziar, doplnky, expresne, pocetKs, nastavenia }) {
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

  const dphPercent = Number(nastavenia?.dph_percent) || 0;
  const dphSuma = cenaBezDph * (dphPercent / 100);

  const cenaSpolu = cenaBezDph + dphSuma;
  const cenaKus = ks > 0 ? cenaSpolu / ks : 0;

  return {
    zaklad,
    doplnkySpolu,
    subtotal,
    expresnyPriplatok,
    cenaBezDph,
    dphSuma,
    cenaSpolu,
    cenaKus,
    vzorec: `(${cenaVelkosti.toFixed(2)} € veľkosť + ${cenaDokoncenia.toFixed(2)} € opracovanie + ${cenaStoziara.toFixed(2)} € prút + ${doplnkySpolu.toFixed(2)} € doplnky) × ${ks} ks${expresne ? ` + ${expresnyPercent}% expres` : ''} + ${dphPercent}% DPH`,
  };
}
