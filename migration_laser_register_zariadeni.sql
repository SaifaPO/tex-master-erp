-- ============================================================
-- MIGRÁCIA: Laser presunutý do registra zariadení (Financie → Réžia firiem)
-- OPRAVA architektúry: Laser NEMÁ vlastnú "Kostra cien" kartu ani vlastnú tabuľku nákladov.
-- Firma má viacero vlastných strojov (tlačiarne, laser a pod.) — všetky teraz žijú v jednej
-- spoločnej tabuľke `cost_metrics` (kategória "zariadenie"), popri mzdách/odvodoch/elektrine/kúrení.
-- Každé zariadenie tam teraz môže mať aj VÝKON (jednotiek/hod), z ktorého sa spolu s elektrinou
-- odvodí sadzba €/jednotka (napr. €/cm² pri laseri).
--
-- Táto migrácia NAHRÁDZA (funkčne) `migration_laser_a_zakazka_odberatel.sql`:
--   - tabuľka `laser_naklady` a stĺpec `products.laser_sa_reze` z tamtej migrácie sa už v kóde
--     NEPOUŽÍVAJÚ — necháme ich v DB bez zmeny (nič sa nemaže, podľa zaužívanej konvencie v projekte),
--     jednoducho sú od teraz mŕtve/neaktívne. Ak si tú migráciu už spustil, nič netreba vracať späť.
--   - stĺpec `materials.zakazka_odberatel` z tamtej migrácie OSTÁVA V PLATNOSTI (nemení sa, naďalej
--     sa používa) — táto migrácia sa ho netýka.
--
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

-- ---------- REGISTER ZARIADENÍ (cost_metrics): výkon stroja ----------
alter table cost_metrics add column if not exists vykon_za_hodinu numeric(12,2);
alter table cost_metrics add column if not exists vykon_jednotka text;

-- ---------- KATALÓG PRODUKTOV: Laser ako odkaz na konkrétne zariadenie z registra ----------
alter table products add column if not exists laser_zariadenie_id text references cost_metrics(id);
