-- ============================================================
-- MIGRÁCIA: Buffky — prerobenie výpočtu nákladu na 1 ks
-- Pôvodný model počítal náklad z plochy strihu (m² materiál+transfer papier+farba) — nesprávne.
-- Nový model:
--   - nákup čistej (nepotlačenej) buffky: FLAT cena €/ks bez DPH (cena_buffka_ks, default 0,50€)
--   - potlač: spotreba na 5 buffiek je 1bm sublimačnej potlače — cena sa ŽIVO ťahá
--     z Kostra cien (textil_naklady_verejny, technologia='sublimacia', stĺpec naklad_bm),
--     rovnaký zdroj, aký už používa Textilná metráž. Náklad na 1 buffku = naklad_bm / 5.
-- Staré stĺpce (cena_material_m2, cena_transfer_papier_m2, cena_farba_m2, cena_sitia_ks)
-- ostávajú v tabuľke nedotknuté (len sa prestanú používať) — konzistentné s zvyškom projektu.
-- Edge Function (buffky-create-draft-order) a appka (Buffky.jsx) sa NEMENIA — obe čítajú len
-- odvodené číslo z buffky_naklady_verejny, ktoré táto migrácia prepočíta.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table buffky_naklady add column if not exists cena_buffka_ks numeric(10,2) not null default 0.50;

create or replace view buffky_naklady_verejny as
select
  round((
    b.cena_buffka_ks + coalesce(t.naklad_bm, 0) / 5
  )::numeric, 2) as naklad_ks
from buffky_naklady b
left join textil_naklady_verejny t on t.technologia = 'sublimacia'
where b.id = 1;

grant select on buffky_naklady_verejny to anon, authenticated;
