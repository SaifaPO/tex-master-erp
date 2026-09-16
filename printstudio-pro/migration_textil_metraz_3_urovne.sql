-- ============================================================
-- MIGRÁCIA: Textilná metráž — 3 úrovne služby s rozdielnou maržou
-- 1. Sublimácia na VÁŠ materiál (zákazník dodá látku, platí len za potlač) — marža ZÁKLAD + 10 bodov
--    (doteraz to bol predvolený stav bez bonusu — teraz má vyššiu maržu, keďže sa nepredáva látka).
-- 2. Sublimácia na NÁŠ materiál (predávame aj látku aj potlač) — marža ostáva ZÁKLADNÁ (nezmenené).
-- 3. Sublimačný papier s vlastnou grafikou (NOVÉ — žiadna látka, žiadne nažehlenie, zákazník si to
--    prevedie sám) — marža ZÁKLAD + 20 bodov, len pre technológiu "sublimacia" (bavlna nemá zmysel,
--    tam sa tlačí priamo na látku, netlačí sa medzištep cez papier).
-- Presné bonusové hodnoty (+10 / +20 percentuálnych bodov k marži z Cenotvorby) sú nastavené priamo
-- v kóde (TextilMetraz.jsx aj textil-metraz-create-draft-order), nie v DB — ak ich budeš chcieť
-- neskôr meniť bez zásahu do kódu, dá sa to presunúť do pricing_config.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

alter table textil_objednavky add column if not exists sluzba_rezim text;
