-- ============================================================
-- MIGRÁCIA: Automatický dopočet Výrobnej ceny v Katalógu Produktov
-- Pridáva jednu centrálnu sadzbu "cena šitia (€/min)" do pricing_config (rovnaké miesto ako DPH —
-- Cenotvorba) a 3 nové polia na produkt (Katalóg Produktov): minuty_sitia, rezia_ks, cena_potlace_ks.
-- Ak admin vyplní minuty_sitia, appka vypočíta production_cost = minuty_sitia * cena_minuty_sitia
-- + rezia_ks + cena_potlace_ks automaticky. Ak minuty_sitia NIE JE vyplnené (starý model), production_cost
-- ostáva čisto ručné pole ako doteraz — žiadny existujúci model sa touto migráciou nezmení.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table pricing_config add column if not exists cena_minuty_sitia numeric(10,2) not null default 0;

alter table products add column if not exists minuty_sitia numeric(10,2);
alter table products add column if not exists rezia_ks numeric(10,2);
alter table products add column if not exists cena_potlace_ks numeric(10,2);
