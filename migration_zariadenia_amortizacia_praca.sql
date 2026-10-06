-- ============================================================
-- Zariadenia (Prehlady -> Vseobecna tabulka nakladov): amortizacia stroja a praca obsluhy v €/hod.
-- Sadzba zariadenia (napr. laser v Katalogu produktov) = (elektrina + amortizacia + praca) na hodinu / vykon za hodinu.
-- Prazdne = 0. Bezpecne spustit opakovane.
-- ============================================================

alter table cost_metrics add column if not exists amortizacia_hod numeric(10,2);
alter table cost_metrics add column if not exists praca_hod numeric(10,2);
