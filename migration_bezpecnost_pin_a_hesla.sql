-- Bezpecnostna oprava: zabranit citaniu password_hash / pin_hash / signup_token z klienta.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.
--
-- DOLEZITE: Po spusteni tejto migracie prestane fungovat stary sposob nacitania zamestnancov
-- (select('*') na tabulke employees), kym sa nenasadi aktualizovany kod appky (App.jsx) spolu
-- s dvomi novymi Edge Functions (verify-station-pin, employee-pin). Sql aj kod/Edge Functions
-- nasadzuj v jednom okne, nie s odstupom niekolkych dni, inak zamestnanci docasne nebudu vediet
-- prihlasit sa PIN-om na stanici.

-- 1) Bezpecny pohlad na zamestnancov bez citlivych stlpcov, len booleovske priznaky "je nastavene".
--    Pohlad (view) cita povodnu tabulku s pravami vlastnika (typicky superuser), takze potrebuje
--    citat password_hash/pin_hash interne na vypocet true/false, ale toto navonok nikdy neuniká.
--    Telefon/email sa navyse vidia len prihlasenym cez Supabase Auth (auth.role() = 'authenticated'),
--    teda Master/Supervisor/Sales — PIN-prihlaseny zamestnanec na stanici (anon) ich nevidi vobec.
create or replace view employees_public as
select
  id, first_name, last_name, birthday, nameday, entry_date, role, position,
  case when auth.role() = 'authenticated' then phone else null end as phone,
  case when auth.role() = 'authenticated' then email else null end as email,
  avatar, auth_user_id, signup_token_expires,
  (password_hash is not null and password_hash <> '') as has_password,
  (pin_hash is not null and pin_hash <> '') as has_pin,
  (signup_token is not null and signup_token <> '') as has_signup_token
from employees;

grant select on employees_public to anon, authenticated;

-- 2) Odobrat priame citanie citlivych stlpcov z povodnej tabulky pre bezne role.
--    Zapisovanie (insert/update pri vytvarani/uprave profilu) tymto nie je dotknute.
revoke select on employees from anon, authenticated;
grant select (
  id, first_name, last_name, birthday, nameday, entry_date, role, position,
  phone, email, avatar, auth_user_id, signup_token_expires
) on employees to anon, authenticated;

-- 3) Tabulka na serverove obmedzenie poctu pokusov o PIN prihlasenie (proti hrubej sile).
--    Pristupuje k nej len Edge Function cez service_role (RLS bez politiky = zakazane pre ostatnych).
create table if not exists pin_login_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  success boolean not null
);
create index if not exists idx_pin_login_attempts_created_at on pin_login_attempts (created_at);
alter table pin_login_attempts enable row level security;

-- 4) DOLEZITE: obmedzit aj Realtime broadcast (Postgres Changes cez WebSocket) len na nectlive stlpce.
--    Realtime cita zmeny priamo z logickej replikacie DB, nie cez GRANT/REVOKE vyssie — bez tohto by
--    citlive stlpce mohli unikat cez WebSocket aj napriek bodu 2. Over si v Supabase dashboarde
--    (Database -> Replication), ci sa publikacia naozaj vola "supabase_realtime" (bezny default).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime set table employees (
      id, first_name, last_name, birthday, nameday, entry_date, role, position,
      phone, email, avatar, auth_user_id, signup_token_expires
    );
  end if;
end $$;
