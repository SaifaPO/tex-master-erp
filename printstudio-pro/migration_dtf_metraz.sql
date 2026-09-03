-- ============================================================
-- MIGRÁCIA: DTF Transfer Metráž — samostatný modul PrintStudio Pro
-- Predaj hotových DTF transferov na meter (rolka šírka 56 cm),
-- nezávislé od konfigurátora potlače oblečenia (migration_konfigurator.sql).
-- Spustiť v Supabase SQL editore alebo cez `supabase db push`.
-- Predpokladá, že bucket Storage 'print-designs' už existuje
-- (vytvorený pri migration_konfigurator.sql) — DTF súbory idú do
-- podpriečinka dtf/<objednavka_id>/... v tom istom bucketi.
-- ============================================================

-- ---------- CENOVÉ HLADINY (množstevné zľavy podľa dĺžky rolky) ----------
create table if not exists dtf_cenove_hladiny (
    id bigint generated always as identity primary key,
    label text not null,
    min_bm numeric(10,2) not null,
    max_bm numeric(10,2) not null,
    cena_bm numeric(10,2) not null,
    poradie int not null default 0
);

-- ---------- VÝROBNÉ NÁKLADY (interné, len pre výpočet marže v admine) ----------
create table if not exists dtf_naklady (
    id int primary key default 1,
    cena_folie_bm numeric(10,2) not null default 1.80,
    cena_lepidlo_kg numeric(10,2) not null default 18.00,
    spotreba_lepidlo_m2 numeric(10,4) not null default 0.02,
    cena_cmyk_kg numeric(10,2) not null default 45.00,
    spotreba_cmyk_m2 numeric(10,4) not null default 0.015,
    cena_biela_kg numeric(10,2) not null default 55.00,
    spotreba_biela_m2 numeric(10,4) not null default 0.030,
    cena_prace_hod numeric(10,2) not null default 15.00,
    rychlost_tlace_m_hod numeric(10,2) not null default 6.0,
    constraint jediny_riadok_naklady check (id = 1)
);

-- ---------- NASTAVENIA — prepojenie na Shopify a pravidlá dopravy/expresu ----------
-- Keďže bežný Shopify (nie Plus) nedovolí meniť cenu položky za behu, predávame
-- cez JEDEN Shopify variant s malou "jednotkovou" cenou (napr. 0,05 €) a do košíka
-- pridávame taký POČET kusov, aby súčet dal presnú vypočítanú cenu objednávky.
-- V Shopify Admin vytvor produkt "DTF tlač — jednotka" s týmto jedným variantom
-- a jeho Variant ID vlož nižšie cez admin kartu.
create table if not exists dtf_nastavenia (
    id int primary key default 1,
    shopify_variant_id text,
    jednotka_cena_eur numeric(10,4) not null default 0.05,
    cena_doprava numeric(10,2) not null default 4.90,
    priplatok_expres_percent numeric(5,2) not null default 10,
    limit_expres_bm numeric(10,2) not null default 40,
    limit_standard_bm numeric(10,2) not null default 100,
    minimalna_cena_objednavky numeric(10,2) not null default 3.00,
    constraint jediny_riadok_nastavenia check (id = 1)
);

-- ---------- OBJEDNÁVKY ----------
create table if not exists dtf_objednavky (
    id uuid primary key default gen_random_uuid(),
    shopify_order_id text,
    rezim text not null check (rezim in ('auto','subor')),
    sirka_cm numeric(10,2),
    vyska_cm numeric(10,2),
    pocet_ks int,
    dlzka_bm numeric(10,2) not null,
    plocha_m2 numeric(10,2),
    cena_hladina text,
    cena_spolu numeric(10,2) not null,
    doprava_rychlost text not null check (doprava_rychlost in ('standard','express')),
    harmonogram text,
    subor_nazov text,
    subor_cesta text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_dtf_objednavky_stav on dtf_objednavky(stav);
create index if not exists idx_dtf_objednavky_shopify on dtf_objednavky(shopify_order_id);

-- ---------- DEFAULTNÉ DÁTA (zodpovedajú pôvodnému HTML prototypu) ----------
insert into dtf_naklady (id) values (1) on conflict (id) do nothing;
insert into dtf_nastavenia (id) values (1) on conflict (id) do nothing;

insert into dtf_cenove_hladiny (label, min_bm, max_bm, cena_bm, poradie)
select * from (values
    ('Maloobchod (do 1m)', 0.01, 0.99, 18.00, 1),
    ('Štandard (od 1m)', 1.00, 4.99, 14.50, 2),
    ('Partner (od 5m)', 5.00, 9.99, 12.00, 3),
    ('Profi (od 10m)', 10.00, 24.99, 10.20, 4),
    ('Veľkoodber (od 25m)', 25.00, 49.99, 8.90, 5),
    ('VIP odber (od 50m)', 50.00, 99.99, 7.80, 6),
    ('Priemysel (od 100m)', 100.00, 9999, 6.90, 7)
) as v(label, min_bm, max_bm, cena_bm, poradie)
where not exists (select 1 from dtf_cenove_hladiny);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table dtf_cenove_hladiny enable row level security;
alter table dtf_naklady enable row level security;
alter table dtf_nastavenia enable row level security;
alter table dtf_objednavky enable row level security;

-- Verejné čítanie cenníka a nastavení potrebných na výpočet ceny v konfigurátore
create policy "verejne citanie dtf cenovych hladin" on dtf_cenove_hladiny for select using (true);
create policy "verejne citanie dtf nastaveni" on dtf_nastavenia for select using (true);
-- dtf_naklady (výrobné náklady) zámerne NIE je verejné — len admin (interná marža)

-- Zákazník môže vytvoriť objednávku (nie čítať cudzie objednávky)
create policy "verejne vytvorenie dtf objednavky" on dtf_objednavky for insert with check (true);

-- Admin (prihlásený) plný prístup
create policy "admin plny pristup dtf hladiny" on dtf_cenove_hladiny for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup dtf naklady" on dtf_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup dtf nastavenia" on dtf_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie dtf objednaviek" on dtf_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update dtf objednaviek" on dtf_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
