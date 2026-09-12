-- Predajný cenník (tlačová A4 tabuľa pre predajňu) — jednoduchý, prehľadný cenník
-- štandardných položiek dotlače (malé/veľké číslo, menovka, plnofarebná potlač A5/A4/A3 a pod.)
-- pre zákazníkov priamo na predajni. Cena sa vždy dopočítava z výrobnej ceny + obchodnej marže
-- + DPH — zmena v ktoromkoľvek z týchto troch sa ihneď premietne do vygenerovaného cenníka
-- (žiadna cena sa neukladá natvrdo). Čisto interný admin nástroj — žiadny anon/verejný prístup.

create table if not exists predajny_cennik_polozky (
    id bigint generated always as identity primary key,
    nazov text not null,
    popis text,
    kategoria text not null default 'Ostatné',
    vyrobna_cena numeric(10,2) not null default 0,
    poradie int not null default 0,
    aktivny boolean not null default true
);

create table if not exists predajny_cennik_nastavenia (
    id int primary key default 1,
    nazov_cennika text not null default 'Cenník dotlače na textil',
    marza_percent numeric(5,2) not null default 40,
    dph_percent numeric(5,2) not null default 23,
    standard_dni int not null default 5,
    expres2_priplatok_percent numeric(5,2) not null default 20,
    expres2_min_eur numeric(10,2) not null default 10,
    expresny_den_priplatok_percent numeric(5,2) not null default 50,
    expresny_den_min_eur numeric(10,2) not null default 10,
    expresny_den_cutoff_hodina int not null default 12,
    kontakt_riadok text default '',
    poznamka text default 'Presné cenové ponuky Vám vypracujeme na predajni. Termíny závisia od aktuálnej vyťaženosti výroby.',
    constraint jediny_riadok_predajny_cennik check (id = 1)
);

insert into predajny_cennik_nastavenia (id) values (1) on conflict (id) do nothing;

-- Zopár orientačných štartovacích položiek (podľa referenčného vzoru) — výrobné ceny sú len
-- placeholder, Martin si ich musí prejsť a nastaviť podľa reálnych nákladov.
insert into predajny_cennik_polozky (nazov, popis, kategoria, vyrobna_cena, poradie)
select * from (values
    ('Malé jednofarebné číslo', 'napr. na rukáve trička — cena za 1 znak', 'Číslovanie a mená', 3.00, 1),
    ('Veľká číslovka', 'napr. na chrbte — cena za 1 znak', 'Číslovanie a mená', 3.00, 2),
    ('Menovka', 'meno hráča/zamestnanca', 'Číslovanie a mená', 3.00, 3),
    ('Plnofarebná potlač A5', '', 'Plnofarebná potlač', 5.00, 4),
    ('Plnofarebná potlač A4', '', 'Plnofarebná potlač', 6.50, 5),
    ('Plnofarebná potlač A3', '', 'Plnofarebná potlač', 11.00, 6)
) as v(nazov, popis, kategoria, vyrobna_cena, poradie)
where not exists (select 1 from predajny_cennik_polozky);

alter table predajny_cennik_polozky enable row level security;
alter table predajny_cennik_nastavenia enable row level security;

-- Cisto interny admin nastroj (nepouziva ho ziaden zakaznicky konfigurator) — pristup len pre
-- prihlasenych zamestnancov v hlavnom ERP.
create policy "admin plny pristup predajny cennik polozky" on predajny_cennik_polozky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup predajny cennik nastavenia" on predajny_cennik_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
