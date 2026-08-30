-- CRM: karta zakaznika (kontakt + zaznam komunikacie), naviazana na uz existujuci vypocet uroven/rebricka
-- podla mena zakaznika (rovnaky sposob, akym uz appka priraduje objednavky/faktury k zakaznikovi).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists customers (
  name text primary key,
  phone text,
  email text,
  contact_person text,
  address text,
  notes text,
  interaction_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table customers enable row level security;
drop policy if exists "customers_allow_all" on customers;
create policy "customers_allow_all" on customers for all to anon, authenticated using (true) with check (true);
