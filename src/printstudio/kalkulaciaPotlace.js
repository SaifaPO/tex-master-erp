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
  { id: 't3d', label: '3D transfer', colors: false, needsRozmer: true, needs3d: true },
];

const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };

// ---- 3D transfery ----
// Výrobný náklad 3D transferu sa počíta na serveri (Edge Function transfer3d-create-draft-order, ako v appke pre zákazníkov — skladanie motívov na fóliu,
// farby, lak, čas tlače…). Tu si berieme len náklad na kus (admin odpoveď) a predajnú cenu dopočítame rovnakou maržovou krivkou ako pri ostatných technológiách.
// Výsledky sa držia v pamäti (60 s), aby sa kalkulačka nesekala; po načítaní sa komponent prekreslí cez `onZmena`.
const TTL_3D = 60 * 1000;
const cache3d = new Map(); // kľúč → { stav: 'caka' | 'ok' | 'chyba', vc?, chyba?, t }
let moznosti3d = null; // { t, p: Promise<{urovne, laky}> }
export const kluc3d = (p, kusov) => `${num(p.sirka)}x${num(p.vyska)}x${kusov}|${p.uroven || 'medium'}|${p.lak || 'partial'}`;
export const naklad3dZCache = (p, kusov) => cache3d.get(kluc3d(p, kusov));
export function nacitaj3dMoznosti(supabase) {
  if (!moznosti3d || Date.now() - moznosti3d.t > TTL_3D) {
    moznosti3d = { t: Date.now(), p: Promise.all([
      supabase.from('transfer3d_urovne').select('kod, nazov').order('poradie'),
      supabase.from('transfer3d_laky').select('kod, nazov').order('poradie'),
    ]).then(([u, l]) => ({ urovne: u.data || [], laky: l.data || [] })).catch(() => ({ urovne: [], laky: [] })) };
  }
  return moznosti3d.p;
}
export async function nacitaj3dNaklad(supabase, p, kusov) {
  const key = kluc3d(p, kusov);
  const stary = cache3d.get(key);
  if (stary && (stary.stav === 'caka' || Date.now() - stary.t < TTL_3D)) return;
  cache3d.set(key, { stav: 'caka', t: Date.now() });
  try {
    const { data, error } = await supabase.functions.invoke('transfer3d-create-draft-order', { body: { preview: true, sirkaCm: num(p.sirka), vyskaCm: num(p.vyska), pocetKs: kusov, uroven: p.uroven || 'medium', lak: p.lak || 'partial' } });
    if (error || !data?.ok) cache3d.set(key, { stav: 'chyba', chyba: data?.error || `3D transfer sa nepodarilo vypočítať${error?.message ? ` (${error.message})` : ''}`, t: Date.now() });
    else if (!data.admin) cache3d.set(key, { stav: 'chyba', chyba: 'Náklady 3D transferu vidí len prihlásený admin.', t: Date.now() });
    else cache3d.set(key, { stav: 'ok', vc: Number(data.admin.nakladKs) || 0, t: Date.now() });
  } catch (e) {
    cache3d.set(key, { stav: 'chyba', chyba: `3D transfer sa nepodarilo vypočítať (${e?.message || 'chyba'})`, t: Date.now() });
  }
}

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
    vc = vcDtfGarmentRozpis(kostra, plocha, pocetNazehleniDtf(kostra, p.sirka, p.vyska), kusov).spolu; // motív väčší než lis sa žehlí viackrát; + príprava objednávky na kus
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
  } else if (p.metoda === 't3d') {
    const z = naklad3dZCache(p, kusov);
    if (!z || z.stav === 'caka') chyba = 'Počítam 3D transfer…';
    else if (z.stav === 'chyba') chyba = z.chyba;
    else vc = z.vc;
    dodatok = [p.urovenNazov, p.lakNazov].filter(Boolean).join(', ');
  } else if (p.metoda === 'rezany') {
    const folia = kostra.folie.find((f) => String(f.id) === String(p.foliaId));
    if (!folia) chyba = 'Vyber typ fólie.';
    vc = vcRezanyTransferRozpis(kostra, p.foliaId, plocha, farby, kusov, p.zlozitost || 'jednoduche').spolu;
    dodatok = [folia?.nazov, p.zlozitost === 'stredne' ? 'stredne zložité' : p.zlozitost === 'zlozite' ? 'zložité' : ''].filter(Boolean).join(', ');
  }
  const jednotkova = Math.max(priceAt(vc, kusov, kostra.pricingConfig), minCenaPotlace(kostra, p.metoda));
  const marza = vc > 0 ? ((jednotkova / vc) - 1) * 100 : 0;
  const farbyLabel = def.colors ? `${farby}F` : '';
  const label = [def.label, popisRozmeru, dodatok, farbyLabel].filter(Boolean).join(' — ');
  return { vc, jednotkova, plocha: plochaPouzita, marza, label, popisRozmeru, chyba };
}
