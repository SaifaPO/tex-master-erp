-- Cestovne prikazy (preplatenie sukromneho auta na pracovnej ceste — kilometrovne + palivo + stravne).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists travel_orders (
  id text primary key,
  employee_id text not null,
  employee_name text not null,
  trip_date date not null,
  departure_time text,
  return_time text,
  from_location text,
  to_location text,
  purpose text,
  related_order_id text,
  distance_km numeric not null default 0,
  fuel_consumption_l100km numeric not null default 7,
  fuel_price_per_liter numeric not null default 1.70,
  status text not null default 'navrhnute',
  approved_by text,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table travel_orders enable row level security;
drop policy if exists "travel_orders_allow_all" on travel_orders;
create policy "travel_orders_allow_all" on travel_orders for all to anon, authenticated using (true) with check (true);
