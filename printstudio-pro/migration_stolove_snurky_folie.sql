-- ============================================================
-- MIGRÁCIA: Stolové vlajky, Šnúrky na krk, Rezané fólie — tri nové aplikácie PrintStudio Pro
-- Výrobné hodnoty sa nastavujú v ERP (PrintStudio → Aplikácie → Stolové vlajky / Šnúrky / Rezané fólie). Cenu VŽDY počíta server
-- (Edge Functions *-create-draft-order) z týchto hodnôt + maržového modulu (Cenotvorba). Zákazník nevidí nákupné ceny.
-- Hodnoty nižšie sú len ODHADY na rozbeh — prepíš ich skutočnými nákladmi. Pri položkách s produktom z Katalógu (produkt_id) sa náklad
-- berie z výrobnej ceny produktu (produkty.zakladna_cena) a ručná hodnota sa ignoruje.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ============ STOLOVÉ VLAJKY ============
create table if not exists stolova_nastavenia (
    id int primary key default 1,
    aktivny boolean not null default true,
    manipulacny_poplatok_eur numeric(10,2) not null default 3,
    cena_doprava numeric(10,2) not null default 4.5,
    postovne_zdarma_od_eur numeric(10,2) not null default 0,
    minimalna_cena_eur numeric(10,2) not null default 6,
    info_text text,
    produkt_id bigint references produkty(id) on delete set null,
    constraint jediny_riadok_stolova_nastavenia check (id = 1)
);
insert into stolova_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists stolova_velkosti (
    kod text primary key, nazov text not null, popis text, sirka_mm numeric(7,1) not null, vyska_mm numeric(7,1) not null,
    naklad_eur numeric(10,2) not null default 0, produkt_id bigint references produkty(id) on delete set null, foto_url text, poradie int not null default 0
);
insert into stolova_velkosti (kod, nazov, popis, sirka_mm, vyska_mm, naklad_eur, poradie) values
    ('small', 'Malá', 'cca 10 × 15 cm', 100, 150, 1.20, 1),
    ('medium', 'Stredná', 'cca 15 × 22 cm', 150, 220, 2.00, 2),
    ('large', 'Veľká', 'cca 20 × 30 cm', 200, 300, 3.20, 3)
on conflict (kod) do nothing;

create table if not exists stolova_tvary (
    kod text primary key, nazov text not null, popis text, naklad_eur numeric(10,2) not null default 0, foto_url text, poradie int not null default 0
);
insert into stolova_tvary (kod, nazov, poradie) values ('shield', 'Erb', 1), ('pentagon', 'Špic', 2), ('rectangle', 'Zaoblená', 3), ('triangle', 'Trojuholník', 4)
on conflict (kod) do nothing;

create table if not exists stolova_okraje (
    kod text primary key, nazov text not null, skupina text not null default 'strapce', farba_hex text, popis text,
    naklad_eur numeric(10,2) not null default 0, produkt_id bigint references produkty(id) on delete set null, foto_url text, poradie int not null default 0
);
insert into stolova_okraje (kod, nazov, skupina, farba_hex, naklad_eur, poradie) values
    ('fringe_white', 'Biele strapce', 'strapce', '#ffffff', 0.60, 1),
    ('fringe_gold', 'Zlaté strapce', 'strapce', '#d4af37', 0.80, 2),
    ('cord_white', 'Biela šnúrka', 'snurka', '#ffffff', 0.30, 3),
    ('cord_black', 'Čierna šnúrka', 'snurka', '#111111', 0.30, 4),
    ('cord_tri', 'Trikolóra (biela, modrá, červená)', 'snurka', '#1d4ed8', 0.40, 5)
on conflict (kod) do nothing;

create table if not exists stolova_podstavce (
    kod text primary key, nazov text not null, popis text, naklad_eur numeric(10,2) not null default 0,
    produkt_id bigint references produkty(id) on delete set null, foto_url text, poradie int not null default 0
);
insert into stolova_podstavce (kod, nazov, popis, naklad_eur, poradie) values
    ('none', 'Žiadny (len závesná šnúrka)', null, 0, 1),
    ('metal_cheap', 'Základný kovový', null, 1.20, 2),
    ('chrome', 'Chrómový', null, 3.50, 3),
    ('silver', 'Strieborný', null, 4.50, 4),
    ('gold', 'Zlatý', null, 5.50, 5),
    ('wood', 'Drevený', null, 3.00, 6)
