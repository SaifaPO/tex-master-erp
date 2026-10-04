-- ============================================================
-- Beachvlajky: rezerva na odpad a kazy (%), pripocita sa k spotrebe latky a sublimacie.
-- Spotreby v zalozke Tvary ostavaju cisté, rezerva sa pridava az pri vypocte ceny.
-- Predvolene 3 %. Bezpecne spustit opakovane.
-- ============================================================

alter table vlajka_nastavenia add column if not exists rezerva_odpad_percent numeric not null default 3;
