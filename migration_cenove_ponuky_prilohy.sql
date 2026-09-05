-- Kniznica prilohovych dokumentov (velkostne tabulky, strihy) pre cenove ponuky.
-- Subory sa ukladaju do uz existujuceho Storage bucketu "item-images" (priecinok quote-documents/),
-- aby nebolo treba zakladat novy bucket. Tato tabulka drzi len metadata + verejnu URL.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists quote_documents (
  id text primary key,
  category text not null default 'Iné',
  name text not null,
  description text,
  file_url text not null,
  file_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table quote_documents enable row level security;
drop policy if exists "quote_documents_allow_all" on quote_documents;
create policy "quote_documents_allow_all" on quote_documents for all to anon, authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quote_documents'
  ) then
    execute 'alter publication supabase_realtime add table public.quote_documents';
  end if;
end $$;
