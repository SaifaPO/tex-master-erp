-- ============================================================
-- MIGRÁCIA: Ponuka dresov pre kluby, školy a agentúry (verejný konfigurátor + dopyty)
-- Verejná stránka: https://printstudio-pro.vercel.app/?typ=ponuka  (bez prihlásenia)
-- Cenník sa spravuje v ERP: PrintStudio → Aplikácie → Ponuka dresov. Cena každej položky = výrobná cena (z produktu v Katalógu produktov
-- alebo ručne) cez maržový modul (Cenotvorba) + DPH; voliteľne sa dá cena prepísať ručne ("predajná cena s DPH"). Výrobné ceny a marže
-- sa zákazníkovi nikdy neposielajú — verejný cenník počíta Edge Function ponuka-dresy.
-- Hodnoty nižšie sú z prototypu: overené sú len ceny z e-shopu (futbalový dres 39,99/44,99, hokejový dres 69,99/99,99/139,99, trenírky 29,99/34,99,
-- hokejové štulpne 29,99/39,99/49,99) — VŠETKO OSTATNÉ JE ODHAD. Bezpečné spustiť opakovane (seed sa nevkladá znova).
-- ============================================================

create table if not exists ponuka_nastavenia (
    id int primary key default 1,
    aktivny boolean not null default true,
    dph_percent numeric(5,2) not null default 23,
    min_marza_percent numeric(6,2) not null default 25,      -- upozornenie v ERP, ak marža po všetkých zľavách klesne pod túto hodnotu
    max_zlava_percent numeric(5,2) not null default 40,      -- strop celkovej zľavy (množstevná + B2B + termín) v % z ceny bez zliav
    email_notifikacie text,                                  -- kam chodí upozornenie na nový dopyt
    updated_at timestamptz not null default now(),
    constraint jediny_riadok_ponuka_nastavenia check (id = 1)
);
insert into ponuka_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists ponuka_sporty (
    kod text primary key,
    nazov text not null,
    poradie int not null default 0,
    rukavy text[] not null default '{kratky,dlhy}',          -- bez | kratky | dlhy
    goliere text[] not null default '{okruhly,v}',           -- okruhly | v | polo | snur
    brankari text not null default 'none' check (brankari in ('none','futbal','hokej')),
    sklad_poznamka text,
    aktivny boolean not null default true
);
insert into ponuka_sporty (kod, nazov, poradie, rukavy, goliere, brankari, sklad_poznamka) values
    ('futbal', 'Futbal', 1, '{kratky,dlhy}', '{okruhly,v,polo}', 'futbal', null),
    ('hokej', 'Hokej', 2, '{dlhy}', '{v,snur}', 'hokej', 'len tréningové dresy'),
    ('hadzana', 'Hádzaná', 3, '{kratky,dlhy}', '{okruhly,v}', 'none', null),
    ('volejbal', 'Volejbal', 4, '{bez,kratky,dlhy}', '{okruhly,v}', 'none', null),
    ('lacrosse', 'Lacrosse', 5, '{bez,kratky}', '{okruhly,v}', 'none', null),
    ('florbal', 'Florbal', 6, '{kratky,dlhy}', '{okruhly,v,polo}', 'none', null),
    ('motokros', 'Motokros', 7, '{dlhy}', '{okruhly}', 'none', null)
on conflict (kod) do nothing;

-- Cenník položiek: šport × položka × režim (custom = celopotlač, stock = sklad + dotlač) × úroveň (0 Základ, 1 Premium, 2 Pro; pri hokejových štulpniach 0 Simple, 1 Pletené, 2 Profesionálne; sklad má úroveň 0)
create table if not exists ponuka_polozky (
    id bigint generated always as identity primary key,
    sport_kod text not null references ponuka_sporty(kod) on delete cascade,
    polozka text not null check (polozka in ('dres','trenirky','stulpne')),
    rezim text not null check (rezim in ('custom','stock')),
    uroven int not null default 0 check (uroven between 0 and 2),
    produkt_id bigint references produkty(id) on delete set null,   -- blank → produkt z Katalógu; výrobná cena = produkty.zakladna_cena
    naklad_eur numeric(10,2),                                       -- ručná výrobná cena (ak nie je produkt)
    predajna_s_dph numeric(10,2),                                   -- ručný prepis predajnej ceny s DPH (má prednosť pred výpočtom z nákladu)
    unique (sport_kod, polozka, rezim, uroven)
);

