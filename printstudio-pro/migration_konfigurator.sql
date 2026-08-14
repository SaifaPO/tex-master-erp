-- ============================================================
-- MIGRÁCIA: PrintStudio Pro — konfigurátor potlače
-- Zodpovedá dátovému modelu z master-admin.html a konfigurator-fabric.html
-- Spustiť v Supabase SQL editore alebo cez `supabase db push`
-- ============================================================

-- ---------- KATEGÓRIE ----------
create table if not exists kategorie (
    id bigint generated always as identity primary key,
    nazov text not null,
    poradie int default 0,
    created_at timestamptz default now()
);

-- ---------- FARBY (globálna paleta) ----------
create table if not exists farby (
    id bigint generated always as identity primary key,
    nazov text not null,
    hex text not null,
    created_at timestamptz default now()
);

-- ---------- PRODUKTY (blanks) ----------
create table if not exists produkty (
    id bigint generated always as identity primary key,
    kategoria_id bigint references kategorie(id) on delete restrict,
    nazov text not null,
    shopify_handle text unique,              -- párovanie s produktom na eshope
    pohlavie text not null check (pohlavie in ('muz','zena','dieta','unisex')),
    zakladna_cena numeric(10,2) not null default 0,
    technologia text not null check (technologia in ('sublimacia','dtf','sietotlac','rezany')),
    dodavatel text,
    aktivny boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index if not exists idx_produkty_kategoria on produkty(kategoria_id);
create index if not exists idx_produkty_handle on produkty(shopify_handle);

-- ---------- PRODUKT × FARBY (M:N) ----------
create table if not exists produkt_farby (
    produkt_id bigint references produkty(id) on delete cascade,
    farba_id bigint references farby(id) on delete cascade,
    primary key (produkt_id, farba_id)
);

-- ---------- VEĽKOSTI PRODUKTU ----------
create table if not exists produkt_velkosti (
    id bigint generated always as identity primary key,
    produkt_id bigint references produkty(id) on delete cascade,
    velkost text not null,                   -- napr. 'S', 'XL', '128'
    poradie int default 0
);
create index if not exists idx_velkosti_produkt on produkt_velkosti(produkt_id);

-- ---------- MAX. ROZMER POTLAČE PRE KAŽDÚ ZÓNU DANEJ VEĽKOSTI ----------
create table if not exists produkt_velkost_zony (
    id bigint generated always as identity primary key,
    produkt_velkost_id bigint references produkt_velkosti(id) on delete cascade,
    zona text not null check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav')),
    max_sirka_cm numeric(6,2) not null,
    max_vyska_cm numeric(6,2) not null,
    unique (produkt_velkost_id, zona)
);

-- ---------- FONTY ----------
create table if not exists fonty (
    id bigint generated always as identity primary key,
    nazov text not null,                     -- presný CSS font-family
    pouzitie text not null check (pouzitie in ('vsetko','meno','cislo','text')),
    created_at timestamptz default now()
);

-- ---------- GRAFIKY (design knižnica) ----------
create table if not exists grafiky (
    id bigint generated always as identity primary key,
    nazov text not null,
    kategoria text,
    url text not null,                       -- odkaz na Supabase Storage
    created_at timestamptz default now()
);

-- ---------- CENNÍK — PLOŠNÉ TECHNOLÓGIE (sublimácia, DTF) ----------
create table if not exists cennik_technologie (
    technologia text primary key check (technologia in ('sublimacia','dtf')),
    cena_cm2 numeric(10,4) not null,
    min_cena numeric(10,2) not null default 0
);

-- ---------- CENNÍK — SIEŤOTLAČ (plocha + počet farieb) ----------
create table if not exists cennik_sietotlac (
    id int primary key default 1,
    cena_cm2 numeric(10,4) not null,
    min_cena numeric(10,2) not null default 0,
    priplatok_farba numeric(10,2) not null default 0,
    constraint jediny_riadok check (id = 1)
);

-- ---------- CENNÍK — TYPY FÓLIE PRE REZANÝ TRANSFER ----------
create table if not exists cennik_folie (
    id bigint generated always as identity primary key,
    nazov text not null,
    cena_cm2 numeric(10,4) not null
);
create table if not exists cennik_rezany_transfer (
    id int primary key default 1,
    min_cena numeric(10,2) not null default 0,
    constraint jediny_riadok_rezany check (id = 1)
);

-- ---------- OBJEDNÁVKY (fronta pre ERP schvaľovanie) ----------
create table if not exists objednavky (
    id bigint generated always as identity primary key,
    shopify_order_id text,                   -- ID objednávky zo Shopify (webhook orders/create)
    produkt_id bigint references produkty(id),
    farba text,
    velkost text,
    pocet_ks int not null default 1,
    technologia text,
    pocet_farieb int default 1,
    plocha_cm2_spolu numeric(10,2),
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2),
    status text not null default 'na_schvalenie' check (status in ('na_schvalenie','schvalene','zamietnute')),
    grafika_ok boolean default false,
    design_id text,                          -- odkaz na súbor(y) v Storage
    poznamka text,
    created_at timestamptz default now(),
    schvalene_at timestamptz
);
create index if not exists idx_objednavky_status on objednavky(status);
create index if not exists idx_objednavky_shopify on objednavky(shopify_order_id);

