-- ============================================================
-- MIGRÁCIA: Sublimácia — elektrina konkrétnych strojov (tlačiareň + lis/kalander) v cene potlače
-- Doteraz "Operátor + kalander (€/hod)" bola jedna ručne zadaná sadzba (práca aj réžia dokopy).
-- Teraz sa dá navyše priradiť KONKRÉTNY stroj z registra zariadení (Financie → Réžia firiem, resp.
-- Prehľady → Všeobecná tabuľka nákladov) pre tlač (Mimaki/Epson/Roland) a pre lis/kalander
-- (Kalander/Karusel/Fixak) — elektrina týchto strojov (kW × cena elektriny × reálny čas) sa
-- pripočíta ako SAMOSTATNÁ položka v rozpise ceny potlače na tričká. Bez priradenia sa nič nemení
-- oproti doterajšiemu stavu (elektrina sa jednoducho nepripočíta, len zostane v "cena_prace_hod").
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_naklady add column if not exists tlaciaren_zariadenie_id text references cost_metrics(id);
alter table textil_naklady add column if not exists kalander_zariadenie_id text references cost_metrics(id);
