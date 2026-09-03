-- ============================================================
-- MIGRÁCIA: PrintStudio Pro — konfigurátor plážových vlajok (beachflag)
-- Zodpovedá dátovému modelu z beachflag_studio_pro.html
-- Úplne izolované od tabuliek pre trička/dresy (žiadne zdieľané FK) —
-- prefix vlajka_ na všetkom, aby sa predišlo kolízii s konfigurátorom oblečenia.
-- Spustiť v Supabase SQL editore alebo cez `supabase db push`.
-- ============================================================

-- ---------- TVARY VLAJKY ----------
create table if not exists vlajka_tvary (
    id bigint generated always as identity primary key,
    kod text not null unique,                -- napr. 'pierko', 'kvapka', 'cepel', 'kridlo'
    nazov text not null,
    ikona text,                              -- meno lucide-react ikony
    poradie int default 0,
    aktivny boolean not null default true,
    created_at timestamptz default now()
);

-- ---------- CUT/SAFE SVG CESTY PRE KAŽDÝ TVAR × VEĽKOSŤ ----------
create table if not exists vlajka_tvar_rozmery (
    id bigint generated always as identity primary key,
    tvar_id bigint references vlajka_tvary(id) on delete cascade,
    velkost text not null check (velkost in ('S','M','L','XL')),
    viewbox text not null default '0 0 210 430',
    cut_path text not null,                  -- SVG "d" atribút — červená prerušovaná orezová čiara
    safe_path text not null,                 -- SVG "d" atribút — zelená prerušovaná bezpečná zóna
    unique (tvar_id, velkost)
);

-- ---------- VEĽKOSTI (plochá cena, nie cm² formula) ----------
create table if not exists vlajka_velkosti (
    id bigint generated always as identity primary key,
    kod text not null unique check (kod in ('S','M','L','XL')),
    nazov text not null,
    vyska_cm numeric(6,1) not null,          -- celková výška po zostavení (od zeme)
    rozmer_popis text not null,              -- napr. '65 x 290 cm'
    cena numeric(10,2) not null default 0,
    poradie int default 0,
    aktivny boolean not null default true
);

-- ---------- OPRACOVANIE OKRAJOV ----------
create table if not exists vlajka_dokoncenie (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    cena numeric(10,2) not null default 0,
    popis text,
    obrazok_url text,
    poradie int default 0,
    aktivny boolean not null default true
);

-- ---------- KONŠTRUKCIA / PRÚT ----------
create table if not exists vlajka_stoziare (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    cena numeric(10,2) not null default 0,
    popis text,
    obrazok_url text,
    poradie int default 0,
    aktivny boolean not null default true
);

-- ---------- PODSTAVCE A PRÍSLUŠENSTVO (s množstvom) ----------
create table if not exists vlajka_doplnky (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    cena numeric(10,2) not null default 0,   -- cena za kus
    popis text,
    obrazok_url text,
    max_mnozstvo int not null default 10,
    poradie int default 0,
    aktivny boolean not null default true
);

-- ---------- PANTONE VZORKY (samostatné od farby, ktorá má tričkové polia) ----------
create table if not exists vlajka_pantone (
    id bigint generated always as identity primary key,
    kod text not null,                       -- napr. 'Pantone 185 C'
    hex text not null,
    poradie int default 0
);

-- ---------- GLOBÁLNE NASTAVENIA (jeden riadok) ----------
create table if not exists vlajka_nastavenia (
    id int primary key default 1,
    dph_percent numeric(5,2) not null default 23,
    expresny_priplatok_percent numeric(5,2) not null default 10,
    constraint jediny_riadok_nastavenia check (id = 1)
);

