-- ============================================================
-- MIGRÁCIA: Buffky — druhý typ "Premium" (bočný šev, 2 materiály na výber)
-- Doteraz existoval len jeden typ (teraz premenovaný na "Tubular Basic" — bez švov,
-- bez obšívania, potlač na bezšvovú tubulárnu pletenú látku, grafika v 2 paneloch A/B).
-- Nový typ "Premium": jeden bočný šev (zošité ako rukáv trička), horný aj spodný okraj
-- obšitý/zahnutý dovnútra (2cm lem, tam sa nesmie tlačiť grafika), grafika JEDEN obrázok
-- 50x50cm (nie 2 samostatné strany), výber z 2 materiálov (cotton touch polyester / microfleece).
-- Materiály su linknute na Produkty (zakladna_cena = nakupna cena za ks), rovnaky princip ako
-- Celenky (migration_celenky_naklad_prerobenie.sql).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- Tento subor je SAMOSTATNY a zahrna aj obsah migration_buffky_naklad_prerobenie.sql (nakup
-- cistej buffky flat cena_buffka_ks + potlac z Kostra cien) — ak si tamtu migraciu uz spustil,
-- nizsie prikazy su bezpecne re-run (idempotentne); ak nie, sposobi rovnaky vysledok v jednom kroku.
alter table buffky_naklady add column if not exists cena_buffka_ks numeric(10,2) not null default 0.50;
-- Cena prišitia bočného švu (len Premium, Tubular Basic ho nemá — bez švov).
alter table buffky_naklady add column if not exists cena_sitia_bok_ks numeric(10,2) not null default 0.90;

-- ---------- MATERIÁLY PRE PREMIUM (linknuté na Produkty — zakladna_cena = nákupná cena/ks) ----------
create table if not exists buffky_premium_materialy (
    kod text primary key,
    nazov text not null,
    popis text,
    produkt_id bigint references produkty(id) on delete set null,
    aktivny boolean not null default true,
    poradie int not null default 0
);
insert into buffky_premium_materialy (kod, nazov, popis, poradie)
select * from (values
    ('cotton_touch_polyester', 'Cotton Touch Polyester', 'Jemný, priedušný, príjemný na dotyk ako bavlna — ľahká šatka na celoročné nosenie.', 1),
    ('microfleece', 'Microfleece', 'Hrejivejší, mierne plyšový povrch — vhodné na chladnejšie počasie a zimné aktivity.', 2)
) as v(kod, nazov, popis, poradie)
where not exists (select 1 from buffky_premium_materialy);

create or replace view buffky_premium_materialy_verejny as
select m.kod, m.nazov, m.popis, coalesce(p.zakladna_cena, 0) as naklad_material_ks, m.poradie
from buffky_premium_materialy m
left join produkty p on p.id = m.produkt_id
where m.aktivny = true
order by m.poradie;

grant select on buffky_premium_materialy_verejny to anon, authenticated;

-- ---------- ROZŠÍRENÝ VÝPOČET NÁKLADU — pridané zložky pre Premium (naklad_ks pre Basic ostáva) ----------
create or replace view buffky_naklady_verejny as
select
  round((b.cena_buffka_ks + coalesce(t.naklad_bm, 0) / 5)::numeric, 2) as naklad_ks,
  round((coalesce(t.naklad_bm, 0) / 5)::numeric, 2) as naklad_potlac_ks,
  round(coalesce(b.cena_sitia_bok_ks, 0)::numeric, 2) as cena_sitia_bok_ks
from buffky_naklady b
left join textil_naklady_verejny t on t.technologia = 'sublimacia'
where b.id = 1;

grant select on buffky_naklady_verejny to anon, authenticated;

-- ---------- OBJEDNÁVKY — zaznamenať typ a (pri Premium) zvolený materiál ----------
alter table buffky_objednavky add column if not exists typ text not null default 'tubular_basic' check (typ in ('tubular_basic', 'premium'));
alter table buffky_objednavky add column if not exists material_kod text references buffky_premium_materialy(kod);

alter table buffky_premium_materialy enable row level security;
create policy "verejne citanie aktivnych buffky premium materialov" on buffky_premium_materialy for select using (aktivny = true);
create policy "admin plny pristup buffky premium materialy" on buffky_premium_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
