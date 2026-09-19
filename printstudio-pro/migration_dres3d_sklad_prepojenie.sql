-- Prepojenie materialov 3D dresu na skutocny sklad (tabulka "materials" v hlavnom ERP,
-- rovnaka Supabase databaza). Namiesto rucne odhadnuteho "priplatok_eur" sa da vybrat
-- konkretny skladovy material (napr. Bona 1.3, Borghini) a priplatok sa dopocita z jeho
-- ceny za bezny meter (materials.price_per_m) a sirky rolky (materials.width, v cm) —
-- rovnaky vzor ako uz existuje pre Zastavy (migration_zastava_sklad_prepojenie.sql).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table produkt_dres_materialy add column if not exists sklad_material_id text references materials(id) on delete set null;
