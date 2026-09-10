// Vypočíta cenu beachvlajky — rovnaká logika ako zákaznícky konfigurátor
// (printstudio-pro/src/beachflag/vlajkaCenotvorba.js — obe kópie musia zostať zosúladené,
// presne ako existujúca dvojica cenotvorba.js pre trička; live cena beží cez
// beachflag-price-preview Edge Function, toto je len pre admin testovaciu kalkulačku).
// Cena "veľkosti" už nie je plochá suma — počíta sa z nákladu materiálu (spotreba_m2 × naklad_m2
// daného materiálu) cez jednotný maržový vzorec (pricingEngine.js), rovnako ako pri Zástavách.
// Doplnky sa počítajú za kus × množstvo, celok sa násobí počtom kusov, potom expres, potom DPH.
//
// vstup:
//   nakladMaterial: number (spotreba_m2 × naklad_m2 materiálu)
//   pricingConfig: 5-koeficientová konfigurácia z Cenotvorby (pozri pricingEngine.js)
//   dokoncenie: { cena } | null
//   stoziar: { cena } | null
//   doplnky: [{ cena, mnozstvo }]
//   expresne: boolean
//   pocetKs: number
//   nastavenia: { dph_percent, expresny_priplatok_percent }
import { priceAt } from './pricingEngine';

export function vypocitajCenuVlajky({ nakladMaterial, pricingConfig, dokoncenie, stoziar, doplnky, expresne, pocetKs, nastavenia }) {
  const ks = Math.max(1, Number(pocetKs) || 1);
  const cenaVelkosti = priceAt(Number(nakladMaterial) || 0, ks, pricingConfig);
  const cenaDokoncenia = Number(dokoncenie?.cena) || 0;
  const cenaStoziara = Number(stoziar?.cena) || 0;
  const zaklad = cenaVelkosti + cenaDokoncenia + cenaStoziara;

  const doplnkySpolu = (doplnky || []).reduce((sum, d) => sum + (Number(d.cena) || 0) * (Number(d.mnozstvo) || 0), 0);

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
    vzorec: `(${cenaVelkosti.toFixed(2)} € materiál + ${cenaDokoncenia.toFixed(2)} € opracovanie + ${cenaStoziara.toFixed(2)} € prút + ${doplnkySpolu.toFixed(2)} € doplnky) × ${ks} ks${expresne ? ` + ${expresnyPercent}% expres` : ''} + ${dphPercent}% DPH`,
  };
}
