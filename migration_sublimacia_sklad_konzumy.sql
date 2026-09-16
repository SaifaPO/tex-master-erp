-- ============================================================
-- MIGRÁCIA: Sublimácia — reálne odčítanie papiera/atramentu/protekčného papiera zo skladu
-- Doteraz cena sublimačnej potlače v Katalógu Produktov len POČÍTALA náklad na papier/atrament/
-- protekčný papier (nákladový vzorec), ale nič sa reálne neodpočítalo zo Skladu. Teraz sa dá
-- v Kostre cien → Sublimácia priradiť ku každému z týchto troch spotrebných materiálov konkrétna
-- položka zo Skladu (napr. "Papier Sportsline", "Farba sublimačný pigment", "Protekčný papier") —
-- keď sa pri zákazke odpočítava látka, odpočíta sa v rovnakom kroku aj tento spotrebný materiál,
-- podľa plochy potlače (rovnaký princíp ako pri látke).
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_naklady add column if not exists papier_material_id text references materials(id);
alter table textil_naklady add column if not exists atrament_material_id text references materials(id);
alter table textil_naklady add column if not exists protekcny_papier_material_id text references materials(id);
