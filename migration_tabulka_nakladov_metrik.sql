-- Vseobecna tabulka nakladov/metrik (elektrina, mzdy, cena za meter technologie, spotreba zariadeni a pod.)
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

create table if not exists cost_metrics (
  id text primary key,
  name text not null,
  value numeric not null default 0,
  unit text,
  description text,
  created_at timestamptz not null default now()
);

alter table cost_metrics enable row level security;
drop policy if exists "cost_metrics_allow_all" on cost_metrics;
create policy "cost_metrics_allow_all" on cost_metrics for all to anon, authenticated using (true) with check (true);

-- Rozsirenie o vypocet mesacnych nakladov na energie (vykon zariadenia v kW x hodiny prevadzky za mesiac
-- x cena elektriny/plynu) a o rozlisenie fixny/variabilny naklad.
alter table cost_metrics add column if not exists power_kw numeric;
alter table cost_metrics add column if not exists hours_per_month numeric;
alter table cost_metrics add column if not exists category text not null default 'vseobecne';
-- Fixny naklad = nemeni sa podla objemu vyroby (naklad, mzdy na fixny plat, kurenie, svetla, pocitace).
-- Variabilny naklad = rastie s objemom vyroby (stroje bezice len pocas aktivnej vyroby, mzdy za kus).
alter table cost_metrics add column if not exists cost_type text not null default 'fixny';

-- Fiktivne uvodne data na doladenie (cena elektriny/plynu, typicke zariadenia dielne) —
-- vlozi sa len ak tam este nic nie je, aby sa nic neprepisalo pri opakovanom spusteni.
insert into cost_metrics (id, name, value, unit, description, category, power_kw, hours_per_month, cost_type)
select * from (values
  ('metric-seed-cena-elektriny', 'Cena elektriny', 0.19, '€/kWh', 'FIKTÍVNE — doplň skutočnú sadzbu z faktúry od dodávateľa', 'vseobecne', null::numeric, null::numeric, 'fixny'),
  ('metric-seed-cena-plynu', 'Cena plynu', 0.09, '€/kWh', 'FIKTÍVNE — doplň skutočnú sadzbu z faktúry od dodávateľa', 'vseobecne', null::numeric, null::numeric, 'fixny'),
  ('metric-seed-zehlicky', 'Žehličky / transfer lis', 0, '€/mesiac', 'FIKTÍVNE — uprav výkon a hodiny prevádzky. Beží len počas výroby.', 'zariadenie', 3.5, 160, 'variabilny'),
  ('metric-seed-tlaciarne', 'Sublimačné tlačiarne', 0, '€/mesiac', 'FIKTÍVNE — uprav výkon a hodiny prevádzky. Beží len počas výroby.', 'zariadenie', 1.2, 120, 'variabilny'),
  ('metric-seed-pocitace', 'Počítače (spolu)', 0, '€/mesiac', 'FIKTÍVNE — uprav podľa počtu počítačov. Bežia bez ohľadu na objem výroby.', 'zariadenie', 1.5, 180, 'fixny'),
  ('metric-seed-svetla', 'Osvetlenie dielne', 0, '€/mesiac', 'FIKTÍVNE — uprav podľa reálneho príkonu svietidiel. Nezávisí od objemu výroby.', 'zariadenie', 2.0, 250, 'fixny'),
  ('metric-seed-kurenie', 'Kúrenie (plyn, chladné mesiace)', 0, '€/mesiac', 'FIKTÍVNE — len vo vykurovacej sezóne, mimo sezóny nastav hodiny na 0. Nezávisí od objemu výroby.', 'kurenie', 15, 200, 'fixny')
) as seed(id, name, value, unit, description, category, power_kw, hours_per_month, cost_type)
where not exists (select 1 from cost_metrics where cost_metrics.id = seed.id);
