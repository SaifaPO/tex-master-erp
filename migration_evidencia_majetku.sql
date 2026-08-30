-- Evidencia dlhodobeho majetku a danovych odpisov.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists assets (
  id text primary key,
  name text not null,
  acquisition_date date not null,
  acquisition_price numeric not null,
  depreciation_group smallint not null,
  depreciation_method text not null default 'rovnomerne',
  status text not null default 'aktivny',
  disposal_date date,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Zapnut RLS (Supabase to odporuca pri kazdej novej tabulke), ale s pravidlom, ktore povoluje rovnaky
-- pristup ako ostatne obchodne tabulky v appke (materials, invoices, cash_documents a pod.) — appka si
-- pristup riadi sama cez ACL v kode, nie cez RLS. Tymto sa nemeni sprava appky, len sa RLS stav zjednoti
-- a zapisuje explicitne namiesto toho, aby tabulka bola bez RLS uplne.
alter table assets enable row level security;
drop policy if exists "assets_allow_all" on assets;
create policy "assets_allow_all" on assets for all to anon, authenticated using (true) with check (true);
