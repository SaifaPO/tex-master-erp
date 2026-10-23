-- ============================================================
-- Laser: spotreba metráže z hotfoldera (DXF súbory na rezanie)
-- Lokálny agent na PC v sieti prezerá hotfolder, z každého nového DXF prečíta rozmer a pošle ho do funkcie laser-spotreba-ingest.
-- Funkcia z názvu súboru rozparsuje zákazku, farbu, materiál, strih, veľkosť a počet kusov a uloží riadok do laser_spotreba.
-- Denný súhrn e-mailom posiela funkcia laser-spotreba-sumar (pg_cron každý večer). Bezpečné spustiť opakovane.
-- ============================================================

-- Nastavenia (jeden riadok)
create table if not exists laser_spotreba_nastavenia (
    id int primary key default 1,
    agent_token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
    max_sirka_cm numeric(8,1) not null default 160,         -- najširšia metráž; širší strih sa označí "nezmestí sa"
    nasobit_poctom boolean not null default true,           -- spotreba = dĺžka rozloženia × počet kusov z názvu (napr. "3X")
    osa_dlzky text not null default 'dlhsia',               -- dlhsia | x | y — ktorá strana rozloženia je dĺžka v smere rolky
    prijemcovia text[] not null default '{}',               -- e-mailové adresy pre denný súhrn
    sumar_zapnuty boolean not null default false,
    cas_sumaru int not null default 18,                     -- hodina (slovenský čas), kedy sa súhrn posiela
    odosielatel_meno text,
    odosielatel_email text,                                 -- prázdne = použije sa odosielateľ z upomienok (Resend)
    posledny_ping timestamptz,                              -- kedy sa naposledy ozval agent
    agent_info text,
    posledny_sumar_datum date,
    constraint jediny_riadok_laser_spotreba check (id = 1)
);
insert into laser_spotreba_nastavenia (id) values (1) on conflict (id) do nothing;
alter table laser_spotreba_nastavenia enable row level security;
drop policy if exists "admin plny pristup laser spotreba nastavenia" on laser_spotreba_nastavenia;
create policy "admin plny pristup laser spotreba nastavenia" on laser_spotreba_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Slovník farieb a materiálov pre rozpoznanie názvu súboru (dá sa dopĺňať v ERP)
create table if not exists laser_slovnik (
    id bigserial primary key,
    typ text not null check (typ in ('farba', 'material')),
    hodnota text not null,
    unique (typ, hodnota)
);
alter table laser_slovnik enable row level security;
drop policy if exists "admin plny pristup laser slovnik" on laser_slovnik;
create policy "admin plny pristup laser slovnik" on laser_slovnik for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
insert into laser_slovnik (typ, hodnota) values
    ('farba', 'čierna'), ('farba', 'čierne'), ('farba', 'cierne'), ('farba', 'black'), ('farba', 'navy'), ('farba', 'biela'), ('farba', 'biele'),
    ('farba', 'sivá'), ('farba', 'siva'), ('farba', 'šedá'), ('farba', 'melír'), ('farba', 'antracit'), ('farba', 'modrá'), ('farba', 'royal'),
    ('farba', 'červená'), ('farba', 'zelená'), ('farba', 'khaki'), ('farba', 'béžová'), ('farba', 'bordó'), ('farba', 'ružová'), ('farba', 'žltá'), ('farba', 'oranžová'),
    ('material', 'garzato'), ('material', 'kimi 200 darapana'), ('material', 'teplákovina'), ('material', 'softshell'), ('material', 'interlock'), ('material', 'fleece')
on conflict (typ, hodnota) do nothing;

-- Riadky spotreby (jeden DXF súbor = jeden riadok)
create table if not exists laser_spotreba (
    id bigserial primary key,
    datum date not null,                                    -- deň (slovenský čas) zmeny súboru = deň rezania
    subor_nazov text not null,
    subor_cesta text not null,
    obsah_hash text not null,
    velkost_bajtov bigint,
    zmena_ts timestamptz,
    zakazka text,
    zakaznik text,
    material text,
    farba text,
    strih text,
    velkost text,                                           -- veľkosť oblečenia z názvu (M, L, 2XL, M+5 cm …)
    pocet_ks int,                                           -- počet kusov z názvu ("3X" = 3)
    dlzka_cm numeric(10,2),                                 -- dĺžka jednej sady v smere rolky
    sirka_cm numeric(10,2),                                 -- šírka rozloženia (kontrola na šírku metráže)
    dielov int,
    dlzka_rezu_cm numeric(12,2),                            -- celková dĺžka rezu laserom (pre čas rezania)
    stav text not null default 'ok',                        -- ok | chyba_v_nazve | nezmesti_sa | chyba_suboru
    poznamka text,
    ignorovat boolean not null default false,
    created_at timestamptz not null default now(),
    unique (subor_cesta, obsah_hash)
);
create index if not exists laser_spotreba_datum_idx on laser_spotreba (datum);
create index if not exists laser_spotreba_zakazka_idx on laser_spotreba (zakazka);
alter table laser_spotreba enable row level security;
drop policy if exists "admin plny pristup laser spotreba" on laser_spotreba;
create policy "admin plny pristup laser spotreba" on laser_spotreba for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
