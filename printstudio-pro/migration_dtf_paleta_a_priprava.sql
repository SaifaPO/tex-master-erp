-- ============================================================
-- MIGRÁCIA: DTF metráž — Paleta farieb (5€) + Príprava grafiky na tlač (+10€)
-- Pridáva novy rezim 'paleta' (PBT posiela zakaznikovi fyzicku paletu vzoriek, ziadny subor sa
-- nenahrava, pevna cena 5€ s DPH — rovnaky princip ako 'vzorky') a stlpec graficka_priprava
-- (zaskrtavacie policko pri rezimoch 'auto'/'subor' — PBT pripravi grafiku zakaznika na tlac za
-- pripatok +10€).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table dtf_objednavky add column if not exists graficka_priprava boolean not null default false;

-- Rozsirenie CHECK obmedzenia na rezim o 'paleta' — predpoklada standardne Postgres pomenovanie
-- (nazov stlpca + "_check"). Ak by tento prikaz zlyhal s chybou "constraint does not exist",
-- daj mi vediet presny nazov obmedzenia (SELECT conname FROM pg_constraint WHERE conrelid =
-- 'dtf_objednavky'::regclass) a upravim prikaz.
alter table dtf_objednavky drop constraint if exists dtf_objednavky_rezim_check;
alter table dtf_objednavky add constraint dtf_objednavky_rezim_check check (rezim in ('auto', 'subor', 'vzorky', 'paleta'));
