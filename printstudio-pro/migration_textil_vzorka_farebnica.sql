-- ============================================================
-- Textilna metraz (sublimacia / digitalna bavlna): nove typy objednavok
--   'vzorka'    — vzorovy vystrizok vlastnej grafiky (pevna cena 5 EUR s DPH vratane postovneho)
--   'farebnica' — fyzicka farebnica (pevna cena 5 EUR s DPH vratane postovneho)
-- Rozsiruje CHECK obmedzenie na stlpci rezim. Bezpecne spustit opakovane.
-- Ak by prikaz zlyhal na nazve obmedzenia, zisti ho: SELECT conname FROM pg_constraint
-- WHERE conrelid = 'textil_objednavky'::regclass;
-- ============================================================

alter table textil_objednavky drop constraint if exists textil_objednavky_rezim_check;
alter table textil_objednavky add constraint textil_objednavky_rezim_check check (rezim in ('auto', 'subor', 'vzorka', 'farebnica'));
