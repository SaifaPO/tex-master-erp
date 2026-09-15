-- ============================================================
-- MIGRÁCIA: Katalóg Produktov — poznámka k réžii
-- Rezia (nite, gombiky, gumicky a pod.) je rucne zadana suma na produkt — pridava sa k tomu
-- volny text popisujuci co presne rezia obsahuje.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table products add column if not exists rezia_poznamka text;
