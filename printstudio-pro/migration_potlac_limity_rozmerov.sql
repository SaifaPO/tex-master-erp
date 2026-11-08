-- Potlač textilu: max. rozmery podľa technológie, rozmer lisu (viacnásobné nažehlenie), okraje podľa veľkosti trička, veľkostné tabuľky produktov.
alter table public.potlac_nastavenia add column if not exists max_rozmery jsonb not null default '{"dtf":{"sirka":50,"vyska":50},"rezany":{"sirka":49,"vyska":60},"sietotlac":{"sirka":43,"vyska":58},"sublimacia":{"sirka":50,"vyska":60}}'::jsonb;
alter table public.potlac_nastavenia add column if not exists lis_sirka_cm numeric not null default 38;
alter table public.potlac_nastavenia add column if not exists lis_vyska_cm numeric not null default 48;
alter table public.potlac_nastavenia add column if not exists okraj_sirka_cm numeric not null default 8;
alter table public.potlac_nastavenia add column if not exists okraj_vyska_cm numeric not null default 20;
alter table public.potlac_produkty add column if not exists velkostna_tabulka jsonb;
-- velkostna_tabulka: {"M":{"A":polovica hrudi cm,"B":dlzka tela cm}} (pánske/dámske B&C #E190 — hodnoty doplnené 2026-11-08); pozície rukávov upravené v DB.
