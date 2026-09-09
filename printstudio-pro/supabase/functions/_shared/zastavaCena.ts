// Server-side vypocet ceny zastavy (stoziarova/ulicna vlajka). Na rozdiel od beachvlajky
// (vlajkaCena.ts), tu admin zadava VYROBNE NAKLADY, nie predajnu cenu — preto tento vypocet
// beží VÝLUČNE tu (edge functions so servisnym klucom), nikdy v klientskom JS. Marzovy vzorec
// je zhodny s src/printstudio/pricingEngine.js a printstudio-pro/src/pricingEngine.js — pri
// zmene vzorca uprav VSETKY tri miesta rovnako. Zdroj pravdy: erp-marzovy-modul-specifikacia.md.

export interface PricingConfig {
  coefA: number; coefB: number; marginFloor: number; coefP: number; qtyAtFloor: number;
}

function baseMargin(cost: number, cfg: PricingConfig) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost: number, qty: number, cfg: PricingConfig) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.qtyAtFloor, 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost: number, qty: number, cfg: PricingConfig) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

export interface ZastavaNaklady {
  naklad_sitia_min: number;
  min_sitia_na_m2: number;
  naklad_laser_m2: number;
  naklad_tunel_bm: number;
  naklad_ocko_ks: number;
  naklad_karabinka_ks: number;
  naklad_popruh_bm: number;
  dph_percent: number;
  expresny_priplatok_percent: number;
}

export interface ZastavaVstup {
  sirkaCm: number;
  vyskaCm: number;
  materialNakladM2: number;
  vyhotovenie: 'obsite' | 'laser';
  tunelyBm: number;
  ockaPocet: number;
  karabinkyPocet: number;
  popruhBm: number;
  pocetKs: number;
  expresne: boolean;
  naklady: ZastavaNaklady;
  pricingConfig: PricingConfig;
}

export interface TunelPolozka { side: 'top' | 'bottom' | 'left' | 'right'; }
export interface OckoSkupina { side: 'top' | 'bottom' | 'left' | 'right' | 'all' | 'corners'; count: number; }
export interface KarabinkaSkupina { side: 'top' | 'bottom' | 'left' | 'right' | 'all'; count: number; }
export interface PopruhyStav { left?: boolean; top?: boolean; right?: boolean; bottom?: boolean; }

// Prevedie zoznamy modularneho hardveru (ako ich drzi zakaznicky konfigurator) na jednotky,
// ktore pouziva cenovy vzorec (bm / ks) — pouziva sa rovnako v price-preview aj v create-draft-order,
// aby zivy nahlad a finalna cena objednavky VZDY sedeli.
export function vypocitajHardwareRozmery(
  sirkaCm: number, vyskaCm: number,
  tunely: TunelPolozka[], ocka: OckoSkupina[], karabinky: KarabinkaSkupina[], popruhy: PopruhyStav,
) {
  const tunelyBm = (tunely || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  const ockaPocet = (ocka || []).reduce((s, g) => s + (g.side === 'all' ? g.count * 4 : g.side === 'corners' ? 4 : g.count), 0);
  const karabinkyPocet = (karabinky || []).reduce((s, c) => s + (c.side === 'all' ? c.count * 4 : c.count), 0);
  let popruhBm = 0;
  if (popruhy?.left) popruhBm += vyskaCm / 100;
  if (popruhy?.right) popruhBm += vyskaCm / 100;
  if (popruhy?.top) popruhBm += sirkaCm / 100;
  if (popruhy?.bottom) popruhBm += sirkaCm / 100;
  return { tunelyBm, ockaPocet, karabinkyPocet, popruhBm };
}

export function vypocitajCenuZastavy(v: ZastavaVstup) {
  const m2 = (v.sirkaCm * v.vyskaCm) / 10000;

  const nakladMaterial = m2 * v.materialNakladM2;
  const nakladVyhotovenie = v.vyhotovenie === 'laser'
    ? m2 * v.naklady.naklad_laser_m2
    : m2 * v.naklady.min_sitia_na_m2 * v.naklady.naklad_sitia_min;
  const nakladHardware =
    (v.tunelyBm || 0) * v.naklady.naklad_tunel_bm +
    (v.ockaPocet || 0) * v.naklady.naklad_ocko_ks +
    (v.karabinkyPocet || 0) * v.naklady.naklad_karabinka_ks +
    (v.popruhBm || 0) * v.naklady.naklad_popruh_bm;

  const nakladKus = nakladMaterial + nakladVyhotovenie + nakladHardware;
  const ks = Math.max(1, Math.round(v.pocetKs) || 1);

  const cenaKus = priceAt(nakladKus, ks, v.pricingConfig);
  const marzaPercent = Math.round(marginAt(nakladKus, ks, v.pricingConfig));

  const subtotal = cenaKus * ks;
  const expresnyPriplatok = v.expresne ? subtotal * (v.naklady.expresny_priplatok_percent / 100) : 0;
  const cenaBezDph = subtotal + expresnyPriplatok;
  const dphSuma = cenaBezDph * (v.naklady.dph_percent / 100);
  const cenaSpolu = cenaBezDph + dphSuma;

  return {
    m2: Math.round(m2 * 100) / 100,
    cenaKus: Math.round(cenaKus * 100) / 100,
    marzaPercent,
    subtotal: Math.round(subtotal * 100) / 100,
    expresnyPriplatok: Math.round(expresnyPriplatok * 100) / 100,
    expresnyPercent: v.naklady.expresny_priplatok_percent,
    cenaBezDph: Math.round(cenaBezDph * 100) / 100,
    dphSuma: Math.round(dphSuma * 100) / 100,
    cenaSpolu: Math.round(cenaSpolu * 100) / 100,
  };
}
