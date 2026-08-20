-- Funkcia 4: Zvýraznenie zmeny zákazky na sprievodke
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

alter table orders add column if not exists last_modified_at timestamptz;
alter table orders add column if not exists last_modified_note text;
