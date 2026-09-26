-- Rozsirenie typ_konfiguratora (produkty) o 'celenka'/'buffka' — kliknutie na tieto produkty
-- v katalogu ("Ostatne") ma otvorit uz hotove dedikovane appky (Celenky.jsx/Buffky.jsx, ten
-- isty konfigurator ako na ?typ=celenka/?typ=buffka), nie vseobecny 2D Dizajner ako doteraz.
-- Rovnaky princip ako 3d_dres pre Vyrobu dresov (migration_dres3d.sql).
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table produkty drop constraint if exists produkty_typ_konfiguratora_check;
alter table produkty add constraint produkty_typ_konfiguratora_check check (typ_konfiguratora in ('2d_potlac', '3d_dres', 'celenka', 'buffka'));

update produkty set typ_konfiguratora = 'celenka' where nazov ilike '%čelenk%';
update produkty set typ_konfiguratora = 'buffka' where nazov ilike '%buffk%';
