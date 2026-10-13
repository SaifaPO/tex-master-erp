-- ============================================================
-- PRIJATE FAKTURY (od dodavatelov) — evidencia, AI vycitanie z PDF/fotky, schvalovanie, uhrady.
-- Cielom je, aby uctovnicka nemusela nic prepisovat: doklady nahra firma, AI vycita udaje, majitel schvali,
-- uctovnicka dostane hotovy balik (pozri dalsie moduly "Financie").
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists prijate_faktury (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    created_by text,
    firma text not null default 'PBT',                 -- ktora firma doklad prijala: ATAK | PBT | ADY
    stav text not null default 'na_schvalenie',        -- spracovava | na_schvalenie | schvalena | uhradena | zamietnuta
    druh text not null default 'faktura',              -- faktura | dobropis | zalohova | ina
    dodavatel_nazov text,
    dodavatel_ico text,
    dodavatel_dic text,
    dodavatel_ic_dph text,
    dodavatel_krajina text,                            -- ISO kod, napr. SK, CZ, FI
    cislo_faktury text,
    variabilny_symbol text,
    iban text,
    datum_vystavenia date,
    datum_dodania date,
    datum_splatnosti date,
    mena text not null default 'EUR',
    zaklad_dane numeric(12,2),
    dph_suma numeric(12,2),
    suma_celkom numeric(12,2),
    dph_sadzby jsonb not null default '[]'::jsonb,     -- [{ "sadzba": 23, "zaklad": 100, "dph": 23 }]
    rezim_dph text not null default 'standard',        -- standard | prenos_danovej_povinnosti | oslobodene | mimo_sk_bez_dph | nejasne
    kategoria text,
    popis text,
    vyzaduje_kontrolu boolean not null default false,  -- AI/pravidla: novy dodavatel, zahranicie, dobropis, vysoka suma, DPH rezim...
    dovod_kontroly text,
    subor_cesta text,                                  -- cesta v sukromnom bucket-e prijate-faktury
    subor_nazov text,
    subor_typ text,
    ai_data jsonb,
    ai_istota numeric(4,2),
    uhradena_datum date,
    sposob_uhrady text,                                -- banka | hotovost | karta | ine
    poznamka text
);

create index if not exists prijate_faktury_stav_idx on prijate_faktury (stav);
create index if not exists prijate_faktury_splatnost_idx on prijate_faktury (datum_splatnosti);
create index if not exists prijate_faktury_ico_idx on prijate_faktury (dodavatel_ico);

alter table prijate_faktury enable row level security;
drop policy if exists "prihlaseni plny pristup prijate_faktury" on prijate_faktury;
create policy "prihlaseni plny pristup prijate_faktury" on prijate_faktury for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bankove transakcie: odchadzajuce platby (zaporna suma) sa daju parovat na prijate faktury.
alter table bank_transactions add column if not exists prijata_faktura_id uuid;

-- Sukromny bucket na PDF/fotky faktur (verejnost k nim nema pristup, appka pouziva podpisane odkazy).
insert into storage.buckets (id, name, public) values ('prijate-faktury', 'prijate-faktury', false) on conflict (id) do nothing;

drop policy if exists "prihlaseni citaju prijate-faktury" on storage.objects;
create policy "prihlaseni citaju prijate-faktury" on storage.objects for select using (bucket_id = 'prijate-faktury' and auth.role() = 'authenticated');
drop policy if exists "prihlaseni nahravaju prijate-faktury" on storage.objects;
create policy "prihlaseni nahravaju prijate-faktury" on storage.objects for insert with check (bucket_id = 'prijate-faktury' and auth.role() = 'authenticated');
drop policy if exists "prihlaseni menia prijate-faktury" on storage.objects;
create policy "prihlaseni menia prijate-faktury" on storage.objects for update using (bucket_id = 'prijate-faktury' and auth.role() = 'authenticated');
drop policy if exists "prihlaseni mazu prijate-faktury" on storage.objects;
create policy "prihlaseni mazu prijate-faktury" on storage.objects for delete using (bucket_id = 'prijate-faktury' and auth.role() = 'authenticated');

-- Zivy prenos zmien (rovnako ako ostatne financne tabulky).
do $$ begin
  begin alter publication supabase_realtime add table prijate_faktury; exception when others then null; end;
end $$;
