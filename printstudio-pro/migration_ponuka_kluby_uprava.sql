-- Ponuka dresov (kluby) — úpravy podľa Martina (2026-10-25): strihy podľa športu, rukávy, goliere a vyšívanie pre hokej, brankár v hádzanej,
-- ponožkové / bezponožkové štulpne, reflexný flex 6 €, expres +10 %, lacrosse s jedným materiálom, dopyt na doplnky (len informačne v appke).
-- Ceny NOVÝCH príplatkov sú ODHAD — uprav ich v PrintStudio → Ponuka dresov → Príplatky. Bezpečné spustiť opakovane.
alter table ponuka_sporty add column if not exists strihy text[] not null default '{standard,raglan}';
alter table ponuka_sporty add column if not exists kvality int not null default 3;          -- koľko materiálových úrovní šport ponúka (1 = jeden štandardný materiál)
alter table ponuka_sporty drop constraint if exists ponuka_sporty_brankari_check;
alter table ponuka_sporty add constraint ponuka_sporty_brankari_check check (brankari in ('none', 'futbal', 'hokej', 'hadzana'));

update ponuka_sporty set strihy = '{klasik,sedlo,raglan}', goliere = '{okruhly,v,v_vsuvka,snur_retro,snur_hexa,hexa}', rukavy = '{dlhy}' where kod = 'hokej';
update ponuka_sporty set rukavy = '{kratky}', brankari = 'hadzana' where kod = 'hadzana';           -- hádzaná nemá dlhé rukávy (len brankársky dres = mikina)
update ponuka_sporty set rukavy = '{bez,kratky}' where kod = 'volejbal';                            -- volejbal nemá dlhý rukáv
update ponuka_sporty set rukavy = '{kratky}' where kod = 'florbal';                                  -- florbal nemá dlhé rukávy
update ponuka_sporty set strihy = '{lacrosse,box}', kvality = 1 where kod = 'lacrosse';              -- lacrosse / box lacrosse (dlhý rukáv), jeden materiál

insert into ponuka_priplatky (kod, skupina, nazov, poradie, predajna_s_dph) values
    ('fit.standard', 'strih', 'Strih štandardný (hlavičový)', 4, 0), ('fit.raglan', 'strih', 'Strih raglan', 5, 4), ('fit.sedlo', 'strih', 'Strih sedlo (hokej)', 6, 5),
    ('fit.lacrosse', 'strih', 'Strih lacrosse', 7, 0), ('fit.box', 'strih', 'Strih box lacrosse (dlhý rukáv)', 8, 0),
    ('collar.v_vsuvka', 'golier', 'Golier V-výstrih so vsuvkou', 5, 3), ('collar.snur_retro', 'golier', 'Golier šnúrovací retro', 6, 8),
    ('collar.snur_hexa', 'golier', 'Golier šnúrovací hexa', 7, 8), ('collar.hexa', 'golier', 'Golier hexa', 8, 4),
    ('vys.hrud', 'vysivka', 'Vyšívané logo na hrudi (hokej)', 1, 6), ('vys.rukav', 'vysivka', 'Vyšívané malé čísla na rukávoch (hokej)', 2, 5),
    ('vys.chrbat', 'vysivka', 'Vyšívané veľké číslo na chrbte (hokej)', 3, 8), ('vys.sponzor', 'vysivka', 'Vyšívané logo sponzora (za každé logo, hokej)', 4, 5),
    ('stulp.ponozkove', 'stulpne', 'Štulpne ponožkové (príplatok)', 1, 0), ('stulp.bezponozkove', 'stulpne', 'Štulpne bezponožkové (príplatok)', 2, 0),
    ('gk.mikina', 'brankari', 'Brankársky dres hádzaná: mikina, dlhý rukáv, iný materiál', 4, 18)
on conflict (kod) do nothing;

update ponuka_priplatky set predajna_s_dph = 6 where kod = 'apps.flexRefl';      -- reflexný flex je drahší: 6 €
update ponuka_priplatky set nazov = '3D logo' where kod = 'apps.logo3d';          -- nie je silikónové
update ponuka_terminy set uprava_percent = 10 where kod = 'exp';                  -- expres +10 %
