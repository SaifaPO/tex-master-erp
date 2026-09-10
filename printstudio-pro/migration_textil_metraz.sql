-- ============================================================
-- MIGRÁCIA: Textilná Metráž — samostatný modul PrintStudio Pro
-- Predaj potlačenej textilnej metráže na rolke šírka 160 cm, DVE technológie:
--   'sublimacia' — sublimačná potlač (papier + kalander) na polyester/funkčné látky
--   'bavlna'     — digitálna priama pigmentová potlač bavlny (bez papiera)
-- Rovnaky architektonicky vzor ako DTF metraz (migration_dtf_metraz.sql + neskorsi
-- migration_dtf_marza_zdielana.sql) — cena sa VZDY pocita zo zdielaneho marzoveho
-- vzorca (pricing_config/priceAt), NIE samostatnou tabulkou cenovych hladin. Surove
-- vyrobne naklady su admin-only, verejne (anon) sa vidi len derivovane cislo €/bm
-- cez textil_naklady_verejny pohlad — rovnaky princip ako dtf_naklady_verejny/
-- zastava_materialy_verejny.
-- Spustit v Supabase SQL editore. Predpoklada, ze bucket Storage 'print-designs'
-- uz existuje (vytvoreny skorsou migraciou) — subory idu do podpriecinka
-- textil/<objednavka_id>/... v tom istom bucketi.
-- ============================================================

-- ---------- VÝROBNÉ NÁKLADY (interné, jeden riadok na technológiu) ----------
create table if not exists textil_naklady (
    technologia text primary key check (technologia in ('sublimacia', 'bavlna')),
    cena_papier_bm numeric(10,2),              -- sublimacny transferovy papier (len sublimacia)
    cena_ochranny_papier_bm numeric(10,2),      -- ochranny kalandrovaci papier (len sublimacia)
    cena_primer_l numeric(10,2),                -- preduprava/penetracia bavlny (len bavlna)
    spotreba_primer_ml_m2 numeric(10,4),        -- ml/m2 (len bavlna)
    cena_atrament_l numeric(10,2) not null default 0,       -- sublimacny CMYK alebo pigmentovy atrament €/l
    spotreba_atrament_ml_m2 numeric(10,4) not null default 0,
    cena_prace_hod numeric(10,2) not null default 0,        -- operator + kalander/susiaci tunel €/hod
    rychlost_m_hod numeric(10,2) not null default 1         -- rychlost tlace+fixacie bm/hod
);

-- ---------- NASTAVENIA — Shopify prepojenie, doprava, expres, kapacita per technologia ----------
-- Rovnaky "jednotkovy variant" trik ako DTF metraz (bezny Shopify nedovoli menit cenu
-- polozky za behu) — jeden Shopify produkt/variant s malou cenou (napr. 0,05 €), do
-- kosika sa prida taky pocet kusov, aby sucet dal presnu vypocitanu cenu objednavky.
create table if not exists textil_nastavenia (
    id int primary key default 1,
    shopify_variant_id text,
    jednotka_cena_eur numeric(10,4) not null default 0.05,
    cena_doprava numeric(10,2) not null default 4.90,
    priplatok_expres_percent numeric(5,2) not null default 10,
    minimalna_cena_objednavky numeric(10,2) not null default 8.00,
    limit_expres_bm_sublimacia numeric(10,2) not null default 60,
    limit_standard_bm_sublimacia numeric(10,2) not null default 150,
    limit_expres_bm_bavlna numeric(10,2) not null default 35,
    limit_standard_bm_bavlna numeric(10,2) not null default 80,
    constraint jediny_riadok_textil_nastavenia check (id = 1)
);

-- ---------- OBJEDNÁVKY ----------
create table if not exists textil_objednavky (
    id uuid primary key default gen_random_uuid(),
    shopify_order_id text,
    technologia text not null check (technologia in ('sublimacia', 'bavlna')),
    rezim text not null check (rezim in ('auto', 'subor')),
    raster_typ text check (raster_typ in ('grid', 'half-drop', 'stack')),
    sirka_cm numeric(10,2),
    vyska_cm numeric(10,2),
    dlzka_bm numeric(10,2) not null,
    plocha_m2 numeric(10,2),
    cena_hladina text,
    cena_spolu numeric(10,2) not null,
    doprava_rychlost text not null check (doprava_rychlost in ('standard', 'express')),
    harmonogram text,
    subor_nazov text,
    subor_cesta text,
    stav text not null default 'nova' check (stav in ('nova', 'v_tlaci', 'odoslana', 'zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_textil_objednavky_stav on textil_objednavky(stav);
create index if not exists idx_textil_objednavky_shopify on textil_objednavky(shopify_order_id);

-- ---------- DEFAULTNÉ DÁTA (zodpovedajú referenčnému HTML prototypu) ----------
insert into textil_naklady (technologia, cena_papier_bm, cena_ochranny_papier_bm, cena_primer_l, spotreba_primer_ml_m2, cena_atrament_l, spotreba_atrament_ml_m2, cena_prace_hod, rychlost_m_hod)
select * from (values
    ('sublimacia', 0.95, 0.30, null::numeric, null::numeric, 38.00, 12, 18.00, 15),
    ('bavlna', null::numeric, null::numeric, 22.00, 25, 65.00, 18, 20.00, 8)
) as v(technologia, cena_papier_bm, cena_ochranny_papier_bm, cena_primer_l, spotreba_primer_ml_m2, cena_atrament_l, spotreba_atrament_ml_m2, cena_prace_hod, rychlost_m_hod)
where not exists (select 1 from textil_naklady);

insert into textil_nastavenia (id) values (1) on conflict (id) do nothing;

-- ---------- VEREJNÝ POHĽAD — LEN derivovaný naklad €/bm, nikdy surove vstupy ----------
create or replace view textil_naklady_verejny as
select
  technologia,
  round(
    (case
      when technologia = 'sublimacia' then
        coalesce(cena_papier_bm, 0) + coalesce(cena_ochranny_papier_bm, 0)
        + (cena_atrament_l * spotreba_atrament_ml_m2 / 1000) * 1.60
        + (cena_prace_hod / nullif(rychlost_m_hod, 0))
      when technologia = 'bavlna' then
        (coalesce(cena_primer_l, 0) * coalesce(spotreba_primer_ml_m2, 0) / 1000) * 1.60
        + (cena_atrament_l * spotreba_atrament_ml_m2 / 1000) * 1.60
        + (cena_prace_hod / nullif(rychlost_m_hod, 0))
      else 0
    end)::numeric
  , 2) as naklad_bm
from textil_naklady;

grant select on textil_naklady_verejny to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table textil_naklady enable row level security;
alter table textil_nastavenia enable row level security;
alter table textil_objednavky enable row level security;

-- Verejné čítanie nastavení potrebných pre výpočet ceny/kapacity v konfigurátore
create policy "verejne citanie textil nastaveni" on textil_nastavenia for select using (true);
-- textil_naklady (výrobné náklady) zámerne NIE je verejné — len admin (interná marža),
-- zákaznícky konfigurátor číta iba textil_naklady_verejny (view vyššie).

-- Zákazník môže vytvoriť objednávku (nie čítať cudzie objednávky)
create policy "verejne vytvorenie textil objednavky" on textil_objednavky for insert with check (true);

-- Admin (prihlásený) plný prístup
create policy "admin plny pristup textil naklady" on textil_naklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin plny pristup textil nastavenia" on textil_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie textil objednaviek" on textil_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update textil objednaviek" on textil_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