on conflict (kod) do nothing;

create table if not exists stolova_objednavky (
    id uuid primary key default gen_random_uuid(), cislo_objednavky text,
    velkost text, tvar text, okraj text, podstavec text, pocet_ks int not null check (pocet_ks > 0),
    cena_kus numeric(10,2), cena_spolu numeric(10,2) not null, naklad_spolu numeric(10,2),
    dizajn_json jsonb, subor_nazov text, subor_cesta text, subor_url text, subor2_cesta text, subor2_url text,
    osobny_odber boolean not null default false, shopify_order_id text, erp_zakazka_id text, erp_cislo text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')), created_at timestamptz default now()
);

-- ============ ŠNÚRKY NA KRK ============
create table if not exists snurka_nastavenia (
    id int primary key default 1,
    aktivny boolean not null default true,
    manipulacny_poplatok_eur numeric(10,2) not null default 3,
    cena_doprava numeric(10,2) not null default 4.5,
    postovne_zdarma_od_eur numeric(10,2) not null default 0,
    minimalna_cena_eur numeric(10,2) not null default 8,
    info_text text,
    produkt_id bigint references produkty(id) on delete set null,
    constraint jediny_riadok_snurka_nastavenia check (id = 1)
);
insert into snurka_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists snurka_modely (
    kod text primary key, nazov text not null, popis text, sirka_mm numeric(7,1) not null default 936, vyska_mm numeric(7,1) not null default 26,
    naklad_eur numeric(10,2) not null default 0, produkt_id bigint references produkty(id) on delete set null, foto_url text, poradie int not null default 0
);
insert into snurka_modely (kod, nazov, popis, naklad_eur, poradie) values
    ('klasicka', 'Klasická', 'Obojstranná tlačená šnúrka', 0.90, 1),
    ('sponou', 'So sponou', 'Šnúrka s kovovou sponou', 1.20, 2),
    ('spona_poistka', 'Spona + poistka', 'Šnúrka so sponou a bezpečnostnou poistkou', 1.50, 3),
    ('klucenka', 'Kľúčenka', 'Šnúrka s karabínkou na kľúče', 1.10, 4)
on conflict (kod) do nothing;

create table if not exists snurka_objednavky (
    id uuid primary key default gen_random_uuid(), cislo_objednavky text, model text, pocet_ks int not null check (pocet_ks > 0),
    cena_kus numeric(10,2), cena_spolu numeric(10,2) not null, naklad_spolu numeric(10,2),
    dizajn_json jsonb, subor_nazov text, subor_cesta text, subor_url text, subor2_cesta text, subor2_url text,
    osobny_odber boolean not null default false, shopify_order_id text, erp_zakazka_id text, erp_cislo text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')), created_at timestamptz default now()
);

