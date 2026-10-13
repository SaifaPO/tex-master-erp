-- ============================================================
-- MIGRÁCIA: Čelenky — veľkosti × materiál (6 variantov) + fotky materiálov; Buffky — fotky materiálov a nákupná cena čistej buffky z Produktov
-- Čelenky: 2 materiály (hladký "smooth", počesaný "combed") a 3 veľkosti, rozmer strihu závisí od materiálu:
--   Dospelý štandard: combed 51×9 cm, smooth 48×9 cm
--   Dospelý vysoká:   combed 51×10 cm, smooth 48×10 cm
--   Detská štandard:  combed 48×7 cm,  smooth 45×7 cm
-- Nákupná cena každého variantu sa vyberie z Produktov (zakladna_cena) — ak variant nemá produkt, použije sa pôvodný
-- jednotný náklad čelenky (celenky_naklady_verejny), takže nič sa nerozbije.
-- Fotky materiálov sa nahrávajú v admine (PrintStudio → Čelenky / Buffky) do verejného bucketu "grafiky".
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ---------- ČELENKY: materiály ----------
create table if not exists celenky_materialy (
    kod text primary key,
    nazov text not null,
    popis text,
    foto_url text,
    poradie int not null default 0
);
insert into celenky_materialy (kod, nazov, popis, poradie) values
    ('smooth', 'Hladký (smooth)', 'Hladký, pevnejší úplet — čistý, sýty tlačový povrch.', 1),
    ('combed', 'Počesaný (combed)', 'Mäkký, jemne počesaný úplet — hrejivejší a príjemnejší na dotyk.', 2)
on conflict (kod) do nothing;

-- ---------- ČELENKY: varianty (veľkosť × materiál) ----------
create table if not exists celenky_varianty (
    velkost_kod text not null,
    velkost_nazov text not null,
    material_kod text not null references celenky_materialy(kod) on delete cascade,
    sirka_cm numeric(5,1) not null,
    vyska_cm numeric(5,1) not null,
    produkt_id bigint references produkty(id) on delete set null,
    poradie int not null default 0,
    primary key (velkost_kod, material_kod)
);
insert into celenky_varianty (velkost_kod, velkost_nazov, material_kod, sirka_cm, vyska_cm, poradie) values
    ('adult_standard', 'Dospelý — štandard', 'combed', 51, 9, 1),
    ('adult_standard', 'Dospelý — štandard', 'smooth', 48, 9, 1),
    ('adult_high',     'Dospelý — vysoká',   'combed', 51, 10, 2),
    ('adult_high',     'Dospelý — vysoká',   'smooth', 48, 10, 2),
    ('kids_standard',  'Detská — štandard',  'combed', 48, 7, 3),
    ('kids_standard',  'Detská — štandard',  'smooth', 45, 7, 3)
on conflict (velkost_kod, material_kod) do nothing;

-- Verejný pohľad: zákazník/Edge Function vidia len náklad (cez view s právami vlastníka), nie jednotlivé nákupné ceny produktov.
create or replace view celenky_varianty_verejny as
select v.velkost_kod, v.velkost_nazov, v.material_kod, v.sirka_cm, v.vyska_cm, v.poradie,
       coalesce(p.zakladna_cena, (select naklad_ks from celenky_naklady_verejny limit 1), 0) as naklad_ks
from celenky_varianty v
left join produkty p on p.id = v.produkt_id;
grant select on celenky_varianty_verejny to anon, authenticated;

alter table celenky_materialy enable row level security;
drop policy if exists "verejne citanie celenky materialov" on celenky_materialy;
create policy "verejne citanie celenky materialov" on celenky_materialy for select using (true);
drop policy if exists "admin plny pristup celenky materialy" on celenky_materialy;
create policy "admin plny pristup celenky materialy" on celenky_materialy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table celenky_varianty enable row level security;
drop policy if exists "admin plny pristup celenky varianty" on celenky_varianty;
create policy "admin plny pristup celenky varianty" on celenky_varianty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- ČELENKY: objednávky zapamätajú variant ----------
alter table celenky_objednavky add column if not exists velkost text;
alter table celenky_objednavky add column if not exists material text;
alter table celenky_objednavky add column if not exists sirka_cm numeric(5,1);
alter table celenky_objednavky add column if not exists vyska_cm numeric(5,1);

-- ---------- BUFFKY: fotky materiálov ----------
alter table buffky_premium_materialy add column if not exists foto_url text;
alter table buffky_nastavenia add column if not exists foto_basic_url text;

create or replace view buffky_premium_materialy_verejny as
select m.kod, m.nazov, m.popis, coalesce(p.zakladna_cena, 0) as naklad_material_ks, m.poradie, m.foto_url
from buffky_premium_materialy m
left join produkty p on p.id = m.produkt_id
where m.aktivny = true
order by m.poradie;
grant select on buffky_premium_materialy_verejny to anon, authenticated;

-- ---------- BUFFKY: nákupná cena čistej (nepotlačenej) buffky z Produktov ----------
-- Predtým sa brala len ručne zadaná suma (predvolené 0,50 €), ktorá sa nemusela zhodovať s reálnou nákupnou cenou.
alter table buffky_naklady add column if not exists produkt_id bigint references produkty(id) on delete set null;

create or replace view buffky_naklady_verejny as
select
  round((coalesce(p.zakladna_cena, b.cena_buffka_ks) + coalesce(t.naklad_bm, 0) / 5)::numeric, 2) as naklad_ks,
  round((coalesce(t.naklad_bm, 0) / 5)::numeric, 2) as naklad_potlac_ks,
  round(coalesce(b.cena_sitia_bok_ks, 0)::numeric, 2) as cena_sitia_bok_ks
from buffky_naklady b
left join produkty p on p.id = b.produkt_id
left join textil_naklady_verejny t on t.technologia = 'sublimacia'
where b.id = 1;
grant select on buffky_naklady_verejny to anon, authenticated;
