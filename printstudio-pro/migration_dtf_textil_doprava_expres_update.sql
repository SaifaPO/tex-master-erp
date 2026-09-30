-- ============================================================
-- MIGRÁCIA: DTF + Textilná metráž — poštovné zdarma od X bm, osobný odber,
-- minimálny príplatok expres (€ alebo %), expres platí len do X:00.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- Nové nastavenia (rovnaké názvy v oboch appkách, aby sa dali zdielať v kóde)
alter table dtf_nastavenia add column if not exists postovne_zdarma_od_bm numeric not null default 2;
alter table dtf_nastavenia add column if not exists priplatok_expres_min_eur numeric not null default 5;
alter table dtf_nastavenia add column if not exists expres_cutoff_hodina integer not null default 12;

alter table textil_nastavenia add column if not exists postovne_zdarma_od_bm numeric not null default 2;
alter table textil_nastavenia add column if not exists priplatok_expres_min_eur numeric not null default 5;
alter table textil_nastavenia add column if not exists expres_cutoff_hodina integer not null default 12;

-- Príznak "osobný odber" na objednávke (zákazník si prišiel po tovar sám, neplatí poštovné)
alter table dtf_objednavky add column if not exists osobny_odber boolean not null default false;
alter table textil_objednavky add column if not exists osobny_odber boolean not null default false;
