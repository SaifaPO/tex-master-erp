-- Naplanovanie automatickej nocnej zalohy (nightly-backup Edge Function) o polnoci kazdy den.
-- POZOR: krok 1 spusti len RAZ (samostatne, s vlastnym service role klucom vlozenym namiesto placeholderu).
-- Ak uz v Project Settings -> Vault existuje secret s nazvom 'service_role_key', krok 1 presko a rovno pokracuj krokom 2.

-- 1) Bezpecne ulozenie service role kluca do Supabase Vault (najdes ho v Project Settings -> API -> service_role).
--    Nikdy ho nedavaj do git repozitara ani nikam inam do kodu appky!
select vault.create_secret(
  'SEM_VLOZ_SVOJ_SERVICE_ROLE_KEY_ZO_SETTINGS_API',
  'service_role_key'
);

-- 2) Povolit rozsirenia potrebne na naplanovane volanie Edge Function z databazy.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3) Naplanovat volanie nightly-backup kazdy den.
--    POZOR na cas: pg_cron pocita v UTC, nie v slovenskom case. Slovensko je UTC+1 (zimny cas) / UTC+2 (letny cas).
--    '0 23 * * *' = 23:00 UTC = cca polnoc SK v zime, cca 01:00 SK v lete (posun kvoli letnemu casu).
--    Ak ti na tej hodine zalezi presne, uprav cislo pred prvou hviezdickou (napr. '0 22 * * *' pre presnejsiu polnoc v lete).
select cron.schedule(
  'nightly-backup-midnight',
  '0 23 * * *',
  $$
  select net.http_post(
    url := 'https://uqjzecxwmjtytjodhjxp.supabase.co/functions/v1/nightly-backup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Kontrola, ze je naplanovane:
-- select * from cron.job;
-- Zrusenie naplanovania (ak by bolo treba):
-- select cron.unschedule('nightly-backup-midnight');
