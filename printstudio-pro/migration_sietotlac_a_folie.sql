-- ============================================================
-- DOPLNOK: cena sieťotlače podľa svetlého/tmavého textilu
-- Na tmavý textil treba 2 vrstvy farby pre dobré krytie = drahšie ako na svetlý textil.
-- ============================================================

alter table farby add column if not exists je_tmava boolean not null default false;
alter table cennik_sietotlac add column if not exists cena_cm2_tmavy numeric(10,4);

-- Seedni rozumnú počiatočnú hodnotu (rovnaká ako svetlý textil), nastav si presnú sadzbu
-- v Master Admin karte "Cenník potlače" po spustení tejto migrácie.
update cennik_sietotlac set cena_cm2_tmavy = cena_cm2 where cena_cm2_tmavy is null;
alter table cennik_sietotlac alter column cena_cm2_tmavy set not null;
