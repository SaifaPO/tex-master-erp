-- ============================================================
-- POTLAČ TEXTILU (?typ=potlac) — jedna appka: vyber produktu (tričko, mikina…) → farba → technológia (DTF / rezaný transfer / sieťotlač)
-- → návrh potlače na fotke produktu → cena → platba cez Shopify. Textil môže dodať zákazník, alebo ho objednať od nás.
-- Bezpečné spustiť opakovane, nič nemaže. Ceny textilov označené FIKTÍVNE si doplň v ERP (Aplikácie → Potlač textilu).
-- ============================================================

create table if not exists potlac_nastavenia (
  id integer primary key default 1 check (id = 1),
  aktivny boolean not null default true,
  info_text text,
  email_notifikacie text,
  manipulacny_poplatok_eur numeric(10,2) not null default 5,
  cena_doprava numeric(10,2) not null default 4.5,
  postovne_zdarma_od_eur numeric(10,2) not null default 100,
  minimalna_cena_eur numeric(10,2) not null default 0,
  max_ks integer not null default 5000,
  produkt_id bigint references produkty(id) on delete set null,   -- Blank (Produkty) pre zákazky v ERP
  updated_at timestamptz default now()
);
insert into potlac_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists potlac_produkty (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  nazov text not null,
  kategoria text not null default 'tricko',                       -- tricko | mikina | polokosela | siltovka | ine
  popis text,
  material text not null default 'bavlna' check (material in ('bavlna','polyester')),
  cena_textilu_eur numeric(10,2) not null default 0,              -- predajná cena textilu za kus BEZ DPH (ak ho objednáva od nás)
  velkosti text[] not null default '{S,M,L,XL,XXL}',
  farby jsonb not null default '[]'::jsonb,                       -- [{nazov, hex}] — fotka (biela) sa prefarbí automaticky
  technologie text[] not null default '{dtf,rezany,sietotlac}',
  foto_predok_url text,                                           -- biely produkt na bielom pozadí
  foto_zadok_url text,
  foto_sirka_cm numeric(8,2) not null default 100,                -- koľko cm reálne predstavuje šírka fotky (na mierku potlače)
  pozicie jsonb not null default '{}'::jsonb,                     -- { kod_umiestnenia: { predok|zadok: { x, y, kotva: 'stred'|'hore', rot } } } — pomery 0–1 z fotky
  poradie integer not null default 0,
  aktivny boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists potlac_objednavky (
  id uuid primary key default gen_random_uuid(),
  cislo_objednavky text,
  produkt_id uuid,
  produkt_nazov text,
  vlastny_textil boolean not null default false,
  farba_nazov text,
  farba_hex text,
  technologia text not null,
  velkosti jsonb,                                                  -- { "M": 3, "L": 2 } pri textile od nás
  pocet_ks integer not null check (pocet_ks > 0),
  polozky jsonb not null default '[]'::jsonb,                      -- potlače: umiestnenie, rozmer, farby, efekt, súbor
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

alter table potlac_nastavenia enable row level security;
alter table potlac_produkty enable row level security;
alter table potlac_objednavky enable row level security;
drop policy if exists "prihlaseni plny pristup potlac_nastavenia" on potlac_nastavenia;
create policy "prihlaseni plny pristup potlac_nastavenia" on potlac_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "prihlaseni plny pristup potlac_produkty" on potlac_produkty;
create policy "prihlaseni plny pristup potlac_produkty" on potlac_produkty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "prihlaseni plny pristup potlac_objednavky" on potlac_objednavky;
create policy "prihlaseni plny pristup potlac_objednavky" on potlac_objednavky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- verejné úložisko fotiek produktov (čítanie pre všetkých, zápis len prihlásení)
insert into storage.buckets (id, name, public) values ('potlac-produkty', 'potlac-produkty', true) on conflict (id) do nothing;
drop policy if exists "potlac produkty citanie" on storage.objects;
create policy "potlac produkty citanie" on storage.objects for select using (bucket_id = 'potlac-produkty');
drop policy if exists "potlac produkty zapis" on storage.objects;
create policy "potlac produkty zapis" on storage.objects for all
  using (bucket_id = 'potlac-produkty' and auth.role() = 'authenticated') with check (bucket_id = 'potlac-produkty' and auth.role() = 'authenticated');

-- ===== východiskové produkty =====
-- Pánske biele bavlnené tričko (fotky z /produkty/ v appke) — ako prvý aktívny produkt.
insert into potlac_produkty (kod, nazov, kategoria, popis, material, cena_textilu_eur, velkosti, farby, technologie, foto_predok_url, foto_zadok_url, foto_sirka_cm, pozicie, poradie, aktivny)
values (
  'tricko-panske', 'Pánske tričko (bavlna)', 'tricko',
  'Klasické pánske tričko z bavlny, okrúhly priekrčník. FIKTÍVNA CENA — nahraď skutočnou predajnou cenou.', 'bavlna', 4.90,
  '{S,M,L,XL,XXL,3XL}',
  '[{"nazov":"Biela","hex":"#ffffff"},{"nazov":"Čierna","hex":"#141414"},{"nazov":"Tmavomodrá","hex":"#1e2a4a"},{"nazov":"Kráľovská modrá","hex":"#1f4fc9"},{"nazov":"Svetlomodrá","hex":"#7cc4ec"},{"nazov":"Červená","hex":"#c4161c"},{"nazov":"Bordová","hex":"#6e1423"},{"nazov":"Zelená","hex":"#1f7a3d"},{"nazov":"Žltá","hex":"#f5c518"},{"nazov":"Oranžová","hex":"#f07a1a"},{"nazov":"Ružová","hex":"#ef7fb0"},{"nazov":"Sivá","hex":"#9aa0a6"}]'::jsonb,
  '{dtf,rezany,sietotlac}', '/produkty/tricko-biele-predok.jpg', '/produkty/tricko-biele-zadok.jpg', 102,
  '{
    "hrud_srdce":  {"predok": {"x": 0.60, "y": 0.235, "kotva": "stred", "rot": 0}},
    "hrud_stred":  {"predok": {"x": 0.50, "y": 0.19,  "kotva": "hore",  "rot": 0}},
    "chrbat":      {"zadok":  {"x": 0.50, "y": 0.15,  "kotva": "hore",  "rot": 0}},
    "rukav_lavy":  {"predok": {"x": 0.855, "y": 0.205, "kotva": "stred", "rot": -36}, "zadok": {"x": 0.145, "y": 0.205, "kotva": "stred", "rot": 36}},
    "rukav_pravy": {"predok": {"x": 0.145, "y": 0.205, "kotva": "stred", "rot": 36},  "zadok": {"x": 0.855, "y": 0.205, "kotva": "stred", "rot": -36}}
  }'::jsonb,
  1, true
) on conflict (kod) do nothing;

-- Ďalšie produkty — zatiaľ BEZ fotiek (neaktívne). FIKTÍVNE ceny; po pridaní fotiek v ERP ich zapni.
insert into potlac_produkty (kod, nazov, kategoria, popis, material, cena_textilu_eur, velkosti, farby, technologie, poradie, aktivny)
select v.kod, v.nazov, v.kategoria, 'FIKTÍVNA CENA — nahraď skutočnou. Pridaj fotky (predok/zadok) a zapni produkt.', v.material, v.cena, v.velkosti::text[],
  (select farby from potlac_produkty where kod = 'tricko-panske'), v.technologie::text[], v.poradie, false
from (values
  ('tricko-damske', 'Dámske tričko (bavlna)', 'tricko', 'bavlna', 5.20, '{XS,S,M,L,XL,XXL}', '{dtf,rezany,sietotlac}', 2),
  ('tricko-dlhy-rukav', 'Tričko s dlhým rukávom', 'tricko', 'bavlna', 6.90, '{S,M,L,XL,XXL}', '{dtf,rezany,sietotlac}', 3),
  ('mikina-kapucna', 'Mikina s kapucňou', 'mikina', 'bavlna', 17.90, '{S,M,L,XL,XXL}', '{dtf,rezany,sietotlac}', 4),
  ('mikina-zips', 'Mikina na zips', 'mikina', 'bavlna', 19.90, '{S,M,L,XL,XXL}', '{dtf,rezany,sietotlac}', 5),
  ('mikina-krunok', 'Mikina bez kapucne (krúžok)', 'mikina', 'bavlna', 14.90, '{S,M,L,XL,XXL}', '{dtf,rezany,sietotlac}', 6),
  ('polokosela', 'Polokošeľa', 'polokosela', 'bavlna', 9.90, '{S,M,L,XL,XXL}', '{dtf,rezany}', 7),
  ('siltovka', 'Šiltovka', 'siltovka', 'bavlna', 3.90, '{jedna veľkosť}', '{dtf,rezany}', 8)
) as v(kod, nazov, kategoria, material, cena, velkosti, technologie, poradie)
on conflict (kod) do nothing;
