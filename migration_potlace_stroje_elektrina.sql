-- ============================================================
-- MIGRÁCIA: Rezaná fólia, DTF a Sieťotlač — elektrina konkrétnych strojov v cene potlače
-- Rovnaký princíp ako pri sublimácii (tlačiareň/kalander/lis) — priradíš stroj z registra zariadení,
-- jeho elektrina (kW × cena elektriny × reálny čas behu) sa pripočíta ako samostatná položka.
--
-- Rezaná fólia (rezaný transfer): Plotter (rezanie) + Transferový lis (nažehlenie) — časy už
-- existujú (cas_rezania_min, cas_nazehlovania_min), stačia len 2 nové stĺpce so strojmi.
--
-- DTF: Tlačiareň (tlač, už existuje rychlost_tlace_m_hod) + Fixačný tunel (fixácia prášku — NOVÝ
-- čas, tunel môže bežať inou rýchlosťou ako tlačiareň) + Transferový lis (nažehlenie na textil,
-- už existuje cas_nazehlovania_min).
--
-- Sieťotlač: Karusel (tlač cez sitá) + Fixačný tunel (fixácia farby) — sieťotlač doteraz nemala
-- žiadny čas vôbec (len paušálne náklady na farbu/sito/manipuláciu), pridávajú sa 2 NOVÉ časy
-- (min/ks, rovnaký vzor ako "Čas nažehlovania" pri iných technológiách).
--
-- Všetky nové stĺpce majú default 0/NULL — bez vyplnenia sa nič nemení oproti doterajšiemu stavu.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- Rezaná fólia
alter table cennik_rezany_transfer add column if not exists ploter_zariadenie_id text references cost_metrics(id);
alter table cennik_rezany_transfer add column if not exists transferovy_lis_zariadenie_id text references cost_metrics(id);

-- DTF
alter table dtf_naklady add column if not exists tlaciaren_zariadenie_id text references cost_metrics(id);
alter table dtf_naklady add column if not exists fixacny_tunel_zariadenie_id text references cost_metrics(id);
alter table dtf_naklady add column if not exists rychlost_tunela_m_hod numeric(10,2) not null default 1;
alter table dtf_naklady add column if not exists transferovy_lis_zariadenie_id text references cost_metrics(id);

-- Sieťotlač
alter table cennik_sietotlac add column if not exists karusel_zariadenie_id text references cost_metrics(id);
alter table cennik_sietotlac add column if not exists cas_tlace_min numeric(10,2) not null default 0;
alter table cennik_sietotlac add column if not exists fixacny_tunel_zariadenie_id text references cost_metrics(id);
alter table cennik_sietotlac add column if not exists cas_fixacie_min numeric(10,2) not null default 0;
