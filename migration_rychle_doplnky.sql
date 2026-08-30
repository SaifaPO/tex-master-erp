-- Editovatelny zoznam "rychlych doplnkov" pre polozky zakaziek (napr. parenie etikety, balenie do sacku...).
-- Pouziva sa v beznom Konfiguratore zakaziek aj v expresnej Dotlacovke ako zaskrtavacie policka.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists addon_types (
  id text primary key,
  label text not null,
  sort_order int not null default 0
);

insert into addon_types (id, label, sort_order)
values
  ('parenie_etikety', 'Párenie etikety', 1),
  ('balenie_sacok_kus', 'Balenie do sáčku po kuse', 2),
  ('balenie_sacky_viac_ks', 'Balenie do sáčkov po viac ks', 3),
  ('balenie_krabica', 'Balenie do krabice', 4),
  ('bez_oznacenia_vyrobcu', 'Bez označenia výrobcu', 5)
on conflict (id) do nothing;

alter table addon_types enable row level security;
drop policy if exists "addon_types_allow_all" on addon_types;
create policy "addon_types_allow_all" on addon_types for all to anon, authenticated using (true) with check (true);
