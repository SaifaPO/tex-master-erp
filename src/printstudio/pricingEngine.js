// ============================================================
// Marzovy cenovy modul — JEDINY zdroj pravdy pre vypocet marze/predajnej ceny
// z vyrobnej ceny a poctu kusov, pouzivany naprieč cel'ym PrintStudio Pro
// (Cenotvorba pre katalog produktov aj Cennik potlace pre nakladove kalkulacky).
// Vzorec presne podla specifikacie (erp-marzovy-modul-specifikacia.md), overene
// proti kontrolnej tabulke (napr. VC 1€/1ks -> 4,00€, VC 100€/1ks -> 151,32€,
// VC 500€ pri lubovolnom odbere -> 650,00€). NEMENIT poradie krokov ani
// zaokruhlovanie (zaokruhlovat az na konci) — inak sa vysledky rozidu s tabulkou.
// ============================================================

export function baseMargin(cost, cfg) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
export function marginAt(cost, qty, cfg) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.qtyAtFloor, 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
export function priceAt(cost, qty, cfg) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

// Odberove hladiny zobrazene v cenniku (kazdy produkt/kalkulacka x kazda hladina).
export const QUANTITY_LEVELS = [1, 10, 25, 50, 100, 250, 500, 1000];
// Rychle tlacidla prepinaca referencneho poctu kusov (samostatny zoznam zo specifikacie).
export const QTY_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

export const mapConfigFromDb = (r) => ({
  coefA: Number(r.coef_a), coefB: Number(r.coef_b), marginFloor: Number(r.margin_floor),
  coefP: Number(r.coef_p), qtyAtFloor: Number(r.qty_at_floor),
});
export const mapConfigToDb = (c) => ({
  coef_a: c.coefA, coef_b: c.coefB, margin_floor: c.marginFloor, coef_p: c.coefP, qty_at_floor: c.qtyAtFloor,
});

export const DEFAULT_PRICING_CONFIG = { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };
