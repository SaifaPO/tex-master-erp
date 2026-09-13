-- ============================================================
-- MIGRÁCIA: Textilná metráž — voliteľné vlastné látky (materiál od nás)
-- Doteraz appka predávala LEN samotný tlačový proces (zákazník dodáva vlastnú látku —
-- textil_naklady su cisto proces: papier/ochranny papier/primer/atrament/praca, ZIADNA latka).
-- Teraz pribuda moznost "tlačiť aj na náš materiál" — Martin ponúkne 5-10 látok, kazda
-- prepojitelna na skutocnu skladovu polozku (rovnaky vzor ako zastava_materialy/vlajka_materialy/
-- dtf_materialy). Cena latky sa pocita rovnakym marzovym vzorcom (pricing_config) a PRIPOCITAVA
-- k cene potlace (nie kombinovany naklad pred jednou marzou — dve samostatne polozky spocitane
-- az na konci).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists textil_materialy (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    popis text,           -- na co je vhodny (zobrazi sa zakaznikovi)
    pouzitie text,         -- odporucane pouzitie (zobrazi sa zakaznikovi)
    specifikacie text,     -- technicke specifikacie - zlozenie, gramaz a pod. (zobrazi sa zakaznikovi)
    technologia text not null default 'obe' check (technologia in ('sublimacia','bavlna','obe')), -- pre ktoru technologiu je latka vhodna
    naklad_m2 numeric(10,2) not null default 0,
    sklad_material_id text references materials(id) on delete set null,
    aktivny boolean not null default true,
    poradie int default 0,
    created_at timestamptz default now()
);

alter table textil_materialy enable row level security;
drop policy if exists "admin plny pristup textil materialy" on textil_materialy;
create policy "admin plny pristup textil materialy" on textil_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Verejny pohlad — Textilna metraz ma uz zavedeny zvyk vystavovat priamo vypocitany naklad
-- (pozri textil_naklady_verejny.naklad_bm) pre zivy klientsky nahlad ceny, s tym, ze objednavka
-- sa VZDY prepocita autoritativne server-side. Kvoli konzistencii preto naklad_m2 nie je skryty.
create or replace view textil_materialy_verejny as
select kod, nazov, popis, pouzitie, specifikacie, technologia, naklad_m2, poradie
from textil_materialy
where aktivny = true
order by poradie;

grant select on textil_materialy_verejny to anon, authenticated;

-- Ktoru latku (ak vobec) si zakaznik vybral, nech to admin vidi pri vybavovani objednavky.
alter table textil_objednavky add column if not exists material_kod text;
alter table textil_objednavky add column if not exists material_nazov text;
