-- OPRAVA: appka prestala dostavat "zive" (realtime) potvrdenia zmien - v publikacii supabase_realtime
-- ostala zaregistrovana len tabulka "employees", vsetky ostatne (orders, materials, ...) z nej vypadli.
-- Preto sa zmeny (napr. zmena stavu zakazky, presun v planovacej matici) zapisali do DB spravne,
-- ale appka o tom nevedela, kym sa strankka rucne neobnovila.
-- Tento skript doplni vsetky potrebne tabulky spat do publikacie. Bezpecne spustit opakovane.

do $$
declare
  tbl text;
  tables text[] := array[
    'materials','warehouses','cost_rates','station_assignments','station_default_assignments',
    'station_default_exclusions','employee_checkins','attendance_records','login_mismatches',
    'problem_reports','invoices','bank_transactions','journal_entries','tax_deadlines','cash_documents',
    'assets','cost_metrics','customer_tier_rules','travel_orders','vehicles','vehicle_log_entries',
    'customers','dotlacovka_price_list','addon_types','help_requests','station_capacity_config',
    'station_product_times','company_settings','products','quality_tiers','employees','orders',
    'sports','acl_settings'
  ];
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

-- Over si vysledok:
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
