// Cena JEDNEJ potlače (jedno logo/umiestnenie) podľa technológie — rovnaký vzorec ako kalkulačka tlače v Cenových ponukách
// (src/CenovePonukyTab.jsx, sekcia „Potlač (kalkulačka)“), len ako samostatná funkcia, aby sa dalo nacenit VIAC potlačí naraz
// (napr. malé logo vpredu + veľké vzadu na chrbte). VC (výrobná cena) z Kostry cien, predajná cena = marža podľa počtu kusov
// z krivky v Cenotvorbe, najmenej však „min. cena úkonu“ danej technológie.
import { priceAt } from './pricingEngine';
import { vcSublimaciaGarmentRozpis, vcDtfGarmentRozpis, pocetNazehleniDtf, vcRezanyTransferRozpis, vcVysivka, vcSietotlacCelkom, plochaFormatuSietotlac, minCenaPotlace } from './vyrobneNaklady';

export const METODY_POTLACE = [
  { id: 'dtf', label: 'DTF', colors: false, needsRozmer: true },
  { id: 'rezany', label: 'Rezaný transfer', colors: true, needsRozmer: true, needsFolia: true },
  { id: 'sietotlac', label: 'Sieťotlač', colors: true, needsFormat: true },
  { id: 'sublimacia', label: 'Sublimácia', colors: false, needsRozmer: true },
  { id: 'vysivka', label: 'Výšivka', colors: false, needsRozmer: true },
];

const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };

/**
 * @param kostra  výsledok nacitajKostru(supabase)
 * @param p       { metoda, sirka, vyska, farby, velkostId, tmavy, foliaId }
 * @param ks      počet kusov (pre všetky potlače rovnaký — určuje maržu)
 * @returns { vc, jednotkova, plocha, marza, label, popisRozmeru, chyba }
 */
export function cenaPotlace(kostra, p, ks) {
  const def = METODY_POTLACE.find((m) => m.id === p.metoda);
  const kusov = Math.max(1, Math.round(num(ks)) || 1);
  const farby = def?.colors ? Math.max(1, Math.round(num(p.farby)) || 1) : 1;
  const plocha = Math.round(num(p.sirka) * num(p.vyska) * 10) / 10;
  let vc = 0;
  let chyba = '';
  let plochaPouzita = plocha;
  let popisRozmeru = `${num(p.sirka)}×${num(p.vyska)} cm`;
  let dodatok = '';
  if (!kostra || !def) return { vc: 0, jednotkova: 0, plocha, marza: 0, label: def?.label || p.metoda, popisRozmeru, chyba: 'Chýbajú výrobné náklady (Kostra cien).' };

  if (p.metoda === 'sublimacia') {
    const rz = vcSublimaciaGarmentRozpis(kostra, plocha);
    vc = rz?.spolu ?? 0;
  } else if (p.metoda === 'dtf') {
    vc = vcDtfGarmentRozpis(kostra, plocha, pocetNazehleniDtf(kostra, p.sirka, p.vyska)).spolu; // motív väčší než lis sa žehlí viackrát
  } else if (p.metoda === 'vysivka') {
    vc = vcVysivka(kostra, plocha, kusov);
  } else if (p.metoda === 'sietotlac') {
    const vlastny = !p.velkostId || p.velkostId === 'vlastny';
    const format = vlastny ? null : kostra.sietotlacVelkosti.find((v) => String(v.id) === String(p.velkostId));
    if (!vlastny && !format) chyba = 'Vyber formát sieťotlače.';
    vc = vcSietotlacCelkom(kostra, vlastny ? 'vlastny' : format?.id, !!p.tmavy, farby, kusov, plocha);
    plochaPouzita = plochaFormatuSietotlac(kostra, vlastny ? 'vlastny' : format?.id, plocha);
    popisRozmeru = vlastny ? popisRozmeru : (format?.label || '');
    dodatok = `${p.tmavy ? 'tmavý' : 'svetlý'} textil`;
  } else if (p.metoda === 'rezany') {
    const folia = kostra.folie.find((f) => String(f.id) === String(p.foliaId));
    if (!folia) chyba = 'Vyber typ fólie.';
    vc = vcRezanyTransferRozpis(kostra, p.foliaId, plocha, farby).spolu;
    dodatok = folia?.nazov || '';
  }
  const jednotkova = Math.max(priceAt(vc, kusov, kostra.pricingConfig), minCenaPotlace(kostra, p.metoda));
  const marza = vc > 0 ? ((jednotkova / vc) - 1) * 100 : 0;
  const farbyLabel = def.colors ? `${farby}F` : '';
  const label = [def.label, popisRozmeru, dodatok, farbyLabel].filter(Boolean).join(' — ');
  return { vc, jednotkova, plocha: plochaPouzita, marza, label, popisRozmeru, chyba };
}