-- ---------- FRONTA OBJEDNÁVOK ZO SHOPIFY (na schválenie) ----------
-- Nezdieľaná s objednavky/objednavka_zony (tá má zona CHECK špecifický pre oblečenie).
-- Polia tvar_kod/velkost_kod/... sú zámerne text (nie FK) — úprava/zmazanie katalógu
-- nikdy neosirie históriu už prijatej objednávky.
create table if not exists vlajka_objednavky (
    id bigint generated always as identity primary key,
    shopify_order_id text,
    shopify_order_number text,               -- napr. '#1042'
    design_id text,                          -- priečinok v Storage bucket print-designs
    tvar_kod text,
    velkost_kod text,
    dokoncenie_kod text,
    stoziar_kod text,
    doplnky jsonb default '[]'::jsonb,       -- [{kod, nazov, mnozstvo, cena_ks}]
    pantone_kod text,
    farba_hex text,
    farba_poznamka text,
    text_na_vlajke text,
    ma_ai_pozadie boolean default false,
    pocet_ks int not null default 1,
    expresne boolean default false,
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2),
    status text not null default 'na_schvalenie' check (status in ('na_schvalenie','schvalene','zamietnute')),
    nahlad_url text,
    tlacovy_subor_url text,
    zakaznik_meno text,
    zakaznik_email text,
    poznamka text,
    raw_shopify_payload jsonb,               -- celé telo webhooku, pre ručné dohľadanie
    created_at timestamptz default now(),
    schvalene_at timestamptz
);
create index if not exists idx_vlajka_objednavky_status on vlajka_objednavky(status);
create index if not exists idx_vlajka_objednavky_shopify on vlajka_objednavky(shopify_order_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table vlajka_tvary enable row level security;
alter table vlajka_tvar_rozmery enable row level security;
alter table vlajka_velkosti enable row level security;
alter table vlajka_dokoncenie enable row level security;
alter table vlajka_stoziare enable row level security;
alter table vlajka_doplnky enable row level security;
alter table vlajka_pantone enable row level security;
alter table vlajka_nastavenia enable row level security;
alter table vlajka_objednavky enable row level security;

-- Verejné čítanie (konfigurátor na eshope) — len aktívne katalógové riadky
create policy "verejne citanie vlajka_tvarov" on vlajka_tvary for select using (aktivny = true);
create policy "verejne citanie vlajka_tvar_rozmerov" on vlajka_tvar_rozmery for select using (true);
create policy "verejne citanie vlajka_velkosti" on vlajka_velkosti for select using (aktivny = true);
create policy "verejne citanie vlajka_dokoncenia" on vlajka_dokoncenie for select using (aktivny = true);
create policy "verejne citanie vlajka_stoziarov" on vlajka_stoziare for select using (aktivny = true);
create policy "verejne citanie vlajka_doplnkov" on vlajka_doplnky for select using (aktivny = true);
create policy "verejne citanie vlajka_pantone" on vlajka_pantone for select using (true);
create policy "verejne citanie vlajka_nastaveni" on vlajka_nastavenia for select using (true);

-- Vkladanie objednávok je verejné (webhook z edge funkcie aj tak používa service-role kľúč
-- a RLS obchádza — táto policy je len pre konzistenciu s existujúcim vzorom/debug)
create policy "verejne vytvorenie vlajka_objednavky" on vlajka_objednavky for insert with check (true);

-- Zápis/úprava/mazanie v katalógových tabuľkách len pre prihlásených administrátorov
create policy "admin plny pristup vlajka_tvary" on vlajka_tvary for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_tvar_rozmery" on vlajka_tvar_rozmery for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_velkosti" on vlajka_velkosti for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_dokoncenie" on vlajka_dokoncenie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_stoziare" on vlajka_stoziare for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_doplnky" on vlajka_doplnky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_pantone" on vlajka_pantone for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup vlajka_nastavenia" on vlajka_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie vlajka_objednaviek" on vlajka_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update vlajka_objednaviek" on vlajka_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- POČIATOČNÉ DÁTA (prevzaté z prototypu beachflag_studio_pro.html)
-- ============================================================
insert into vlajka_tvary (kod, nazov, ikona, poradie) values
    ('pierko', 'Pierko (Feather)', 'flag', 1),
    ('kvapka', 'Slza (Tear)', 'droplet', 2),
    ('cepel', 'Čepeľ (Blade)', 'sword', 3),
    ('kridlo', 'Krídlo (Wing)', 'feather', 4)
on conflict (kod) do nothing;

-- Cut/safe cesty — pôvodné SVG dáta z prototypu (viewBox 0 0 210 430)
insert into vlajka_tvar_rozmery (tvar_id, velkost, viewbox, cut_path, safe_path)
select t.id, v.velkost, v.viewbox, v.cut_path, v.safe_path
from vlajka_tvary t
join (values
    ('pierko','S','0 0 190 400','M 10,10 C 120,10 180,40 180,120 L 180,380 C 100,410 20,390 10,380 Z','M 20,20 C 110,20 165,45 165,120 L 165,365 C 95,390 30,375 20,368 Z'),
    ('pierko','M','0 0 200 420','M 10,10 C 130,10 190,40 190,120 L 190,400 C 100,420 20,400 10,390 Z','M 20,20 C 120,20 175,45 175,120 L 175,385 C 95,400 30,385 20,378 Z'),
    ('pierko','L','0 0 205 425','M 10,10 C 140,10 195,40 195,120 L 195,410 C 100,425 20,405 10,395 Z','M 20,20 C 130,20 180,45 180,120 L 180,395 C 95,405 30,390 20,383 Z'),
    ('pierko','XL','0 0 210 430','M 10,10 C 150,10 200,40 200,120 L 200,415 C 100,430 20,410 10,400 Z','M 20,20 C 140,20 185,45 185,120 L 185,400 C 95,410 30,395 20,388 Z'),
    ('kvapka','S','0 0 210 420','M 10,120 C 10,20 150,10 180,120 C 200,200 180,380 90,410 C 10,380 10,200 10,120 Z','M 20,120 C 20,30 140,20 165,120 C 180,195 165,365 90,392 C 20,365 20,195 20,120 Z'),
    ('kvapka','M','0 0 215 425','M 10,120 C 10,20 160,10 185,120 C 205,210 185,390 95,415 C 10,385 10,200 10,120 Z','M 20,120 C 20,30 150,20 170,120 C 185,200 170,375 95,397 C 20,370 20,195 20,120 Z'),
    ('kvapka','L','0 0 220 430','M 10,120 C 10,20 170,10 190,120 C 210,220 190,400 100,420 C 10,390 10,200 10,120 Z','M 20,120 C 20,30 160,20 175,120 C 190,210 175,385 100,402 C 20,375 20,195 20,120 Z'),
    ('kvapka','XL','0 0 225 432','M 10,120 C 10,20 180,10 195,120 C 215,225 195,405 105,422 C 10,392 10,200 10,120 Z','M 20,120 C 20,30 170,20 180,120 C 195,215 180,390 105,404 C 20,377 20,195 20,120 Z'),
    ('cepel','S','0 0 180 420','M 10,10 C 120,10 170,20 170,100 L 150,380 C 80,410 10,390 10,380 Z','M 20,20 C 110,20 155,28 155,95 L 138,365 C 75,390 20,375 20,368 Z'),
    ('cepel','M','0 0 190 425','M 10,10 C 130,10 180,20 180,100 L 160,395 C 90,415 10,395 10,385 Z','M 20,20 C 120,20 165,28 165,95 L 148,380 C 85,395 20,380 20,373 Z'),
    ('cepel','L','0 0 195 430','M 10,10 C 140,10 185,20 185,100 L 165,405 C 95,420 10,400 10,390 Z','M 20,20 C 130,20 170,28 170,95 L 153,390 C 90,400 20,385 20,378 Z'),
    ('cepel','XL','0 0 200 435','M 10,10 C 150,10 190,20 190,100 L 170,410 C 100,425 10,405 10,395 Z','M 20,20 C 140,20 175,28 175,95 L 158,395 C 95,405 20,390 20,383 Z'),
    ('kridlo','S','0 0 190 420','M 10,30 C 80,10 180,10 180,100 L 180,390 C 100,390 20,410 10,370 Z','M 20,38 C 80,22 165,22 165,100 L 165,375 C 95,375 30,390 20,358 Z'),
    ('kridlo','M','0 0 200 425','M 10,30 C 80,10 190,10 190,100 L 190,405 C 100,405 20,415 10,380 Z','M 20,38 C 80,22 175,22 175,100 L 175,390 C 95,390 30,395 20,368 Z'),
    ('kridlo','L','0 0 205 430','M 10,30 C 80,10 195,10 195,100 L 195,415 C 100,415 20,420 10,390 Z','M 20,38 C 80,22 180,22 180,100 L 180,400 C 95,400 30,400 20,378 Z'),
    ('kridlo','XL','0 0 210 435','M 10,30 C 80,10 200,10 200,100 L 200,420 C 100,420 20,425 10,395 Z','M 20,38 C 80,22 185,22 185,100 L 185,405 C 95,405 30,405 20,383 Z')
) as v(tvar_kod, velkost, viewbox, cut_path, safe_path) on v.tvar_kod = t.kod
on conflict (tvar_id, velkost) do nothing;

insert into vlajka_velkosti (kod, nazov, vyska_cm, rozmer_popis, cena, poradie) values
    ('S', 'S', 220, '50 x 190 cm', 45.00, 1),
    ('M', 'M', 350, '65 x 290 cm', 55.00, 2),
    ('L', 'L', 450, '80 x 380 cm', 70.00, 3),
    ('XL', 'XL', 550, '90 x 480 cm', 90.00, 4)
on conflict (kod) do nothing;

insert into vlajka_dokoncenie (kod, nazov, cena, popis, poradie) values
    ('hemmed', 'Obšitie okrajov dookola', 0, 'Spevnené dvojité prešitie po obvode pre dlhú životnosť vo vetre.', 1),
    ('laser', 'Orezané laserom', 0, 'Čistý zatavený okraj bez nití, znižuje hmotnosť vlajky.', 2)
on conflict (kod) do nothing;

insert into vlajka_stoziare (kod, nazov, cena, popis, poradie) values
    ('none', 'Bez konštrukcie', 0, 'Iba samotná vytlačená plachta vlajky.', 1),
    ('basic', 'Basic Laminát prút', 14.00, 'Pružný sklolaminát, vhodný pre bežné exteriérové podmienky.', 2),
    ('pro', 'PRO Hliník + Sklo prút', 24.00, 'Extra spevnená konštrukcia s eloxovaným hliníkovým základom.', 3)
on conflict (kod) do nothing;

insert into vlajka_doplnky (kod, nazov, cena, popis, max_mnozstvo, poradie) values
    ('cross', 'Krížový podstavec (Skladací)', 18.00, 'Ľahký prenosný kovový kríž na pevný podklad.', 5, 1),
    ('plate4kg', 'Oceľová platňa 4kg', 28.00, 'Stabilná plochá oceľová základňa pre interiér aj exteriér.', 5, 2),
    ('spike', 'Zapichovací oceľový tŕň', 15.00, 'Kovový kolík ideálny do trávnika, hliny alebo piesku.', 5, 3),
    ('waterbag', 'Vodný zaťažovací vak (10L)', 8.00, 'Prídavný prstenec plniteľný vodou pre vyššiu stabilitu vo vetre.', 5, 4)
on conflict (kod) do nothing;

insert into vlajka_pantone (kod, hex, poradie) values
    ('Pantone 185 C', '#e4002b', 1),
    ('Pantone 286 C', '#0033a0', 2),
    ('Pantone 355 C', '#009639', 3),
    ('Pantone Yellow C', '#fed100', 4),
    ('Pantone Orange 021 C', '#fe5000', 5),
    ('Pantone Process Black', '#2d2926', 6),
    ('Pantone 268 C', '#582c83', 7),
    ('Pantone 320 C', '#009999', 8)
on conflict do nothing;

insert into vlajka_nastavenia (id, dph_percent, expresny_priplatok_percent) values (1, 23, 10)
on conflict (id) do nothing;

-- ============================================================
-- POZNÁMKA K STORAGE
-- Znovu sa používa existujúci bucket "print-designs" (rovnaký ako pre trička),
-- cesta ${design_id}/vlajka.png — nový bucket sa nevytvára.
-- ============================================================
