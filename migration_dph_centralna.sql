-- ============================================================
-- MIGRÁCIA: Centrálna DPH sadzba pre celý PrintStudio Pro
-- Doteraz mal kazdy modul (DTF metraz, Textilna metraz, Zastava, Beachflag, Celenky, Buffky)
-- VLASTNU nezavislu kopiu dph_percent vo svojej *_nastavenia tabulke — jedna z nich sa raz
-- omylom rozisla (buffky_nastavenia malo 15% namiesto 23%). Odteraz je JEDINY zdroj pravdy
-- pricing_config.dph_percent (nastavuje sa v admin appke, zalozka Cenotvorba) — vsetky moduly
-- (appky aj Edge Functions) citaju len odtial'to.
--
-- Povodne *_nastavenia.dph_percent stlpce NEMAZEME (konzistentne s celym projektom — ziadny
-- DROP COLUMN), len sa prestanu pouzivat v kode.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table pricing_config add column if not exists dph_percent numeric(5,2) not null default 23;
