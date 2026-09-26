-- ============================================================
-- ZMENA MARZOVEHO MODELU: "podlaha" marze sa uz neriadi pevnym poctom kusov (qty_at_floor),
-- ale CIELOVOU HODNOTOU VELKEJ ZAKAZKY (€) - kolko kusov treba na dosiahnutie podlahovej marze
-- sa dopocita ako cielova_hodnota_zakazky / vyrobna_cena_kusu. Draha polozka (napr. hokejovy
-- dres) tak dosiahne podlahu uz pri par stovkach kusov, lacna polozka (napr. celenka) az pri
-- tisickach - namiesto rovnakeho poctu kusov pre vsetko, ako to bolo doteraz.
-- Povodny stlpec qty_at_floor OSTAVA v DB (nic sa nemaze), len sa uz nepouziva vo vzorci -
-- kod cita novy stlpec cielova_hodnota_zakazky.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.
-- ============================================================

alter table pricing_config add column if not exists cielova_hodnota_zakazky numeric(10,2) not null default 25000;
