-- Doplnenie sirky rolky materialu — vlajka nemoze byt sirsia ako vlajkovina, na ktoru sa tlaci
-- (dlzka/vyska vsak nie je fyzicky obmedzena sirkou rolky, len prakticky cca do 500cm).
-- Na rozdiel od naklad_m2 (interna nakupna cena) je sirka rolky bezny fyzicky udaj, ktory
-- zakaznik potrebuje poznat pred objednanim, preto je aj v verejnom pohlade.
alter table zastava_materialy add column if not exists sirka_rolky_cm numeric(6,1) not null default 150;

-- CREATE OR REPLACE VIEW nedovoli vlozit novy stlpec doprostred existujuceho zoznamu stlpcov
-- (len na koniec) — pohlad sa preto najprv zmaze a znova vytvori; je to len read-only pohlad
-- bez vlastnych dat, takze je to bezpecne.
drop view if exists zastava_materialy_verejny;
create view zastava_materialy_verejny as
select kod, nazov, popis, pouzitie, sirka_rolky_cm, poradie
from zastava_materialy
where aktivny = true
order by poradie;

grant select on zastava_materialy_verejny to anon, authenticated;
