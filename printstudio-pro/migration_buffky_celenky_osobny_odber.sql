-- ============================================================
-- MIGRÁCIA: Buffky + Čelenky — osobný odber (neplatí poštovné)
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table buffky_objednavky add column if not exists osobny_odber boolean not null default false;
alter table celenky_objednavky add column if not exists osobny_odber boolean not null default false;
