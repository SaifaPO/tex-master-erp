-- Medzifiremne vyuctovanie sluzieb medzi ATAK a PBT (mesacny dodaci list podla vyrobnych ukonov).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

-- Sklady: ktorej firme sklad patri (ATAK/PBT/NULL=spolocny/neutralny) - potrebne na automaticke
-- rozpoznanie, ci material na zakazke islo zo skladu DRUHEJ firmy (teda sa ma vyfakturovat).
alter table warehouses add column if not exists company text;

-- Cennik medzifiremnych sluzieb (co si ATAK a PBT navzajom fakturuju za vyrobne ukony) + variabilna marza.
create table if not exists intercompany_rates (
  service_key text primary key,
  label text not null,
  unit text not null, -- 'bm' (bezne metre) alebo 'ks' (kusy)
  price numeric not null default 0,
  markup_percent numeric not null default 30
);

insert into intercompany_rates (service_key, label, unit, price, markup_percent) values
  ('sublimacia', 'Sublimácia (podľa bežných metrov)', 'bm', 4, 30),
  ('laser', 'Rezanie laserom', 'ks', 1, 30),
  ('transfer', 'Transfer tlač', 'ks', 1, 30),
  ('sietotlac', 'Sieťotlač', 'ks', 1, 30),
  ('strihanie', 'Strihanie', 'ks', 1, 30),
  ('sitie', 'Šitie', 'ks', 1, 30),
  ('rezia', 'Réžia', 'ks', 0.5, 30),
  ('material', 'Materiál (medzifiremný odber)', 'bm', 0, 30)
on conflict (service_key) do nothing;

alter table intercompany_rates enable row level security;
drop policy if exists "intercompany_rates_allow_all" on intercompany_rates;
create policy "intercompany_rates_allow_all" on intercompany_rates for all to anon, authenticated using (true) with check (true);
