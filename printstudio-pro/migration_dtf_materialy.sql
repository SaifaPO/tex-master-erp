-- ============================================================
-- MIGRÁCIA: DTF metráž — voliteľné vlastné látky (materiál od nás)
-- Doteraz appka predávala LEN samotnú DTF potlač (zákazník si nažehľuje na svoj materiál).
-- Teraz pribúda moznosť "tlačiť aj na náš materiál" — Martin ponúkne 5-10 látok, každá
-- prepojiteľná na skutočnú skladovú položku (rovnaký vzor ako zastava_materialy/vlajka_materialy —
-- pozri migration_zastava_sklad_prepojenie.sql a migration_vlajka_material.sql).
-- Cena látky sa počíta rovnakým marzovym vzorcom (pricing_config) a PRIPOČÍTAVA k cene potlače
-- (nie kombinovaný náklad pred jednou maržou — dve samostatné položky spočítané až na konci).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists dtf_materialy (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    popis text,           -- na co je vhodny (zobrazi sa zakaznikovi)
    pouzitie text,         -- odporucane pouzitie (zobrazi sa zakaznikovi)
    specifikacie text,     -- technicke specifikacie - zlozenie, gramaz a pod. (zobrazi sa zakaznikovi)
    naklad_m2 numeric(10,2) not null default 0,
    sklad_material_id text references materials(id) on delete set null,
    aktivny boolean not null default true,
    poradie int default 0,
    created_at timestamptz default now()
);

alter table dtf_materialy enable row level security;
drop policy if exists "admin plny pristup dtf materialy" on dtf_materialy;
create policy "admin plny pristup dtf materialy" on dtf_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Verejny pohlad — DTF metraz ma uz zavedeny zvyk vystavovat priamo vypocitany naklad (pozri
-- dtf_naklady_verejny.naklad_bm) pre ziovy klientsky nahlad ceny, s tym, ze objednavka sa VZDY
-- prepocita autoritativne server-side (Edge Function nikdy neveri klientovi, vzdy si sklad. cenu
-- znova zisti sama). Kvoli konzistencii v ramci tohto modulu preto naklad_m2 NIE je skryty.
create or replace view dtf_materialy_verejny as
select kod, nazov, popis, pouzitie, specifikacie, naklad_m2, poradie
from dtf_materialy
where aktivny = true
order by poradie;

grant select on dtf_materialy_verejny to anon, authenticated;

-- Ktoru latku (ak vobec) si zakaznik vybral, nech to admin vidi pri vybavovani objednavky.
alter table dtf_objednavky add column if not exists material_kod text;
alter table dtf_objednavky add column if not exists material_nazov text;
