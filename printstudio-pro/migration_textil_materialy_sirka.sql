-- ============================================================
-- MIGRÁCIA: Textilná metráž — šírka tlače pre vlastné látky
-- Doteraz bola šírka tlače natvrdo 160cm pre všetky objednávky. Teraz:
--   - "vlastný materiál" -> zákazník zadá šírku svojho materiálu sám (appka)
--   - "naša látka" -> šírka sa AUTOMATICKY odvodí zo skladovej položky (šírka rolky MÍNUS
--     8cm rezerva na spadávku/okraje — 4cm z každej strany), rovnaky princip ako pri
--     naklad_m2 (auto-prepocet zo skladu, s moznostou manualneho prepisania/fallbacku).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_materialy add column if not exists sirka_tlace_cm numeric(10,1);

create or replace view textil_materialy_verejny as
select kod, nazov, popis, pouzitie, specifikacie, technologia, naklad_m2, sirka_tlace_cm, poradie
from textil_materialy
where aktivny = true
order by poradie;

grant select on textil_materialy_verejny to anon, authenticated;

-- Skutocna sirka tlace pouzita v objednavke (nezamienat s sirka_cm/vyska_cm — to je velkost
-- opakujuceho sa motivu pri rezime "auto", nie sirka rolky/tlace).
alter table textil_objednavky add column if not exists sirka_tlace_cm numeric(10,1);
