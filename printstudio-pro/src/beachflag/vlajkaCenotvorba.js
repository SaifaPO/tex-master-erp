// Vypočíta cenu beachvlajky — táto kópia MUSÍ zostať zosúladená s
// src/printstudio/vlajkaCenotvorba.js v hlavnej ERP appke (admin testovacia kalkulačka).
// Live cena v konfigurátore beží cez Edge Function beachflag-price-preview (server-side,
// nikdy nedôveruje klientovi) — tento súbor už nie je volaný z BeachflagApp.jsx priamo,
// je tu len ako zdokumentovaná referencia vzorca zosúladená s admin kalkulačkou.
// Cena "veľkosti" nie je plochá suma — počíta sa z nákladu materiálu (spotreba_m2 × naklad_m2)
// cez jednotný maržový vzorec (pricingEngine.js), rovnako ako pri Zástavách.
// Doplnky sa počítajú za kus × množstvo, celok sa násobí počtom kusov, potom expres, potom DPH.
import { priceAt } from '../pricingEngine';

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
