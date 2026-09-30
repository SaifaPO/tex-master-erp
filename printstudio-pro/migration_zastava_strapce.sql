-- ============================================================
-- MIGRÁCIA: Vlajky (Zástava) — obšitie strapcami (biele/modré/zlaté), cenené
-- za bm obšitého okraja (rovnaký princíp ako tunely/popruh — vyber si stranu
-- alebo viac strán, prípadne všetky štyri = strapce dookola).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table zastava_nastavenia add column if not exists naklad_strapce_bm numeric not null default 2.0;
