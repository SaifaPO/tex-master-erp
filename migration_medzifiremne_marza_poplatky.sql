-- Medzifiremne vyuctovanie (ATAK <-> PBT): jednotna marza a mesacne poplatky.
-- Ceny sluzieb sa dalej pocitaju zo skutocnej vyrobnej ceny (Kostra cien, metraze, spotreby, minuty sitia),
-- novo sa k nim pripocita PEVNA marza (predvolene 30 %), ktoru je mozne zmenit plosne (tu) aj pre kazdu
-- sluzbu zvlast (intercompany_rates.marza_percent; prazdne = pouzije sa plosna). Mesacne poplatky
-- (napr. prenajom stroja) sa pridaju ako riadok do mesacneho dodacieho listu.
-- Bezpecne spustit opakovane.

alter table intercompany_rates add column if not exists marza_percent numeric;  -- null = plosna marza

create table if not exists intercompany_nastavenia (
  id int primary key default 1,
  vychodzia_marza_percent numeric not null default 30,
  pouzit_marzovu_krivku boolean not null default false, -- false = pevna marza; true = mnozstvova krivka z Cenotvorby (ako Textilna metraz)
  constraint jediny_riadok_intercompany_nastavenia check (id = 1)
);
insert into intercompany_nastavenia (id) values (1) on conflict (id) do nothing;
alter table intercompany_nastavenia enable row level security;
drop policy if exists "intercompany_nastavenia_allow_all" on intercompany_nastavenia;
create policy "intercompany_nastavenia_allow_all" on intercompany_nastavenia for all to anon, authenticated using (true) with check (true);

create table if not exists intercompany_mesacne_poplatky (
  id bigint generated always as identity primary key,
  smer text not null check (smer in ('ATAK_TO_PBT', 'PBT_TO_ATAK')), -- ATAK_TO_PBT = PBT fakturuje ATAK (rovnako ako v appke)
  nazov text not null,
  suma numeric not null default 0,                                    -- €/mesiac bez DPH
  aktivny boolean not null default true,
  poznamka text,
  created_at timestamptz default now()
);
alter table intercompany_mesacne_poplatky enable row level security;
drop policy if exists "intercompany_poplatky_allow_all" on intercompany_mesacne_poplatky;
create policy "intercompany_poplatky_allow_all" on intercompany_mesacne_poplatky for all to anon, authenticated using (true) with check (true);
