-- ============================================================
-- MIGRÁCIA: Sieťotlač — práca operátora (€/hod), samostatne od elektriny strojov
-- Doplnenie k migration_potlace_stroje_elektrina.sql — tá pridala len ELEKTRINU karuselu/tunela.
-- Chýbala ešte ľudská práca (obsluha) za čas tlače+fixácie, tak ako ju majú DTF/rezaný transfer/
-- sublimácia (pole cena_prace_hod). Bez vyplnenia sa nič nemení (default 0).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table cennik_sietotlac add column if not exists cena_prace_hod numeric(10,2) not null default 0;
