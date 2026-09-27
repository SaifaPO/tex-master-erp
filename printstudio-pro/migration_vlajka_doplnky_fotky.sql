-- ============================================================
-- MIGRACIA: fotky pre doplnky beachvlajok (Martin 2026-09-27 - chce moznost
-- vlozit fotku ku vsetkym doplnkom: material, prut, podstavec, opracovanie,
-- prislusenstvo). vlajka_stoziare, vlajka_dokoncenie a vlajka_doplnky uz
-- stlpec obrazok_url maju - chybal len na vlajka_podstavce a vlajka_materialy.
-- Verejny pohlad na materialy (vlajka_materialy_verejny) sa musi prepisat,
-- aby obrazok_url pustil aj k zakaznikovi (predtym ho vobec neselectoval).
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_podstavce add column if not exists obrazok_url text;
alter table vlajka_materialy add column if not exists obrazok_url text;

create or replace view vlajka_materialy_verejny as
select kod, nazov, popis, pouzitie, poradie, obrazok_url
from vlajka_materialy
where aktivny = true
order by poradie;

grant select on vlajka_materialy_verejny to anon, authenticated;
