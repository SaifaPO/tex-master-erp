-- Oprava: "Zamestnanci & Práva" neukladali firmu (a mzdu/poistenie/titul pre ponuky).
-- PRÍČINA: appka číta zamestnancov z pohľadu employees_public a z realtime publikácie, ktoré boli
-- vytvorené pred pridaním stĺpcov company, mzda_hruba, socialne_poistenie, zdravotne_poistenie,
-- titul_pre_ponuky. Zápis do tabuľky prešiel, ale pri čítaní tieto polia chýbali -> v zozname prázdne.
-- Aditívna, bezpečne opakovateľná migrácia.
--
-- Pôvodný pohľad (zálohované pre návrat): rovnaké stĺpce ako nižšie bez posledných 5.

create or replace view employees_public as
select
  id, first_name, last_name, birthday, nameday, entry_date, role, position,
  case when auth.role() = 'authenticated' then phone else null end as phone,
  case when auth.role() = 'authenticated' then email else null end as email,
  avatar, auth_user_id, signup_token_expires,
  (password_hash is not null and password_hash <> '') as has_password,
  (pin_hash is not null and pin_hash <> '') as has_pin,
  (signup_token is not null and signup_token <> '') as has_signup_token,
  company,
  titul_pre_ponuky,
  -- mzdy a poistenie vidia len prihlásení cez Supabase Auth (Master/Supervisor/Obchodník), nie PIN stanice
  case when auth.role() = 'authenticated' then mzda_hruba else null end as mzda_hruba,
  case when auth.role() = 'authenticated' then socialne_poistenie else null end as socialne_poistenie,
  case when auth.role() = 'authenticated' then zdravotne_poistenie else null end as zdravotne_poistenie
from employees;

grant select on employees_public to anon, authenticated;

-- Realtime: pridať len NECITLIVÉ nové stĺpce (firma, titul). Mzdy/poistenie sa cez WebSocket nevysielajú.
-- Pozor: NIE "set table" (to by zrušilo všetky ostatné tabuľky z publikácie) — len drop+add tejto tabuľky.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table employees;
    alter publication supabase_realtime add table employees (
      id, first_name, last_name, birthday, nameday, entry_date, role, position,
      phone, email, avatar, auth_user_id, signup_token_expires, company, titul_pre_ponuky
    );
  end if;
end $$;
