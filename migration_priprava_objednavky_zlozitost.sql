-- Príprava objednávky (min na objednávku, rozpočíta sa na kusy) pri DTF a rezanom transfere + násobky zložitosti loga pri rezaní/vyľupovaní.
-- Hodnoty nemajú vplyv na e-shop appky (edge funkcie ich nečítajú) — používa ich len ERP kalkulácia (Cenové ponuky, Potlače).
-- Aplikované na produkciu 2026-11-12.
alter table public.dtf_naklady add column if not exists priprava_min numeric not null default 0;
alter table public.cennik_rezany_transfer add column if not exists priprava_min numeric not null default 0;
alter table public.cennik_rezany_transfer add column if not exists zlozitost_stredna_nasobok numeric not null default 2;
alter table public.cennik_rezany_transfer add column if not exists zlozitost_vysoka_nasobok numeric not null default 3;
update public.dtf_naklady set priprava_min = 10 where id = 1;
update public.cennik_rezany_transfer set priprava_min = 10 where id = 1;

-- Rezaný transfer: reálne časy podľa Martina (2026-11-12). Pôvodné hodnoty: cena_prace_hod 6, cas_vylupovania_min 0.004, zlozitost_stredna 2, zlozitost_vysoka 3.
-- Jednoduché logo 10x10 cm ≈ 10 s vyľupovanie (0,0017 min/cm²); stredne zložité ≈ 1 min (×6); zložité ≈ 2 min (×12). Sadzba 15 €/h ako pri ostatných. Odpad základný 10 %.
alter table public.cennik_rezany_transfer add column if not exists odpad_percent numeric not null default 0;
update public.cennik_rezany_transfer set cena_prace_hod = 15, cas_vylupovania_min = 0.0017, zlozitost_stredna_nasobok = 6, zlozitost_vysoka_nasobok = 12, odpad_percent = 10 where id = 1;
