-- ============================================================
-- MIGRÁCIA: Katalóg Produktov — podrobný rozpis spotreby a nákladov
-- 1) Réžia (nite, stužky, gumičky...) sa dá teraz vyklikať ako zoznam POLOŽIEK zo Skladu
--    (podobne ako látky layer1/2/3), namiesto jednej ručne zadanej sumy. Ak je zoznam
--    vyplnený, cena réžie sa počíta automaticky (súčet množstvo × cena položky zo skladu).
--    Ak zoznam prázdny, správa sa presne ako doteraz (products.rezia_ks ručne, spätná kompatibilita).
-- 2) Rezaný transfer sa dá počítať automaticky z plochy motívu (napr. veľkostný štítok 5×2cm)
--    a zvolenej fólie z Kostry cien, namiesto vždy-ručnej ceny.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table products add column if not exists rezia_polozky jsonb not null default '[]'::jsonb;
alter table products add column if not exists rezany_transfer_folia_id int references cennik_folie(id);
alter table products add column if not exists rezany_transfer_plocha_cm2 numeric;
