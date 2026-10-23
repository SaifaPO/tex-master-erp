-- Sieťotlač: podiel práce operátora pri fixácii v tuneli.
-- Počas fixácie v tunelovej sušičke operátor tlačí ďalšie kusy, takže sa mu pri fixácii nepočíta celý čas na kus.
-- 50 = polovičný úkon (predvolené), 0 = fixácia sa počíta len elektrinou a amortizáciou tunela, 100 = celý čas ako doteraz.
-- Spusti v Supabase SQL Editore.
alter table cennik_sietotlac add column if not exists fixacia_praca_percent numeric(6,2) not null default 50;
