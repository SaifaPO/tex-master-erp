-- ============================================================
-- MIGRÁCIA: Sieťotlač — samostatný čas tlače pre tmavý textil (2 vrstvy farby = dlhšie ako svetlý)
-- Stĺpec cas_tlace_min_tmavy sa v kóde používa už dávnejšie, no nikdy nebol pridaný do databázy —
-- to je presný dôvod, prečo upsert celého riadku cennik_sietotlac padal na "column not found"
-- a UI vracalo späť VŠETKY polia karty (nielen tento jeden), aj "Odporúčaný min. počet" a "Čas tlače".
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table cennik_sietotlac add column if not exists cas_tlace_min_tmavy numeric(10,2) not null default 0;