-- Príplatky a dotlače: kod = 'dotlac.meno' | 'nameNum' | 'fit.slim' | 'sleeve.dlhy' | 'collar.polo' | 'apps.logo3d' | 'gk.cut' ...
create table if not exists ponuka_priplatky (
    kod text primary key,
    skupina text not null,
    nazov text not null,
    poradie int not null default 0,
    produkt_id bigint references produkty(id) on delete set null,
    naklad_eur numeric(10,2),
    predajna_s_dph numeric(10,2)                                    -- príplatok za kus s DPH (môže byť záporný, napr. rukáv "bez")
);

create table if not exists ponuka_zlavy_mnozstvo (
    min_ks int primary key,
    zlava_percent numeric(5,2) not null default 0
);
insert into ponuka_zlavy_mnozstvo (min_ks, zlava_percent) values (1, 0), (10, 5), (30, 10), (60, 15) on conflict (min_ks) do nothing;

create table if not exists ponuka_terminy (
    kod text primary key check (kod in ('slow','std','exp')),
    nazov text not null,
    text_custom text not null,
    text_sklad text not null,
    uprava_percent numeric(5,2) not null default 0,         -- záporné = zľava, kladné = príplatok
    poradie int not null default 0
);
insert into ponuka_terminy (kod, nazov, text_custom, text_sklad, uprava_percent, poradie) values
    ('slow', 'Bez zhonu', '4–6 týždňov', 'do 3 týždňov', -5, 1),
    ('std', 'Štandard', 'do 14 dní', 'do 7 dní', 0, 2),
    ('exp', 'Expres', 'do 7 pracovných dní', 'do 3 pracovných dní', 25, 3)
on conflict (kod) do nothing;

create table if not exists ponuka_velkosti (
    velkost text primary key,
    poradie int not null default 0,
    hrudnik_klasik numeric(5,1), hrudnik_slim numeric(5,1), hrudnik_obtiahnuty numeric(5,1), dlzka numeric(5,1)
);
insert into ponuka_velkosti (velkost, poradie, hrudnik_klasik, hrudnik_slim, hrudnik_obtiahnuty, dlzka) values
    ('128',1,38,37,36,50),('134',2,39,38,37,52),('140',3,41,40,38,55),('146',4,43,42,40,58),('152',5,45,44,42,61),('158',6,47,46,44,64),('164',7,49,48,46,66),
    ('XS',8,48,46,44,68),('S',9,51,49,47,70),('M',10,54,52,50,72),('L',11,57,55,53,74),('XL',12,60,58,56,76),('2XL',13,63,61,59,78),('3XL',14,66,64,62,80)
on conflict (velkost) do nothing;

-- ---------- SEED ceny položiek (predajná cena s DPH z prototypu; výrobné ceny doplní admin) ----------
do $$
declare
    r record;
begin
    -- celopotlač: [Základ, Premium, Pro]
    for r in select * from (values
        ('futbal','dres',39.99,44.99,54.99),('futbal','trenirky',29.99,34.99,39.99),('futbal','stulpne',12.99,15.99,19.99),
        ('hokej','dres',69.99,99.99,139.99),('hokej','stulpne',29.99,39.99,49.99),
        ('hadzana','dres',39.99,44.99,54.99),('hadzana','trenirky',29.99,34.99,39.99),
        ('volejbal','dres',34.99,39.99,49.99),('volejbal','trenirky',29.99,34.99,39.99),
        ('lacrosse','dres',49.99,59.99,69.99),('lacrosse','trenirky',34.99,39.99,44.99),
        ('florbal','dres',39.99,44.99,54.99),('florbal','trenirky',29.99,34.99,39.99),('florbal','stulpne',12.99,15.99,19.99),
        ('motokros','dres',59.99,69.99,89.99)
    ) as t(sport, pol, a, b, c)
    loop
        insert into ponuka_polozky (sport_kod, polozka, rezim, uroven, predajna_s_dph) values
            (r.sport, r.pol, 'custom', 0, r.a), (r.sport, r.pol, 'custom', 1, r.b), (r.sport, r.pol, 'custom', 2, r.c)
        on conflict (sport_kod, polozka, rezim, uroven) do nothing;
    end loop;
    -- sklad + dotlač
    for r in select * from (values
        ('futbal','dres',19.99),('futbal','trenirky',14.99),('futbal','stulpne',7.99),('hokej','dres',29.99),
        ('hadzana','dres',19.99),('hadzana','trenirky',14.99),('volejbal','dres',17.99),('volejbal','trenirky',14.99),
        ('florbal','dres',19.99),('florbal','trenirky',14.99),('florbal','stulpne',7.99)
    ) as t(sport, pol, c)
    loop
        insert into ponuka_polozky (sport_kod, polozka, rezim, uroven, predajna_s_dph) values (r.sport, r.pol, 'stock', 0, r.c)
        on conflict (sport_kod, polozka, rezim, uroven) do nothing;
    end loop;
