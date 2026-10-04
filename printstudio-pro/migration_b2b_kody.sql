-- ============================================================
-- B2B kody pre reklamne agentury a firmy: zakaznik zada osobny kod v konfiguratore a vsetky ceny
-- (Beachvlajky, Vlajky, Dresy, Textilna metraz, DTF, Buffky, Celenky) sa mu znizia o dohodnute %.
-- Tabulka je dostupna LEN prihlasenemu adminovi; overenie kodu a vypocet zlavy robia Edge Functions
-- cez servisny kluc, takze zakaznik nikdy nevidi zoznam kodov ani cudzie zlavy.
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists b2b_kody (
    id bigint generated always as identity primary key,
    kod text not null unique,                    -- ukladane VELKYMI pismenami, napr. 'AGENTURA-NOVA'
    agentura text not null default '',           -- komu kod patri (pre admina)
    zlava_percent numeric not null default 15 check (zlava_percent >= 0 and zlava_percent <= 90),
    aktivny boolean not null default true,
    poznamka text,
    created_at timestamptz default now()
);

alter table b2b_kody enable row level security;
drop policy if exists "admin plny pristup b2b kody" on b2b_kody;
create policy "admin plny pristup b2b kody" on b2b_kody for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
