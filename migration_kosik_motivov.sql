-- Kosik motivov: viac motivov v jednej objednavke (jedno postovne) — Buffky a Celenky.
-- Spolocne ID skupiny + poradie motivu; vyplnene len ak bolo v objednavke viac motivov. (Uz spustene v produkcii 2026-11-03.)
alter table buffky_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
alter table celenky_objednavky add column if not exists skupina_id uuid, add column if not exists poradie int;
