-- ============================================================
-- Zaznam o faktúrach odoslaných zákazníkom e-mailom (ERP tlačidlo "Poslať e-mailom" v detaile faktúry,
-- Edge Function send-invoice-email). Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists faktury_email_log (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    invoice_id text not null,
    invoice_number text,
    customer_name text,
    prijemca text,
    jazyk text not null default 'sk',   -- sk | en
    stav text not null,                 -- odoslane | chyba
    chyba text
);
create index if not exists faktury_email_log_invoice_idx on faktury_email_log (invoice_id);

alter table faktury_email_log enable row level security;
drop policy if exists "prihlaseni plny pristup faktury_email_log" on faktury_email_log;
create policy "prihlaseni plny pristup faktury_email_log" on faktury_email_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
