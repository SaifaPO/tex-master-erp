-- DTF metráž: voliteľné dodanie NASTRIHANÝCH transferov (jednotlivé motívy vystrihnuté z rolky).
-- Cena = dĺžka rolky (bm) × minút na 1 bm × sadzba strihača × (1 + marža). Minúty na 1 bm závisia od veľkosti motívov (malé logá trvajú dlhšie). Bezpečné spustiť opakovane.
alter table dtf_nastavenia add column if not exists strihanie_zapnute boolean not null default true;
alter table dtf_nastavenia add column if not exists strihanie_hod numeric(10,2) not null default 7;               -- €/hod strihača
alter table dtf_nastavenia add column if not exists strihanie_min_bm_male numeric(8,2) not null default 10;        -- minút na 1 bm: malé motívy (do 10 cm)
alter table dtf_nastavenia add column if not exists strihanie_min_bm_velke numeric(8,2) not null default 5;        -- minút na 1 bm: veľké motívy (od 30 cm)
alter table dtf_nastavenia add column if not exists strihanie_marza_percent numeric(6,1) not null default 100;     -- marža na náklad nastrihania (%)
alter table dtf_objednavky add column if not exists nastrihane boolean not null default false;
alter table dtf_objednavky add column if not exists nastrihanie_eur numeric(10,2);
