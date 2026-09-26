-- Cenove ponuky teraz citaju podpisujuceho VZDY z prihlaseneho zamestnanca (meno, telefon, email
-- uz existujuce polia + firma - uz existujuci stlpec employees.company - ATAK/PBT/ADY), nie z
-- fixneho "podpisu firmy". Operacna "pozicia" zamestnanca (napr. "Vyrobny majster") sa ale casto
-- LISI od titulu, akym ma niekto podpisovat oficialne cenove ponuky (napr. konatel) — preto novy
-- volitelny stlpec: ak je vyplneny, pouzije sa namiesto position len pre cenove ponuky.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table employees add column if not exists titul_pre_ponuky text;
