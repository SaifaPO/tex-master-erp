-- VOC/MOC prepinac v Cenotvorbe: velkoobchodna zlava (%) oproti bezne pocitanej (maloobchodnej)
-- cene. Zatial CISTO DIAGNOSTICKE/NAHLADOVE — nemeni ziadnu skutocnu cenu v Cenniku potlace,
-- DTF metrazi, Cenovych ponukach ani v zakaznickych konfiguratoroch (Dizajner/Zastava/atd.).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table pricing_config add column if not exists wholesale_discount_percent numeric(5,2) not null default 15;
