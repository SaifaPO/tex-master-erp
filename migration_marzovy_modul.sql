-- Marzovy cenovy modul — dynamicka cenotvorba podla vyrobnej ceny a poctu kusov.
-- Vzorec (3 kroky, viz specifikacia): marza podla ceny (log krivka) -> degresia podla
-- odberu (mocninova krivka) -> cena = vyrobna cena x (1 + marza/100). Cena sa NIKDY
-- neuklada natvrdo — vzdy sa dopocitava z production_cost + pricing_config.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

-- ---------- KATALOG PRODUKTOV — doplnenie vyrobnej ceny a cenovej skupiny ----------
-- price_group je volny text (nie enum, nie to iste ako "sports" — sports urcuje pre
-- ktore sporty je model pouzitelny pri tvorbe zakazky, price_group len zoskupuje
-- produkty v cenniku, napr. "Futbal", "Hokej", "Doplnky").
alter table products add column if not exists production_cost numeric(10,2);
alter table products add column if not exists price_group text;

-- ---------- KOEFICIENTY CENOTVORBY (jeden konfiguracny riadok) ----------
create table if not exists pricing_config (
    id int primary key default 1,
    coef_a numeric(10,4) not null default 300,
    coef_b numeric(10,4) not null default 54,
    margin_floor numeric(10,4) not null default 30,
    coef_p numeric(10,4) not null default 1.3,
    qty_at_floor int not null default 1000,
    constraint jediny_riadok_pricing_config check (id = 1)
);
insert into pricing_config (id) values (1) on conflict (id) do nothing;
