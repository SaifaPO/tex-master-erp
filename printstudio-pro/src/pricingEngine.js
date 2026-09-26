// Duplicitne s src/printstudio/pricingEngine.js v hlavnom ERP repozitári (printstudio-pro je
// samostatný Vite projekt/build, nemôže importovať súbory odtiaľ) — pri zmene vzorca uprav OBIDVE
// miesta rovnako. Zdroj pravdy: erp-marzovy-modul-specifikacia.md.
export function baseMargin(cost, cfg) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
// Pocet kusov, pri ktorom uz zakazka dosahuje "cielovu hodnotu velkej zakazky" (€, Cenotvorba) —
// draha polozka (vysoke cost) dosiahne tuto hranicu uz pri par stovkach ks, lacna az pri tisickach.
export function qtyAtFloorFor(cost, cfg) {
  return Math.max(cfg.cielovaHodnotaZakazky / Math.max(cost, 0.05), 2);
}
export function marginAt(cost, qty, cfg) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = qtyAtFloorFor(cost, cfg);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
export function priceAt(cost, qty, cfg) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

export const mapConfigFromDb = (r) => ({
  coefA: Number(r.coef_a), coefB: Number(r.coef_b), marginFloor: Number(r.margin_floor),
  coefP: Number(r.coef_p), cielovaHodnotaZakazky: Number(r.cielova_hodnota_zakazky ?? 25000),
  dphPercent: Number(r.dph_percent ?? 23),
});

// dphPercent — JEDINA DPH sadzba pre cely PrintStudio Pro, nastavuje sa v admin appke (zalozka
// Cenotvorba), sem sa len cita. Predtym mal kazdy modul vlastnu nezavislu kopiu v *_nastavenia,
// co sa raz rozislo (Buffky 15% namiesto 23%) — odteraz jeden zdroj pravdy.
export const DEFAULT_PRICING_CONFIG = { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

// Odberove hladiny zobrazene v tabulkach mnozstevnych zliav (Celenky/Buffky/DTF metraz/Textilna metraz).
export const QUANTITY_LEVELS = [1, 10, 25, 50, 100, 250, 500, 1000];
