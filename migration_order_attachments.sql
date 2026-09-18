-- ============================================================
-- MIGRÁCIA: Grafické podklady priamo pri zákazke (sprievodný list)
-- Súbory sa ukladajú do už existujúceho Storage bucketu "item-attachments"
-- (rovnaký ako pri prílohách produktov), do priečinka
-- objednavky/<rok>/<číslo zákazky> - <odberateľ>/<poradové číslo>.<prípona>
-- Táto tabuľková zmena len pridáva stĺpec, kde sa drží zoznam metadát
-- (odkaz, názov súboru, popis, kto a kedy nahral) — samotné súbory sú v Storage.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table orders add column if not exists attachments jsonb default '[]'::jsonb;
