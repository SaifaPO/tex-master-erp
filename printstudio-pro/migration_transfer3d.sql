-- ============================================================
-- MIGRÁCIA: 3D transfery — samostatný modul PrintStudio Pro (objednávka 3D transferov podľa loga)
-- Tlač na fóliu (CMYK + biela + 3D vrstvy + lak), rezanie, výpočet výrobnej ceny z hodnôt nastavených v ERP
-- (PrintStudio → 3D transfery). Cena sa VŽDY počíta na serveri (Edge Function transfer3d-create-draft-order),
-- zákazník nikdy nevidí nákupné ceny ani spotreby — len hotovú predajnú cenu.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ---------- VÝROBNÉ HODNOTY (interné, len admin) ----------
create table if not exists transfer3d_nastavenia (
    id int primary key default 1,
    aktivny boolean not null default true,
    -- fólia a formát
    sirka_folie_cm numeric(6,1) not null default 30,         -- šírka tlačovej fólie
    okraj_cm numeric(5,2) not null default 1,                -- okraj fólie na každej strane (nepotlačiteľný)
    medzera_cm numeric(5,2) not null default 0.5,            -- medzera medzi motívmi pri rezaní
    max_sirka_cm numeric(6,1) not null default 28,           -- max. rozmer jedného motívu
    max_vyska_cm numeric(6,1) not null default 38,
    pokrytie_percent numeric(5,1) not null default 100,      -- pokrytie plochy: spotreby z RIP štatistiky už zahŕňajú reálne pokrytie, preto 100 %
    cena_folie_bm numeric(10,2) not null default 4.50,       -- €/bm fólie (pri šírke fólie vyššie)
    -- farby (€ za liter)
    cena_cmyk_l numeric(10,2) not null default 120,
    cena_biela_l numeric(10,2) not null default 90,
    cena_lak_l numeric(10,2) not null default 110,           -- varnish
    -- stroje (€/hod = amortizácia + prevádzka); ak je vybraté zariadenie z Réžie firiem, berie sa z neho
    stroj_tlac_hod numeric(10,2) not null default 6,
    stroj_rezanie_hod numeric(10,2) not null default 3,
    tlaciaren_zariadenie_id text references cost_metrics(id),
    rezanie_zariadenie_id text references cost_metrics(id),
    -- rezanie
    rezanie_min_ks numeric(8,2) not null default 0.3,        -- minút rezania / 1 motív (nastavenie, vkladanie fólie, orez)
    rezanie_min_m2 numeric(8,2) not null default 4,          -- minút rezania / 1 m² fólie
    -- pracovník
    praca_hod numeric(10,2) not null default 15,
    praca_min_objednavka numeric(8,2) not null default 10,   -- príprava súboru, nastavenie zákazky, balenie
    praca_min_ks numeric(8,2) not null default 0.5,          -- obsluha / kontrola / 1 motív
    obsluha_tlace_percent numeric(5,1) not null default 20,  -- koľko z času tlače pracovník skutočne obsluhuje
    -- rezervy
    odpad_percent numeric(5,1) not null default 10,          -- odpad materiálu (fólia + farby)
    riziko_percent numeric(5,1) not null default 5,          -- koeficient rizika na celkový náklad
    -- predaj
    manipulacny_poplatok_eur numeric(10,2) not null default 5,   -- bez DPH, 1× na objednávku
    cena_doprava numeric(10,2) not null default 4.50,            -- bez DPH
    postovne_zdarma_od_eur numeric(10,2) not null default 0,     -- 0 = poštovné zdarma sa neponúka
    minimalna_cena_eur numeric(10,2) not null default 8,         -- minimálna cena motívov v objednávke (bez DPH)
    produkt_id bigint references produkty(id) on delete set null, -- blank → produkt z Katalógu (zákazka do ERP)
    info_text text,
    constraint jediny_riadok_transfer3d_nastavenia check (id = 1)
);
insert into transfer3d_nastavenia (id) values (1) on conflict (id) do nothing;

