-- Ziadosti o pomoc medzi stanicami (napr. Grafik potrebuje pomoc od obchodnika alebo supervizora).
-- Odlisne od existujucej tabulky problem_reports (tam sa riesi zavinenie/naklady chyby pri baleni) -
-- toto je zivy obojsmerny chat s notifikaciou a moznostou pozastavit/obnovit pracu na zakazke.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists help_requests (
  id text primary key,
  order_id text not null,
  item_id text not null,
  station_id text not null,
  raised_by_id text,
  raised_by_name text,
  target_role text,
  target_employee_id text,
  target_employee_name text,
  message text not null,
  image_url text,
  status text not null default 'open',
  replies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table help_requests enable row level security;
drop policy if exists "help_requests_allow_all" on help_requests;
create policy "help_requests_allow_all" on help_requests for all to anon, authenticated using (true) with check (true);
