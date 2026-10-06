-- ============================================================
-- Katalog produktov: hotovy vyrobok na kusy (napr. bezsvova buffka) — koľko kusov sa vojde na 1 bezny meter
-- sublimacneho papiera. Z toho sa pocita plocha sublimacnej potlace (16000 cm2 / pocet kusov), nie zo spotreby latky.
-- Prazdne = povodne chovanie (plocha zo spotreby latky a sirky zo skladu). Bezpecne spustit opakovane.
-- ============================================================

alter table products add column if not exists ks_na_bm_sublimacie numeric(10,2);
