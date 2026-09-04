-- Cenove ponuky: (1) oprava predvolenej sadzby DPH na aktualnych 23%, (2) profily
-- vystavovatela (PBT / ATAK) s hlbsimi udajmi a logom pre hlavicku/footer ponuky,
-- (3) kalkulacka na cenu tlace (Flex / DTF / Sietotlac / Vysivka) - katalog materialov
-- (cena za jednotku - bm/kg/ks) a velkosti (priemerna spotreba na danu velkost),
-- z coho appka automaticky pocita cenu riadku = cena_za_jednotku x spotreba x farby x ks.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

-- 1) DPH 23% (aktualna sadzba, predtym nastavene na 20%)
update company_settings set default_vat_rate = 23 where id = 1 and default_vat_rate = 20;

-- 2) Profily vystavovatela pre cenove ponuky (dve firmy: PBT / ATAK)
create table if not exists quote_companies (
  id text primary key,
  name text not null,
  address text,
  ico text,
  dic text,
  ic_dph text,
  email text,
  phone text,
  logo_url text,
  signature_name text,
  signature_role text,
  sort_order integer not null default 0
);

insert into quote_companies (id, name, address, ico, dic, ic_dph, email, phone, sort_order) values
  ('pbt', 'PBT s.r.o.', 'Doplň adresu sídla', 'Doplň IČO', 'Doplň DIČ', '', 'info@pbt.sk', '+421 900 000 000', 1),
  ('atak', 'ATAK s.r.o.', 'Doplň adresu sídla', 'Doplň IČO', 'Doplň DIČ', '', 'info@atak.sk', '+421 900 000 000', 2)
on conflict (id) do nothing;

alter table quote_companies enable row level security;
drop policy if exists "quote_companies_allow_all" on quote_companies;
create policy "quote_companies_allow_all" on quote_companies for all to anon, authenticated using (true) with check (true);

-- 3) Kalkulacka tlace - katalog materialov (cena za jednotku) a velkosti (priemerna spotreba)
create table if not exists quote_print_materials (
  id text primary key,
  metoda text not null,
  nazov text not null,
  jednotka text not null default 'bm',
  cena_za_jednotku numeric not null default 0,
  sort_order integer not null default 0
);

create table if not exists quote_print_sizes (
  id text primary key,
  metoda text not null,
  label text not null,
  spotreba numeric not null default 0,
  sort_order integer not null default 0
);

-- Placeholder ceny/spotreby (rovnaka jednotkova konvencia 100 = zaklad, aby vysledna cena pri
-- stand. materiali a 1 farbe zodpovedala priblizne uz pouzivanym cenam v module Dotlacovka:
-- 5x5 ~5€, 10x10 ~9€, 15x15 ~12€, 20x20/A5 ~15€, A4 ~18€, A3 ~25€). Martin si vie kedykolvek
-- upravit priamo v zalozke "Kalkulačka tlače".
insert into quote_print_materials (id, metoda, nazov, jednotka, cena_za_jednotku, sort_order) values
  ('flex-std', 'flex', 'Štandardná fólia', 'bm', 100, 1),
  ('flex-metalicka', 'flex', 'Metalická fólia', 'bm', 120, 2),
  ('flex-special', 'flex', 'Špeciálna fólia', 'bm', 140, 3),
  ('flex-reflex', 'flex', 'Reflexná fólia', 'bm', 160, 4),
  ('flex-neon', 'flex', 'Neónová fólia', 'bm', 150, 5),
  ('flex-sublistop', 'flex', 'Sublistop fólia', 'bm', 130, 6),

  ('dtf-std', 'dtf', 'Štandardný DTF prenos', 'bm', 100, 1),

  ('sito-std', 'sietotlac', 'Štandardná farba', 'kg', 100, 1),
  ('sito-special', 'sietotlac', 'Špeciálna farba', 'kg', 140, 2),
  ('sito-reflex', 'sietotlac', 'Reflexná farba', 'kg', 160, 3),
  ('sito-neon', 'sietotlac', 'Neónová farba', 'kg', 150, 4),
  ('sito-folia', 'sietotlac', 'Fóliová potlač (transferfólia)', 'kg', 130, 5),

  ('vysivka-std', 'vysivka', 'Štandardná výšivka', 'ks', 1, 1)
on conflict (id) do nothing;

insert into quote_print_sizes (id, metoda, label, spotreba, sort_order) values
  ('flex-5x5', 'flex', '5×5 cm (malé logo)', 0.05, 1),
  ('flex-10x10', 'flex', '10×10 cm', 0.09, 2),
  ('flex-15x15', 'flex', '15×15 cm', 0.12, 3),
  ('flex-20x20', 'flex', '20×20 cm (A5)', 0.15, 4),
  ('flex-a4', 'flex', 'A4 (cca 21×29,7 cm)', 0.18, 5),
  ('flex-a3', 'flex', 'A3 (cca 29,7×42 cm)', 0.25, 6),

  ('dtf-5x5', 'dtf', '5×5 cm (malé logo)', 0.05, 1),
  ('dtf-10x10', 'dtf', '10×10 cm', 0.09, 2),
  ('dtf-15x15', 'dtf', '15×15 cm', 0.12, 3),
  ('dtf-20x20', 'dtf', '20×20 cm (A5)', 0.15, 4),
  ('dtf-a4', 'dtf', 'A4 (cca 21×29,7 cm)', 0.18, 5),
  ('dtf-a3', 'dtf', 'A3 (cca 29,7×42 cm)', 0.25, 6),

  ('sito-5x5', 'sietotlac', '5×5 cm (malé logo)', 0.05, 1),
  ('sito-10x10', 'sietotlac', '10×10 cm', 0.09, 2),
  ('sito-15x15', 'sietotlac', '15×15 cm', 0.12, 3),
  ('sito-20x20', 'sietotlac', '20×20 cm (A5)', 0.15, 4),
  ('sito-a4', 'sietotlac', 'A4 (cca 21×29,7 cm)', 0.18, 5),
  ('sito-a3', 'sietotlac', 'A3 (cca 29,7×42 cm)', 0.25, 6),

  ('vysivka-maly', 'vysivka', 'Malé logo (do 5×5 cm, do 5000 stehov)', 6, 1),
  ('vysivka-stredny', 'vysivka', 'Stredný motív (do 10×10 cm)', 10, 2),
  ('vysivka-velky', 'vysivka', 'Veľký motív (nad 10×10 cm / chrbát)', 16, 3)
on conflict (id) do nothing;

alter table quote_print_materials enable row level security;
drop policy if exists "quote_print_materials_allow_all" on quote_print_materials;
create policy "quote_print_materials_allow_all" on quote_print_materials for all to anon, authenticated using (true) with check (true);

alter table quote_print_sizes enable row level security;
drop policy if exists "quote_print_sizes_allow_all" on quote_print_sizes;
create policy "quote_print_sizes_allow_all" on quote_print_sizes for all to anon, authenticated using (true) with check (true);

-- 4) Doplnenie novych tabuliek do realtime publikacie
do $$
declare
  tbl text;
  tables text[] := array['quote_companies', 'quote_print_materials', 'quote_print_sizes'];
begin
  foreach tbl in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
