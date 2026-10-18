-- ============================================================
-- FAKTURÁCIA V ERP: dobropisy, zálohové faktúry, jazyk dokladu (SK/EN), kontaktné údaje dodávateľa pre e-faktúru.
-- Bezpečné spustiť opakovane. Spusti PRED používaním nových tlačidiel (Vystaviť dobropis, Zálohová faktúra, jazyk dokladu).
-- ============================================================

-- Typ dokladu: faktura | dobropis | zalohova (zálohová faktúra / proforma — nie je daňový doklad)
alter table invoices add column if not exists doc_type text not null default 'faktura';
alter table invoices add column if not exists related_invoice_id text;       -- dobropis -> pôvodná faktúra; konečná faktúra -> zálohová faktúra
alter table invoices add column if not exists related_invoice_number text;
alter table invoices add column if not exists credit_reason text;            -- dôvod dobropisu
alter table invoices add column if not exists advance_paid numeric(12,2) not null default 0;  -- už uhradená záloha (odpočíta sa z konečnej faktúry)
alter table invoices add column if not exists language text not null default 'sk';            -- jazyk dokladu: sk | en

-- Samostatné číselné rady pre dobropisy (DB…) a zálohové faktúry (ZF…)
alter table company_settings add column if not exists next_credit_note_number int not null default 1;
alter table company_settings add column if not exists next_proforma_number int not null default 1;

-- Kontakt dodávateľa (použije sa na doklade a v elektronickej faktúre)
alter table company_settings add column if not exists email text;
alter table company_settings add column if not exists phone text;
