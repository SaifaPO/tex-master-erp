-- ============================================================
-- MIGRÁCIA: PrintStudio Pro — 3D konfigurátor dresov (dres3d)
-- Zodpovedá dátovému modelu z 3d_konfigurator_dresov.html
-- Beží POPRI existujúcom 2D konfigurátore (produkty/farby/fonty/grafiky/produkt_velkosti
-- sa znovu používajú) — nový prefix dres_/produkt_dres_ len pre veci špecifické pre 3D dresy,
-- podľa rovnakého vzoru izolácie ako migration_beachflag.sql.
-- Spustiť v Supabase SQL editore alebo cez `supabase db push`.
-- ============================================================

-- ---------- TYP KONFIGURÁTORA NA PRODUKTE ----------
alter table produkty add column if not exists typ_konfiguratora text not null default '2d_potlac'
    check (typ_konfiguratora in ('2d_potlac', '3d_dres'));

-- ---------- PREDVOLENÉ NASTAVENIA 3D DRESU (1 riadok na produkt typu 3d_dres) ----------
create table if not exists produkt_dres_nastavenia (
    produkt_id bigint primary key references produkty(id) on delete cascade,
    farba_zakladna text not null default '#1e3a8a',
    farba_vzor text not null default '#dc2626',
    farba_akcent text not null default '#f59e0b',
    farba_rukava text not null default '#1e3a8a',
    farba_golier text not null default '#ffffff',
    dostupne_vzory text[] not null default array['stripes','hoops','sash','honeycomb','chevron','gradient','modern','camo','plain'],
    dostupne_goliere text[] not null default array['round','vneck','ribbed']
);

-- ---------- MATERIÁLY DRESU (na produkt, s príplatkom) ----------
create table if not exists produkt_dres_materialy (
    id bigint generated always as identity primary key,
    produkt_id bigint not null references produkty(id) on delete cascade,
    kod text not null,
    nazov text not null,
    popis text,
    priplatok_eur numeric(10,2) not null default 0,
    poradie int default 0,
    unique (produkt_id, kod)
);

-- ---------- MNOŽSTEVNÉ ZĽAVY (globálne, podľa počtu hráčov v súpiske) ----------
create table if not exists dres_mnozstevne_zlavy (
    id bigint generated always as identity primary key,
    min_pocet int not null unique,
    zlava_percent numeric(5,2) not null default 0,
    poradie int default 0
);

-- ---------- FRONTA OBJEDNÁVOK ZO SHOPIFY (na schválenie) ----------
-- Nezdieľaná s objednavky/objednavka_zony ani vlajka_objednavky — vlastná tabuľka,
-- rovnaký vzor ako vlajka_objednavky (text polia namiesto FK na katalóg, aby úprava/zmazanie
-- katalógu nikdy neosirelo históriu už prijatej objednávky).
create table if not exists dres_objednavky (
    id bigint generated always as identity primary key,
    shopify_order_id text,
    shopify_order_number text,
    design_id text,
    produkt_id bigint references produkty(id) on delete set null,
    produkt_nazov text,
    vzor_kod text,
    farba_zakladna text,
    farba_vzor text,
    farba_akcent text,
    farba_rukava text,
    farba_golier text,
    golier_typ text,
    material_kod text,
    material_nazov text,
    tim_text text,
    font text,
    roster jsonb default '[]'::jsonb,        -- [{meno, cislo, velkost}]
    pocet_ks int not null default 1,
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2),
    status text not null default 'na_schvalenie' check (status in ('na_schvalenie','schvalene','zamietnute')),
    nahlad_url text,
    zakaznik_meno text,
    zakaznik_email text,
    poznamka text,
    raw_shopify_payload jsonb,
    created_at timestamptz default now(),
    schvalene_at timestamptz
);
create index if not exists idx_dres_objednavky_status on dres_objednavky(status);
create index if not exists idx_dres_objednavky_shopify on dres_objednavky(shopify_order_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table produkt_dres_nastavenia enable row level security;
alter table produkt_dres_materialy enable row level security;
alter table dres_mnozstevne_zlavy enable row level security;
alter table dres_objednavky enable row level security;

-- Verejné čítanie (konfigurátor na eshope)
create policy "verejne citanie produkt_dres_nastaveni" on produkt_dres_nastavenia for select using (true);
create policy "verejne citanie produkt_dres_materialov" on produkt_dres_materialy for select using (true);
create policy "verejne citanie dres_mnozstevnych_zliav" on dres_mnozstevne_zlavy for select using (true);

-- Vkladanie objednávok je verejné (webhook z edge funkcie aj tak používa service-role kľúč
-- a RLS obchádza — táto policy je len pre konzistenciu s existujúcim vzorom/debug)
create policy "verejne vytvorenie dres_objednavky" on dres_objednavky for insert with check (true);

-- Zápis/úprava/mazanie v katalógových tabuľkách len pre prihlásených administrátorov
create policy "admin plny pristup produkt_dres_nastavenia" on produkt_dres_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup produkt_dres_materialy" on produkt_dres_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup dres_mnozstevne_zlavy" on dres_mnozstevne_zlavy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie dres_objednaviek" on dres_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update dres_objednaviek" on dres_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- POČIATOČNÉ DÁTA (prevzaté z prototypu 3d_konfigurator_dresov.html)
-- ============================================================
insert into dres_mnozstevne_zlavy (min_pocet, zlava_percent, poradie) values
    (5, 8, 1),
    (10, 15, 2),
    (20, 25, 3)
on conflict (min_pocet) do nothing;

-- ============================================================
-- POZNÁMKA K STORAGE
-- Znovu sa používa existujúci bucket "print-designs" (rovnaký ako pre trička a vlajky),
-- cesta ${design_id}/dres.png — nový bucket sa nevytvára.
--
-- POZNÁMKA K TESTOVANIU
-- Aby sa konkrétny produkt zobrazoval cez 3D konfigurátor namiesto 2D Fabric editora,
-- treba mu nastaviť typ_konfiguratora, napr.:
--   update produkty set typ_konfiguratora = '3d_dres' where id = <ID_PRODUKTU>;
-- a založiť mu predvolené nastavenia zón, napr.:
--   insert into produkt_dres_nastavenia (produkt_id) values (<ID_PRODUKTU>);
--   insert into produkt_dres_materialy (produkt_id, kod, nazov, popis, priplatok_eur, poradie) values
--     (<ID_PRODUKTU>, 'aero', 'AeroDry Ultra Pro (145 g/m²)', 'Priedušná mikrosieťovina', 0, 1),
--     (<ID_PRODUKTU>, 'elite', 'Elite Match HydroTech', 'Elastický s UV ochranou', 4.50, 2);
-- ============================================================
