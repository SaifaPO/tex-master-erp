-- ============================================================
-- MIGRÁCIA: Sublimačná metráž — samostatný modul PrintStudio Pro
-- Predaj POTLAČENÉHO sublimačného transferového papiera na meter (rolka 160 cm) — zákazník si ho
-- sám nažehľuje na hrnčeky, textil a pod. (na rozdiel od Textilnej metráže, kde tlačíme PRIAMO
-- na látku). Postavené rovnako ako DTF metráž (2 režimy: skladanie z loga / hotová rolka).
--
-- Náklad sa VŽDY ťahá živo z existujúcej Kostra cien (textil_naklady, technologia='sublimacia') —
-- LEN cena papiera + cena farby, bez ochranného papiera a bez práce (na rozdiel od Textilnej
-- metráže, ktorá do naklad_bm počíta aj tieto). Žiadna nová tabuľka s nákladmi — nič sa tu
-- ručne nezadáva, len sa to zobrazuje pre kontrolu. Ak sa zmenia ceny papiera/farby v Kostra
-- cien, táto appka to okamžite zohľadní.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create or replace view sublimacna_metraz_naklad_verejny as
select
  round((
    coalesce(cena_papier_bm, 0)
    + (coalesce(cena_atrament_l, 0) * coalesce(spotreba_atrament_ml_m2, 0) / 1000) * 1.60
  )::numeric, 2) as naklad_bm
from textil_naklady
where technologia = 'sublimacia';

grant select on sublimacna_metraz_naklad_verejny to anon, authenticated;

create table if not exists sublimacna_metraz_nastavenia (
    id int primary key default 1,
    cena_doprava numeric(10,2) not null default 4.90,
    priplatok_expres_percent numeric(5,2) not null default 10,
    limit_expres_bm numeric(10,2) not null default 60,
    limit_standard_bm numeric(10,2) not null default 150,
    minimalna_cena_objednavky numeric(10,2) not null default 5.00,
    dph_percent numeric(5,2) not null default 23,
    constraint jediny_riadok_sublimacna_metraz_nastavenia check (id = 1)
);
insert into sublimacna_metraz_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists sublimacna_metraz_objednavky (
    id uuid primary key default gen_random_uuid(),
    rezim text not null check (rezim in ('auto','subor')),
    sirka_cm numeric(10,2),
    vyska_cm numeric(10,2),
    pocet_ks int,
    dlzka_bm numeric(10,2) not null,
    plocha_m2 numeric(10,2),
    cena_hladina text,
    cena_spolu numeric(10,2) not null,
    doprava_rychlost text not null default 'standard' check (doprava_rychlost in ('standard','express')),
    harmonogram text,
    fluo_zlta boolean not null default false,
    fluo_ruzova boolean not null default false,
    subor_nazov text,
    subor_cesta text,
    stav text not null default 'nova' check (stav in ('nova','v_tlaci','odoslana','zrusena')),
    created_at timestamptz default now()
);
create index if not exists idx_sublimacna_metraz_objednavky_stav on sublimacna_metraz_objednavky(stav);

alter table sublimacna_metraz_nastavenia enable row level security;
alter table sublimacna_metraz_objednavky enable row level security;

create policy "verejne citanie sublimacna metraz nastaveni" on sublimacna_metraz_nastavenia for select using (true);
create policy "verejne vytvorenie sublimacna metraz objednavky" on sublimacna_metraz_objednavky for insert with check (true);

create policy "admin plny pristup sublimacna metraz nastavenia" on sublimacna_metraz_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin citanie sublimacna metraz objednaviek" on sublimacna_metraz_objednavky for select using (auth.role() = 'authenticated');
create policy "admin update sublimacna metraz objednaviek" on sublimacna_metraz_objednavky for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete sublimacna metraz objednaviek" on sublimacna_metraz_objednavky for delete using (auth.role() = 'authenticated');
