-- ============================================================
-- MIGRÁCIA: DTF metráž — inteligentné otáčanie motívu pri vyskladaní
-- Pri móde "auto" appka teraz skúša OBE orientácie motívu (tak ako zadal zákazník, aj otočenú
-- o 90°) a vyberie tú, ktorá vyjde na kratšiu (lacnejšiu) metráž. `sirka_cm`/`vyska_cm` v tabuľke
-- odteraz ukladajú EFEKTÍVNE (produkčné) rozmery — ak appka motív otočila, sú tu už prehodené.
-- Nový stĺpec `otoceny` hovorí výrobe jednoznačne, či sa má motív na vyskladanie fyzicky otočiť.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table dtf_objednavky add column if not exists otoceny boolean not null default false;
