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

// ============================================================
// DIAGNOSTIKA (6. koeficient) — este NEPOUZITE nikde v zivom vypocte ceny (priceAt/marginAt
// vyssie zostavaju bezo zmeny). Overuje myslienku, ci by sa marza mala viazat aj na to, kolko
// kapacity (Redukovany vykon z Katalogu Modelov, proxy za cas vyroby) dany kus spotrebuje —
// nielen na vyrobnu cenu a pocet kusov. Robi sa ako PODLAHA navyse k existujucej marzi: ak by
// aktualna marza dala menej ako cfg.capMarginTarget € na jednotku redukovaneho vykonu, marza sa
// zdvihne tak, aby na tento ciel dosiahla — produkty narocne na kapacitu tak nikdy nedostanu
// tenku marzu len preto, ze su lacne na vyrobu. Ak capMarginTarget=0 alebo produkt nema
// redukovany vykon, sprava sa identicky ako marginAt/priceAt (bezo zmeny).
export function marginWithCapacity(cost, qty, redukovanyVykon, cfg) {
  const base = marginAt(cost, qty, cfg);
  if (!cfg.capMarginTarget || !redukovanyVykon || redukovanyVykon <= 0) return base;
  const c = Math.max(cost, 0.05);
  const requiredPct = (cfg.capMarginTarget * redukovanyVykon / c) * 100;
  return Math.max(base, requiredPct);
}
export function priceWithCapacity(cost, qty, redukovanyVykon, cfg) {
  return Math.round(cost * (1 + marginWithCapacity(cost, qty, redukovanyVykon, cfg) / 100) * 100) / 100;
}
// € marže na jednotku redukovaného výkonu pri danej cene/marži — priama odpoveď na otázku
// "obracia sa táto marža rovnako rýchlo ako pri iných produktoch, vzhľadom na kapacitu?".
export function marginEurPerCapUnit(cost, margin, redukovanyVykon) {
  if (!redukovanyVykon || redukovanyVykon <= 0) return null;
  return (cost * margin / 100) / redukovanyVykon;
}

// VOC/MOC nahlad — velkoobchodna cena (pre reklamky) sa pocita ako zlava z bezne pocitanej
// (maloobchodnej) ceny, NIE ako samostatna paralelna krivka — dnesny vzorec uz zodpoveda
// realnej cene, ktoru vidi koncovy zakaznik na zivom Shopify konfiguratore (Dizajner/Zastava/
// DTF metraz), takze tu ostava ukotvena ako "strop" a velkoobchod je z nej zlava smerom dole.
// Cisto diagnosticke — ceny v Cenniku potlace/DTF metrazi/konfiguratoroch sa tymto nemenia.
export function wholesalePriceOf(retailPrice, cfg) {
  const d = cfg.wholesaleDiscountPercent || 0;
  return Math.round(retailPrice * (1 - d / 100) * 100) / 100;
}

// Odberove hladiny zobrazene v cenniku (kazdy produkt/kalkulacka x kazda hladina).
export const QUANTITY_LEVELS = [1, 10, 25, 50, 100, 250, 500, 1000];
// Rychle tlacidla prepinaca referencneho poctu kusov (samostatny zoznam zo specifikacie).
export const QTY_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

export const mapConfigFromDb = (r) => ({
  coefA: Number(r.coef_a), coefB: Number(r.coef_b), marginFloor: Number(r.margin_floor),
  coefP: Number(r.coef_p), qtyAtFloor: Number(r.qty_at_floor), capMarginTarget: Number(r.cap_margin_target ?? 0),
  wholesaleDiscountPercent: Number(r.wholesale_discount_percent ?? 15),
});
export const mapConfigToDb = (c) => ({
  coef_a: c.coefA, coef_b: c.coefB, margin_floor: c.marginFloor, coef_p: c.coefP, qty_at_floor: c.qtyAtFloor,
  cap_margin_target: c.capMarginTarget ?? 0, wholesale_discount_percent: c.wholesaleDiscountPercent ?? 15,
});

export const DEFAULT_PRICING_CONFIG = { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000, capMarginTarget: 0, wholesaleDiscountPercent: 15 };
