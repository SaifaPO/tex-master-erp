-- ============================================================
-- Vlajkove materialy (Beachvlajky, Zastava): rucna cena €/m2, ktora PREPISE cenu zo skladu.
-- Cena zo skladu (cena/bm ÷ sirka) ostava ako referencia (v ERP sa zobrazuje pod polickom),
-- ale ak je vyplnena rucna cena, pouzije sa tato (napr. mierne zaokruhlena).
-- Prazdne (NULL) = pouzije sa cena zo skladu. Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_materialy add column if not exists naklad_m2_rucne numeric;
alter table zastava_materialy add column if not exists naklad_m2_rucne numeric;
