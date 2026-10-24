-- Výšivka: kalkulácia ceny (rovnako ako sublimácia / DTF / laser). Výrobné hodnoty výšivkárne + vyšívací stroj v Réžii firiem (cost_metrics).
-- Vyšívací stroj (3-hlavový): 60 000 €, 6 hodín denne. Amortizácia = 60 000 € / 12 rokov (stred životnosti 10–15 r.) / (250 dní × 6 h = 1 500 h/rok) = 3,33 €/h
-- + fond opráv a servis 600 €/rok / 1 500 h = 0,40 €/h  →  3,73 €/h celého stroja. Príkon 1,2 kW je ODHAD pre 3-hlavový stroj (uprav podľa štítku).
-- Hodnoty sú odhady — uprav v PrintStudio → Ceny a tlač → Výšivka — kalkulácia a v Réžii firiem. Bezpečné spustiť opakovane.
insert into cost_metrics (id, name, value, unit, description, power_kw, hours_per_month, category, cost_type, company, amortizacia_hod)
values ('metric-vysivaci-stroj', 'Vyšívací stroj (3-hlavový)', 0, '€/mesiac',
        'Cena 60 000 €, život 10–15 r. (stred 12 r.) + servis 600 €/rok, 6 hod denne (~126 h/mes): 3,33 + 0,40 = 3,73 €/h celého stroja (3 hlavy vyšívajú naraz). Príkon 1,2 kW je ODHAD — doplň podľa štítku stroja.',
        1.2, 126, 'zariadenie', 'variabilny', 'PBT', 3.73)
on conflict (id) do nothing;

create table if not exists vysivka_kalk_nastavenia (
    id int primary key default 1,
    stroj_zariadenie_id text not null default 'metric-vysivaci-stroj',   -- riadok v cost_metrics (príkon + amortizácia za hodinu celého stroja)
    hlavy int not null default 3,                                         -- koľko kusov stroj vyšíva naraz
    rychlost_spm numeric(8,1) not null default 650,                       -- stehov za minútu (pre ručné zadanie stehov)
    strih_s numeric(6,2) not null default 2.5,                            -- sekúnd na 1 strih nite (rovnako ako v editore)
    zmena_farby_s numeric(6,2) not null default 4,                        -- sekúnd na 1 výmenu farby nite (rovnako ako v editore)
    nit_cena_kus_eur numeric(8,2) not null default 3.50,                  -- cena 1 cievky vrchnej nite
    nit_dlzka_kus_m numeric(8,0) not null default 5000,                   -- dĺžka nite na cievke
    nit_m_na_1000_stehov numeric(6,2) not null default 4.5,               -- spotreba vrchnej nite (ak nie je známa z editora)
    spodna_nit_percent numeric(6,1) not null default 35,                  -- spodná niť v % spotreby vrchnej
    stabilizator_eur_ks numeric(8,3) not null default 0.15,               -- podkladový materiál (stabilizér) na 1 kus
    praca_hod numeric(8,2) not null default 15,                           -- €/hod zamestnanca
    priprava_min numeric(8,1) not null default 10,                        -- príprava objednávky (súbor, niť, upnutie) v minútach
    vkladanie_min_ks numeric(8,2) not null default 1.2,                   -- upnutie a odstrihnutie 1 kusu v minútach
    obsluha_percent numeric(6,1) not null default 25,                     -- podiel obsluhy z času behu stroja (dozeranie, výmena nite)
    riziko_percent numeric(6,1) not null default 5,                       -- zmetky a rezerva
    min_cena_eur numeric(8,2) not null default 10,                        -- minimálna cena výšivky (bez DPH)
    constraint jediny_riadok_vysivka_kalk check (id = 1)
);
insert into vysivka_kalk_nastavenia (id) values (1) on conflict (id) do nothing;
alter table vysivka_kalk_nastavenia enable row level security;
drop policy if exists "admin plny pristup vysivka kalk" on vysivka_kalk_nastavenia;
create policy "admin plny pristup vysivka kalk" on vysivka_kalk_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
