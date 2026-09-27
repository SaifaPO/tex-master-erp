-- ============================================================
-- OPRAVA DUPLICITY: tabulka vlajka_doplnky stale obsahovala 4 stare polozky
-- (cross/plate4kg/spike/waterbag) z obdobia PRED tym, nez vznikol dedikovany
-- system vlajka_podstavce + vlajka_podstavce_ceny (cena podla velkosti vlajky).
-- Zakaznik si tak podstavec vyberal DVAKRAT - raz spravne v Parametroch (podla
-- velkosti), raz znova v kroku "Doplnky" za plochu cenu bez ohladu na velkost.
-- Deaktivacia (nie zmazanie) - historicke objednavky, ktore uz tieto kody
-- pouzili, ostavaju netknute, len sa prestanu ponukat novym zakaznikom.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

update vlajka_doplnky set aktivny = false where kod in ('cross', 'plate4kg', 'spike', 'waterbag');
