-- "Kostra cien" — zjednotenie výrobných nákladov naprieč technológiami do jednej karty.
-- Čisto prídavné zmeny (ADD COLUMN / CREATE TABLE) — žiadne mazanie ani presun dát, existujúce
-- čísla v Cenníku potlače / DTF metráži / Textilnej metráži ostávajú bezo zmeny. Mení sa len to,
-- KTORÁ admin karta má editovateľné UI pre ktoré stĺpce (viď KostraCienTab.jsx / PotlaceTab.jsx).

-- Sublimácia — potlač na tričká (garment variant): nové vstupy ochranný papier a riziko zničenia kusu.
alter table cennik_sublimacia_naklady add column if not exists naklady_ochranny_papier numeric(10,2) not null default 0;
alter table cennik_sublimacia_naklady add column if not exists koeficient_rizika_percent numeric(5,2) not null default 0;

-- Rezaný transfer — čas rezania a vyľupovania (predtým sa počítal len čas nažehlovania).
alter table cennik_rezany_transfer add column if not exists cas_rezania_min numeric(10,2) not null default 0;
alter table cennik_rezany_transfer add column if not exists cas_vylupovania_min numeric(10,2) not null default 0;

-- Fólie — pridaný surový náklad materiálu na typ, zadávaný ako €/bežný meter (Martinovi pohodlnejšie
-- ako €/cm²) — prepočet na €/cm² sa robí cez efektívnu šírku fólie (cennik_rezany_transfer.sirka_vyuzitelna_cm,
-- už existuje, len sa znovu zapája). cena_cm2 ostáva predajná sadzba, nezmenené.
alter table cennik_folie add column if not exists naklad_bm numeric(10,2) not null default 0;

-- Sieťotlač — sito a čistiace prípravky ako fixná prirážka (dohodnuté s Martinom, nie amortizácia
-- na počet kusov zo sita — jednoduchšie a presnejšie podľa jeho skúsenosti). naklad_sito_zakazka sa
-- pôvodne počítalo raz na zákazku — teraz sa násobí počtom farieb (každá farba = ďalšie sito),
-- názov stĺpca ostáva kvôli kompatibilite, len sa zmenil význam/výpočet v JS.
alter table cennik_sietotlac add column if not exists naklad_sito_zakazka numeric(10,2) not null default 0;
alter table cennik_sietotlac add column if not exists naklad_cistenie_zakazka numeric(10,2) not null default 0;
-- Odporúčaný minimálny počet kusov pre sieťotlač (informačne — sito/nastavenie stroja sa oplatí
-- až od väčšieho odberu, ale menšie zákazky sú možné za vyššiu cenu na kus).
alter table cennik_sietotlac add column if not exists odporucany_min_ks int not null default 30;

-- Výšivka — úplne nová technológia (predtým existovala len ako plochá položka v cenových ponukách).
create table if not exists kostra_vysivka (
    id int primary key default 1,
    cena_digitalizacia numeric(10,2) not null default 0,
    cena_vysivky_cm2 numeric(10,4) not null default 0,
    constraint jediny_riadok_kostra_vysivka check (id = 1)
);
insert into kostra_vysivka (id) values (1) on conflict (id) do nothing;
alter table kostra_vysivka enable row level security;
create policy "admin plny pristup kostra vysivka" on kostra_vysivka for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Uvoľniť cennik_technologie, aby mohla mať aj výšivka predajnú sadzbu (rovnaký mechanizmus
-- "Použiť ako predajnú sadzbu" ako dnes sublimácia/DTF) — samotné ponúknutie výšivky zákazníkovi
-- v Dizajner.jsx konfigurátore je mimo rozsahu tejto zmeny.
alter table cennik_technologie drop constraint if exists cennik_technologie_technologia_check;
alter table cennik_technologie add constraint cennik_technologie_technologia_check check (technologia in ('sublimacia', 'dtf', 'vysivka'));
insert into cennik_technologie (technologia, cena_cm2, min_cena) values ('vysivka', 0, 0) on conflict (technologia) do nothing;

-- Predajný cenník — predtým počítal cenu len ako VC × marža predajne × DPH, čím úplne obchádzal
-- štandardnú maržovú krivku (priceAt/pricing_config) používanú všade inde v PrintStudio Pro. Pri
-- lacných malých položkách (napr. 4×10cm číslo) to dávalo výrazne podhodnotenú cenu. Referenčný
-- počet kusov určuje, pri akom množstve sa má maržová krivka vyhodnotiť (predajňa zvyčajne 1ks).
alter table predajny_cennik_nastavenia add column if not exists referencny_pocet_ks int not null default 1;
