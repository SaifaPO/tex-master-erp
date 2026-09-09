-- 10 fontov (zaklade + sportove/hranate) overenych priamo cez Google Fonts API, ze obsahuju
-- podmnozinu "latin-ext" (Google-ovo oznacenie pre stredoeuropske znaky vratane slovenskej
-- diakritiky č/ž/š/ň/ľ/ĺ/ť/á/ô/ä). Kazdy z tychto fontov teda diakritiku zobrazi spravne.
-- Pripaja sa k existujucim riadkom (nemaze/nepresahuje uz zadane fonty) — priradenie podla
-- nazvu, nevklada duplicitne, bezpecne spustit opakovane.
insert into fonty (nazov, pouzitie)
select v.nazov, v.pouzitie from (values
    ('Inter', 'vsetko'),
    ('Oswald', 'vsetko'),
    ('Montserrat', 'vsetko'),
    ('Rajdhani', 'vsetko'),
    ('Teko', 'vsetko'),
    ('Chakra Petch', 'vsetko'),
    ('Anton', 'vsetko'),
    ('Russo One', 'vsetko'),
    ('Bebas Neue', 'vsetko'),
    ('Black Ops One', 'vsetko')
) as v(nazov, pouzitie)
where not exists (select 1 from fonty f where f.nazov = v.nazov);
