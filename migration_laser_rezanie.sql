-- Laserové rezanie dielcov — nová technológia v "Kostra cien" a "Potlače", rovnaký vzor ako
-- Rezaný transfer (cennik_rezany_transfer/cennik_folie): náklady sa počítajú z min/cm² podľa
-- zvolenej hrúbky látky (rôzne hrúbky = rôzna rýchlosť rezania laserom), predajná sadzba (€/cm²)
-- + min. cena úkonu sú priamo na riadku hrúbky (rovnaký princíp ako cennik_folie.cena_cm2).
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

create table if not exists cennik_laser_rezanie (
    id int primary key default 1,
    naklady_manipulacia numeric(10,2) not null default 0,
    cena_prace_hod numeric(10,2) not null default 0,
    laser_zariadenie_id text,
    min_cena numeric(10,2) not null default 0,
    constraint jediny_riadok_laser_rezanie check (id = 1)
);
insert into cennik_laser_rezanie (id) values (1) on conflict (id) do nothing;
alter table cennik_laser_rezanie enable row level security;
drop policy if exists "admin plny pristup laser rezanie" on cennik_laser_rezanie;
create policy "admin plny pristup laser rezanie" on cennik_laser_rezanie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists cennik_laser_hrubky (
    id bigint generated always as identity primary key,
    label text not null,
    cas_rezania_min_cm2 numeric(10,4) not null default 0,
    cena_cm2 numeric(10,4) not null default 0,
    poradie int not null default 0
);
insert into cennik_laser_hrubky (label, cas_rezania_min_cm2, cena_cm2, poradie)
select * from (values
    ('Tenká (do 1mm) — bavlna, polyester', 0.0, 0.0, 1),
    ('Stredná (1–3mm) — flís, softshell', 0.0, 0.0, 2),
    ('Hrubá (3mm+) — plsť, neoprén', 0.0, 0.0, 3)
) as v(label, cas_rezania_min_cm2, cena_cm2, poradie)
where not exists (select 1 from cennik_laser_hrubky);
alter table cennik_laser_hrubky enable row level security;
drop policy if exists "verejne citanie laser hrubky" on cennik_laser_hrubky;
create policy "verejne citanie laser hrubky" on cennik_laser_hrubky for select using (true);
drop policy if exists "admin plny pristup laser hrubky" on cennik_laser_hrubky;
create policy "admin plny pristup laser hrubky" on cennik_laser_hrubky for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
