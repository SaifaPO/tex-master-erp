-- ============================================================
-- Textilna metraz (sublimacia): nova sluzba "Len zrazanie materialu" (kalandrovanie dodaneho
-- materialu, bez tlace). Nepouziva sa ziadna farba ani sublimacny papier, len ochranny papier
-- a praca/kalander — preto je to najlacnejsia sluzba.
-- Verejny pohlad textil_naklady_verejny dostane novy stlpec naklad_bm_zrazanie (€/bm):
--   ochranny papier + cena prace za hodinu / rychlost (rovnaka rychlost ako pri tlaci+fixacii).
-- Povodne stlpce (technologia, naklad_bm) ostavaju nezmenene. Bezpecne spustit opakovane.
-- ============================================================

create or replace view textil_naklady_verejny as
select
  technologia,
  round(
    (case
      when technologia = 'sublimacia' then
        coalesce(cena_papier_bm, 0) + coalesce(cena_ochranny_papier_bm, 0)
        + (cena_atrament_l * spotreba_atrament_ml_m2 / 1000) * 1.60
        + (cena_prace_hod / nullif(rychlost_m_hod, 0))
      when technologia = 'bavlna' then
        (coalesce(cena_primer_l, 0) * coalesce(spotreba_primer_ml_m2, 0) / 1000) * 1.60
        + (cena_atrament_l * spotreba_atrament_ml_m2 / 1000) * 1.60
        + (cena_prace_hod / nullif(rychlost_m_hod, 0))
      else 0
    end)::numeric
  , 2) as naklad_bm,
  round(
    (case
      when technologia = 'sublimacia' then
        coalesce(cena_ochranny_papier_bm, 0) + (cena_prace_hod / nullif(rychlost_m_hod, 0))
      else 0
    end)::numeric
  , 2) as naklad_bm_zrazanie
from textil_naklady;

grant select on textil_naklady_verejny to anon, authenticated;