-- ---------- ZÓNY POTLAČE V RÁMCI JEDNEJ OBJEDNÁVKY ----------
-- (jeden produkt môže mať potlač na viacerých zónach naraz — predok+chrbát+rukávy)
create table if not exists objednavka_zony (
    id bigint generated always as identity primary key,
    objednavka_id bigint references objednavky(id) on delete cascade,
    zona text not null check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav')),
    tlacovy_subor_url text,                  -- PNG/PDF pripravené na tlač
    nahlad_url text
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table kategorie enable row level security;
alter table farby enable row level security;
alter table produkty enable row level security;
alter table produkt_farby enable row level security;
alter table produkt_velkosti enable row level security;
alter table produkt_velkost_zony enable row level security;
alter table fonty enable row level security;
alter table grafiky enable row level security;
alter table cennik_technologie enable row level security;
alter table cennik_sietotlac enable row level security;
alter table cennik_folie enable row level security;
alter table cennik_rezany_transfer enable row level security;
alter table objednavky enable row level security;
alter table objednavka_zony enable row level security;

-- Verejné čítanie (konfigurátor na eshope) — len aktívne produkty a ich súvisiace dáta
create policy "verejne citanie kategorii" on kategorie for select using (true);
create policy "verejne citanie farieb" on farby for select using (true);
create policy "verejne citanie aktivnych produktov" on produkty for select using (aktivny = true);
create policy "verejne citanie produkt_farby" on produkt_farby for select using (true);
create policy "verejne citanie velkosti" on produkt_velkosti for select using (true);
create policy "verejne citanie zon" on produkt_velkost_zony for select using (true);
create policy "verejne citanie fontov" on fonty for select using (true);
create policy "verejne citanie grafik" on grafiky for select using (true);
create policy "verejne citanie cennika_tech" on cennik_technologie for select using (true);
create policy "verejne citanie cennika_sieto" on cennik_sietotlac for select using (true);
create policy "verejne citanie folii" on cennik_folie for select using (true);
create policy "verejne citanie cennika_rezany" on cennik_rezany_transfer for select using (true);

-- Vkladanie objednávok je verejné (prichádzajú z konfigurátora / Shopify webhooku),
-- ale menenie stavu (schválenie) je len pre prihlásených (Master rola v Supabase Auth)
create policy "verejne vytvorenie objednavky" on objednavky for insert with check (true);
create policy "verejne vytvorenie zony objednavky" on objednavka_zony for insert with check (true);

-- Zápis/úprava/mazanie vo všetkých tabuľkách len pre prihlásených administrátorov
create policy "admin plny pristup kategorie" on kategorie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup farby" on farby for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup produkty" on produkty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup produkt_farby" on produkt_farby for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup velkosti" on produkt_velkosti for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup zony" on produkt_velkost_zony for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup fonty" on fonty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup grafiky" on grafiky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup cennik_tech" on cennik_technologie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup cennik_sieto" on cennik_sietotlac for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup folie" on cennik_folie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup cennik_rezany" on cennik_rezany_transfer for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup objednavky" on objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie objednaviek" on objednavky for select using (auth.role() = 'authenticated');
create policy "admin citanie zon objednaviek" on objednavka_zony for select using (auth.role() = 'authenticated');

-- ============================================================
-- POČIATOČNÉ DÁTA (rovnaké ako v prototype pre plynulý prechod)
-- ============================================================
insert into kategorie (nazov) values ('Tričko'), ('Mikina'), ('Dres'), ('Taška'), ('Šiltovka')
on conflict do nothing;

insert into farby (nazov, hex) values
    ('Biela', '#f1f2f4'), ('Čierna', '#1b1e24'), ('Modrá', '#1b4b8c'),
    ('Červená', '#b3202c'), ('Sivá', '#8d96a3')
on conflict do nothing;

insert into cennik_technologie (technologia, cena_cm2, min_cena) values
    ('sublimacia', 0.12, 3.0),
    ('dtf', 0.18, 3.5)
on conflict (technologia) do nothing;

insert into cennik_sietotlac (id, cena_cm2, min_cena, priplatok_farba) values
    (1, 0.03, 6.5, 1.5)
on conflict (id) do nothing;

insert into cennik_rezany_transfer (id, min_cena) values (1, 4.0)
on conflict (id) do nothing;

insert into cennik_folie (nazov, cena_cm2) values
    ('Štandardná biela/čierna', 0.15),
    ('Flex farebná', 0.20),
    ('Flock / semiš', 0.28),
    ('Reflexná', 0.35)
on conflict do nothing;

-- ============================================================
-- POZNÁMKA K STORAGE
-- Vytvor v Supabase Storage bucket "print-designs" (súkromný, prístup cez
-- signed URL) pre tlačové súbory (PNG/PDF) a náhľady z konfigurátora.
-- ============================================================
