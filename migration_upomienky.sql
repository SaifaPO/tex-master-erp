-- ============================================================
-- AUTOMATICKE UPOMIENKY faktur po splatnosti.
-- Edge Function send-payment-reminders (denne z pg_cron) posle zakaznikovi pripomienku / upomienku / poslednu vyzvu.
-- Predvolene je VYPNUTE (zapnute = false) a odosielatel je fiktivny — najprv nastav skutocnu adresu a zapni v ERP.
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists upomienky_nastavenia (
    id int primary key default 1,
    zapnute boolean not null default false,
    odosielatel_meno text not null default 'Fakturácia',
    odosielatel_email text not null default 'fakturacia@example.sk',   -- FIKTIVNE: nahrad skutocnou adresou na overenej domene
    kopia_email text,                                                  -- skryta kopia kazdej upomienky (napr. majitel)
    dni_1 int not null default 3,                                      -- dni po splatnosti: priatelska pripomienka
    dni_2 int not null default 14,                                     -- upomienka
    dni_3 int not null default 30,                                     -- posledna vyzva
    uctovat_pokutu boolean not null default false,                     -- zapni az ked maju zakaznici odsuhlasene VOP s pokutou
    pokuta_percent_denne numeric(6,3) not null default 0.05,
    pausal_eur numeric(8,2) not null default 40,
    updated_at timestamptz not null default now(),
    constraint upomienky_nastavenia_jedna check (id = 1)
);
insert into upomienky_nastavenia (id) values (1) on conflict (id) do nothing;

create table if not exists upomienky_log (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    invoice_id text not null,
    invoice_number text,
    customer_name text,
    prijemca text,
    stupen int not null,
    dni_po_splatnosti int,
    stav text not null,            -- odoslane | chyba
    chyba text
);
create index if not exists upomienky_log_invoice_idx on upomienky_log (invoice_id);

-- Zakaznik, ktoremu sa automaticke upomienky nemaju posielat (spor, dohoda, VIP…)
alter table customers add column if not exists nevysielat_upomienky boolean not null default false;

alter table upomienky_nastavenia enable row level security;
drop policy if exists "prihlaseni plny pristup upomienky_nastavenia" on upomienky_nastavenia;
create policy "prihlaseni plny pristup upomienky_nastavenia" on upomienky_nastavenia for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table upomienky_log enable row level security;
drop policy if exists "prihlaseni plny pristup upomienky_log" on upomienky_log;
create policy "prihlaseni plny pristup upomienky_log" on upomienky_log for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- NAPLANOVANIE (spusti az ked je nasadena funkcia send-payment-reminders a v Vault existuje 'service_role_key'
-- — rovnaky ako pri nocnej zaloohe, pozri migration_naplanovanie_nocnej_zalohy.sql).
-- 06:00 UTC = 07:00 (zima) / 08:00 (leto) slovenskeho casu.
-- ------------------------------------------------------------
-- select cron.schedule(
--   'upomienky-faktur-denne',
--   '0 6 * * *',
--   $$
--   select net.http_post(
--     url := 'https://uqjzecxwmjtytjodhjxp.supabase.co/functions/v1/send-payment-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
