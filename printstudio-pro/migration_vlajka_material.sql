-- Beachvlajky: material (fabric) ako skutocny cenovy faktor namiesto plochej ceny za velkost.
-- Doteraz kazda velkost (S/M/L/XL) mala rucne nastavenu PEVNU predajnu cenu (vlajka_velkosti.cena) —
-- ziadny material, ziadna marzova formula. Teraz sa cena vlajky pocita ako:
--   naklad = spotreba_m2 (per tvar x velkost) * naklad_m2 (material) -> marzovy vzorec (pricing_config)
-- + opracovanie + prut (tie ostavaju plocha cena, nie su "naklad") + doplnky + expres + DPH.
-- Rovnaky princip ako uz existujuce Zastavy (zastava_materialy) — surovy naklad NIKDY nejde k
-- anon klientovi priamo, len cez verejny pohlad (bez naklad_m2) a server-side Edge Function.

create table if not exists vlajka_materialy (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    popis text,
    pouzitie text,
    naklad_m2 numeric(10,2) not null default 0,
    sklad_material_id text references materials(id) on delete set null,
    aktivny boolean not null default true,
    poradie int default 0,
    created_at timestamptz default now()
);

alter table vlajka_materialy enable row level security;
drop policy if exists "admin plny pristup vlajka materialy" on vlajka_materialy;
create policy "admin plny pristup vlajka materialy" on vlajka_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Verejny pohlad pre zakaznicky konfigurator — LEN nazov/popis, bez naklad_m2 (rovnaky princip
-- ako zastava_materialy_verejny — pohlad bezi s pravami vlastnika, obchadza RLS na baznej tabulke).
create or replace view vlajka_materialy_verejny as
select kod, nazov, popis, pouzitie, poradie
from vlajka_materialy
where aktivny = true
order by poradie;

grant select on vlajka_materialy_verejny to anon, authenticated;

-- Spotreba materialu (m2) pre kazdu kombinaciu tvar x velkost — nutna pre vypocet nakladu.
-- Nastavuje sa rucne (realna spotreba pri reze vratane odpadu), nie geometricky z SVG ciest.
alter table vlajka_tvar_rozmery add column if not exists spotreba_m2 numeric(6,3);
