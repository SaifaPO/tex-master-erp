-- Oprava bezpecnostneho upozornenia zo Supabase: tabulka pricing_config nemala od svojho vzniku
-- (migration_marzovy_modul.sql) zapnute Row-Level Security vobec - kazdy so znalostou URL projektu
-- (co je v podstate verejna informacia, je v kode appky) mohol cez REST API citat AJ MENIT
-- koeficienty marzovej krivky bez prihlasenia. Vzor zhodny s cennik_technologie (verejne citanie,
-- pretoze zakaznicke appky - DtfMetraz/TextilMetraz/Celenky/Buffky - citaju tuto tabulku anon
-- klucom priamo z prehliadaca), zapis len pre prihlasenych (admin Cenotvorba).
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table pricing_config enable row level security;

drop policy if exists "verejne citanie pricing_config" on pricing_config;
create policy "verejne citanie pricing_config" on pricing_config for select using (true);

drop policy if exists "admin plny pristup pricing_config" on pricing_config;
create policy "admin plny pristup pricing_config" on pricing_config for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
