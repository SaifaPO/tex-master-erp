-- 3D transfery: výber textúry podkladu loga (10 vzorov 30 x 40 cm). Zákazník si vyberie pri objednávke, cena sa nemení.
-- Plné výrobné súbory (PDF/SVG 30x40 cm) ostávajú u teba — v objednávke je názov súboru. Bezpečné spustiť opakovane.
create table if not exists transfer3d_textury (
    kod text primary key, nazov text not null, popis text, foto_url text, subor_nazov text,
    aktivny boolean not null default true, poradie int not null default 0
);
alter table transfer3d_objednavky add column if not exists textura text;
alter table transfer3d_textury enable row level security;
drop policy if exists "admin plny pristup transfer3d textury" on transfer3d_textury;
create policy "admin plny pristup transfer3d textury" on transfer3d_textury for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create or replace view transfer3d_textury_verejny as select kod, nazov, popis, foto_url, poradie from transfer3d_textury where aktivny;
grant select on transfer3d_textury_verejny to anon, authenticated;
insert into transfer3d_textury (kod, nazov, popis, foto_url, subor_nazov, poradie) values
 ('bodky_sachovnica', 'Bodky / šachovnica', 'Jemné bodky v šachovnicovom rastri', 'https://printstudio-pro.vercel.app/textury/01_bodky_sachovnica.webp', '01_bodky_sachovnica_300x400', 1),
 ('hexagony', 'Hexagóny', 'Včelie plásty', 'https://printstudio-pro.vercel.app/textury/02_hexagony.webp', '02_hexagony_300x400', 2),
 ('carbon', 'Karbón', 'Štruktúra karbónového vlákna', 'https://printstudio-pro.vercel.app/textury/03_carbon.webp', '03_carbon_300x400', 3),
 ('ciarky_45', 'Čiarky 45°', 'Šikmé rovnobežné čiarky', 'https://printstudio-pro.vercel.app/textury/04_ciarky_45.webp', '04_ciarky_45_300x400', 4),
 ('vlnky', 'Vlnky', 'Jemné vlnovky', 'https://printstudio-pro.vercel.app/textury/05_vlnky.webp', '05_vlnky_300x400', 5),
 ('rybia_kost', 'Rybia kosť', 'Klasický vzor rybej kosti', 'https://printstudio-pro.vercel.app/textury/06_rybia_kost.webp', '06_rybia_kost_300x400', 6),
 ('slzickovy_plech', 'Slzičkový plech', 'Protišmykový rebrovaný plech', 'https://printstudio-pro.vercel.app/textury/07_slzickovy_plech.webp', '07_slzickovy_plech_300x400', 7),
 ('stvorceky', 'Štvorčeky', 'Jemná štvorcová mriežka', 'https://printstudio-pro.vercel.app/textury/08_stvorceky.webp', '08_stvorceky_300x400', 8),
 ('trojuholniky', 'Trojuholníky', 'Mozaika z trojuholníkov', 'https://printstudio-pro.vercel.app/textury/09_trojuholniky.webp', '09_trojuholniky_300x400', 9),
 ('supiny', 'Šupiny', 'Rybie šupiny', 'https://printstudio-pro.vercel.app/textury/10_supiny.webp', '10_supiny_300x400', 10)
on conflict (kod) do nothing;
