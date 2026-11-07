-- ============================================================
-- NAMERANE VYKONY A SPOTREBA: skutocne namerane zakazky (kolko ks za hodinu, kolko farby sa minulo)
-- + referencne vykony pre kalkulacku potlace (cas na celu zakazku pri 1 / 2 / 3 zariadeniach).
-- Bezpecne spustit opakovane, nic nemaze.
-- ============================================================
create table if not exists vykon_merania (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  datum date not null default current_date,
  technologia text not null,                -- sietotlac | dtf | sublimacia | rezany | ina
  popis text not null,
  produkt text,
  ks integer,
  cas_min numeric,                          -- cely cas v minutach
  pocet_zariadeni integer not null default 1,
  farby integer,
  spotreba_kg numeric,                      -- celkova spotreba farby/materialu v kg
  poznamka text
);
create index if not exists vykon_merania_datum_idx on vykon_merania (datum desc);
alter table vykon_merania enable row level security;
drop policy if exists "prihlaseni plny pristup vykon_merania" on vykon_merania;
create policy "prihlaseni plny pristup vykon_merania" on vykon_merania for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Referencny vykon jedneho zariadenia pre kazdu technologiu (pouziva kalkulacka v Potlace)
create table if not exists vykon_nastavenia (
  technologia text primary key,             -- sietotlac | dtf | sublimacia | rezany
  ks_hod_zariadenie numeric,                -- realny priemer ks/hod na 1 zariadenie (vratane prestavok)
  ks_hod_spicka numeric,                    -- najlepsi namerany vykon ks/hod na 1 zariadenie
  referencne_farby integer not null default 1,  -- pre kolko farieb plati ks_hod (sietotlac)
  jednotka text,                            -- tricko / ruksak ...
  poznamka text,
  cena_balenia_eur numeric,                 -- farba: cena baleni (galon)
  hmotnost_balenia_kg numeric,
  spotreba_g_ks numeric,                    -- priemerna spotreba farby na 1 ks
  spotreba_popis text,
  updated_at timestamptz not null default now()
);
alter table vykon_nastavenia enable row level security;
drop policy if exists "prihlaseni plny pristup vykon_nastavenia" on vykon_nastavenia;
create policy "prihlaseni plny pristup vykon_nastavenia" on vykon_nastavenia for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Namerane hodnoty (2026-11-07)
insert into vykon_nastavenia (technologia, ks_hod_zariadenie, ks_hod_spicka, referencne_farby, jednotka, poznamka, cena_balenia_eur, hmotnost_balenia_kg, spotreba_g_ks, spotreba_popis)
values
 ('sietotlac', 90, 283, 2, 'tričko', 'Excalibur karusel, 2 farby na jednu stranu. Realny priemer: 450 ks za 5 h. Spicka: 12 ks za 2:30 (283 ks/h).', 101, 5.8, 7.4, 'Arctic white plastisol: 950 tričiek, 2/2 vpredu aj vzadu, spolu 7 kg = 7,4 g na tričko; galón 5,8 kg = 101 €'),
 ('dtf', 67.9, null, 1, 'ruksak', 'Transfer, nazehlenie 8+8 s. 950 ruksakov za 7 h na 2 zehlickach = 67,9 ks/h na 1 zehlicku.', null, null, null, null),
 ('sublimacia', null, null, 1, null, 'Zatial nezmerane.', null, null, null, null),
 ('rezany', 67.9, null, 1, 'ruksak', 'Rovnaký výkon ako DTF transfer: nažehlenie 8+8 s (Martin: platí aj pre rezaný). Odvodené z 950 ruksakov za 7 h na 2 žehličkách.', null, null, null, null)
on conflict (technologia) do nothing;

insert into vykon_merania (datum, technologia, popis, produkt, ks, cas_min, pocet_zariadeni, farby, spotreba_kg, poznamka)
select * from (values
 ('2026-11-07'::date, 'sietotlac', 'Excalibur karusel, 2x2 záter na tmavý textil, 12 ks za 2:30 (výkon 283 ks/h)', 'tričko', 12, 2.5::numeric, 1, 2, null::numeric, 'Tmavý textil (2 vrstvy: podklad + farba)'),
 ('2026-11-07'::date, 'dtf', '950 ruksakov nažehlených na 2 žehličkách, 8+8 s', 'ruksak', 950, 420::numeric, 2, null::integer, null::numeric, 'Transfer (nie sublimácia)'),
 ('2026-11-07'::date, 'sietotlac', '450 tričiek 2/2, tlač jednej strany', 'tričko', 450, 300::numeric, 1, 2, null::numeric, null),
 ('2026-11-07'::date, 'sietotlac', 'Spotreba plastisolu: 950 tričiek 2/2 vpredu aj 2/2 vzadu', 'tričko', 950, null::numeric, 1, 4, 7::numeric, 'Celý galón (5,8 kg) + približne ďalšie kilo = 7 kg → 7,4 g na tričko. Galón 101 € / 5,8 kg = 17,41 €/kg')
) as v(datum, technologia, popis, produkt, ks, cas_min, pocet_zariadeni, farby, spotreba_kg, poznamka)
where not exists (select 1 from vykon_merania);
