-- ============================================================
-- MIGRÁCIA: Produkty (Blanks) — prepojenie na Sklad podľa farby AJ veľkosti
-- Doteraz "Kategórie"/"Produkty (Blanks)" (konfigurátor "vlastná potlač") nemali ŽIADNU väzbu na
-- Sklad — slúžili len na cenu a nastavenie potlače. Teraz sa dá ku každej kombinácii
-- produkt + farba + veľkosť priradiť konkrétna položka zo Skladu (typicky Vzorkový sklad), aby sa
-- dalo overiť/odpočítať reálnu dostupnosť pri objednávke ("tričko s vlastnou potlačou").
--
-- POZOR: `produkt_velkosti` sa pri každom uložení produktu celá premaže a znova vloží (nové id),
-- preto sa tu veľkosť ukladá ako TEXT (napr. "M"), nie ako cudzí kľúč na produkt_velkosti.id —
-- inak by sa väzba pri každej úprave produktu stratila.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists produkt_sklad_mapovanie (
    id bigint generated always as identity primary key,
    produkt_id bigint not null references produkty(id) on delete cascade,
    farba_id bigint not null references farby(id) on delete cascade,
    velkost text not null,
    material_id text references materials(id),
    unique (produkt_id, farba_id, velkost)
);

alter table produkt_sklad_mapovanie enable row level security;
create policy "admin plny pristup produkt sklad mapovanie" on produkt_sklad_mapovanie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
