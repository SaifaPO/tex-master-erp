-- Generátor cenových ponúk: nová tabuľka pre archív ponúk, nová tabuľka pre jednoduchý cenník
-- položiek na rýchle pridávanie do ponuky, a doplnenie percentuálnej zľavy k existujúcim
-- zákazníckym úrovniam (doteraz úrovne ovplyvňovali len splatnosť faktúry, nie zľavu).
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

-- 1) Percentuálna zľava podľa zákazníckej úrovne (Standard/Bronze/Silver/Gold)
alter table customer_tier_rules add column if not exists discount_percent numeric not null default 0;

update customer_tier_rules set discount_percent = 2.5 where tier = 'bronze' and discount_percent = 0;
update customer_tier_rules set discount_percent = 5   where tier = 'silver' and discount_percent = 0;
update customer_tier_rules set discount_percent = 10  where tier = 'gold'   and discount_percent = 0;

-- 2) Jednoduchý cenník položiek pre rýchle pridávanie do cenovej ponuky
create table if not exists quote_price_list (
  id text primary key,
  name text not null,
  description text,
  price numeric not null default 0,
  sort_order integer not null default 0
);

alter table quote_price_list enable row level security;
drop policy if exists "quote_price_list_allow_all" on quote_price_list;
create policy "quote_price_list_allow_all" on quote_price_list for all to anon, authenticated using (true) with check (true);

-- 3) Archív vygenerovaných cenových ponúk
create table if not exists price_quotes (
  id text primary key,
  offer_number text not null,
  quote_date date not null default current_date,
  customer_name text,
  customer_email text,
  title text,
  total numeric not null default 0,
  status text not null default 'Odoslaná',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table price_quotes enable row level security;
drop policy if exists "price_quotes_allow_all" on price_quotes;
create policy "price_quotes_allow_all" on price_quotes for all to anon, authenticated using (true) with check (true);

-- 4) Doplnenie nových tabuliek do realtime publikácie (rovnaký postup ako v
-- migration_oprava_realtime_publikacie.sql, aby sa znova nestratili zo živých aktualizácií).
do $$
declare
  tbl text;
  tables text[] := array['quote_price_list', 'price_quotes'];
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
