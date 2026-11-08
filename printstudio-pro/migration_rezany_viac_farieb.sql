-- Rezaný transfer (flex) s viacerými farbami: každá ďalšia farba = odpad fólie navyše + čas navyše; nažehlenie za každú vrstvu zvlášť.
alter table public.cennik_rezany_transfer add column if not exists priplatok_odpad_farba_percent numeric not null default 15;
alter table public.cennik_rezany_transfer add column if not exists cas_navyse_farba_min numeric not null default 0.3;
