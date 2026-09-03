-- ============================================================
-- DOPLNOK: prepojenie na skutočné Shopify Variant ID
-- Potrebné, aby /cart/add.js volanie z konfigurátora pridávalo do košíka reálne produkty,
-- nie len vymyslený placeholder text.
-- ============================================================

-- Blank produkt (tričko a pod.) v danej farbe + veľkosti -> jeho skutočné Shopify Variant ID
create table if not exists produkt_shopify_varianty (
    id bigint generated always as identity primary key,
    produkt_id bigint references produkty(id) on delete cascade,
    farba_id bigint references farby(id) on delete cascade,
    velkost text not null,
    shopify_variant_id text not null,
    unique (produkt_id, farba_id, velkost)
);
alter table produkt_shopify_varianty enable row level security;
create policy "verejne citanie shopify variantov" on produkt_shopify_varianty for select using (true);
create policy "admin plny pristup shopify variantov" on produkt_shopify_varianty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Cenové stupne produktu "Personalizácia potlače" (0,50 €, 1,00 €, 1,50 € ...) -> ich Shopify Variant ID.
-- Cena potlače sa v konfigurátore zaokrúhli na najbližší (dostupný) stupeň z tejto tabuľky.
create table if not exists cennik_personalizacia_varianty (
    cena_eur numeric(10,2) primary key,
    shopify_variant_id text not null
);
alter table cennik_personalizacia_varianty enable row level security;
create policy "verejne citanie personalizacia variantov" on cennik_personalizacia_varianty for select using (true);
create policy "admin plny pristup personalizacia variantov" on cennik_personalizacia_varianty for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
