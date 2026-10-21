-- ============================================================
-- Modul VÝŠIVKA (Stitch Editor) — záznamy uložených výšivkových programov k zákazkám.
-- Zákazky v ERP sú v tabuľke orders (id je text, napr. ZAK-1730000000000). Súbory (DST, náhľad, výrobný list, projekt, súpiska)
-- sú v súkromnom buckete "vysivky". Bezpečné spustiť opakovane.
-- ============================================================
create table if not exists public.vysivky (
  id              uuid primary key default gen_random_uuid(),
  zakazka_id      text references public.orders(id) on delete cascade,
  nazov           text not null,
  stehov          integer not null,
  minut           numeric(8,2) not null,          -- čas šitia jedného kusu pri danej rýchlosti
  rychlost        integer,                         -- stehov/min, z ktorej je čas vypočítaný
  farieb          integer,
  vymen_niti      integer,
  strihov         integer,
  sirka_mm        numeric(6,1),
  vyska_mm        numeric(6,1),
  spotreba_nite_m numeric(8,2),
  nite            jsonb,      -- [{order, name, code, hex, stitches, meters}]
  subory          jsonb,      -- {dst, nahlad, vyrobny_list, projekt, predloha} = cesty v buckete "vysivky"
  supiska         jsonb,      -- [{cislo, meno, subor, stehov, minut}] alebo null
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid()
);
create index if not exists vysivky_zakazka_idx on public.vysivky (zakazka_id, created_at desc);

alter table public.vysivky enable row level security;
drop policy if exists "vysivky_select" on public.vysivky;
drop policy if exists "vysivky_insert" on public.vysivky;
drop policy if exists "vysivky_delete" on public.vysivky;
create policy "vysivky_select" on public.vysivky for select using (auth.role() = 'authenticated');
create policy "vysivky_insert" on public.vysivky for insert with check (auth.role() = 'authenticated');
create policy "vysivky_delete" on public.vysivky for delete using (auth.role() = 'authenticated');

-- Súkromný bucket na súbory
insert into storage.buckets (id, name, public) values ('vysivky', 'vysivky', false) on conflict (id) do nothing;
drop policy if exists "vysivky_files_read" on storage.objects;
drop policy if exists "vysivky_files_insert" on storage.objects;
drop policy if exists "vysivky_files_delete" on storage.objects;
create policy "vysivky_files_read" on storage.objects for select using (bucket_id = 'vysivky' and auth.role() = 'authenticated');
create policy "vysivky_files_insert" on storage.objects for insert with check (bucket_id = 'vysivky' and auth.role() = 'authenticated');
create policy "vysivky_files_delete" on storage.objects for delete using (bucket_id = 'vysivky' and auth.role() = 'authenticated');
