-- Kniha jazd pre firemne vozidla — evidencia stavu kilometrov (z fotky tachometra cez AI OCR) a tankovania.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists vehicles (
  id text primary key,
  name text not null,
  license_plate text,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_log_entries (
  id text primary key,
  vehicle_id text not null references vehicles(id),
  employee_id text not null,
  employee_name text not null,
  entry_date date not null,
  odometer_km numeric not null,
  photo_url text,
  fuel_type text,
  fuel_liters numeric,
  fuel_cost numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table vehicles enable row level security;
drop policy if exists "vehicles_allow_all" on vehicles;
create policy "vehicles_allow_all" on vehicles for all to anon, authenticated using (true) with check (true);

alter table vehicle_log_entries enable row level security;
drop policy if exists "vehicle_log_entries_allow_all" on vehicle_log_entries;
create policy "vehicle_log_entries_allow_all" on vehicle_log_entries for all to anon, authenticated using (true) with check (true);
