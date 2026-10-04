-- Beachvlajky: postovne zdarma pri objednavke od zadanej sumy (EUR s DPH, bez dopravy).
-- Predvolene 150 EUR; ak stlpec neexistuje, Edge Functions pouzivaju 150 EUR. 0 = postovne zdarma sa nepouziva.
alter table vlajka_nastavenia add column if not exists postovne_zdarma_od_eur numeric not null default 150;
