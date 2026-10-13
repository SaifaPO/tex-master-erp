-- ============================================================
-- ODOVZDANIE ZAKAZKY ZAKAZNIKOVI S PODPISOM (dodaci list)
-- Pri osobnom odbere / kurierovi sa na tablete alebo mobile ukaze zoznam odovzdavaneho tovaru, prebierajuci napise meno
-- a podpise sa prstom. Uklada sa datum a cas, podpis a presny zoznam tovaru — poistka, ze tovar bol prevzaty.
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists order_handovers (
    id uuid primary key default gen_random_uuid(),
    order_id text not null,
    order_number text,
    customer text,
    company_brand text,
    prevzal_meno text not null,
    sposob text not null default 'osobny_odber' check (sposob in ('osobny_odber', 'kurier', 'ine')),
    polozky jsonb not null default '[]'::jsonb,   -- [{ nazov, qty, poznamka }] — snimka toho, co sa odovzdalo
    podpis_png text,                               -- podpis ako data URL (maly PNG)
    poznamka text,
    signed_at timestamptz not null default now(),
    created_by text
);
create index if not exists order_handovers_order_idx on order_handovers (order_id);

alter table order_handovers enable row level security;
drop policy if exists "prihlaseni plny pristup order_handovers" on order_handovers;
create policy "prihlaseni plny pristup order_handovers" on order_handovers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
