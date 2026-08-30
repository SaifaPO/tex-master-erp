-- PAY by square s variabilnym symbolom priradenym zakazke uz pri vytvoreni (pred vystavenim faktury).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table orders add column if not exists variable_symbol text;
alter table orders add column if not exists expected_amount numeric;
-- VS/suma existuju na zakazke priebezne, ale QR sa zakaznikovi realne ponukne a parovanie platieb ho
-- berie do uvahy az po vedomom potvrdeni (napr. ked je zakazka dokoncena alebo dana na uhradu) —
-- aby zmena/zrusenie zakazky pred potvrdenim nespravilo zmatok so sumou, ktoru uz zakaznik videl.
alter table orders add column if not exists variable_symbol_confirmed boolean not null default false;
alter table bank_transactions add column if not exists order_id text;

-- Doplnenie VS pre uz existujuce zakazky, ktore ho este nemaju (rovnaky sposob odvodenia ako pri fakturach).
update orders set variable_symbol = right(regexp_replace(id, '[^0-9]', '', 'g'), 10)
where variable_symbol is null or variable_symbol = '';
