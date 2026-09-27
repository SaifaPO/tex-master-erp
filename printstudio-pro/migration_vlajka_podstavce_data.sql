-- ============================================================
-- MIGRACIA: 4 realne podstavce pre beachvlajky (doteraz bola tabulka
-- vlajka_podstavce prazdna - toto su tie iste 4 typy, co uz zobrazuje
-- plagat "Ako objednat beachvlajku", teraz naozaj v databaze s cenou
-- a vhodnostou podla velkosti S/M/L/XL. Ceny nizsie su navrhovy zaklad
-- (rovnaky vzor rastu +2€ na velkost ako pri Konstrukcia/prut) -
-- uprav ich v admine (Beachvlajky -> Doplnky -> Konstrukcia / prut ->
-- sekcia Podstavce) podla realnych nakladov, toto len rozbieha data.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

insert into vlajka_podstavce (kod, nazov, popis, poradie, aktivny) values
  ('krizovy', 'Krížový skladací', 'Ľahký skladací kovový kríž, rýchle zloženie/rozloženie.', 1, true),
  ('platna', 'Oceľová platňa 4 kg', 'Ťažká stabilná platňa, najlepšia voľba do vetra.', 2, true),
  ('tren', 'Zapichovací tŕň', 'Zapichuje sa priamo do trávy alebo piesku.', 3, true),
  ('vodny_vak', 'Vodný vak 10 L', 'Doplnková záťaž k inému podstavcu, samostatne vlajku nepostaví.', 4, true)
on conflict (kod) do update set
  nazov = excluded.nazov, popis = excluded.popis, poradie = excluded.poradie, aktivny = excluded.aktivny;

-- ---------- Krížový skladací ----------
insert into vlajka_podstavce_ceny (podstavec_id, velkost, cena, vhodny, poznamka)
select p.id, v.velkost, v.cena, v.vhodny, v.poznamka
from vlajka_podstavce p, (values
  ('S', 16, true, null),
  ('M', 18, true, null),
  ('L', 20, true, null),
  ('XL', 22, false, 'Pri XL odporúčame len do interiéru alebo v bezvetrí — vonku hrozí prevrátenie.')
) as v(velkost, cena, vhodny, poznamka)
where p.kod = 'krizovy'
on conflict (podstavec_id, velkost) do update set
  cena = excluded.cena, vhodny = excluded.vhodny, poznamka = excluded.poznamka;

-- ---------- Oceľová platňa 4 kg ----------
insert into vlajka_podstavce_ceny (podstavec_id, velkost, cena, vhodny, poznamka)
select p.id, v.velkost, v.cena, v.vhodny, v.poznamka
from vlajka_podstavce p, (values
  ('S', 26, true, null),
  ('M', 28, true, null),
  ('L', 30, true, null),
  ('XL', 32, true, 'Odporúčaný podstavec pre XL vo vonkajšom prostredí — najstabilnejší pri vetre.')
) as v(velkost, cena, vhodny, poznamka)
where p.kod = 'platna'
on conflict (podstavec_id, velkost) do update set
  cena = excluded.cena, vhodny = excluded.vhodny, poznamka = excluded.poznamka;

-- ---------- Zapichovací tŕň ----------
insert into vlajka_podstavce_ceny (podstavec_id, velkost, cena, vhodny, poznamka)
select p.id, v.velkost, v.cena, v.vhodny, v.poznamka
from vlajka_podstavce p, (values
  ('S', 13, true, 'Len do mäkkého podkladu (tráva, piesok) — nie na dlažbu ani betón.'),
  ('M', 15, true, 'Len do mäkkého podkladu (tráva, piesok) — nie na dlažbu ani betón.'),
  ('L', 17, true, 'Len do mäkkého podkladu (tráva, piesok) — nie na dlažbu ani betón.'),
  ('XL', 19, false, 'Pri XL sa neodporúča — veľká plocha vlajky vo vetre by mohla tŕň vytrhnúť. Zvoľ radšej oceľovú platňu.')
) as v(velkost, cena, vhodny, poznamka)
where p.kod = 'tren'
on conflict (podstavec_id, velkost) do update set
  cena = excluded.cena, vhodny = excluded.vhodny, poznamka = excluded.poznamka;

-- ---------- Vodný vak 10 L ----------
insert into vlajka_podstavce_ceny (podstavec_id, velkost, cena, vhodny, poznamka)
select p.id, v.velkost, v.cena, v.vhodny, v.poznamka
from vlajka_podstavce p, (values
  ('S', 8, true, 'Doplnková záťaž k inému podstavcu — samostatne vlajku nepostaví.'),
  ('M', 8, true, 'Doplnková záťaž k inému podstavcu — samostatne vlajku nepostaví.'),
  ('L', 8, true, 'Doplnková záťaž k inému podstavcu — samostatne vlajku nepostaví.'),
  ('XL', 8, true, 'Doplnková záťaž k inému podstavcu — samostatne vlajku nepostaví.')
) as v(velkost, cena, vhodny, poznamka)
where p.kod = 'vodny_vak'
on conflict (podstavec_id, velkost) do update set
  cena = excluded.cena, vhodny = excluded.vhodny, poznamka = excluded.poznamka;
