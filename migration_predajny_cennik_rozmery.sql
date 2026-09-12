-- Predajný cenník: pridanie orientačného rozmeru (šírka × výška v cm) ku každej položke,
-- aby zákazník na predajni videl čo znamená napr. "A4" alebo "malé logo" — a možnosť
-- dopočítať výrobnú cenu orientačne z aktuálnej DTF sadzby (Cenník potlače) podľa plochy.

alter table predajny_cennik_polozky add column if not exists sirka_cm numeric(6,1);
alter table predajny_cennik_polozky add column if not exists vyska_cm numeric(6,1);

-- Orientačné rozmery pre existujúce štartovacie položky (podľa bežných formátov).
update predajny_cennik_polozky set sirka_cm = 21, vyska_cm = 29.7 where nazov = 'Plnofarebná potlač A4' and sirka_cm is null;
update predajny_cennik_polozky set sirka_cm = 14.8, vyska_cm = 21 where nazov = 'Plnofarebná potlač A5' and sirka_cm is null;
update predajny_cennik_polozky set sirka_cm = 29.7, vyska_cm = 42 where nazov = 'Plnofarebná potlač A3' and sirka_cm is null;
