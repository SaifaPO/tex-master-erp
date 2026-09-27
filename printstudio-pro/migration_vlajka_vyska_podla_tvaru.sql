-- ============================================================
-- MIGRACIA: "vyska od zeme" (platno + tyc) sa doteraz brala z jednej spolocnej
-- hodnoty pre velkost (vlajka_velkosti.vyska_cm) - to sedelo pre Blade/Basic/
-- Feather (rovnake platno), ale NIE pre Wing a Wave (ine platno = ina celkova
-- vyska). Realne hodnoty od Martina (2026-09-27):
--   Wing:  S=230  M=275  L=340  XL=470
--   Wave:  S=220  M=270  L=350  XL=435
--   (Blade/Basic/Feather ostavaju S=220 M=350 L=450 XL=550, bez zmeny)
-- Pridava sa vyska_cm priamo na vlajka_tvar_rozmery (per tvar x velkost) -
-- appka (ParametreTab) ju pouzije namiesto spolocnej hodnoty, ked je vyplnena.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_tvar_rozmery add column if not exists vyska_cm numeric;

update vlajka_tvar_rozmery r set vyska_cm = v.vyska
from vlajka_tvary t, (values
  ('cepel', 'S', 220), ('cepel', 'M', 350), ('cepel', 'L', 450), ('cepel', 'XL', 550),
  ('basic', 'S', 220), ('basic', 'M', 350), ('basic', 'L', 450), ('basic', 'XL', 550),
  ('pierko', 'S', 220), ('pierko', 'M', 350), ('pierko', 'L', 450), ('pierko', 'XL', 550),
  ('kridlo', 'S', 230), ('kridlo', 'M', 275), ('kridlo', 'L', 340), ('kridlo', 'XL', 470),
  ('kvapka', 'S', 220), ('kvapka', 'M', 270), ('kvapka', 'L', 350), ('kvapka', 'XL', 435)
) as v(kod, velkost, vyska)
where t.kod = v.kod and r.tvar_id = t.id and r.velkost = v.velkost;
