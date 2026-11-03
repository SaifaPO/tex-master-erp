// Cena objednavky s viacerymi motivmi (kosik motivov) — pouzivaju Buffky a Celenky.
// POZOR: rovnaky algoritmus je v Edge Functions buffky-/celenky-create-draft-order (server cenu vzdy
// prepocita sam, klientovi neveri) — pri zmene tu treba upravit aj tam.
//
// Pravidla:
//  - mnozstevna hladina sa pocita z CELKOVEHO poctu kusov vsetkych motivov v objednavke,
//  - minimalna hodnota objednavky plati raz na cely tovar (doplatok sa rozpocita medzi motivy),
//  - B2B zlava, expres priplatok, poštovne (raz) a DPH sa pocitaju z celku.
import { priceAt } from './pricingEngine';

export function vypocitajKosik({ polozky, cfg, nastavenia, deliverySpeed = 'standard', osobnyOdber = false, b2bPercent = 0 }) {
  const ksSpolu = polozky.reduce((s, p) => s + Math.max(1, Number(p.pocetKs) || 1), 0);
  const riadky = polozky.map((p) => {
    const ks = Math.max(1, Number(p.pocetKs) || 1);
    const cenaKus = priceAt(Number(p.nakladKs) || 0, ksSpolu, cfg);
    return { ks, cenaKus, tovar: cenaKus * ks };
  });
  const tovarSpolu = riadky.reduce((s, r) => s + r.tovar, 0);
  const minimum = Number(nastavenia?.minimalna_cena_objednavky) || 0;
  const doplatokMinima = Math.max(0, minimum - tovarSpolu);
  const predZlavou = tovarSpolu + doplatokMinima;
  const b2bZlavaEur = Math.round(predZlavou * (Number(b2bPercent) || 0)) / 100;
  const subtotal = predZlavou - b2bZlavaEur;
  const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia?.priplatok_expres_percent) || 0) / 100) : 0;
  const shippingFee = osobnyOdber ? 0 : (Number(nastavenia?.cena_doprava) || 0);
  const grandTotalBezDph = subtotal + expressFee + shippingFee;
  const dphPercent = Number(cfg?.dphPercent) || 0;
  const dphSuma = grandTotalBezDph * (dphPercent / 100);
  const grandTotal = grandTotalBezDph + dphSuma;
  return { ksSpolu, riadky, tovarSpolu, minimum, doplatokMinima, predZlavou, b2bZlavaEur, subtotal, expressFee, shippingFee, grandTotalBezDph, dphPercent, dphSuma, grandTotal };
}
