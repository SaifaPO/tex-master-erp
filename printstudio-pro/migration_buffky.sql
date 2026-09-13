-- ============================================================
-- MIGRÁCIA: Buffky (multifunkčné tunelové šatky) — samostatný modul PrintStudio Pro
-- Sublimačná potlač, pevný výrobný formát rozloženého strihu 50×50 cm (2× 25×50 cm), 300 DPI.
-- Rovnaký vzor ako migration_celenky.sql: surové náklady su interné (len admin), naklad_ks
-- sa vystavuje cez VIEW s právami vlastníka (obchádza RLS na buffky_naklady), takže
-- zákaznícky konfigurátor aj Edge Function vidia len jedno vypočítané číslo.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists buffky_naklady (
    id int primary key default 1,
    cena_material_m2 numeric(10,2) not null default 8.50,        -- sublimačný mikrovláknový úplet
    cena_transfer_papier_m2 numeric(10,2) not null default 3.20,  -- sublimačný transferový papier
    cena_farba_m2 numeric(10,2) not null default 1.80,            -- spotreba sublimačnej farby
    cena_sitia_ks numeric(10,2) not null default 1.20,            -- zošitie do tunela na 1 ks
    constraint jediny_riadok_buffky_naklady check (id = 1)
);
insert into buffky_naklady (id) values (1) on conflict (id) do nothing;

-- Plocha rozloženého strihu 50×50 cm v m² (0.5 * 0.5 = 0.25 m²) — natvrdo v SQL, keďže ide
-- o jediný pevný formát (rovnako ako pri čelenkách sa nemení podľa objednávky).
create or replace view buffky_naklady_verejny as
select
    ((n.cena_material_m2 + n.cena_transfer_papier_m2 + n.cena_farba_m2) * 0.25 + n.cena_sitia_ks) as naklad_ks
from buffky_naklady n
where n.id = 1;

grant select on buffky_naklady_verejny to anon, authenticated;

create table if not exists buffky_nastavenia (
    id int primary key default 1,
    cena_doprava numeric(10,2) not null default 3.90,
    priplatok_expres_percent numeric(5,2) not null default 15,
    minimalna_cena_objednavky numeric(10,2) not null default 8.00,
    dph_percent numeric(5,2) not null default 23,
    constraint jediny_riadok_buffky_nastavenia check (id = 1)
);
insert into buffky_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists buffky_objednavky (
    id uuid primary key default gen_random_uuid(),
    pocet_ks int not null check (pocet_ks > 0),
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2) not null,
    doprava_rychlost text not null default 'standard' check (doprava_rychlost in ('standard','express')),
    dizajn_json jsonb,       -- STATE (elementy/farby/vzor) pre pripadnu reprodukciu/upravu
    subor_nazov text,
    subor_cesta text,        -- tlacovy subor 300 DPI 50x50cm v Storage (bucket print-designs), len pre admina
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_buffky_objednavky_stav on buffky_objednavky(stav);

alter table buffky_naklady enable row level security;
alter table buffky_nastavenia enable row level security;
alter table buffky_objednavky enable row level security;

create policy "verejne citanie buffky nastaveni" on buffky_nastavenia for select using (true);
-- buffky_naklady (vyrobne naklady) zamerne NIE je verejne — len admin (interna marza)

create policy "verejne vytvorenie buffky objednavky" on buffky_objednavky for insert with check (true);

create policy "admin plny pristup buffky naklady" on buffky_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup buffky nastavenia" on buffky_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie buffky objednaviek" on buffky_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update buffky objednaviek" on buffky_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete buffky objednaviek" on buffky_objednavky for delete using (auth.role() = 'authenticated');
