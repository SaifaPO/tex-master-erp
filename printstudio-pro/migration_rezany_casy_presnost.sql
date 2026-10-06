-- ============================================================
-- Rezany transfer: cas rezania a vylupovania (min/cm²) sa ukladal len na 2 desatinne miesta (numeric(10,2)),
-- takze hodnoty ako 0,004 sa zaokruhlili na 0,00 / 0,01. Zvysujeme presnost na 6 desatinnych miest.
-- Existujuce hodnoty ostavaju nezmenene. Bezpecne spustit opakovane.
-- ============================================================

alter table cennik_rezany_transfer alter column cas_rezania_min type numeric(12,6);
alter table cennik_rezany_transfer alter column cas_vylupovania_min type numeric(12,6);
