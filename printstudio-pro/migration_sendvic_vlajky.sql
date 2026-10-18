-- Obojstranna (sendvicova) vlajka: 3 vrstvy — 2 vonkajsie latky potlacene motivom (z oboch stran
-- citatelne) + vnutorna blackout/podkladova vrstva, ktora zabrani presvitaniu. Tazsia a drahsia.
-- Pouziva sa pri Beachvlajkach (odporucane velkosti S, M) aj pri klasickych Zastavach.
-- Dierkovany (mesh) material sa na sendvic NEPOUZIVA -> prizvuk je_mesh, zakaznik ho pri sendvici nemoze zvolit.
-- Bezpecne spustit opakovane.

-- 1) Priznak "dierkovany / mesh material"
alter table vlajka_materialy add column if not exists je_mesh boolean not null default false;
alter table zastava_materialy add column if not exists je_mesh boolean not null default false;

update vlajka_materialy set je_mesh = true
where je_mesh = false and (lower(nazov) like '%mesh%' or lower(nazov) like '%dierk%' or lower(nazov) like '%perfor%' or lower(kod) like '%mesh%');
update zastava_materialy set je_mesh = true
where je_mesh = false and (lower(nazov) like '%mesh%' or lower(nazov) like '%dierk%' or lower(nazov) like '%perfor%' or lower(kod) like '%mesh%');

-- 2) Verejne pohlady sa rozsiruju o je_mesh (naklad_m2 stale NIKDY nejde klientovi). View sa maze a vytvara nanovo,
--    lebo create or replace nedovoli zmenit poradie stlpcov.
drop view if exists vlajka_materialy_verejny;
create view vlajka_materialy_verejny as
select kod, nazov, popis, pouzitie, poradie, obrazok_url, je_mesh
from vlajka_materialy
where aktivny = true
order by poradie;
grant select on vlajka_materialy_verejny to anon, authenticated;

drop view if exists zastava_materialy_verejny;
create view zastava_materialy_verejny as
select kod, nazov, popis, pouzitie, sirka_rolky_cm, poradie, je_mesh
from zastava_materialy
where aktivny = true
order by poradie;
grant select on zastava_materialy_verejny to anon, authenticated;

-- 3) Nakladove sadzby sendvica (jeden riadok, spolocne pre Beachvlajky aj Zastavy) — SUKROME,
--    cita ich len Edge Function so servisnym klucom a prihlaseny admin.
create table if not exists sendvic_nastavenia (
    id int primary key default 1,
    vlozka_naklad_m2 numeric(10,2) not null default 3.50,   -- vnutorna blackout/podkladova latka, €/m2
    praca_naklad_m2 numeric(10,2) not null default 2.00,    -- spajanie vrstiev (lepenie/zosivanie navyse), €/m2
    sitie_koef numeric(5,2) not null default 1.50,          -- nasobok casu sitia (3 vrstvy sa siju dlhsie)
    constraint jediny_riadok_sendvic_nastavenia check (id = 1)
);
insert into sendvic_nastavenia (id) values (1) on conflict (id) do nothing;
alter table sendvic_nastavenia enable row level security;
drop policy if exists "admin plny pristup sendvic nastavenia" on sendvic_nastavenia;
create policy "admin plny pristup sendvic nastavenia" on sendvic_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4) Objednavky si pamataju, ze islo o obojstrannu vlajku (aby sa vo vyrobe vedelo)
alter table vlajka_objednavky add column if not exists obojstranna boolean not null default false;
alter table zastava_objednavky add column if not exists obojstranna boolean not null default false;
