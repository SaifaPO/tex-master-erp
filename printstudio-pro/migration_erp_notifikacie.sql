-- ============================================================
-- ERP NOTIFIKÁCIE (zvonček v hornej lište): nový dopyt, nová objednávka z konfigurátora, nová zákazka v ERP.
-- Notifikácie vytvárajú databázové triggery (fungujú aj pre záznamy, ktoré vkladajú Edge Functions). Zvonček ich zobrazí
-- okamžite (Realtime) a kliknutím prejde priamo na dopyt / objednávku / zákazku. Bezpečné spustiť opakovane.
-- ============================================================
create table if not exists erp_notifikacie (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    typ text not null,                 -- dopyt | objednavka | zakazka
    zdroj text,                        -- dopyt | dres | buffka | ... | orders
    titulok text not null,
    text text,
    odkaz jsonb,                       -- kam sa prekliknúť: { tab, subtab, typ, id }
    precitane boolean not null default false
);
create index if not exists erp_notifikacie_created_idx on erp_notifikacie (created_at desc);
alter table erp_notifikacie enable row level security;
drop policy if exists "admin cita notifikacie" on erp_notifikacie;
create policy "admin cita notifikacie" on erp_notifikacie for select using (auth.role() = 'authenticated');
drop policy if exists "admin upravuje notifikacie" on erp_notifikacie;
create policy "admin upravuje notifikacie" on erp_notifikacie for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin maze notifikacie" on erp_notifikacie;
create policy "admin maze notifikacie" on erp_notifikacie for delete using (auth.role() = 'authenticated');

-- Realtime (okamžité vyskočenie notifikácie)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'erp_notifikacie') then
    alter publication supabase_realtime add table erp_notifikacie;
  end if;
end $$;

create or replace function erp_notif_novy_zaznam() returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(NEW);
  zdroj text := TG_ARGV[0];
  nazov text := TG_ARGV[1];
  cislo text;
  detail text;
begin
  if zdroj = 'dopyt' then
    insert into erp_notifikacie (typ, zdroj, titulok, text, odkaz) values (
      'dopyt', 'dopyt', 'Nový dopyt DOPYT-' || coalesce(j->>'kod', ''),
      coalesce(j->>'produkt_nazov', '') || ' · ' || coalesce(j->>'pocet_ks', '?') || ' ks'
        || case when j->>'cena_spolu_bez_dph' is not null then ' · ' || to_char(round((j->>'cena_spolu_bez_dph')::numeric, 2), 'FM999990.00') || ' € bez DPH' else '' end
        || case when coalesce(j->>'agentura', '') <> '' then ' · ' || (j->>'agentura') else '' end,
      jsonb_build_object('tab', 'printstudio', 'subtab', 'objednavky', 'typ', 'dopyt', 'id', j->>'id'));
  elsif zdroj = 'orders' then
    insert into erp_notifikacie (typ, zdroj, titulok, text, odkaz) values (
      'zakazka', 'orders', 'Nová zákazka ' || coalesce(j->>'order_number', ''),
      coalesce(j->>'customer', '') || case when coalesce(j->>'company_brand', '') <> '' then ' · ' || (j->>'company_brand') else '' end,
      jsonb_build_object('tab', 'planner', 'id', j->>'id'));
  else
    cislo := coalesce(nullif(j->>'cislo_objednavky', ''), nullif(j->>'shopify_order_number', ''), '');
    detail := coalesce(j->>'pocet_ks', '') ;
    insert into erp_notifikacie (typ, zdroj, titulok, text, odkaz) values (
      'objednavka', zdroj, 'Nová objednávka — ' || nazov || case when cislo <> '' then ' ' || cislo else '' end,
      trim(both ' ·' from (case when detail <> '' then detail || ' ks' else '' end
        || case when j->>'cena_spolu' is not null then ' · ' || to_char(round((j->>'cena_spolu')::numeric, 2), 'FM999990.00') || ' €' else '' end)),
      jsonb_build_object('tab', 'printstudio', 'subtab', 'objednavky', 'typ', zdroj, 'id', j->>'id'));
  end if;
  return NEW;
exception when others then
  return NEW;   -- notifikácia nesmie nikdy zhodiť vloženie objednávky / dopytu
end $$;

do $$
declare t record;
begin
  for t in select * from (values
    ('b2b_dopyty', 'dopyt', 'Dopyt'),
    ('orders', 'orders', 'Zákazka'),
    ('dres_objednavky', 'dres', 'Dresy'),
    ('buffky_objednavky', 'buffka', 'Buffky'),
    ('celenky_objednavky', 'celenka', 'Čelenky'),
    ('zastava_objednavky', 'zastava', 'Vlajky'),
    ('vlajka_objednavky', 'beach', 'Beachvlajky'),
    ('dtf_objednavky', 'dtf', 'DTF metráž'),
    ('textil_objednavky', 'textil', 'Textil metráž'),
    ('transfer3d_objednavky', 'transfer3d', '3D transfery'),
    ('stolova_objednavky', 'stolova', 'Stolové vlajky'),
    ('snurka_objednavky', 'snurka', 'Šnúrky'),
    ('folie_objednavky', 'folie', 'Rezané fólie')
  ) as v(tabulka, zdroj, nazov) loop
    execute format('drop trigger if exists erp_notif_trg on %I', t.tabulka);
    execute format('create trigger erp_notif_trg after insert on %I for each row execute function erp_notif_novy_zaznam(%L, %L)', t.tabulka, t.zdroj, t.nazov);
  end loop;
end $$;
