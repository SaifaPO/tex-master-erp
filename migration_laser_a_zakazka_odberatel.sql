-- ============================================================
-- MIGRÁCIA: Laser ako samostatná Kostra cien + Zákazka/Odberateľ na sklade
-- Laser (vlastný stroj PBT, rezanie/vysekávanie) je teraz OSOBITNE od Strihania/kompletáže
-- (výkon krajčírskej dielne ATAK) — každé má vlastnú sadzbu a vlastný prepínač na produkte.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ---------- KOSTRA CIEN: Laser (singleton, rovnaky vzor ako dtf_naklady/cennik_sietotlac) ----------
create table if not exists laser_naklady (
    id int primary key default 1,
    cena_elektriny_kwh numeric(10,4) not null default 0,
    vykon_kw numeric(10,2) not null default 0,
    rychlost_cm2_hod numeric(10,2) not null default 1,
    cena_prace_hod numeric(10,2) not null default 0,
    amortizacia_hod numeric(10,2) not null default 0,
    constraint jediny_riadok_laser_naklady check (id = 1)
);
insert into laser_naklady (id) values (1) on conflict (id) do nothing;

alter table laser_naklady enable row level security;
create policy "admin plny pristup laser naklady" on laser_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- KATALOG PRODUKTOV: Laser ako samostatny prepinac (oddelene od striha_sa_reze_vyseka) ----------
alter table products add column if not exists laser_sa_reze boolean not null default false;

-- ---------- SKLAD: Zakazka/Odberatel na kazdej polozke (podla dodacieho listu) ----------
alter table materials add column if not exists zakazka_odberatel text;
