-- ============================================================
-- MIGRÁCIA: Doplnenie 6 kvalitatívnych radov (Entry / Entry Max / Pro / Pro Max / Ultra / Ultra Max)
-- Popis pri každom rade obsahuje, čo je v danej úrovni PEVNE zahrnuté (žiadne
-- odškrtávanie doplnkov pri objednávke — kto chce doplnky navyše, ide do vyššej úrovne).
-- Bezpečné spustiť opakovane — každý rad sa vloží len ak ešte neexistuje rad s rovnakým názvom.
-- Texty popisov uprav podľa potreby priamo v ERP (Katalóg produktov -> Kvalitatívne rady).
-- ============================================================

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-entry', 'Entry', '', '', 'Základná úroveň — regular strih (hlavicový alebo raglánový). Materiály: Torino / Cooltex / F02.'
where not exists (select 1 from quality_tiers where name = 'Entry');

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-entry-max', 'Entry Max', '', '', 'Ako Entry, navyše pevne zahrnuté: 3D logo alebo výšivka, špeciálny golier (patentový / na gombíky / so šnúrkou), vetracie zóny (šité alebo laserom rezané).'
where not exists (select 1 from quality_tiers where name = 'Entry Max');

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-pro', 'Pro', '', '', 'Slim fit strih. Materiály: Bona 1.3 / Bona 1.6.'
where not exists (select 1 from quality_tiers where name = 'Pro');

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-pro-max', 'Pro Max', '', '', 'Ako Pro, navyše pevne zahrnuté: 3D logo alebo výšivka, špeciálny golier, vetracie zóny.'
where not exists (select 1 from quality_tiers where name = 'Pro Max');

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-ultra', 'Ultra', '', '', 'Priliehavý strih. Materiál: Borghini.'
where not exists (select 1 from quality_tiers where name = 'Ultra');

insert into quality_tiers (id, name, fit, ventilation, description)
select 'tier-ultra-max', 'Ultra Max', '', '', 'Ako Ultra, navyše pevne zahrnuté: 3D logo alebo výšivka, špeciálny golier, vetracie zóny.'
where not exists (select 1 from quality_tiers where name = 'Ultra Max');
