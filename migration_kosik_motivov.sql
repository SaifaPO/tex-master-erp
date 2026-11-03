-- Kosik motivov: viac motivov v jednej objednavke (jedno postovne) — Buffky a Celenky.
-- Spolocne ID skupiny + poradie motivu; vyplnene len ak bolo v objednavke viac motivov. (Uz spustene v produkcii 2026-11-03.)
alter table buffky_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
alter table celenky_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;

-- Dalsie appky (skupina 1): snurky, stolove vlajky, rezane folie, 3D transfery (uz spustene v produkcii 2026-11-03).
alter table snurka_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
alter table stolova_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
alter table folie_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
alter table transfer3d_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
