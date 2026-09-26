-- Vlajky (Zastava) uz maju Standard/Mesh/Cordura (migration_zastavy.sql), chyba len "Saten" —
-- ten isty 4. material, ktory uz Martin manualne pridal do Beachvlajok (vlajka_materialy).
-- Admin karta (Vlajky -> Materialy) uz vsetko potrebne podporuje (prepojenie na sklad + refresh
-- ikonka) - kod je zdielany s Beachvlajkami, staci pridat chybajuci riadok.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

insert into zastava_materialy (kod, nazov, popis, pouzitie, naklad_m2, poradie)
values ('saten', 'Saten', 'Ľahká saténová (hodvábna) tkanina, hladký lesklý povrch, dobrý presvit farby.', 'Dekoratívne vlajky, interiér, príležitosti kde zaleží na vzhľade viac než na odolnosti voči počasiu.', 0, 4)
on conflict (kod) do nothing;
