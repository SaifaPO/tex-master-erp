-- Katalóg Modelov: prílohy k modelu (napr. rozmerové tabuľky, PDF) + alternatívne/náhradné
-- materiály pre jednotlivé vrstvy (Primárna/Sekundárna/Terciárna látka).
--
-- Prílohy: nový stĺpec "attachments" (JSONB pole objektov {id, url, fileName, mimeType, uploadedAt}).
-- Súbory sa ukladajú do už existujúceho Storage bucketu "item-attachments" (priečinok product-docs/),
-- rovnako ako rozpisy položiek zákazky — netreba zakladať nový bucket.
--
-- Alternatívne materiály: layer1/layer2/layer3 (JSONB stĺpce) už majú vo svojej štruktúre pole
-- "alternativeIds" (doteraz vždy prázdne, appka ho nikdy nenapĺňala) — na to netreba žiadnu zmenu
-- schémy, len appka teraz vie toto pole naplniť a pri tvorbe zákazky ho použiť na obmedzenie výberu.
--
-- Bezpečné spustiť opakovane (idempotentné), nič nemaže existujúce dáta.

alter table products add column if not exists attachments jsonb not null default '[]'::jsonb;
