-- ============================================================
-- MIGRACIA: novy tvar beachvlajky "Square" (klasicky obdlznik), velkosti S, M, L
--   S: vlajka 66 x 220 cm, vyska od zeme po zostaveni 270 cm
--   M: vlajka 66 x 280 cm, vyska od zeme po zostaveni 330 cm
--   L: vlajka 66 x 380 cm, vyska od zeme po zostaveni 440 cm
-- Rovnaka konvencia ako ostatne tvary: 1 jednotka = 1 cm, viewbox = vlajka + 5 cm okraj na
-- kazdej strane, cut_path = orez (cervena), bleed_path = spadavka 5 cm dookola navyse,
-- safe_path = bezpecna zona 4 cm dovnutra. spotreba_m2 = plocha vlajky (bez spadavky).
-- Pridava sa aj stlpec rozmer_popis na vlajka_tvar_rozmery (rozmer vlajky PER TVAR; ak je prazdny,
-- pouzije sa spolocny popis z vlajka_velkosti). Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_tvar_rozmery add column if not exists rozmer_popis text;

insert into vlajka_tvary (kod, nazov, ikona, poradie)
values ('square', 'Square', 'flag', 11)
on conflict (kod) do nothing;

-- S: 66 x 220
insert into vlajka_tvar_rozmery (tvar_id, velkost, viewbox, cut_path, bleed_path, safe_path, spotreba_m2, vyska_cm, rozmer_popis)
select t.id, 'S', '0 0 76 230',
  'M 5,5 L 71,5 L 71,225 L 5,225 Z',
  'M 0,0 L 76,0 L 76,230 L 0,230 Z',
  'M 9,9 L 67,9 L 67,221 L 9,221 Z',
  1.452, 270, '66 x 220 cm'
from vlajka_tvary t where t.kod = 'square'
on conflict (tvar_id, velkost) do update set
  viewbox = excluded.viewbox, cut_path = excluded.cut_path, bleed_path = excluded.bleed_path,
  safe_path = excluded.safe_path, spotreba_m2 = excluded.spotreba_m2,
  vyska_cm = excluded.vyska_cm, rozmer_popis = excluded.rozmer_popis;

-- M: 66 x 280
insert into vlajka_tvar_rozmery (tvar_id, velkost, viewbox, cut_path, bleed_path, safe_path, spotreba_m2, vyska_cm, rozmer_popis)
select t.id, 'M', '0 0 76 290',
  'M 5,5 L 71,5 L 71,285 L 5,285 Z',
  'M 0,0 L 76,0 L 76,290 L 0,290 Z',
  'M 9,9 L 67,9 L 67,281 L 9,281 Z',
  1.848, 330, '66 x 280 cm'
from vlajka_tvary t where t.kod = 'square'
on conflict (tvar_id, velkost) do update set
  viewbox = excluded.viewbox, cut_path = excluded.cut_path, bleed_path = excluded.bleed_path,
  safe_path = excluded.safe_path, spotreba_m2 = excluded.spotreba_m2,
  vyska_cm = excluded.vyska_cm, rozmer_popis = excluded.rozmer_popis;

-- L: 66 x 380
insert into vlajka_tvar_rozmery (tvar_id, velkost, viewbox, cut_path, bleed_path, safe_path, spotreba_m2, vyska_cm, rozmer_popis)
select t.id, 'L', '0 0 76 390',
  'M 5,5 L 71,5 L 71,385 L 5,385 Z',
  'M 0,0 L 76,0 L 76,390 L 0,390 Z',
  'M 9,9 L 67,9 L 67,381 L 9,381 Z',
  2.508, 440, '66 x 380 cm'
from vlajka_tvary t where t.kod = 'square'
on conflict (tvar_id, velkost) do update set
  viewbox = excluded.viewbox, cut_path = excluded.cut_path, bleed_path = excluded.bleed_path,
  safe_path = excluded.safe_path, spotreba_m2 = excluded.spotreba_m2,
  vyska_cm = excluded.vyska_cm, rozmer_popis = excluded.rozmer_popis;
