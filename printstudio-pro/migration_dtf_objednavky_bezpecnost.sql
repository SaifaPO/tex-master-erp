-- ============================================================
-- MIGRÁCIA: DTF metráž — zatvorenie zbytočnej verejnej "insert" politiky
-- Od refaktoru na Shopify Draft Order (Edge Function `dtf-metraz-create-draft-order`) už
-- KLIENT nikdy nezapisuje do `dtf_objednavky` priamo — zápis robí výhradne Edge Function cez
-- SERVICE ROLE kľúč, ktorý RLS politiky úplne obchádza. Stará politika "verejne vytvorenie dtf
-- objednavky" (for insert with check (true)) je teda už len zbytočná diera: ktokoľvek s verejným
-- anon kľúčom (ten je v appke vždy viditeľný) by mohol vkladať vymyslené objednávky priamo do
-- tabuľky bez zaplatenia a bez prepočtu ceny — reálne peniaze/Shopify objednávka by tým nevznikli,
-- ale falošné riadky by zaplnili admin frontu objednávok.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

drop policy if exists "verejne vytvorenie dtf objednavky" on dtf_objednavky;
