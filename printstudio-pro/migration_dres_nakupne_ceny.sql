-- ============================================================
-- Dres 3D: nakupne ceny. Ak zadas nakupnu cenu dresu (a volitelne nakupnu cenu materialu),
-- predajna cena sa dopocita na serveri z marze a poctu kusov (rovnako ako ostatne produkty)
-- a nahradi pevnu cenu produkty.zakladna_cena + tabulku mnozstevnych zliav. Kym nakupnu cenu
-- nezadas, plati stary rezim — nic sa nezmeni.
-- Tabulky su dostupne LEN prihlasenemu adminovi (verejnost ich nevidi). Bezpecne spustit opakovane.
-- ============================================================

create table if not exists produkt_dres_naklady (
    produkt_id bigint primary key references produkty(id) on delete cascade,
    naklad_ks numeric not null default 0          -- nakupna/vyrobna cena 1 dresu bez DPH
);
create table if not exists produkt_dres_material_naklady (
    material_id bigint primary key references produkt_dres_materialy(id) on delete cascade,
    naklad_eur numeric not null default 0         -- nakupny priplatok za material bez DPH
);

alter table produkt_dres_naklady enable row level security;
alter table produkt_dres_material_naklady enable row level security;
drop policy if exists "admin plny pristup produkt_dres_naklady" on produkt_dres_naklady;
create policy "admin plny pristup produkt_dres_naklady" on produkt_dres_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin plny pristup produkt_dres_material_naklady" on produkt_dres_material_naklady;
create policy "admin plny pristup produkt_dres_material_naklady" on produkt_dres_material_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
