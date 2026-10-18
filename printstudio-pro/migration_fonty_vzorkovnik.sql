-- Vzorkovnik fontov (tlacitelny manual pre predajnu): kazdy font ma cislo, aby si zakaznik
-- vybral "font c. 7", a pocet farieb potlace (1 = jednofarebny, 2 = napr. vyplň + kontura,
-- 3 = vyplň + kontura + tien/druha kontura). Bezpecne spustit opakovane.

alter table fonty add column if not exists kat_cislo int;
alter table fonty add column if not exists farebnost smallint not null default 1;
alter table fonty drop constraint if exists fonty_farebnost_check;
alter table fonty add constraint fonty_farebnost_check check (farebnost between 1 and 3);

-- Cisla vo vzorkovniku: existujucim fontom podla poradia vzniku (nove si admin urci sam).
with ocislovane as (
    select id, row_number() over (order by id) + coalesce((select max(kat_cislo) from fonty), 0) as n
    from fonty where kat_cislo is null
)
update fonty f set kat_cislo = o.n from ocislovane o where f.id = o.id;

-- Navrh: hranate/sportove fonty maju zmysel ako dvojfarebne (vyplň + kontura) — v admin
-- paneli (Fonty) sa da zmenit pre kazdy font zvlast na 1, 2 alebo 3 farby.
update fonty set farebnost = 2
where farebnost = 1 and nazov in ('Anton', 'Bebas Neue', 'Russo One', 'Black Ops One', 'Teko', 'Oswald');
