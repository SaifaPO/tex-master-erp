-- ============================================================
-- MIGRÁCIA: Čelenky — prerobenie výpočtu nákladu na 1 ks
-- Pôvodný model počítal náklad z plochy strihu (m² materiál+transfer papier+farba) — nesprávne.
-- Nový model: náklad na 1 ks = základná cena PRODUKTU vybraného zo záložky "Produkty"
-- (zakladna_cena, €/ks nákupná cena hotovej/blank čelenky) — žiadny výpočet z materiálu,
-- len marža + DPH navrchu (rovnaký princíp ako Dizajner/Dres3D, ktoré tiež čítajú
-- produkty.zakladna_cena).
-- Staré stĺpce (cena_material_m2, cena_transfer_papier_m2, cena_farba_m2, cena_sitia_ks)
-- ostávajú v tabuľke nedotknuté (len sa prestanú používať) — konzistentné s zvyškom projektu.
-- Edge Function (celenky-create-draft-order) a appka (Celenky.jsx) sa NEMENIA — obe čítajú len
-- odvodené číslo z celenky_naklady_verejny, ktoré táto migrácia prepočíta.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table celenky_naklady add column if not exists produkt_id bigint references produkty(id) on delete set null;

create or replace view celenky_naklady_verejny as
select coalesce(p.zakladna_cena, 0) as naklad_ks
from celenky_naklady n
left join produkty p on p.id = n.produkt_id
where n.id = 1;

grant select on celenky_naklady_verejny to anon, authenticated;
