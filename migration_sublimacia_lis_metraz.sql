-- ============================================================
-- MIGRÁCIA: Sublimácia — oprava strojov (tlačiareň = metráž AJ tričká, kalander = LEN metráž, lis = LEN tričká)
-- Predošlá migrácia (migration_sublimacia_stroje_elektrina.sql) mylne používala "kalander" aj pre
-- potlač tričiek. V skutočnosti: tlačiareň (Mimaki/Epson/Roland) tlačí motív rovnako pre metráž aj
-- pre tričká, kalander (valcový) beží LEN pri metráži (kontinuálna rolka), zatiaľ čo pri tričkách sa
-- namiesto kalandra používa samostatný LIS (Fixak Malý/Veľký) na jednotlivé kusy. Kalander a lis sú
-- teda dva odlišné stroje pre dva odlišné varianty — pridáva sa nový stĺpec `lis_zariadenie_id` pre
-- tričká, `kalander_zariadenie_id` (z predošlej migrácie) ostáva už len pre metráž.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_naklady add column if not exists lis_zariadenie_id text references cost_metrics(id);
