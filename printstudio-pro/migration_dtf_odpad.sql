-- ============================================================
-- DTF potlac textilu: odpad na rolke (%), jedno % pre vsetky velkosti log. Pripocitava sa len k transferu
-- (medzery medzi logami, okraje pasu). Predvolene 13 % (Martinov priklad: 30x logo 33x25cm = 5 bm).
-- Bezpecne spustit opakovane.
-- ============================================================

alter table dtf_naklady add column if not exists odpad_percent numeric default 13;
update dtf_naklady set odpad_percent = 13 where odpad_percent is null;