-- ============ REZANÉ FÓLIE (vinyl) ============
create table if not exists folie_nastavenia (
    id int primary key default 1,
    aktivny boolean not null default true,
    sirka_rolky_mm numeric(7,1) not null default 500,
    pracovna_sirka_mm numeric(7,1) not null default 490,
    medzera_mm numeric(6,1) not null default 5,
    min_rozmer_mm numeric(6,1) not null default 10,
    max_dlzka_mm numeric(8,1) not null default 10000,
    odpad_percent numeric(5,1) not null default 8,
    rez_min_bm numeric(8,2) not null default 6,              -- minút rezania plotrom na 1 bm rolky
    stroj_rezanie_hod numeric(10,2) not null default 4,      -- amortizácia + prevádzka plotra (€/hod)
    praca_hod numeric(10,2) not null default 15,
    priprava_min numeric(8,2) not null default 8,            -- príprava súboru a plotra (min na objednávku)
    weeding_min_maly numeric(8,2) not null default 0.6,      -- separácia: minút na 1 ks pri motíve do hranice
    weeding_min_velky numeric(8,2) not null default 1.8,     -- minút na 1 ks pri väčšom motíve
    hranica_velky_mm numeric(6,1) not null default 100,
    riziko_percent numeric(5,1) not null default 5,
    manipulacny_poplatok_eur numeric(10,2) not null default 0,
    cena_doprava numeric(10,2) not null default 4.5,
    postovne_zdarma_od_eur numeric(10,2) not null default 0,
    minimalna_cena_eur numeric(10,2) not null default 6,
    info_text text,
    produkt_id bigint references produkty(id) on delete set null,
    constraint jediny_riadok_folie_nastavenia check (id = 1)
);
insert into folie_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists folie_druhy (
    kod text primary key, nazov text not null, popis text, foto_url text,
    cena_bm numeric(10,2) not null default 0,                -- nákupná cena €/bm (rolka 50 cm)
    teplota text, cas text, odtrhnutie text, tlak text, pranie text, hrubka text, trieda text, poradie int not null default 0
);
insert into folie_druhy (kod, nazov, popis, cena_bm, teplota, cas, odtrhnutie, tlak, pranie, hrubka, trieda, poradie) values
    ('psfilm', 'Základné (P.S. Film)', 'Prémiová matná PU fólia pre jemné detaily a vrstvenie. Univerzálna a tenká.', 5.50, '150°C', '15s', 'Za tepla / studena', 'Stredný', 'Pranie do 80°C', '90 μm', null, 1),
    ('hi5', '5-sekundové (Hi-5)', 'Extrémne rýchla aplikácia pri nízkej teplote. Bráni spáleniu jemných textílií a polyesteru.', 6.80, '120°C', '5s', 'Za tepla / studena', 'Stredný', 'Pranie do 60°C', '90 μm', null, 2),
    ('subli', 'Sublistop (Subli LT)', 'Špeciálna bariéra proti migrácii farieb. Ideálne na sublimované športové dresy.', 7.80, '130°C', '15s', 'Za tepla / studena', 'Stredný', 'Pranie do 40°C', '110 μm', null, 3),
    ('flock', 'Flock (Stripflock Pro)', 'Na dotyk ako zamat alebo semiš. Výrazný 3D efekt s jemným chĺpkom.', 9.40, '155°C', '15s', 'Za tepla', 'Stredný', 'Pranie do 60°C', '500 μm', 'flock', 4),
    ('reflex', 'Reflexné (EasyReflective)', 'Odrazka certifikovaná podľa EN ISO 20471. Vysoká viditeľnosť v tme pre odevy.', 11.70, '150°C', '15s', 'Za tepla', 'Stredný', 'Pranie do 60°C', '140 μm', 'reflective', 5),
    ('metal', 'Metalické (Metal)', 'Extrémne tenká fólia s luxusným kovovým leskom. Splynie so štruktúrou textilu.', 8.40, '150°C', '10s', 'ZA STUDENA', 'Stredný', 'Pranie do 40°C', '80 μm', 'metallic', 6),
    ('glitter', 'Trblietavé (Glitter)', 'Zrnitá štruktúra s výraznými trblietkami. Hrubší materiál s na dotyk drsným povrchom.', 10.40, '160°C', '15s', 'Za tepla / studena', 'Silný', 'Pranie do 40°C', '350 μm', 'glitter', 7)
on conflict (kod) do nothing;

create table if not exists folie_farby (
    kod text primary key, druh_kod text not null references folie_druhy(kod) on delete cascade, nazov text not null, hex text not null default '#ffffff', poradie int not null default 0
);
insert into folie_farby (kod, druh_kod, nazov, hex, poradie) values
    ('ps_white','psfilm','Biela','#FFFFFF',1),('ps_black','psfilm','Čierna','#111827',2),('ps_red','psfilm','Červená','#EF4444',3),('ps_royal','psfilm','Kráľovská modrá','#1D4ED8',4),
    ('ps_green','psfilm','Zelená','#22C55E',5),('ps_yellow','psfilm','Žltá','#EAB308',6),('ps_orange','psfilm','Oranžová','#F97316',7),('ps_grey','psfilm','Šedá','#9CA3AF',8),
    ('ps_gold','psfilm','Zlatá','#D4AF37',9),('ps_silver','psfilm','Strieborná','#C0C0C0',10),
    ('hi_white','hi5','Biela','#FFFFFF',1),('hi_black','hi5','Čierna','#111827',2),('hi_red','hi5','Červená','#DC2626',3),('hi_royal','hi5','Modrá','#1E3A8A',4),('hi_yellow','hi5','Žltá','#FACC15',5),('hi_green','hi5','Zelená','#15803D',6),
    ('sb_white','subli','Biela','#FFFFFF',1),('sb_yellow','subli','Žltá','#FACC15',2),
    ('f_white','flock','Biela','#FFFFFF',1),('f_black','flock','Čierna','#111827',2),('f_red','flock','Červená','#B91C1C',3),('f_blue','flock','Modrá','#1D4ED8',4),('f_yellow','flock','Žltá','#EAB308',5),('f_green','flock','Zelená','#15803D',6),
    ('r_silver','reflex','Strieborná','#9CA3AF',1),
    ('m_gold','metal','Zlatá','#D4AF37',1),('m_silver','metal','Strieborná','#C0C0C0',2),('m_rose','metal','Rose Gold','#B76E79',3),('m_red','metal','Červená','#DC2626',4),('m_blue','metal','Modrá','#2563EB',5),
    ('g_silver','glitter','Strieborná','#E5E7EB',1),('g_gold','glitter','Zlatá','#FBBF24',2),('g_black','glitter','Čierna','#111827',3),('g_red','glitter','Červená','#EF4444',4),('g_blue','glitter','Modrá','#3B82F6',5),('g_pink','glitter','Ružová','#EC4899',6)
