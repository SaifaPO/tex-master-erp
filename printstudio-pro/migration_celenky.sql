-- ============================================================
-- MIGRÁCIA: Čelenky — samostatný modul PrintStudio Pro
-- Sublimačná potlač športových čeleniek, pevný výrobný formát 51×9 cm (300 DPI).
-- Rovnaký vzor ako DTF/Textilná metráž: surové náklady sú interné (len admin),
-- naklad_ks sa vystavuje cez VIEW s právami vlastníka (obchádza RLS na celenky_naklady),
-- takže zákaznícky konfigurátor aj Edge Function vidia len jedno vypočítané číslo,
-- nikdy jednotlivé nákupné ceny materiálu.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ---------- VÝROBNÉ NÁKLADY (interné, len pre výpočet marže v admine) ----------
create table if not exists celenky_naklady (
    id int primary key default 1,
    cena_material_m2 numeric(10,2) not null default 9.50,       -- elastický sublimačný úplet
    cena_transfer_papier_m2 numeric(10,2) not null default 3.20, -- sublimačný transferový papier
    cena_farba_m2 numeric(10,2) not null default 1.80,           -- spotreba sublimačnej farby
    cena_sitia_ks numeric(10,2) not null default 0.90,           -- strih + šitie na 1 ks
    constraint jediny_riadok_celenky_naklady check (id = 1)
);
insert into celenky_naklady (id) values (1) on conflict (id) do nothing;

-- Plocha výrobného formátu 51×9 cm v m² (0.51 * 0.09 = 0.0459 m²) — natvrdo v SQL, keďže ide
-- o jediný pevný formát čelenky (na rozdiel od DTF metráže sa tu veľkosť nemení podľa objednávky).
create or replace view celenky_naklady_verejny as
select
    ((n.cena_material_m2 + n.cena_transfer_papier_m2 + n.cena_farba_m2) * 0.0459 + n.cena_sitia_ks) as naklad_ks
from celenky_naklady n
where n.id = 1;

grant select on celenky_naklady_verejny to anon, authenticated;

-- ---------- NASTAVENIA — doprava, expres, DPH ----------
create table if not exists celenky_nastavenia (
    id int primary key default 1,
    cena_doprava numeric(10,2) not null default 3.90,
    priplatok_expres_percent numeric(5,2) not null default 15,
    minimalna_cena_objednavky numeric(10,2) not null default 8.00,
    dph_percent numeric(5,2) not null default 23,
    constraint jediny_riadok_celenky_nastavenia check (id = 1)
);
insert into celenky_nastavenia (id) values (1) on conflict (id) do nothing;

-- ---------- OBJEDNÁVKY ----------
create table if not exists celenky_objednavky (
    id uuid primary key default gen_random_uuid(),
    pocet_ks int not null check (pocet_ks > 0),
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2) not null,
    doprava_rychlost text not null default 'standard' check (doprava_rychlost in ('standard','express')),
    dizajn_json jsonb,       -- STATE (elementy/farby) pre pripadnu reprodukciu/upravu
    subor_nazov text,
    subor_cesta text,        -- tlacovy subor 300 DPI 51x9cm v Storage (bucket print-designs), len pre admina
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_celenky_objednavky_stav on celenky_objednavky(stav);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table celenky_naklady enable row level security;
alter table celenky_nastavenia enable row level security;
alter table celenky_objednavky enable row level security;

create policy "verejne citanie celenky nastaveni" on celenky_nastavenia for select using (true);
-- celenky_naklady (vyrobne naklady) zamerne NIE je verejne — len admin (interna marza)

create policy "verejne vytvorenie celenky objednavky" on celenky_objednavky for insert with check (true);

create policy "admin plny pristup celenky naklady" on celenky_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup celenky nastavenia" on celenky_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie celenky objednaviek" on celenky_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update celenky objednaviek" on celenky_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete celenky objednaviek" on celenky_objednavky for delete using (auth.role() = 'authenticated');
