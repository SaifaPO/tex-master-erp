-- Cenove ponuky — firmy (quote_companies):
-- 1) Ak logo uz obsahuje nazov firmy vpalene v obrazku (napr. ATAK), nema zmysel ukazovat nazov
--    firmy este raz ako samostatny text vedla loga v hlavicke ponuky — pridane zaskrtavacie pole
--    na jeho vypnutie (default zapnute = zachovava sucasne spravanie pre firmy bez textu v logu).
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table quote_companies add column if not exists zobrazit_nazov_pri_logu boolean not null default true;
