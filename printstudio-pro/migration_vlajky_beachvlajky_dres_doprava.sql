-- ============================================================
-- MIGRÁCIA: Vlajky, Beachvlajky a Dres 3D — pridanie poštovného (predtým tam
-- nebolo vôbec žiadne) + osobný odber (zadarmo, keď si zákazník príde po tovar sám).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- Zástava (Vlajky) — vlastná tabuľka nastavení
alter table zastava_nastavenia add column if not exists cena_doprava numeric not null default 4.90;

-- Beachvlajky — vlastná tabuľka nastavení (aj keď sa volá "vlajka_", je to ich, nie Zástavy)
alter table vlajka_nastavenia add column if not exists cena_doprava numeric not null default 4.90;

-- Dres 3D — doteraz nemal ŽIADNU globálnu nastavenia tabuľku (len per-produkt farby v
-- produkt_dres_nastavenia) — táto je nová, jeden spoločný riadok pre celý Dres 3D konfigurátor.
create table if not exists dres_nastavenia (
    id int primary key default 1,
    cena_doprava numeric not null default 4.90,
    constraint jediny_riadok_dres_nastavenia check (id = 1)
);
insert into dres_nastavenia (id, cena_doprava) values (1, 4.90) on conflict (id) do nothing;
