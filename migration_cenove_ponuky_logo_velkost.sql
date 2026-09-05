-- Cenove ponuky: nastavitelna velkost loga firmy (logo PBT je v pomere mensie ako ATAK,
-- tak aby si vedel Martin dolat velkost kazdeho loga zvlast, bez zasahu do kodu).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table quote_companies add column if not exists logo_scale numeric not null default 100;

-- Logo PBT o 15% vacsie ako standard (100%), ATAK ostava na 100%.
update quote_companies set logo_scale = 115 where id = 'pbt' and logo_scale = 100;
