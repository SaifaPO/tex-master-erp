-- ============================================================
-- MIGRÁCIA: Uzávierka mesiaca pre medzifiremné dodacie listy (PBT <-> ATAK)
-- Bez tejto tabuľky sa dodací list vždy počíta naživo z aktuálnych dát zákaziek —
-- ak by sa zákazka po vystavení dodacieho listu ešte upravila, historický dodací
-- list by sa potichu prepočítal inak. Uzavretím mesiaca sa uloží "zmrazená" kópia
-- (snapshot) riadkov a súčtu, ktorá sa už nemení, kým ju master výslovne neodomkne.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists intercompany_closed_periods (
    direction text not null,
    month text not null,
    closed_at timestamptz not null default now(),
    closed_by text,
    snapshot jsonb not null,
    primary key (direction, month)
);
alter table intercompany_closed_periods enable row level security;
drop policy if exists "authenticated_all_intercompany_closed_periods" on intercompany_closed_periods;
create policy "authenticated_all_intercompany_closed_periods" on intercompany_closed_periods
    for all to authenticated using (true) with check (true);
