-- ============================================================
-- ZÁSTAVY (stožiarové/uličné vlajky s vlastným dizajnom) — samostatný modul,
-- oddelený od "vlajka_*" tabuliek (tie su v skutocnosti BEACHVLAJKY — pierko/kvapka/
-- cepel/kridlo tvary predavane na plazovy stojan). Tento modul je pre skutocne
-- vlajky na stoziar/budovu/plot: vlastne rozmery v cm, obsitie alebo laser orez,
-- tunely, kovove priechodky (ocka), popruhy, karabinky.
--
-- DOLEZITE (rovnaky princip ako pri DTF metrazi, migration_dtf_marza_zdielana.sql):
-- admin zadava VYROBNE NAKLADY (material, sitie, laser, hardware), nie predajnu cenu.
-- Predajna cena sa dopocitava jednotnym marzovym vzorcom z pricing_config (ten isty,
-- co pouziva Cenotvorba a Cennik potlace). Tieto naklady preto NIKDY nesmu byt citatelne
-- pre anon/zakaznika — vsetok vypocet ceny pre zakaznika bezi cez Edge Function
-- (zastava-price-preview, zastava-create-draft-order), ktora pouziva servisny kluc.
-- Klientovi ide len hotova cena, nie naklady ani marzove koeficienty.
-- Bezpecne spustit opakovane.

-- ---------- MATERIÁLY (vlajkovina) — interné náklady ----------
create table if not exists zastava_materialy (
    id bigint generated always as identity primary key,
    kod text not null unique,
    nazov text not null,
    popis text,
    pouzitie text,
    naklad_m2 numeric(10,2) not null default 0,
    poradie int not null default 0,
    aktivny boolean not null default true
);
insert into zastava_materialy (kod, nazov, popis, pouzitie, naklad_m2, poradie)
select * from (values
    ('flag_std', 'Flag Standard 110g', 'Klasická vlajkovina, 100% polyester, lesklá, presvit farby cca 85%.', 'Stožiarové vlajky, uličné zástavy, interiérové vlajky.', 6.50, 1),
    ('flag_mesh', 'Flag Mesh 110g (Dierkovaná)', 'Odvetraná dierkovaná sieťovina vhodná do veterných oblastí.', 'Stožiare na veterných miestach, výškové budovy.', 7.80, 2),
    ('cordura', 'Cordura Banner 220g (Pevná)', 'Extrémne pevná hrubšia tkanina pre dlhodobé uličné bannery.', 'Uličné bannery medzi stĺpmi, plotové transparenty.', 10.20, 3)
) as v(kod, nazov, popis, pouzitie, naklad_m2, poradie)
where not exists (select 1 from zastava_materialy);

-- Verejný pohľad pre zákaznícky konfigurátor — LEN názov/popis, bez naklad_m2 (view beží
-- s právami vlastníka, takže obchádza RLS na zastava_materialy — rovnaký princíp ako
-- dtf_naklady_verejny).
create or replace view zastava_materialy_verejny as
select kod, nazov, popis, pouzitie, poradie
from zastava_materialy
where aktivny = true
order by poradie;

grant select on zastava_materialy_verejny to anon, authenticated;

-- ---------- NASTAVENIA / NÁKLADOVÉ SADZBY (jeden riadok) — interné, neverejné ----------
create table if not exists zastava_nastavenia (
    id int primary key default 1,
    naklad_sitia_min numeric(10,2) not null default 0.35,
    min_sitia_na_m2 numeric(10,2) not null default 4.0,
    naklad_laser_m2 numeric(10,2) not null default 1.80,
    naklad_tunel_bm numeric(10,2) not null default 1.50,
    naklad_ocko_ks numeric(10,2) not null default 0.25,
    naklad_karabinka_ks numeric(10,2) not null default 0.55,
    naklad_popruh_bm numeric(10,2) not null default 0.80,
    dph_percent numeric(5,2) not null default 23,
    expresny_priplatok_percent numeric(5,2) not null default 10,
    constraint jediny_riadok_zastava_nastavenia check (id = 1)
);
insert into zastava_nastavenia (id) values (1) on conflict (id) do nothing;

-- ---------- OBJEDNÁVKY ----------
create table if not exists zastava_objednavky (
    id uuid primary key default gen_random_uuid(),
    shopify_order_id text,
    shopify_order_number text,
    design_id text,
    sirka_cm numeric(10,2) not null,
    vyska_cm numeric(10,2) not null,
    material_kod text,
    vyhotovenie text check (vyhotovenie in ('obsite','laser')),
    tunely jsonb not null default '[]',
    ocka jsonb not null default '[]',
    karabinky jsonb not null default '[]',
    popruhy jsonb not null default '{}',
    statna_vlajka text,
    farba_hex text,
    farba_poznamka text,
    text_na_vlajke text,
    pocet_ks int not null default 1,
    expresne boolean not null default false,
    cena_kus numeric(10,2),
    cena_spolu numeric(10,2),
    nahlad_url text,
    tlacovy_subor_url text,
    status text not null default 'na_schvalenie' check (status in ('na_schvalenie','schvalene','zamietnute')),
    zakaznik_meno text,
    zakaznik_email text,
    poznamka text,
    raw_shopify_payload jsonb,
    created_at timestamptz default now(),
    schvalene_at timestamptz
);
create index if not exists idx_zastava_objednavky_status on zastava_objednavky(status);
create index if not exists idx_zastava_objednavky_shopify on zastava_objednavky(shopify_order_id);

-- ============================================================
-- ROW LEVEL SECURITY — naklady a nastavenia NIKDY nie su verejne citatelne.
-- ============================================================
alter table zastava_materialy enable row level security;
alter table zastava_nastavenia enable row level security;
alter table zastava_objednavky enable row level security;

drop policy if exists "admin plny pristup zastava materialy" on zastava_materialy;
create policy "admin plny pristup zastava materialy" on zastava_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin plny pristup zastava nastavenia" on zastava_nastavenia;
create policy "admin plny pristup zastava nastavenia" on zastava_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin citanie zastava objednaviek" on zastava_objednavky;
create policy "admin citanie zastava objednaviek" on zastava_objednavky for select using (auth.role() = 'authenticated');
drop policy if exists "admin update zastava objednaviek" on zastava_objednavky;
create policy "admin update zastava objednaviek" on zastava_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Vkladanie riadi len webhook cez servisny kluc (obchadza RLS) — ziadna verejna insert politika.
