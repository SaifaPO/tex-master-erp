-- ============================================================
-- MIGRÁCIA: Krajčírky (kapacita šitia) + jednotná sadzba strihania/rezania/vysekávania
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- Centralna sadzba za strihanie/rezanie/vysekavanie, spolocna pre cely Katalog Produktov —
-- pocita sa z plochy latky (cm2), rovnaky princip ako Cena sitia (€/min) v Cenotvorbe.
alter table pricing_config add column if not exists cena_strihania_100cm2 numeric(10,2) not null default 0;

-- ---------- KATALOG PRODUKTOV: rozpis ceny potlace podla technologie + strihanie ----------
-- Sublimacia sa pocita AUTOMATICKY z plochy latky (Kostra cien) — netreba pre nu manualnu cenu.
-- DTF/sietotlac/rezany transfer/vysivka su vzdy rucne €/ks (lokalny motiv, nezavisi od spotreby).
alter table products add column if not exists tlac_sublimacia boolean not null default false;
alter table products add column if not exists tlac_dtf boolean not null default false;
alter table products add column if not exists cena_potlace_dtf_ks numeric(10,2);
alter table products add column if not exists tlac_sietotlac boolean not null default false;
alter table products add column if not exists cena_potlace_sietotlac_ks numeric(10,2);
alter table products add column if not exists tlac_rezany_transfer boolean not null default false;
alter table products add column if not exists cena_potlace_rezany_transfer_ks numeric(10,2);
alter table products add column if not exists tlac_vysivka boolean not null default false;
alter table products add column if not exists cena_potlace_vysivka_ks numeric(10,2);
alter table products add column if not exists striha_sa_reze_vyseka boolean not null default false;

-- ---------- KRAJČÍRKY (kapacita šitia, pre Planovaciu maticu) ----------
create table if not exists krajcirky (
    id bigint generated always as identity primary key,
    meno text not null,
    vykon_za_smenu numeric(10,2) not null default 0,
    aktivna boolean not null default true,
    poznamka text,
    poradie int not null default 0,
    created_at timestamptz default now()
);

-- Dlzka pracovnej smeny v minutach — jediny riadok, pouziva sa na prepocet minut sitia na
-- redukovane jednotky vykonu (spolu s vykon_za_smenu jednotlivych krajciriek vyssie).
create table if not exists vyrobna_kapacita_nastavenia (
    id int primary key default 1,
    dlzka_smeny_min numeric(10,2) not null default 480,
    constraint jediny_riadok_vyrobna_kapacita_nastavenia check (id = 1)
);
insert into vyrobna_kapacita_nastavenia (id) values (1) on conflict (id) do nothing;

alter table krajcirky enable row level security;
alter table vyrobna_kapacita_nastavenia enable row level security;

create policy "admin plny pristup krajcirky" on krajcirky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vyrobna kapacita nastavenia" on vyrobna_kapacita_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
