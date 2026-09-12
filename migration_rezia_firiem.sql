-- Rezia firiem (ATAK / PBT / ADY) — mesacny prehlad nakladov po firmach: mzdy, elektrina (uz
-- existujuci model zariadenie -> kW x hod/mesiac x cena, len s pridanym rozlisenim firmy),
-- kurenie, najom, splatky strojov, uvery, material. Firma je uz zavedeny koncept (objednavky
-- maju companyBrand ATAK/PBT/ADY) — rovnaky enum sa pouziva aj tu.

alter table employees add column if not exists company text check (company in ('ATAK','PBT','ADY'));
alter table employees add column if not exists mzda_hruba numeric(10,2);
alter table employees add column if not exists socialne_poistenie numeric(10,2);
alter table employees add column if not exists zdravotne_poistenie numeric(10,2);

alter table cost_metrics add column if not exists company text check (company in ('ATAK','PBT','ADY'));
