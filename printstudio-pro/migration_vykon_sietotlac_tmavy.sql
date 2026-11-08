-- Sieťotlač: čas výroby nezávisí od počtu farieb; tmavý textil = 2 prechody = 2x dlhšie.
-- merane_na_tmavom = či bol "reálny priemer" (ks/hod) nameraný na tmavom (2 prechody) alebo svetlom textile.
alter table public.vykon_nastavenia add column if not exists merane_na_tmavom boolean not null default false;
