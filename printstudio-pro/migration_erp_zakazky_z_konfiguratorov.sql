-- Objednavky z konfiguratorov (Celenky, Buffky) sa po zaplateni v Shopify automaticky zalozia ako zakazka v ERP pod cislom PBT-RR-XXXX.
-- Spravny ERP produkt sa vyberie z mapovania: kazda varianta konfiguratora (napr. celenka "dospely standard | pocesana",
-- buffka "Tubular Basic" / "Premium | microfleece") je prepojena na jeden produkt z Katalogu produktov (PrintStudio -> Prepojenie na ERP).
-- Bezpecne spustit opakovane.

create table if not exists erp_mapovanie_produktov (
    id bigint generated always as identity primary key,
    konfigurator text not null check (konfigurator in ('celenky', 'buffky')),
    variant_kod text not null,                 -- celenky: 'velkost|material' (napr. adult_standard|combed); buffky: 'basic' alebo 'premium|<kod materialu>'
    erp_produkt_id text references products(id) on delete set null,
    unique (konfigurator, variant_kod)
);
alter table erp_mapovanie_produktov enable row level security;
drop policy if exists "admin plny pristup erp mapovanie" on erp_mapovanie_produktov;
create policy "admin plny pristup erp mapovanie" on erp_mapovanie_produktov for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Ktora ERP zakazka vznikla z objednavky (aby sa ta ista objednavka nezalozila dvakrat)
alter table celenky_objednavky add column if not exists erp_zakazka_id text;
alter table celenky_objednavky add column if not exists erp_cislo text;
alter table celenky_objednavky add column if not exists shopify_order_id text;
alter table buffky_objednavky add column if not exists erp_zakazka_id text;
alter table buffky_objednavky add column if not exists erp_cislo text;
alter table buffky_objednavky add column if not exists shopify_order_id text;
