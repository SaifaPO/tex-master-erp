-- Náčrty faktúr zo zákazky: pri vytvorení zákazky s fakturáciou sa automaticky pripraví NÁČRT faktúry (alebo zálohovej faktúry),
-- ktorý odsúhlasí predávajúci (obchodník) aj financie. Až potom sa vystaví ostrá faktúra a pošle zákazníkovi.
-- Aditívne, bezpečné spustiť opakovane.

-- 1) predávajúci na zákazke + plánovaný typ dokladu
alter table orders add column if not exists seller_id text;
alter table orders add column if not exists seller_name text;
alter table orders add column if not exists invoice_plan text;   -- 'faktura' | 'zalohova' | null

-- 2) náčrty faktúr
create table if not exists faktura_nacrty (
    id text primary key,
    order_id text,
    doc_type text not null default 'faktura',            -- 'faktura' | 'zalohova'
    status text not null default 'navrh',                 -- 'navrh' | 'vystavene' | 'zrusene'
    customer_name text not null default '',
    customer_address text not null default '',
    customer_ico text not null default '',
    customer_dic text not null default '',
    customer_ic_dph text not null default '',
    customer_type text not null default 'sk_platca',
    customer_email text not null default '',
    customer_phone text not null default '',
    language text not null default 'sk',
    due_date date,
    items jsonb not null default '[]'::jsonb,
    notes text not null default '',
    seller_id text,
    seller_name text,
    seller_approved_at timestamptz,
    seller_approved_by text,
    finance_approved_at timestamptz,
    finance_approved_by text,
    invoice_id text,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_faktura_nacrty_order on faktura_nacrty (order_id);
create index if not exists idx_faktura_nacrty_status on faktura_nacrty (status);
alter table faktura_nacrty enable row level security;
drop policy if exists "prihlaseni plny pristup faktura_nacrty" on faktura_nacrty;
create policy "prihlaseni plny pristup faktura_nacrty" on faktura_nacrty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3) notifikácie smerované na konkrétnu rolu / osobu (bez cieľa = pre Mastra, ako doteraz)
alter table erp_notifikacie add column if not exists pre_role text[];
alter table erp_notifikacie add column if not exists pre_employee_id text;
drop policy if exists "prihlaseni vkladaju notifikacie" on erp_notifikacie;
create policy "prihlaseni vkladaju notifikacie" on erp_notifikacie for insert with check (auth.role() = 'authenticated');

-- 4) živé prenášanie náčrtov (Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'faktura_nacrty') then
    alter publication supabase_realtime add table faktura_nacrty;
  end if;
end $$;