-- ---------- ÚROVNE 3D EFEKTU (low / medium / high) — čím vyššia, tým dlhšia tlač a viac farby ----------
create table if not exists transfer3d_urovne (
    kod text primary key,
    nazov text not null,
    popis text,
    foto_url text,
    spotreba_cmyk_ml_m2 numeric(8,2) not null default 8,     -- ml CMYK na 1 m² potlačenej plochy
    spotreba_biela_ml_m2 numeric(8,2) not null default 12,   -- ml bielej
    spotreba_lak_ml_m2 numeric(8,2) not null default 10,     -- ml laku pri plnom nanesení
    cas_tlace_min_m2 numeric(8,2) not null default 25,       -- minút tlače na 1 m² fólie
    poradie int not null default 0
);
insert into transfer3d_urovne (kod, nazov, popis, spotreba_cmyk_ml_m2, spotreba_biela_ml_m2, spotreba_lak_ml_m2, cas_tlace_min_m2, poradie) values
    ('low', 'Nízky 3D', 'Jemné vystúpenie nad povrch', 6.6, 8.5, 6, 250, 1),
    ('medium', 'Stredný 3D', 'Zlatá stredná cesta', 6.6, 17, 12, 450, 2),
    ('high', 'Vysoký 3D', 'Maximálny a výrazný efekt', 6.6, 28, 20, 750, 3)
on conflict (kod) do nothing;

-- ---------- LAK (varnish): bez / čiastočne / na plno ----------
create table if not exists transfer3d_laky (
    kod text primary key,
    nazov text not null,
    popis text,
    foto_url text,
    pokrytie_percent numeric(5,1) not null default 100,      -- aká časť plochy motívu sa lakuje
    cas_nasobok numeric(5,2) not null default 1,             -- násobok času tlače (lak = ďalší prechod)
    poradie int not null default 0
);
insert into transfer3d_laky (kod, nazov, popis, pokrytie_percent, cas_nasobok, poradie) values
    ('none', 'Bez laku (matný)', 'Matný povrch bez laku', 0, 0.85, 1),
    ('partial', 'Čiastočný lak (pololesk)', 'Lak len na vybraných detailoch motívu', 40, 0.95, 2),
    ('full', 'Lak na plno (vysoký lesk)', 'Lak na celom motíve', 100, 1.00, 3)
on conflict (kod) do nothing;

-- ---------- OBJEDNÁVKY ----------
create table if not exists transfer3d_objednavky (
    id uuid primary key default gen_random_uuid(),
    cislo_objednavky text,
    sirka_cm numeric(6,1) not null,
    vyska_cm numeric(6,1) not null,
    pocet_ks int not null check (pocet_ks > 0),
    uroven text,
    lak text,
    dlzka_bm numeric(8,2),
    cena_kus numeric(10,2),                  -- bez DPH
    cena_spolu numeric(10,2) not null,       -- s DPH
    naklad_spolu numeric(10,2),              -- výrobný náklad (interné)
    subor_nazov text,
    subor_cesta text,
    subor_url text,
    osobny_odber boolean not null default false,
    shopify_order_id text,
    erp_zakazka_id text,
    erp_cislo text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_transfer3d_objednavky_stav on transfer3d_objednavky(stav);

-- ============================================================
-- VEREJNÉ POHĽADY (zákazník vidí len názvy, popisy, fotky a rozmery — nie spotreby ani nákupné ceny)
-- ============================================================
create or replace view transfer3d_urovne_verejny as select kod, nazov, popis, foto_url, poradie from transfer3d_urovne;
create or replace view transfer3d_laky_verejny as select kod, nazov, popis, foto_url, poradie from transfer3d_laky;
create or replace view transfer3d_nastavenia_verejny as
    select aktivny, sirka_folie_cm, max_sirka_cm, max_vyska_cm, info_text from transfer3d_nastavenia where id = 1;
grant select on transfer3d_urovne_verejny, transfer3d_laky_verejny, transfer3d_nastavenia_verejny to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table transfer3d_nastavenia enable row level security;
alter table transfer3d_urovne enable row level security;
alter table transfer3d_laky enable row level security;
alter table transfer3d_objednavky enable row level security;

drop policy if exists "admin plny pristup transfer3d nastavenia" on transfer3d_nastavenia;
create policy "admin plny pristup transfer3d nastavenia" on transfer3d_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin plny pristup transfer3d urovne" on transfer3d_urovne;
create policy "admin plny pristup transfer3d urovne" on transfer3d_urovne for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin plny pristup transfer3d laky" on transfer3d_laky;
create policy "admin plny pristup transfer3d laky" on transfer3d_laky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin plny pristup transfer3d objednavky" on transfer3d_objednavky;
create policy "admin plny pristup transfer3d objednavky" on transfer3d_objednavky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Objednávky zakladá Edge Function so servisným kľúčom (obchádza RLS) — zákazník do tabuľky nezapisuje priamo.

-- Tlačové súbory zákazníka: bucket print-designs, priečinok transfer3d/ — rovnaká politika ako DTF/čelenky (nahrávanie povolené, čítanie len admin).
