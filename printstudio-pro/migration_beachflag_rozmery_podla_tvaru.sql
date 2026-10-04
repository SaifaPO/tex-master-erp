-- ============================================================
-- Beachvlajky: rozmer plachty PER TVAR a velkost (rozmer_popis na vlajka_tvar_rozmery).
--   Basic, Blade, Feather:  S 55x200  M 60x250  L 70x340  XL 85x450
--   Wave:                   S 75x165  M 92,5x215  L 110x275  XL 130x360
--   Wing:                   S 55x160  M 60x210  L 80x280  XL 85x400
--   Square: uz nastavene (66 x 220 / 280 / 380 cm)
-- Vysky od zeme su uz ulozene per tvar (vyska_cm). Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_tvar_rozmery add column if not exists rozmer_popis text;

update vlajka_tvar_rozmery r set rozmer_popis = v.popis
from vlajka_tvary t, (values
  ('basic', 'S', '55 x 200 cm'), ('basic', 'M', '60 x 250 cm'), ('basic', 'L', '70 x 340 cm'), ('basic', 'XL', '85 x 450 cm'),
  ('cepel', 'S', '55 x 200 cm'), ('cepel', 'M', '60 x 250 cm'), ('cepel', 'L', '70 x 340 cm'), ('cepel', 'XL', '85 x 450 cm'),
  ('pierko', 'S', '55 x 200 cm'), ('pierko', 'M', '60 x 250 cm'), ('pierko', 'L', '70 x 340 cm'), ('pierko', 'XL', '85 x 450 cm'),
  ('kvapka', 'S', '75 x 165 cm'), ('kvapka', 'M', '92,5 x 215 cm'), ('kvapka', 'L', '110 x 275 cm'), ('kvapka', 'XL', '130 x 360 cm'),
  ('kridlo', 'S', '55 x 160 cm'), ('kridlo', 'M', '60 x 210 cm'), ('kridlo', 'L', '80 x 280 cm'), ('kridlo', 'XL', '85 x 400 cm')
) as v(kod, velkost, popis)
where t.kod = v.kod and r.tvar_id = t.id and r.velkost = v.velkost;
