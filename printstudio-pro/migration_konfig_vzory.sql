-- ============================================================
-- SPRAVA VZOROV A GRAFIKY v konfiguratoroch Celenky a Buffky
-- 1) konfig_vstavane_vzory: zoznam vstavanych vzorov (10 pri celenkach, 10 pri buffkach) — dajú sa vypnut / premenovat.
-- 2) konfig_vzory: vlastne vzory pozadia (obrazok), ktore admin nahra a zakaznik ich vidi vedla vstavanych.
-- Vlozitelne loga a grafiky (kniznica) uz existuju v tabulke "grafiky" (ERP -> PrintStudio -> Grafiky).
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists konfig_vstavane_vzory (
    produkt_typ text not null check (produkt_typ in ('celenka', 'buffka')),
    kluc text not null,
    nazov text not null,
    aktivny boolean not null default true,
    poradie int not null default 0,
    primary key (produkt_typ, kluc)
);
insert into konfig_vstavane_vzory (produkt_typ, kluc, nazov, poradie) values
    ('celenka', 'template-1', 'Neon Limits — Push Your Limits', 1),
    ('celenka', 'template-2', 'Alpine Peaks — Mountains Calling', 2),
    ('celenka', 'template-3', 'Cyber Run — Run More', 3),
    ('celenka', 'template-4', 'Topo Trail — Explore Train Repeat', 4),
    ('celenka', 'template-5', 'Mono Shards — Stronger Everyday', 5),
    ('celenka', 'template-6', 'Tropical Flora — Good Energy', 6),
    ('celenka', 'template-7', 'Glitch Speed — Faster Higher', 7),
    ('celenka', 'template-8', 'Aero Waves — Run Bike Hike', 8),
    ('celenka', 'template-9', 'Liquid Marble — Limitless', 9),
    ('celenka', 'template-10', 'Red Crystal — Never Give Up', 10),
    ('buffka', 'mountain', 'Hory', 1),
    ('buffka', 'camo', 'Camo', 2),
    ('buffka', 'geo', 'Geometria', 3),
    ('buffka', 'gradient', 'Gradient', 4),
    ('buffka', 'topomap', 'Topo mapa', 5),
    ('buffka', 'cyber_hex', 'Hex honeycomb', 6),
    ('buffka', 'splash', 'Paint splash', 7),
    ('buffka', 'speed_stripes', 'Speed racing', 8),
    ('buffka', 'nordic_tri', 'Nordic frost', 9),
    ('buffka', 'lava_smoke', 'Láva a dym', 10)
on conflict (produkt_typ, kluc) do nothing;

create table if not exists konfig_vzory (
    id bigint generated always as identity primary key,
    produkt_typ text not null check (produkt_typ in ('celenka', 'buffka')),
    nazov text not null,
    url text not null,                       -- obrazok pozadia (PNG/JPG), cely strih
    poradie int not null default 0,
    aktivny boolean not null default true,
    created_at timestamptz not null default now()
);

alter table konfig_vstavane_vzory enable row level security;
drop policy if exists "verejne citanie konfig vstavane vzory" on konfig_vstavane_vzory;
create policy "verejne citanie konfig vstavane vzory" on konfig_vstavane_vzory for select using (true);
drop policy if exists "admin plny pristup konfig vstavane vzory" on konfig_vstavane_vzory;
create policy "admin plny pristup konfig vstavane vzory" on konfig_vstavane_vzory for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table konfig_vzory enable row level security;
drop policy if exists "verejne citanie aktivnych konfig vzorov" on konfig_vzory;
create policy "verejne citanie aktivnych konfig vzorov" on konfig_vzory for select using (aktivny = true);
drop policy if exists "admin plny pristup konfig vzory" on konfig_vzory;
create policy "admin plny pristup konfig vzory" on konfig_vzory for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
