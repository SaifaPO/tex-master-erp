-- Redukovane vykony — normalizovana jednotka kapacity vyroby na 1ks produktu (konfekcia/krajcirky),
-- analogia stlpca K z povodneho Google Sheets planu. Vyrobna cena (production_cost) uz existuje
-- z Cenotvorby — rovnaky stlpec sa pouziva aj tu (rovnaky vyznam: naklad na 1ks vratane materialu,
-- sitia, rezie a potlace), ziadny novy stlpec pre cenu netreba.
-- Bezpecne spustit opakovane.
alter table products add column if not exists redukovany_vykon numeric(10,3);
