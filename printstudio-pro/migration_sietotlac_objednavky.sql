-- ============================================================
-- SIEŤOTLAČ — 2. ČASŤ: objednávka a platba (Shopify), viac potlačí na kuse, umiestnenia, B2B kódy.
-- Dopĺňa migration_sietotlac_appka.sql. Bezpečné spustiť opakovane, nič nemaže.
-- Hodnoty označené ODHAD si skontroluj v ERP (Aplikácie → Sieťotlač).
-- ============================================================

-- poplatky / doprava / produkt pre zákazky (rovnaké polia ako ostatné appky — karta „Poplatky, doprava a minimálna cena“)
alter table sietotlac_nastavenia add column if not exists manipulacny_poplatok_eur numeric(10,2) not null default 3;       -- ODHAD
alter table sietotlac_nastavenia add column if not exists cena_doprava numeric(10,2) not null default 4.5;                 -- ODHAD
alter table sietotlac_nastavenia add column if not exists postovne_zdarma_od_eur numeric(10,2) not null default 0;
alter table sietotlac_nastavenia add column if not exists minimalna_cena_eur numeric(10,2) not null default 0;
alter table sietotlac_nastavenia add column if not exists produkt_id bigint references produkty(id) on delete set null;

-- umiestnenia potlače na kuse (hruď-srdce, chrbát, rukávy…) s limitmi rozmeru
create table if not exists sietotlac_umiestnenia (
  kod text primary key,
  nazov text not null,
  popis text,
  strana text not null default 'predok',                 -- predok | zadok | rukav_l | rukav_p (len pre náhľad)
  max_sirka_cm numeric not null default 30,
  max_vyska_cm numeric not null default 40,
  vychodzia_sirka_cm numeric not null default 20,
  vychodzia_vyska_cm numeric not null default 20,
  aktivny boolean not null default true,
  poradie integer not null default 0
);
insert into sietotlac_umiestnenia (kod, nazov, popis, strana, max_sirka_cm, max_vyska_cm, vychodzia_sirka_cm, vychodzia_vyska_cm, poradie) values
  ('hrud_srdce', 'Hruď — srdce (ľavá strana)', 'Malé logo na ľavej strane hrude', 'predok', 12, 12, 8, 8, 1),
  ('hrud_stred', 'Hruď — stred', 'Väčší motív v strede hrude', 'predok', 35, 45, 28, 32, 2),
  ('chrbat', 'Chrbát', 'Veľká potlač na chrbte', 'zadok', 43, 58, 30, 40, 3),
  ('rukav_lavy', 'Ľavý rukáv', 'Potlač na ľavom rukáve', 'rukav_l', 10, 30, 7, 7, 4),
  ('rukav_pravy', 'Pravý rukáv', 'Potlač na pravom rukáve', 'rukav_p', 10, 30, 7, 7, 5)
on conflict (kod) do nothing;                              -- rozmery sú ODHAD

-- objednávky (zaplatené cez Shopify draft order)
create table if not exists sietotlac_objednavky (
  id uuid primary key default gen_random_uuid(),
  cislo_objednavky text,
  pocet_ks integer not null check (pocet_ks > 0),
  material text,
  tmavy boolean not null default false,
  dve_velkosti boolean not null default false,
  polozky jsonb not null default '[]'::jsonb,            -- potlače: umiestnenie, rozmer, farby, efekt, súbor
  cena_kus numeric(10,2),
  cena_spolu numeric(10,2) not null,
  naklad_spolu numeric(10,2),
  b2b_kod text,
  osobny_odber boolean not null default false,
  subor_nazov text,
  subor_cesta text,
  shopify_order_id text,
  erp_zakazka_id text,
  erp_cislo text,
  stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
  created_at timestamptz default now()
);

alter table sietotlac_dopyty add column if not exists b2b_kod text;

alter table sietotlac_umiestnenia enable row level security;
alter table sietotlac_objednavky enable row level security;
drop policy if exists "prihlaseni plny pristup sietotlac_umiestnenia" on sietotlac_umiestnenia;
create policy "prihlaseni plny pristup sietotlac_umiestnenia" on sietotlac_umiestnenia for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "prihlaseni plny pristup sietotlac_objednavky" on sietotlac_objednavky;
create policy "prihlaseni plny pristup sietotlac_objednavky" on sietotlac_objednavky for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
