-- ============================================================
-- B2B DOPYTY e-mailom: agentúra po zadaní B2B kódu klikne "Vyžiadať ponuku e-mailom" — otvorí sa jej e-mailový klient
-- s predvyplneným textom (výber, množstvo, orientačná cena, číslo dopytu). Návrh (tlačový súbor) sa zároveň uloží na server
-- pod číslom DOPYT-XXXXXXXX. V ERP potom stačí prilepiť text e-mailu do "AI zadanie zákazky" a zákazka sa načíta jedným klikom
-- (bez AI, presne podľa čísla dopytu) — aj s grafikou a termínom, ktorý zákazník dopísal.
-- Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists b2b_dopyty (
    id uuid primary key default gen_random_uuid(),
    kod text not null unique,                 -- 8 hex znakov, napr. 'A1B2C3D4' (v e-maile ako DOPYT-A1B2C3D4)
    created_at timestamptz not null default now(),
    produkt_typ text not null,                -- celenka | buffka | ...
    produkt_nazov text not null,
    popis_varianty text,
    pocet_ks int not null default 1,
    cena_kus_bez_dph numeric(10,2),
    cena_spolu_bez_dph numeric(10,2),
    expres boolean not null default false,
    osobny_odber boolean not null default false,
    b2b_kod text,
    agentura text,
    subor_cesta text,                         -- tlačový súbor v Storage (print-designs), len pre admina
    dizajn_json jsonb,
    stav text not null default 'novy' check (stav in ('novy', 'importovany', 'zrusene')),
    importovane_at timestamptz
);

alter table b2b_dopyty enable row level security;
drop policy if exists "verejne vytvorenie b2b dopytu" on b2b_dopyty;
create policy "verejne vytvorenie b2b dopytu" on b2b_dopyty for insert with check (true);
drop policy if exists "admin plny pristup b2b dopyty" on b2b_dopyty;
create policy "admin plny pristup b2b dopyty" on b2b_dopyty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Na ktorý e-mail majú chodiť dopyty (nastaví sa v ERP: PrintStudio → B2B kódy). Predvolená adresa je FIKTÍVNA.
create table if not exists b2b_dopyt_nastavenia (
    id int primary key default 1,
    email text not null default 'objednavky@example.sk',
    constraint b2b_dopyt_nastavenia_jedna check (id = 1)
);
insert into b2b_dopyt_nastavenia (id) values (1) on conflict (id) do nothing;
alter table b2b_dopyt_nastavenia enable row level security;
drop policy if exists "verejne citanie b2b dopyt nastavenia" on b2b_dopyt_nastavenia;
create policy "verejne citanie b2b dopyt nastavenia" on b2b_dopyt_nastavenia for select using (true);
drop policy if exists "admin plny pristup b2b dopyt nastavenia" on b2b_dopyt_nastavenia;
create policy "admin plny pristup b2b dopyt nastavenia" on b2b_dopyt_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
