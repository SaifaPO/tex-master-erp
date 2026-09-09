-- Cennik potlace (PrintStudio Pro) — rozsirenie o NAKLADOVU zlozku (material, farba, praca) a
-- zdielany "marzovy matrix" podla poctu kusov, z ktoreho sa da dopocitat odporucana predajna sadzba.
-- DOLEZITE: existujuce predajne sadzby (cennik_technologie.cena_cm2, cennik_sietotlac.cena_cm2*,
-- cennik_folie.cena_cm2, cennik_rezany_transfer.min_cena) NEMENIME ani nemazeme — tie stale realne
-- pouziva zakaznicky konfigurator (Dizajner.jsx). Nakladova kalkulacka len DOPOCITA odporucanu
-- hodnotu, ktoru admin sam potvrdi/zapise cez uz existujuce polia.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

-- ---------- MARZOVY MATRIX (spolocny pre vsetky technologie) ----------
-- Nasobok sa aplikuje na vyrobnu cenu (VC) podla poctu kusov v objednavke, napr. VC 1€ x 4.0 = 4€ pri 1ks.
create table if not exists cennik_marza_hladiny (
    id bigint generated always as identity primary key,
    min_ks int not null,
    max_ks int not null,
    nasobok numeric(6,2) not null,
    poradie int not null default 0
);
insert into cennik_marza_hladiny (min_ks, max_ks, nasobok, poradie)
select * from (values
    (1, 1, 4.0, 1),
    (2, 4, 3.2, 2),
    (5, 9, 2.6, 3),
    (10, 24, 2.1, 4),
    (25, 49, 1.8, 5),
    (50, 99, 1.6, 6),
    (100, 999999, 1.4, 7)
) as v(min_ks, max_ks, nasobok, poradie)
where not exists (select 1 from cennik_marza_hladiny);

-- ---------- SUBLIMÁCIA — nakladova zlozka (papier + farba + praca) ----------
create table if not exists cennik_sublimacia_naklady (
    id int primary key default 1,
    cena_papier_bm numeric(10,2) not null default 0,
    sirka_papiera_cm numeric(10,2) not null default 160,
    cena_farba_liter numeric(10,2) not null default 0,
    spotreba_farba_ml_m2 numeric(10,3) not null default 0,
    naklady_manipulacia numeric(10,2) not null default 0,
    cas_nazehlovania_min numeric(10,2) not null default 0,
    cena_prace_hod numeric(10,2) not null default 0,
    constraint jediny_riadok_sublimacia_naklady check (id = 1)
);
insert into cennik_sublimacia_naklady (id) values (1) on conflict (id) do nothing;

-- ---------- SIEŤOTLAČ — cena farby + spotreby podla velkosti (svetly/tmavy textil) ----------
alter table cennik_sietotlac add column if not exists cena_farba_kg numeric(10,2) not null default 0;
alter table cennik_sietotlac add column if not exists naklady_manipulacia numeric(10,2) not null default 0;

create table if not exists cennik_sietotlac_velkosti (
    id bigint generated always as identity primary key,
    label text not null,
    sirka_cm numeric(10,2) not null default 0,
    vyska_cm numeric(10,2) not null default 0,
    spotreba_g_svetly numeric(10,3) not null default 0,
    spotreba_g_tmavy numeric(10,3) not null default 0,
    poradie int not null default 0
);
insert into cennik_sietotlac_velkosti (label, sirka_cm, vyska_cm, spotreba_g_svetly, spotreba_g_tmavy, poradie)
select * from (values
    ('Malé logo (do 5×5 cm)', 5, 5, 3, 5, 1),
    ('A5', 14.8, 21, 6, 9, 2),
    ('A4', 21, 29.7, 8, 12, 3),
    ('A3', 29.7, 42, 10, 15, 4)
) as v(label, sirka_cm, vyska_cm, spotreba_g_svetly, spotreba_g_tmavy, poradie)
where not exists (select 1 from cennik_sietotlac_velkosti);

-- ---------- REZANÝ TRANSFER — cena za bm + realne vyuzitelna sirka folie + praca ----------
alter table cennik_rezany_transfer add column if not exists cena_bm numeric(10,2) not null default 0;
alter table cennik_rezany_transfer add column if not exists sirka_folie_cm numeric(10,2) not null default 50;
alter table cennik_rezany_transfer add column if not exists sirka_vyuzitelna_cm numeric(10,2) not null default 49;
alter table cennik_rezany_transfer add column if not exists naklady_manipulacia numeric(10,2) not null default 0;
alter table cennik_rezany_transfer add column if not exists cas_nazehlovania_min numeric(10,2) not null default 0;
alter table cennik_rezany_transfer add column if not exists cena_prace_hod numeric(10,2) not null default 0;

-- ---------- DTF (Digitalny transfer) — doplnenie manipulacie a nazehlovania k uz existujucim
-- nakladom v dtf_naklady (cena_prace_hod uz existuje, pouzije sa aj na nazehlovanie) ----------
alter table dtf_naklady add column if not exists naklady_manipulacia numeric(10,2) not null default 0;
alter table dtf_naklady add column if not exists cas_nazehlovania_min numeric(10,2) not null default 0;

-- ---------- RLS ----------
alter table cennik_marza_hladiny enable row level security;
alter table cennik_sublimacia_naklady enable row level security;
alter table cennik_sietotlac_velkosti enable row level security;

drop policy if exists "verejne citanie marza hladin" on cennik_marza_hladiny;
create policy "verejne citanie marza hladin" on cennik_marza_hladiny for select using (true);
drop policy if exists "admin plny pristup marza hladiny" on cennik_marza_hladiny;
create policy "admin plny pristup marza hladiny" on cennik_marza_hladiny for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin plny pristup sublimacia naklady" on cennik_sublimacia_naklady;
create policy "admin plny pristup sublimacia naklady" on cennik_sublimacia_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin plny pristup sietotlac velkosti" on cennik_sietotlac_velkosti;
create policy "admin plny pristup sietotlac velkosti" on cennik_sietotlac_velkosti for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
