-- Šnúrky na krk: tlač v samostatných častiach (napr. dlhšia 70 cm + kratšia 12 cm). Časti sa v dizajnéri nakreslia vedľa seba na jednej ploche (medzi nimi 10 mm), výroba ich oddelí.
-- casti_mm = dĺžky častí v mm oddelené čiarkou ("700,120"); prázdne = jedna plocha podľa sirka_mm. Bezpečné spustiť opakovane.
alter table snurka_modely add column if not exists casti_mm text;
update snurka_modely set casti_mm = '700,120', sirka_mm = 830, popis = 'Dvojdielna tlač: dlhšia časť 70 cm + kratšia 12 cm' where kod = 'sponou';
update snurka_modely set casti_mm = '370,370,120', sirka_mm = 880, popis = 'Tlač: 2 × dlhšia časť 37 cm + kratšia časť 12 cm' where kod = 'spona_poistka';
update snurka_modely set casti_mm = '140', sirka_mm = 140, popis = 'Jedna krátka časť 14 cm' where kod = 'klucenka';
create or replace view snurka_modely_verejny as select kod, nazov, popis, sirka_mm, vyska_mm, foto_url, poradie, casti_mm from snurka_modely;
grant select on snurka_modely_verejny to anon, authenticated;
