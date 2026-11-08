-- Zákaznícky chat (live) medzi verejnými appkami (printstudio-pro) a ERP.
-- Zákazník (anon) ide len cez Edge Function `chat` (service role, overenie tokenom konverzácie); ERP (prihlásení) čítajú/píšu cez RLS + Realtime.
create table if not exists public.chat_konverzacie (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),            -- tajný kľúč zákazníka ku konverzácii (localStorage / odkaz v e-maile)
  meno text not null default '',
  email text not null,
  telefon text,
  aplikacia text,
  url text,
  jazyk text,
  stav text not null default 'otvorena' check (stav in ('otvorena', 'uzavreta')),
  created_at timestamptz not null default now(),
  posledna_sprava_at timestamptz not null default now(),
  neprecitane_admin int not null default 0,                  -- koľko správ od zákazníka ešte admin neotvoril
  zakaznik_aktivny_at timestamptz,                           -- posledná aktivita zákazníka v okne chatu (kvôli rozhodnutiu: poslať e-mail?)
  posledny_email_adminovi timestamptz
);
create table if not exists public.chat_spravy (
  id bigint generated always as identity primary key,
  konverzacia_id uuid not null references public.chat_konverzacie(id) on delete cascade,
  od text not null check (od in ('zakaznik', 'admin')),
  text text not null,
  autor text,
  created_at timestamptz not null default now(),
  precitane_zakaznikom boolean not null default false
);
create index if not exists chat_spravy_konv_idx on public.chat_spravy (konverzacia_id, id);
create index if not exists chat_konverzacie_posledna_idx on public.chat_konverzacie (posledna_sprava_at desc);
create table if not exists public.chat_admin_online (
  user_id text primary key,
  meno text,
  last_seen timestamptz not null default now()
);
create table if not exists public.chat_nastavenia (
  id int primary key default 1 check (id = 1),
  prijemcovia text[] not null default '{pbtprint@pbtprint.sk}',   -- kam ísť e-mail, keď nie je nikto online
  odosielatel_meno text not null default 'PBT Print',
  odosielatel_email text not null default 'pbtprint@pbtprint.sk',
  email_pri_offline boolean not null default true,
  email_zakaznikovi boolean not null default true,                   -- odpoveď e-mailom, keď zákazník zavrel okno
  odkaz_appky text not null default 'https://printstudio-pro.vercel.app/',
  odkaz_erp text not null default 'https://tex-master-erp.vercel.app/'
);
insert into public.chat_nastavenia (id) values (1) on conflict (id) do nothing;

alter table public.chat_konverzacie enable row level security;
alter table public.chat_spravy enable row level security;
alter table public.chat_admin_online enable row level security;
alter table public.chat_nastavenia enable row level security;
do $$ declare t text; begin
  foreach t in array array['chat_konverzacie', 'chat_spravy', 'chat_admin_online', 'chat_nastavenia'] loop
    execute format('drop policy if exists "prihlaseni %1$s" on public.%1$I', t);
    execute format('create policy "prihlaseni %1$s" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Realtime pre ERP (nové správy hneď, bez obnovenia)
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_konverzacie', 'chat_spravy'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
