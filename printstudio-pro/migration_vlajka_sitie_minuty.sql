-- ============================================================
-- MIGRACIA: naklad beachvlajky doteraz pocital LEN latku (vlajka_materialy.naklad_m2),
-- chybala sublimacna potlac aj sitie -> cena bola drasticky podhodnotena (napr. XL vychadzalo
-- len 17 EUR). Sitie sa teraz pocita z minut sitia danej velkosti x centralna sadzba
-- pricing_config.cena_minuty_sitia (uz existuje, pouziva sa aj inde v ERP). Sublimacna potlac
-- sa pocita zivo z textil_naklady_verejny (rovnaky zdroj ako Buffky/Textilna metraz),
-- prepocitana z EUR/bm na EUR/m2 podla nominalnej sirky 160cm (rovnaka konvencia ako
-- printstudio-pro/src/TextilMetraz.jsx ROLL_WIDTH_CM). Toto len prida stlpec pre minuty sitia -
-- ostatne zmeny su v Edge Functions (beachflag-price-preview, beachflag-create-draft-order).
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_velkosti add column if not exists minuty_sitia numeric default 0;

update vlajka_velkosti set minuty_sitia = 5 where kod = 'S';
update vlajka_velkosti set minuty_sitia = 7 where kod = 'M';
update vlajka_velkosti set minuty_sitia = 9 where kod = 'L';
update vlajka_velkosti set minuty_sitia = 11 where kod = 'XL';