end $$;

insert into ponuka_priplatky (kod, skupina, nazov, poradie, predajna_s_dph) values
    ('dotlac.meno', 'dotlac', 'Dotlač: meno', 1, 3), ('dotlac.cislo', 'dotlac', 'Dotlač: číslo', 2, 4), ('dotlac.logo', 'dotlac', 'Dotlač: logo klubu', 3, 5),
    ('dotlac.cisloTren', 'dotlac', 'Dotlač: číslo na trenírky', 4, 3), ('nameNum', 'dotlac', 'Meno a číslo (celopotlač)', 5, 6),
    ('fit.klasik', 'strih', 'Strih klasický', 1, 0), ('fit.slim', 'strih', 'Strih slim fit', 2, 0), ('fit.obtiahnuty', 'strih', 'Strih obtiahnutý', 3, 4),
    ('sleeve.bez', 'rukav', 'Rukáv bez rukávov', 1, -5), ('sleeve.kratky', 'rukav', 'Rukáv krátky', 2, 0), ('sleeve.dlhy', 'rukav', 'Rukáv dlhý', 3, 10),
    ('collar.okruhly', 'golier', 'Golier okrúhly', 1, 0), ('collar.v', 'golier', 'Golier V-výstrih', 2, 0), ('collar.polo', 'golier', 'Golier polo s gombíkmi', 3, 5), ('collar.snur', 'golier', 'Golier šnurovací', 4, 8),
    ('apps.logo3d', 'aplikacie', '3D logo', 1, 6), ('apps.flexRefl', 'aplikacie', 'Reflexný flex', 2, 4), ('apps.flexMetal', 'aplikacie', 'Metalický flex', 3, 4), ('apps.flexGlitter', 'aplikacie', 'Glitter flex', 4, 5),
    ('gk.cut', 'brankari', 'Brankársky strih', 1, 5), ('gk.lakte', 'brankari', 'Spevnené lakte molitanom (dres)', 2, 8), ('gk.boky', 'brankari', 'Spevnené boky molitanom (trenírky)', 3, 8)
on conflict (kod) do nothing;

-- ---------- DOPYTY ----------
create table if not exists ponuka_dopyty (
    id uuid primary key default gen_random_uuid(),
    cislo text,                                  -- napr. DOP-260001
    created_at timestamptz not null default now(),
    klub text, kontakt text, email text, telefon text, poznamka text,
    sport text, rezim text, hracov int, brankarov int, kusov int,
    konfig jsonb,                                -- celá konfigurácia (výber zákazníka)
    supiska jsonb,                               -- [{m, c, s, g}] meno, číslo, veľkosť, brankár
    cena_bez_zliav_s_dph numeric(10,2), cena_spolu_s_dph numeric(10,2), cena_spolu_bez_dph numeric(10,2),
    b2b_kod text, agentura text, zlava_b2b_percent numeric(5,2),
    stav text not null default 'novy' check (stav in ('novy','spracovany','ponuka','objednavka','zrusene')),
    erp_zakazka_id text, erp_cislo text,
    ip_hash text
);
create index if not exists ponuka_dopyty_created_idx on ponuka_dopyty (created_at desc);
create index if not exists ponuka_dopyty_ip_idx on ponuka_dopyty (ip_hash, created_at desc);

-- ============================================================
-- RLS: všetko len pre prihláseného admina; verejnosť číta cenník cez Edge Function (servisný kľúč) a dopyty vkladá tiež cez ňu.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['ponuka_nastavenia','ponuka_sporty','ponuka_polozky','ponuka_priplatky','ponuka_zlavy_mnozstvo','ponuka_terminy','ponuka_velkosti','ponuka_dopyty']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin plny pristup %s" on %I', t, t);
    execute format('create policy "admin plny pristup %s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;
