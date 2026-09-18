-- ============================================================
-- MIGRÁCIA: Prehľadné čísla objednávok (napr. "DTF-260001") namiesto holého UUID v Shopify
-- Doteraz Shopify poznámka pri objednávke obsahovala len technické UUID ("DTF metráž objednávka
-- 078a733d-..."), z čoho sa nedalo nič vyčítať. Nová tabuľka je jednoduché počítadlo (podľa
-- predpony a roka, resetuje sa každý rok) — Edge Functions z neho vygenerujú číslo v tvare
-- PREDPONA-RRXXXX (napr. DTF-260001, TXT-260001). UUID v `id` stĺpci objednávok ostáva
-- nezmenené (interný kľúč, cesty v úložisku súborov naň odkazujú) — číslo je len na zobrazenie.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists print_objednavky_pocitadla (
    prefix text not null,
    year int not null,
    next_number int not null default 1,
    primary key (prefix, year)
);
alter table print_objednavky_pocitadla enable row level security;
-- Ziadna policy = pristup len cez service role (Edge Functions) — nikto ine to nepotrebuje citat/menit.

alter table dtf_objednavky add column if not exists cislo_objednavky text;
alter table textil_objednavky add column if not exists cislo_objednavky text;

-- Podpisany odkaz na stiahnutie nahrateho suboru, ulozeny rovno pri objednavke — aby sa dal
-- zobrazit aj priamo v admin fronte v ERP (Prehlad -> DTF/Textilna metraz), nielen v Shopify note.
alter table dtf_objednavky add column if not exists subor_url text;
alter table textil_objednavky add column if not exists subor_url text;
