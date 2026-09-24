-- Limity (kvóty) Supabase planu, aby karta "Úložisko" vedela ukázať percento zaplnenia, nielen
-- surové čísla v GB. Supabase klient (anon/authenticated kľúč) nemá API na zistenie limitu planu
-- (to je len v Supabase Dashboarde pod Settings -> Billing/Usage) — Martin ho preto zadá ručne
-- raz sem a appka si ho odteraz pamätá. Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.

create table if not exists ulozisko_limity (
    id int primary key default 1,
    limit_db_gb numeric(10,2) not null default 0,
    limit_storage_gb numeric(10,2) not null default 0,
    constraint jediny_riadok_ulozisko_limity check (id = 1)
);
insert into ulozisko_limity (id) values (1) on conflict (id) do nothing;
alter table ulozisko_limity enable row level security;
drop policy if exists "admin plny pristup ulozisko limity" on ulozisko_limity;
create policy "admin plny pristup ulozisko limity" on ulozisko_limity for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
