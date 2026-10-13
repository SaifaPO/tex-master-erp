-- ============================================================
-- SUBLIMÁCIA — stroje (elektrina + amortizácia tlačiarne a kalandra) v cene metráže pre zákaznícke appky
-- Doteraz verejný náklad metráže (textil_naklady_verejny.naklad_bm) obsahoval len papier, ochranný papier, atrament a prácu —
-- elektrina strojov a amortizácia boli len v admin náhľade (Kostra cien), takže zákaznícke ceny (Buffky, Textilná metráž, Vlajky…)
-- vychádzali nižšie, než ukazoval admin. Teraz admin uloží do stĺpca stroje_bm (€/bm) sumu "elektrina + amortizácia
-- tlačiarne a kalandra / rýchlosť" a verejný náklad ju pripočíta. Hodnotu zapisuje ERP automaticky (Kostra cien → Sublimácia).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_naklady add column if not exists stroje_bm numeric(10,4) not null default 0;

create or replace view textil_naklady_verejny as
select
  technologia,
  round(
    (case
      when technologia = 'sublimacia' then
        coalesce(cena_papier_bm, 0) + coalesce(cena_ochranny_papier_bm, 0)
        + (cena_atrament_l * spotreba_atrament_ml_m2 / 1000) * 1.60
        + (cena_prace_hod / nullif(rychlost_m_hod, 0))
        + coalesce(stroje_bm, 0)
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
