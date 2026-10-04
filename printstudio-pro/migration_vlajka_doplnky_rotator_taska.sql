-- Prislusenstvo Beachvlajok: rotator a prepravna taska. Pridava sa ako SKRYTE (aktivny = false) s nakupnou cenou 0 —
-- v ERP (Beachvlajky -> Opracovanie, pruty, podstavce, prislusenstvo) nastav NAKUPNU cenu a prepni na "Aktivny".
-- Bezpecne spustit opakovane.
insert into vlajka_doplnky (kod, nazov, cena, max_mnozstvo, aktivny) values
  ('rotator', 'Rotátor', 0, 10, false),
  ('taska', 'Prepravná taška', 0, 10, false)
on conflict (kod) do nothing;
