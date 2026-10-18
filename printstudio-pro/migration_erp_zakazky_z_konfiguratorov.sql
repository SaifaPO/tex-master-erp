-- Objednavky z konfiguratorov (Celenky, Buffky) sa po zaplateni v Shopify automaticky zalozia ako zakazka v ERP pod cislom PBT-RR-XXXX.
-- Spravny ERP produkt sa najde cez BLANKS (PrintStudio -> Produkty (Blanks)): variant v appke -> blank -> produkt z Katalogu produktov
-- (produkty.erp_produkt_id, pozri migration_produkty_z_erp_katalogu.sql). Tu sa len pridavaju stlpce, aby sa ta ista objednavka
-- nezalozila dvakrat. Bezpecne spustit opakovane.

alter table celenky_objednavky add column if not exists erp_zakazka_id text;
alter table celenky_objednavky add column if not exists erp_cislo text;
alter table celenky_objednavky add column if not exists shopify_order_id text;
alter table buffky_objednavky add column if not exists erp_zakazka_id text;
alter table buffky_objednavky add column if not exists erp_cislo text;
alter table buffky_objednavky add column if not exists shopify_order_id text;
