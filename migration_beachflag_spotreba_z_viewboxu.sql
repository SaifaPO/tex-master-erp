-- Beachvlajky: spotreba_m2 (spotreba materiálu) sa doteraz musela zadávať ručne pre každý tvar
-- × veľkosť, a chýbajúca hodnota hádže chybu priamo v živom Shopify konfigurátore (beachflag-price-preview
-- Edge Function). viewBox už ale obsahuje presný rozmer plachty ("minX minY šírka výška" v cm) —
-- plocha celého obdĺžnika presne zodpovedá "spotreba vrátane odpadu pri reze" (z rolky materiálu sa
-- reálne spotrebuje celý obdĺžnik, bez ohľadu na to, aký tvar sa z neho vystrihne).
--
-- Dopočíta chýbajúce (NULL) spotreba_m2 zo šírky×výšky viewBoxu — nič, čo už bolo ručne zadané, sa nemení.
update vlajka_tvar_rozmery
set spotreba_m2 = round(
    (split_part(viewbox, ' ', 3)::numeric * split_part(viewbox, ' ', 4)::numeric) / 10000,
    2
)
where spotreba_m2 is null
  and viewbox ~ '^\S+\s+\S+\s+\S+\s+\S+$'
  and split_part(viewbox, ' ', 3) ~ '^[0-9.]+$'
  and split_part(viewbox, ' ', 4) ~ '^[0-9.]+$';
