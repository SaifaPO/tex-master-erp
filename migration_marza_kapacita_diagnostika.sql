-- Diagnostika 6. koeficientu marže: "cieľová € marža na jednotku redukovaného výkonu"
-- (kapacita/čas výroby). Zatiaľ NEOVPLYVŇUJE žiadnu skutočnú cenu — používa ho len nová
-- simulačná tabuľka v Cenotvorbe, aby Martin videl, ako by sa ceny zmenili, keby sa marža
-- viazala aj na to, koľko kapacity (Redukovaný výkon z Katalógu Modelov) daný kus spotrebuje,
-- nielen na výrobnú cenu a počet kusov ako doteraz. Živé funkcie priceAt/marginAt v
-- pricingEngine.js (používané aj Cenníkom potlače/DTF metrážou) tento stĺpec nečítajú.
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

alter table pricing_config add column if not exists cap_margin_target numeric(10,2) not null default 0;
