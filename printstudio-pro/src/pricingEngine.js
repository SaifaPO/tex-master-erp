// Duplicitne s src/printstudio/pricingEngine.js v hlavnom ERP repozitári (printstudio-pro je
// samostatný Vite projekt/build, nemôže importovať súbory odtiaľ) — pri zmene vzorca uprav OBIDVE
// miesta rovnako. Zdroj pravdy: erp-marzovy-modul-specifikacia.md.
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

export const mapConfigFromDb = (r) => ({
  coefA: Number(r.coef_a), coefB: Number(r.coef_b), marginFloor: Number(r.margin_floor),
  coefP: Number(r.coef_p), qtyAtFloor: Number(r.qty_at_floor),
});

export const DEFAULT_PRICING_CONFIG = { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };
