-- Beachvlajky maju velkosti S/M/L/XL — doteraz mal kazdy stoziar/prislusenstvo LEN JEDNU cenu bez
-- ohladu na velkost vlajky, hoci realne vacsia vlajka potrebuje dlhsi/pevnejsi stoziar aj inak
-- dimenzovany podstavec. Rieseni:
--   1) vlajka_stoziare_ceny — cena stoziara ZVLAST pre kazdu velkost vlajky S/M/L/XL.
--   2) vlajka_podstavce — NOVA, samostatna tabulka len pre podstavce (oddelena od vseobecneho
--      prislusenstva vo vlajka_doplnky, ktore ostava nezmenene pre veci ako karabinky a pod.)
--   3) vlajka_podstavce_ceny — cena podstavca PRE KAZDU velkost + "vhodny" (ci sa da vobec pouzit
--      pre danu velkost) + volitelna poznamka (napr. "vhodne aj pre XL, ale len v interieri").
-- Povodny stlpec cena vo vlajka_stoziare OSTAVA (nic sa nemaze) — len sa uz nepouziva, nahradza ho
-- vlajka_stoziare_ceny. Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

create table if not exists vlajka_stoziare_ceny (
    id bigint generated always as identity primary key,
    stoziar_id bigint not null references vlajka_stoziare(id) on delete cascade,
    velkost text not null check (velkost in ('S','M','L','XL')),
    cena numeric(10,2) not null default 0,
    unique (stoziar_id, velkost)
);
alter table vlajka_stoziare_ceny enable row level security;
drop policy if exists "admin plny pristup vlajka stoziare ceny" on vlajka_stoziare_ceny;
create policy "admin plny pristup vlajka stoziare ceny" on vlajka_stoziare_ceny for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "verejne citanie vlajka stoziare ceny" on vlajka_stoziare_ceny;
create policy "verejne citanie vlajka stoziare ceny" on vlajka_stoziare_ceny for select using (true);

create table if not exists vlajka_podstavce (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    popis text,
    poradie int default 0,
    aktivny boolean not null default true
);
alter table vlajka_podstavce enable row level security;
drop policy if exists "admin plny pristup vlajka podstavce" on vlajka_podstavce;
create policy "admin plny pristup vlajka podstavce" on vlajka_podstavce for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "verejne citanie vlajka podstavce" on vlajka_podstavce;
create policy "verejne citanie vlajka podstavce" on vlajka_podstavce for select using (true);

create table if not exists vlajka_podstavce_ceny (
    id bigint generated always as identity primary key,
    podstavec_id bigint not null references vlajka_podstavce(id) on delete cascade,
    velkost text not null check (velkost in ('S','M','L','XL')),
    cena numeric(10,2) not null default 0,
    vhodny boolean not null default true,
    poznamka text,
    unique (podstavec_id, velkost)
);
alter table vlajka_podstavce_ceny enable row level security;
drop policy if exists "admin plny pristup vlajka podstavce ceny" on vlajka_podstavce_ceny;
create policy "admin plny pristup vlajka podstavce ceny" on vlajka_podstavce_ceny for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "verejne citanie vlajka podstavce ceny" on vlajka_podstavce_ceny;
create policy "verejne citanie vlajka podstavce ceny" on vlajka_podstavce_ceny for select using (true);
