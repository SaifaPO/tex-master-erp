-- DTF metraz a Textilna metraz zobrazovali a do kosika posielali ceny BEZ DPH — na Slovensku sa
-- vsak koncovemu zakaznikovi (B2C) musi predavat vzdy s DPH. Pridava sa dph_percent (default 23%)
-- do oboch nastaveni, aplikovane na celkovu cenu v zakaznickej appke aj v sume poslanej do kosika.
alter table dtf_nastavenia add column if not exists dph_percent numeric(5,2) not null default 23;
alter table textil_nastavenia add column if not exists dph_percent numeric(5,2) not null default 23;
