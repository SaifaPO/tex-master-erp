-- Prepojenie materialov Zastavy na skutocny sklad (tabulka "materials" v hlavnom ERP,
-- rovnaka Supabase databaza). Namiesto rucne zadavanej "naklad_m2" sa da vybrat konkretny
-- skladovy material (napr. Vlajkovina, Mesh, Cordura) a cena/m2 sa dopocita z jeho ceny za
-- bezny meter (materials.price_per_m) a sirky rolky (materials.width, v cm).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table zastava_materialy add column if not exists sklad_material_id text references materials(id) on delete set null;
