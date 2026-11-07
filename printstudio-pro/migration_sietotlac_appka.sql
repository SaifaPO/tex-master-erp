-- ============================================================
-- APPKA SIEŤOTLAČ (verejná stránka ?typ=sietotlac): kalkulačka + dopyt.
-- Cenu počíta Edge Function sietotlac-dopyt z Kostry cien (rovnaké vzorce ako Dizajner) + maržový modul.
-- Tu sú len nastavenia appky, efekty farieb a prijaté dopyty. Bezpečné spustiť opakovane, nič nemaže.
-- Hodnoty označené ODHAD si v ERP (Aplikácie → Sieťotlač) skontroluj a uprav.
-- ============================================================

create table if not exists sietotlac_nastavenia (
  id integer primary key default 1 check (id = 1),
  aktivny boolean not null default true,
  min_ks integer not null default 10,                    -- minimálny odber (príprava sít)
  max_ks integer not null default 5000,
  max_sirka_cm numeric not null default 43,              -- max. potlač (rám sita)
  max_vyska_cm numeric not null default 58,
  polyester_priplatok_percent numeric not null default 10,  -- ODHAD: príplatok na polyester (špeciálne farby / nižšia fixácia)
  email_notifikacie text,                                -- kam chodí e-mail o novom dopyte
  info_text text,
  updated_at timestamptz not null default now()
);
insert into sietotlac_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists sietotlac_efekty (
  kod text primary key,
  nazov text not null,
  popis text,
  priplatok_percent numeric not null default 0,          -- príplatok k cene potlače v %
  aktivny boolean not null default true,
  poradie integer not null default 0
);
insert into sietotlac_efekty (kod, nazov, popis, priplatok_percent, poradie) values
  ('klasicka', 'Klasická farba', 'Plastizolová farba — štandardná potlač', 0, 1),
  ('puffina', 'Puffina (3D nadúvaná)', 'Farba sa po fixácii nafúkne do 3D reliéfu', 15, 2),   -- ODHAD
  ('semis', 'Semiš (zamatový povrch)', 'Flock — jemný zamatový povrch', 25, 3),                -- ODHAD
  ('silikon', 'Silikón (gumový 3D reliéf)', 'Gumový, lesklý, vyvýšený povrch', 35, 4)          -- ODHAD
on conflict (kod) do nothing;

create table if not exists sietotlac_dopyty (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cislo text not null,
  stav text not null default 'novy',                     -- novy | spracovany | ponuka | objednavka | zrusene
  meno text,
  email text not null,
  telefon text,
  poznamka text,
  konfig jsonb not null default '{}'::jsonb,             -- co si zákazník vybral
  pocet_ks integer,
  cena_kus_bez_dph numeric,
  cena_spolu_bez_dph numeric,
  ip_hash text,
  interna_poznamka text
);
create index if not exists sietotlac_dopyty_created_idx on sietotlac_dopyty (created_at desc);

alter table sietotlac_nastavenia enable row level security;
alter table sietotlac_efekty enable row level security;
alter table sietotlac_dopyty enable row level security;

-- Verejnosť (anon) nič nečíta ani nezapisuje priamo — všetko ide cez Edge Function (servisný kľúč).
drop policy if exists "prihlaseni plny pristup sietotlac_nastavenia" on sietotlac_nastavenia;
create policy "prihlaseni plny pristup sietotlac_nastavenia" on sietotlac_nastavenia for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "prihlaseni plny pristup sietotlac_efekty" on sietotlac_efekty;
create policy "prihlaseni plny pristup sietotlac_efekty" on sietotlac_efekty for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "prihlaseni plny pristup sietotlac_dopyty" on sietotlac_dopyty;
create policy "prihlaseni plny pristup sietotlac_dopyty" on sietotlac_dopyty for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
