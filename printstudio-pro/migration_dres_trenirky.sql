-- ============================================================
-- Dres 3D: TRENIRKY (set dres + trenirky). Bezpecne spustit opakovane.
--  * produkt_dres_nastavenia.trenirky_povolene — ci sa trenirky ponukaju zakaznikom pri tomto dresovom produkte
--  * produkt_dres_naklady.trenirky_naklad_ks   — nakupna/vyrobna cena 1 paru trenirok bez DPH (z nej sa pocita predajna cena marzou)
--  * dres_objednavky.zostava / trenirky_farby  — co zakaznik objednal ('dres' | 'trenky' | 'komplet') a farby zon trenirok
-- ============================================================

alter table produkt_dres_nastavenia add column if not exists trenirky_povolene boolean not null default false;
alter table produkt_dres_naklady add column if not exists trenirky_naklad_ks numeric not null default 0;
alter table dres_objednavky add column if not exists zostava text;
alter table dres_objednavky add column if not exists trenirky_farby jsonb;
