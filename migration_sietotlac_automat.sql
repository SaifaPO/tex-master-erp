-- ============================================================
-- MIGRÁCIA: Katalóg Produktov — automatický výpočet ceny sieťotlače
-- Doteraz bola sieťotlač vždy ručne zadaná €/ks. Teraz sa dá pri produkte zvoliť formát
-- (veľkosť motívu z Kostry cien), či ide o tmavý/svetlý textil a počet farieb — cena sa
-- dopočíta rovnakým vzorcom ako v Kostre cien (síto na farbu + gramáž farby na farbu,
-- klesajúca o 20% za každú ďalšiu farbu). Ak formát nie je zvolený, správa sa presne ako
-- doteraz — ručné pole cena_potlace_sietotlac_ks.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table products add column if not exists sietotlac_velkost_id int references cennik_sietotlac_velkosti(id);
alter table products add column if not exists sietotlac_je_tmavy boolean not null default false;
alter table products add column if not exists sietotlac_pocet_farieb int not null default 1;
