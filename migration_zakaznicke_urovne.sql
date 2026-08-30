-- Zakaznicky rebricek (Standard/Bronze/Silver/Gold) a z neho odvodene predvolby splatnosti faktur.
-- Uroven zakaznika sa pocita za behu z existujucich objednavok/faktur (podla mena zakaznika),
-- netreba samostatnu tabulku zakaznikov. Tu je len konfiguracia prahov a dni splatnosti pre kazdu uroven.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists customer_tier_rules (
  tier text primary key,
  sort_order smallint not null,
  min_orders integer not null default 0,
  min_volume numeric not null default 0,
  due_days integer not null default 14
);

alter table customer_tier_rules enable row level security;
drop policy if exists "customer_tier_rules_allow_all" on customer_tier_rules;
create policy "customer_tier_rules_allow_all" on customer_tier_rules for all to anon, authenticated using (true) with check (true);

-- Fiktivne uvodne prahy na doladenie — zakaznik dosiahne uroven splnenim POCTU OBJEDNAVOK ALEBO OBJEMU (staci jedno).
insert into customer_tier_rules (tier, sort_order, min_orders, min_volume, due_days)
values
  ('standard', 0, 0, 0, 14),
  ('bronze', 1, 5, 500, 21),
  ('silver', 2, 15, 2000, 30),
  ('gold', 3, 30, 5000, 45)
on conflict (tier) do nothing;
