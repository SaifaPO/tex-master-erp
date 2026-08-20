-- Funkcia 3: Rozšírenie hlásenia problémov — zodpovednosť a náklady
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

alter table problem_reports add column if not exists fault_employee_id text;
alter table problem_reports add column if not exists fault_employee_name text;
alter table problem_reports add column if not exists cost_amount numeric;