on conflict (kod) do nothing;

create table if not exists folie_objednavky (
    id uuid primary key default gen_random_uuid(), cislo_objednavky text, druh text, farba text,
    sirka_mm numeric(8,1) not null, vyska_mm numeric(8,1) not null, pocet_ks int not null check (pocet_ks > 0), separacia boolean not null default true,
    dlzka_bm numeric(8,2), cena_kus numeric(10,2), cena_spolu numeric(10,2) not null, naklad_spolu numeric(10,2),
    subor_nazov text, subor_cesta text, subor_url text, osobny_odber boolean not null default false,
    shopify_order_id text, erp_zakazka_id text, erp_cislo text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')), created_at timestamptz default now()
);

-- ============================================================
-- VEREJNÉ POHĽADY (zákazník vidí len názvy, popisy, fotky a rozmery — nie náklady)
-- ============================================================
create or replace view stolova_velkosti_verejny as select kod, nazov, popis, sirka_mm, vyska_mm, foto_url, poradie from stolova_velkosti;
create or replace view stolova_tvary_verejny as select kod, nazov, popis, foto_url, poradie from stolova_tvary;
create or replace view stolova_okraje_verejny as select kod, nazov, skupina, farba_hex, popis, foto_url, poradie from stolova_okraje;
create or replace view stolova_podstavce_verejny as select kod, nazov, popis, foto_url, poradie from stolova_podstavce;
create or replace view stolova_nastavenia_verejny as select aktivny, info_text from stolova_nastavenia where id = 1;
create or replace view snurka_modely_verejny as select kod, nazov, popis, sirka_mm, vyska_mm, foto_url, poradie from snurka_modely;
create or replace view snurka_nastavenia_verejny as select aktivny, info_text from snurka_nastavenia where id = 1;
create or replace view folie_druhy_verejny as select kod, nazov, popis, foto_url, teplota, cas, odtrhnutie, tlak, pranie, hrubka, trieda, poradie from folie_druhy;
create or replace view folie_nastavenia_verejny as
    select aktivny, sirka_rolky_mm, pracovna_sirka_mm, medzera_mm, min_rozmer_mm, max_dlzka_mm, weeding_min_maly, hranica_velky_mm, info_text from folie_nastavenia where id = 1;
grant select on stolova_velkosti_verejny, stolova_tvary_verejny, stolova_okraje_verejny, stolova_podstavce_verejny, stolova_nastavenia_verejny,
    snurka_modely_verejny, snurka_nastavenia_verejny, folie_druhy_verejny, folie_nastavenia_verejny to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY: admin (prihlásený) plný prístup; zákazník len cez pohľady vyššie a Edge Functions (servisný kľúč)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['stolova_nastavenia','stolova_velkosti','stolova_tvary','stolova_okraje','stolova_podstavce','stolova_objednavky',
                           'snurka_nastavenia','snurka_modely','snurka_objednavky','folie_nastavenia','folie_druhy','folie_farby','folie_objednavky']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin plny pristup %s" on %I', t, t);
    execute format('create policy "admin plny pristup %s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;
-- farby fólií nie sú tajné (len názov a odtieň) — zákazník ich číta priamo
drop policy if exists "verejne citanie folie farby" on folie_farby;
create policy "verejne citanie folie farby" on folie_farby for select using (true);
