-- Cennik potlaci pre modul "Dotlacovka" (expresne pridanie dotlacovej zakazky na predajni).
-- Automaticky pocita vyslednu cenu pre zakaznika podla oznacenych bodov na tele.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists dotlacovka_price_list (
  id text primary key,
  label text not null,
  price numeric not null default 0,
  sort_order int not null default 0
);

insert into dotlacovka_price_list (id, label, price, sort_order)
values
  ('male_logo_cislo_menovka', 'Malé logo, číslica, menovka', 5, 1),
  ('velka_cislica', 'Veľká číslica', 8, 2),
  ('velka_menovka', 'Veľká menovka', 8, 3),
  ('potlac_a5', 'Potlač A5', 12, 4),
  ('potlac_a4', 'Potlač A4', 18, 5),
  ('potlac_a3', 'Potlač A3', 25, 6)
on conflict (id) do nothing;

alter table dotlacovka_price_list enable row level security;
drop policy if exists "dotlacovka_price_list_allow_all" on dotlacovka_price_list;
create policy "dotlacovka_price_list_allow_all" on dotlacovka_price_list for all to anon, authenticated using (true) with check (true);
