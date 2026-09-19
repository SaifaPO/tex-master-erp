-- ============================================================
-- MIGRÁCIA: Oprava mazania objednávok v DTF/Textilnej metráži
-- Pôvodné migrácie (migration_dtf_metraz.sql, migration_textil_metraz.sql) vytvorili pre
-- dtf_objednavky/textil_objednavky politiky na CÍTANIE a ÚPRAVU pre prihlásených adminov,
-- ale zabudli na politiku pre MAZANIE. Kliknutie "Zmazať" v admin tabuľke preto Supabase
-- potichu odmietol (RLS bez chyby zobrazenej v appke) — riadok v databáze ostal a po
-- ďalšom načítaní/refreshi sa "vymazaná" objednávka znova objavila.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

drop policy if exists "admin mazanie dtf objednaviek" on dtf_objednavky;
create policy "admin mazanie dtf objednaviek" on dtf_objednavky for delete using (auth.role() = 'authenticated');

drop policy if exists "admin mazanie textil objednaviek" on textil_objednavky;
create policy "admin mazanie textil objednaviek" on textil_objednavky for delete using (auth.role() = 'authenticated');
